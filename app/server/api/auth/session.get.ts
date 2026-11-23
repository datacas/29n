import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, 'admin_session')

  if (!sessionToken) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  const { rows } = await query(`
    SELECT id, expires_at FROM admin_sessions
    WHERE session_token = $1
    LIMIT 1
  `, [sessionToken])

  if (rows.length === 0) {
    throw createError({ statusCode: 401, statusMessage: 'Sesión inválida' })
  }

  const session = rows[0]
  if (new Date(session.expires_at) < new Date()) {
    // Expired session - clean up
    await query(`DELETE FROM admin_sessions WHERE id = $1`, [session.id])
    throw createError({ statusCode: 401, statusMessage: 'Sesión expirada' })
  }

  return { authenticated: true }
})
