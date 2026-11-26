import { requireAdmin } from '~/server/utils/auth'
import { getDbPool } from '~/server/utils/db'
import { EvalError, resolveEvaluator } from '~/server/utils/evaluation'

/** Autentica al administrador, resuelve su identidad de evaluador y traduce los errores de dominio a respuestas HTTP. */
export async function withEvaluator<T>(event: any, fn: (ctx: { pool: ReturnType<typeof getDbPool>; evaluator: Awaited<ReturnType<typeof resolveEvaluator>> }) => Promise<T>): Promise<T> {
  const identity = await requireAdmin(event)
  const pool = getDbPool()
  try {
    const evaluator = await resolveEvaluator(pool, identity.credentialId)
    return await fn({ pool, evaluator })
  } catch (e) {
    if (e instanceof EvalError) {
      throw createError({ statusCode: e.status, statusMessage: e.message, data: e.extra })
    }
    throw e
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function uuidParam(event: any, name: string): string {
  const v = getRouterParam(event, name) ?? ''
  if (!UUID.test(v)) throw createError({ statusCode: 400, statusMessage: 'Identificador no válido' })
  return v
}
