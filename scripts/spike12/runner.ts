import type pg from 'pg'
import { costUsd, type JevClient } from '../../app/lib/jev/client.ts'
import { verifyQuote } from '../../app/lib/jev/quote.ts'
import { claudePositionClass, jevPredictedClass, reviewPosition } from '../../app/lib/jev/review.ts'
import { triage } from '../../app/lib/jev/triage.ts'
import type { JevMode, JevVerdict, PositionInput, QuoteStatus, StanceClass, TriageResult } from '../../app/lib/jev/types.ts'
import { loadPageTexts } from './common.ts'

export interface AnalyzedPosition {
  position: PositionInput
  mode: JevMode
  verdict: JevVerdict
  jevClass: StanceClass | null
  claudeClass: StanceClass
  quoteStatuses: QuoteStatus[]
  triage: TriageResult
  latencyMs: number
  inputTokens: number
  costUsd: number
}

/** Llama a Jev, verifica citas y calcula el triaje. Guarda el registro en jev_shadow_reviews. */
export async function analyzeAndStore(
  client: JevClient,
  pool: pg.Pool,
  position: PositionInput,
  mode: JevMode,
  runId: string,
  runKind: 'benchmark' | 'shadow'
): Promise<AnalyzedPosition> {
  const { verdict, result } = await reviewPosition(client, position, mode)
  const pages = loadPageTexts(position.party)
  const quoteStatuses = position.claims.map((c) => verifyQuote(c.literalText, pages, c.sourcePage))
  const claudeClass = claudePositionClass(position)
  const jevClass = jevPredictedClass(verdict)
  const tri = triage({ verdict, claudeClass, quoteStatuses })
  const cost = costUsd(result.usage.input_tokens)

  await pool.query(
    `INSERT INTO jev_shadow_reviews
       (position_id, run_id, run_kind, mode, provider, model, model_returned, decision, verdict,
        claude_class, jev_class, triage_group, triage_reasons, quote_statuses,
        input_tokens, latency_ms, cost_usd)
     VALUES ($1,$2,$3,$4,'typesafe',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      position.positionId, runId, runKind, mode, client.model, result.model,
      JSON.stringify(result.answers), JSON.stringify(verdict),
      claudeClass, jevClass, tri.group, JSON.stringify(tri.reasons), JSON.stringify(quoteStatuses),
      result.usage.input_tokens, result.latencyMs, cost
    ]
  )

  return {
    position, mode, verdict, jevClass, claudeClass, quoteStatuses, triage: tri,
    latencyMs: result.latencyMs, inputTokens: result.usage.input_tokens, costUsd: cost
  }
}

/** Ejecuta tareas con concurrencia limitada. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = next++
        if (i >= items.length) return
        out[i] = await fn(items[i], i)
      }
    })
  )
  return out
}
