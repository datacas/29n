import { requireAdmin } from '~/server/utils/auth'
import { getSource } from '~/server/utils/repositories/sources'
import { createDocumentJob, updateDocumentJob, insertPassages, updateSourceStatus } from '~/server/utils/repositories/sources'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'

const execFileAsync = promisify(execFile)

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID de fuente requerido' })

  const source = await getSource(id)
  if (!source) throw createError({ statusCode: 404, statusMessage: 'Fuente no encontrada' })

  if (!existsSync(source.storage_path)) {
    throw createError({ statusCode: 400, statusMessage: 'Archivo no encontrado en disco' })
  }

  // Create document job
  const job = await createDocumentJob(id)
  await updateDocumentJob(job.id, { status: 'extracting' })

  try {
    // Run Python extraction
    const workerPath = './services/document-worker/extract_pdf.py'
    const { stdout } = await execFileAsync('python3', [workerPath, source.storage_path, '--tables'], {
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024
    })

    const result = JSON.parse(stdout)

    // Insert passages from pages
    const passages = result.pages.map((page: any) => ({
      source_id: id,
      page: page.page_number,
      literal_text: page.text,
      normalized_text: page.text?.trim()
    })).filter((p: any) => p.literal_text && p.literal_text.length > 0)

    await insertPassages(passages)

    await updateDocumentJob(job.id, {
      status: 'extracted',
      metadata: {
        total_pages: result.total_pages,
        total_chars: result.total_chars,
        passages_count: passages.length,
        metadata: result.metadata
      }
    })

    // Update source status
    await updateSourceStatus(id, 'parsed')

    return {
      success: true,
      job: job.id,
      passages_count: passages.length,
      total_pages: result.total_pages
    }
  } catch (error: any) {
    await updateDocumentJob(job.id, {
      status: 'failed_pdf',
      error_message: error.message || 'Extracción fallida'
    })
    throw createError({ statusCode: 500, statusMessage: 'Error al extraer el documento', cause: error.message })
  }
})
