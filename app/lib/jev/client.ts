/**
 * Cliente mínimo de la API System One de TypeSafe (llamada directa, sin OpenRouter).
 *
 *   POST https://api.typesafe.ai/v1/systemone
 *   Authorization: Bearer $TYPESAFE_API_KEY
 *   { model, state, questions: { id: { type, instructions, criteria? } } }
 *
 * Referencia: https://docs.typesafe.ai/api
 */
import type { SystemOneAnswer, SystemOneResult } from './types.ts'

export const DEFAULT_BASE_URL = 'https://api.typesafe.ai'
export const DEFAULT_MODEL = 'jev-1.14.0'
/** USD por millón de tokens de entrada (los de salida son gratis). Fuente: docs.typesafe.ai/models */
export const INPUT_PRICE_PER_MTOK = 0.042

export type QuestionSpec =
  | { type: 'noul'; instructions: string }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }

export class JevMissingKeyError extends Error {
  constructor() {
    super('Falta TYPESAFE_API_KEY (o JEV_API_KEY): no se puede llamar a Jev. No se simulan resultados.')
    this.name = 'JevMissingKeyError'
  }
}

export class JevApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(`TypeSafe API ${status}: ${message}`)
    this.name = 'JevApiError'
    this.status = status
  }
}

export interface JevClientOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  timeoutMs?: number
  maxRetries?: number
  fetchImpl?: typeof fetch
}

export class JevClient {
  readonly model: string
  private apiKey: string
  private baseUrl: string
  private timeoutMs: number
  private maxRetries: number
  private fetchImpl: typeof fetch

  constructor(opts: JevClientOptions = {}) {
    const key = opts.apiKey ?? process.env.TYPESAFE_API_KEY ?? process.env.JEV_API_KEY
    if (!key) throw new JevMissingKeyError()
    this.apiKey = key
    this.model = opts.model ?? process.env.JEV_MODEL ?? DEFAULT_MODEL
    this.baseUrl = (opts.baseUrl ?? process.env.TYPESAFE_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.timeoutMs = opts.timeoutMs ?? 30_000
    this.maxRetries = opts.maxRetries ?? 2
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  async systemOne(state: unknown, questions: Record<string, QuestionSpec>): Promise<SystemOneResult> {
    const body = JSON.stringify({ model: this.model, state, questions })
    let lastError: unknown
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const started = Date.now()
      try {
        const res = await this.fetchImpl(`${this.baseUrl}/v1/systemone`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body,
          signal: AbortSignal.timeout(this.timeoutMs)
        })
        const latencyMs = Date.now() - started
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          const err = new JevApiError(res.status, text.slice(0, 300))
          // Reintentar solo errores transitorios
          if (res.status === 429 || res.status >= 500) {
            lastError = err
            await sleep(400 * 2 ** attempt)
            continue
          }
          throw err
        }
        const json = (await res.json()) as {
          model?: string
          answers?: Record<string, SystemOneAnswer>
          usage?: { input_tokens?: number; output_tokens?: number }
        }
        if (!json.answers || typeof json.answers !== 'object') {
          throw new JevApiError(res.status, 'respuesta sin "answers"')
        }
        return {
          model: json.model ?? this.model,
          answers: json.answers,
          usage: {
            input_tokens: json.usage?.input_tokens ?? 0,
            output_tokens: json.usage?.output_tokens ?? 0
          },
          latencyMs
        }
      } catch (e) {
        if (e instanceof JevApiError && e.status < 500 && e.status !== 429) throw e
        lastError = e
        if (attempt < this.maxRetries) await sleep(400 * 2 ** attempt)
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }
}

export function costUsd(inputTokens: number): number {
  return (inputTokens / 1_000_000) * INPUT_PRICE_PER_MTOK
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
