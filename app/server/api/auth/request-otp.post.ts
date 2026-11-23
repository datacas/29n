import { query } from '~/server/utils/db'
import { createOtpChallenge, generateSessionToken } from '~/server/utils/otp'
import { createEmailAdapter, MockEmailAdapter } from '~/server/utils/email'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = (config.otpSecret as string) || 'change-me-in-production'
  const adminEmail = (config.adminEmail as string) || ''

  if (!adminEmail) {
    throw createError({ statusCode: 503, statusMessage: 'Admin email not configured' })
  }

  const body = await readBody(event)
  const email = (body?.email as string) || ''

  // Don't reveal if email exists - always return success
  if (email !== adminEmail) {
    return { success: true, message: 'Si la dirección es correcta, se ha enviado un código' }
  }

  // Check rate limit: max 3 requests per 10 minutes
  const { rows: recentChallenges } = await query(`
    SELECT count(*) AS cnt
    FROM admin_otp_challenges
    WHERE credential_id = (SELECT id FROM admin_credentials WHERE email = $1)
      AND expires_at > now()
      AND used_at IS NULL
  `, [email])

  if ((recentChallenges[0]?.cnt as number) >= 3) {
    throw createError({ statusCode: 429, statusMessage: 'Demasiados intentos. Espera unos minutos.' })
  }

  // Get credential ID
  const { rows: creds } = await query(`
    SELECT id FROM admin_credentials WHERE email = $1
  `, [email])

  if (creds.length === 0) {
    // Auto-create credential if it doesn't exist
    await query(`
      INSERT INTO admin_credentials (email) VALUES ($1) ON CONFLICT (email) DO NOTHING
    `, [email])
  }

  const { rows: finalCreds } = await query(`
    SELECT id FROM admin_credentials WHERE email = $1
  `, [email])
  const credentialId = finalCreds[0].id

  // Create OTP challenge
  const { code, challenge } = createOtpChallenge(secret)

  // Store challenge in DB
  await query(`
    INSERT INTO admin_otp_challenges
      (credential_id, challenge_id, otp_hash, attempt_token, max_attempts, attempts_remaining, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    credentialId,
    challenge.challengeId,
    challenge.otpHash,
    challenge.attemptToken,
    challenge.maxAttempts,
    challenge.attemptsRemaining,
    challenge.expiresAt
  ])

  // Send email
  const adapter = createEmailAdapter()
  const isMock = adapter instanceof MockEmailAdapter
  try {
    await adapter.sendOtp(email, code)
  } catch (e) {
    // Log error but don't fail the request - in mock mode this is expected
    console.error('Failed to send OTP email:', e)
  }

  // In mock mode, return the code directly so the user can see it
  if (isMock) {
    console.log(`[MOCK OTP] Código para ${email}: ${code}`)
    return {
      success: true,
      message: `Código de desarrollo (mock): ${code}`,
      attemptToken: challenge.attemptToken,
      code: code,
      isMock: true
    }
  }

  return {
    success: true,
    message: 'Si la dirección es correcta, se ha enviado un código',
    attemptToken: challenge.attemptToken
  }
})
