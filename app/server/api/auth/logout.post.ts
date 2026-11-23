import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, 'admin_session')

  if (sessionToken) {
    await query(`DELETE FROM admin_sessions WHERE session_token = $1`, [sessionToken])
  }

  deleteCookie(event, 'admin_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  })

  return { success: true, message: 'Sesión cerrada' }
})
