export interface EmailAdapter {
  sendOtp(email: string, code: string): Promise<void>
}

export class BrevoAdapter implements EmailAdapter {
  constructor(
    private apiKey: string,
    private senderEmail: string,
    private senderName: string
  ) {}

  async sendOtp(email: string, code: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Brevo API key not configured')
    }
    if (!this.senderEmail) {
      throw new Error('Brevo sender email not configured')
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': this.apiKey
      },
      body: JSON.stringify({
        sender: {
          email: this.senderEmail,
          name: this.senderName || 'Admin'
        },
        to: [{ email }],
        subject: 'Código de acceso administrativo',
        textContent: `Tu código de acceso es: ${code}. Válido durante 10 minutos. Si no has solicitado este código, ignora este mensaje.`
      })
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Brevo API error ${response.status}: ${text}`)
    }
  }
}

export class MockEmailAdapter implements EmailAdapter {
  private codes: Map<string, string> = new Map()

  async sendOtp(email: string, code: string): Promise<void> {
    this.codes.set(email, code)
    console.log(`[MOCK EMAIL] OTP for ${email}: ${code}`)
  }

  getCode(email: string): string | undefined {
    return this.codes.get(email)
  }
}

export function createEmailAdapter(): EmailAdapter {
  const config = useRuntimeConfig()
  const apiKey = config.brevoApiKey as string
  const senderEmail = config.brevoSenderEmail as string
  const senderName = (config.brevoSenderName as string) || 'Admin'

  if (!apiKey || !senderEmail) {
    console.warn('Brevo not configured, using mock email adapter')
    return new MockEmailAdapter()
  }

  return new BrevoAdapter(apiKey, senderEmail, senderName)
}
