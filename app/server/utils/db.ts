import { Pool } from 'pg'

let pool: Pool | null = null

export function getDbPool(): Pool {
  if (!pool) {
    const config = useRuntimeConfig()
    const databaseUrl = (config.databaseUrl as string) || 'postgresql://app:password@localhost:5432/affinity'
    pool = new Pool({
      connectionString: databaseUrl,
      // Serverless: pocas conexiones por instancia (Neon agrupa las conexiones con su pooler)
      max: Number(process.env.DB_POOL_MAX || (process.env.VERCEL ? 3 : 20)),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    })
  }
  return pool
}

export async function query(text: string, params?: unknown[]) {
  const p = getDbPool()
  return p.query(text, params)
}
