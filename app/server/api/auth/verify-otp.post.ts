import { query } from '~/server/utils/db'
import { verifyOtpCode, generateSessionToken } from '~/server/utils/otp'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = (config.otpSecret as string) || 'change-me-in-production'

  const body = await readBody(event)
  const code = (body?.code as string) || ''
  const attemptToken = (body?.attemptToken as string) || ''

  if (!code || !attemptToken) {
    throw createError({ statusCode: 400, statusMessage: 'Código y token requeridos' })
  }

  // Find the challenge by attempt_token (constant-time safe lookup)
  const { rows } = await query(`
    SELECT id, otp_hash, attempts_remaining, expires_at, used_at, credential_id
    FROM admin_otp_challenges
    WHERE attempt_token = $1
    LIMIT 1
  `, [attemptToken])

  if (rows.length === 0) {
    throw createError({ statusCode: 401, statusMessage: 'Código incorrecto' })
  }

  const challenge = rows[0]

  // Check if already used
  if (challenge.used_at != null) {
    throw createError({ statusCode: 401, statusMessage: 'Código ya utilizado' })
  }

  // Check if expired
  if (new Date(challenge.expires_at) < new Date()) {
    throw createError({ statusCode: 401, statusMessage: 'Código expirado' })
  }

  // Check attempts remaining
  if (challenge.attempts_remaining <= 0) {
    throw createError({ statusCode: 403, statusMessage: 'Demasiados intentos. Solicita un nuevo código.' })
  }

  // Verify code with constant-time comparison
  const isValid = verifyOtpCode(code, challenge.otp_hash, secret)

  if (!isValid) {
    // Decrement attempts
    await query(`
      UPDATE admin_otp_challenges
      SET attempts_remaining = attempts_remaining - 1
      WHERE id = $1
    `, [challenge.id])

    throw createError({ statusCode: 401, statusMessage: 'Código incorrecto' })
  }

  // Mark challenge as used
  await query(`
    UPDATE admin_otp_challenges
    SET used_at = now()
    WHERE id = $1
  `, [challenge.id])

  // Create session
  const sessionToken = generateSessionToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await query(`
    INSERT INTO admin_sessions (credential_id, session_token, expires_at)
    VALUES ($1, $2, $3)
  `, [challenge.credential_id, sessionToken, expiresAt])

  // Set secure cookie
  setCookie(event, 'admin_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60,
    path: '/'
  })

  // Audit log
  await query(`
    INSERT INTO editorial_audit (admin_id, action, description)
    VALUES ($1, 'login', 'Administrador ha iniciado sesión')
  `, ['admin'])

  return { success: true, message: 'Sesión iniciada correctamente' }
})
