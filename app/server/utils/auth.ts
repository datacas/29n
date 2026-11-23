import { query } from '~/server/utils/db'

/**
 * Require admin authentication. Throws 401 if not authenticated.
 */
export async function requireAdmin(event: any): Promise<void> {
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
}

/**
 * Check if admin is authenticated. Returns true/false without throwing.
 */
export async function checkAdmin(event: any): Promise<boolean> {
  try {
    await requireAdmin(event)
    return true
  } catch {
    return false
  }
}
