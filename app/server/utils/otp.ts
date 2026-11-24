import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 10
const MAX_ATTEMPTS = 3
const MAX_REQUESTS_PER_WINDOW = 3
const REQUEST_WINDOW_MINUTES = 10

function generateOtpCode(): string {
  // Generate a 6-digit numeric code
  const bytes = randomBytes(4)
  const num = bytes.readUInt32BE(0)
  return (num % 1000000).toString().padStart(OTP_LENGTH, '0')
}

// Sin OTP_SECRET se usa uno aleatorio por proceso (los códigos caducan al reiniciar), nunca un valor conocido
let ephemeralSecret = ''
export function otpSecret(configured: string | undefined): string {
  if (configured) return configured
  if (!ephemeralSecret) ephemeralSecret = randomBytes(32).toString('hex')
  return ephemeralSecret
}

function hashOtp(otp: string, secret: string): string {
  return createHmac('sha256', secret).update(otp).digest('hex')
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export interface OtpChallenge {
  challengeId: string
  attemptToken: string
  otpHash: string
  expiresAt: Date
  maxAttempts: number
  attemptsRemaining: number
}

export function createOtpChallenge(secret: string): { code: string; challenge: OtpChallenge } {
  const code = generateOtpCode()
  const challengeId = generateToken()
  const attemptToken = generateToken()
  const otpHash = hashOtp(code, secret)

  const challenge: OtpChallenge = {
    challengeId,
    attemptToken,
    otpHash,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    maxAttempts: MAX_ATTEMPTS,
    attemptsRemaining: MAX_ATTEMPTS
  }

  return { code, challenge }
}

export function verifyOtpCode(code: string, otpHash: string, secret: string): boolean {
  const computedHash = hashOtp(code, secret)
  const a = Buffer.from(computedHash, 'utf8')
  const b = Buffer.from(otpHash, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function generateSessionToken(): string {
  return randomBytes(48).toString('hex')
}

export const OTP_CONFIG = {
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  MAX_ATTEMPTS,
  MAX_REQUESTS_PER_WINDOW,
  REQUEST_WINDOW_MINUTES
}
