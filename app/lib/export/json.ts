// Export/Import — JSON versioned format with SHA-256 integrity hash
// D-03: schema defined, versioned, reproducible

import type { LocalSurveySession } from '../storage/indexeddb'

export interface ExportPayload {
  version: string
  exported_at: string
  sessions: LocalSurveySession[]
  integrity_hash: string
}

/**
 * Compute SHA-256 hash of a string using the Web Crypto API.
 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const buffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function exportSessions(sessions: LocalSurveySession[]): Promise<string> {
  // Create payload without hash first
  const payloadWithoutHash = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    sessions
  }
  const dataToHash = JSON.stringify(payloadWithoutHash)
  const integrityHash = await sha256(dataToHash)

  const payload: ExportPayload = {
    ...payloadWithoutHash,
    integrity_hash: integrityHash
  }
  return JSON.stringify(payload, null, 2)
}

export async function importSessions(json: string): Promise<LocalSurveySession[]> {
  const payload: ExportPayload = JSON.parse(json)
  
  // Validate version
  if (payload.version !== '1.0.0') {
    throw new Error(`Unsupported export version: ${payload.version}`)
  }
  
  // Validate integrity hash
  const payloadWithoutHash = {
    version: payload.version,
    exported_at: payload.exported_at,
    sessions: payload.sessions
  }
  const expectedHash = await sha256(JSON.stringify(payloadWithoutHash))
  if (payload.integrity_hash !== expectedHash) {
    throw new Error('Integrity check failed: file may be corrupted or tampered')
  }
  
  return payload.sessions
}
