import { createHash } from 'node:crypto'
import { createReadStream, promises as fs } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { query } from '~/server/utils/db'

const ALLOWED_MIME_TYPES = ['application/pdf']
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const STORAGE_DIR = './storage'

export default defineEventHandler(async (event) => {
  // Check authentication
  const sessionToken = getCookie(event, 'admin_session')
  if (!sessionToken) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  const { rows: sessions } = await query(`
    SELECT id, expires_at FROM admin_sessions WHERE session_token = $1 LIMIT 1
  `, [sessionToken])

  if (sessions.length === 0 || new Date(sessions[0].expires_at) < new Date()) {
    throw createError({ statusCode: 401, statusMessage: 'Sesión inválida o expirada' })
  }

  const files = await readMultipartFormData(event)
  if (!files || files.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No se ha enviado ningún archivo' }
)
  }

  const file = files[0]

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw createError({ statusCode: 400, statusMessage: `Tipo de archivo no permitido: ${file.type}` })
  }

  // Validate size
  if (file.data.length > MAX_FILE_SIZE) {
    throw createError({ statusCode: 400, statusMessage: 'Archivo demasiado grande (máximo 100MB)' })
  }

  // Sanitize filename - prevent path traversal
  const originalName = file.name || 'document'
  const safeName = basename(originalName)
  const ext = extname(safeName) || '.pdf'

  // Calculate SHA-256 hash
  const hash = createHash('sha256')
    .update(file.data)
    .digest('hex')

  // Check for duplicates
  const { rows: existing } = await query(`
    SELECT id FROM sources WHERE sha256_hash = $1 LIMIT 1
  `, [hash])

  if (existing.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Este archivo ya existe en el sistema' })
  }

  // Generate unique storage path
  const timestamp = Date.now()
  const storageName = `${timestamp}-${hash.slice(0, 12)}${ext}`
  const storagePath = join(STORAGE_DIR, storageName)

  // Ensure storage directory exists
  await fs.mkdir(STORAGE_DIR, { recursive: true })

  // Write file
  await fs.writeFile(storagePath, file.data)

  // Get form fields
  const formData = await readBody(event)
  const entity_id = formData?.entity_id as string || ''
  const title = formData?.title as string || originalName
  const type = formData?.type as string || 'program'

  if (!entity_id) {
    throw createError({ statusCode: 400, statusMessage: 'entity_id es requerido' })
  }

  // Create source record
  const { rows: source } = await query(`
    INSERT INTO sources (entity_id, title, type, storage_path, sha256_hash, status)
    VALUES ($1, $2, $3, $4, $5, 'uploaded')
    RETURNING id, title, status, created_at
  `, [entity_id, title, type, storagePath, hash])

  return {
    success: true,
    source: source[0],
    storagePath,
    hash
  }
})
