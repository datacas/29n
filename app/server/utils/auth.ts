import { query } from '~/server/utils/db'

export interface AdminIdentity {
  sessionId: string
  credentialId: string
}

/**
 * Require admin authentication. Throws 401 if not authenticated.
 * Devuelve la identidad (sesión y credencial) para poder atribuir acciones a una persona concreta;
 * los usos anteriores, que ignoran el valor devuelto, siguen funcionando igual.
 */
export async function requireAdmin(event: any): Promise<AdminIdentity> {
  const sessionToken = getCookie(event, 'admin_session')
  if (!sessionToken) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  const { rows: sessions } = await query(`
    SELECT id, credential_id, expires_at FROM admin_sessions WHERE session_token = $1 LIMIT 1
  `, [sessionToken])

  if (sessions.length === 0 || new Date(sessions[0].expires_at) < new Date()) {
    throw createError({ statusCode: 401, statusMessage: 'Sesión inválida o expirada' })
  }
  return { sessionId: sessions[0].id, credentialId: sessions[0].credential_id }
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
