// IndexedDB wrapper — persistent storage for survey progress and completed sessions
// Supports: in-progress surveys (auto-save), completed sessions (history), export/import

const DB_NAME = 'affinity-platform'
const DB_VERSION = 2
const STORE_NAME = 'survey_sessions'
const PROGRESS_STORE = 'survey_progress'

export interface LocalSurveySession {
  local_id: string
  survey_release_id: string
  scoring_model_version: string
  entities: string[]
  depth_mode: 'quick' | 'normal' | 'deep' | 'total'
  answers: any[]
  weights: any[]
  results?: any[]
  started_at: string
  completed_at?: string
  updated_at: string
  hash: string
}

export interface SurveyProgress {
  release_id: string
  local_id: string
  selectedEntities: string[]
  depthMode: 'quick' | 'normal' | 'deep' | 'total'
  calibrationMode: 'serious' | 'quick' | 'skipped'
  calibrationWeights?: Record<string, number>
  questions: any[]
  answers: Record<string, number>
  skippedQuestions: string[]
  questionImportance: Record<string, 'low' | 'medium' | 'high'>
  currentQuestionIndex: number
  startedAt: string
  updatedAt: string
}

let db: IDBDatabase | null = null

export async function openDb(): Promise<IDBDatabase> {
  if (db) return db
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      // Completed sessions store
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'local_id' })
        store.createIndex('survey_release_id', 'survey_release_id', { unique: false })
        store.createIndex('completed_at', 'completed_at', { unique: false })
      }
      // In-progress survey store (keyed by release_id for single active survey per release)
      if (!database.objectStoreNames.contains(PROGRESS_STORE)) {
        database.createObjectStore(PROGRESS_STORE, { keyPath: 'release_id' })
      }
    }
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }
    request.onerror = () => reject(request.error)
  })
}

// ─── Survey Progress (in-progress surveys) ───

export async function saveProgress(progress: SurveyProgress): Promise<void> {
  const database = await openDb()
  // Sanitize: JSON round-trip to ensure only serializable data (removes Set, Map, functions, etc.)
  const sanitized = JSON.parse(JSON.stringify({
    ...progress,
    // Ensure skippedQuestions is always an array, not a Set
    skippedQuestions: Array.isArray(progress.skippedQuestions)
      ? progress.skippedQuestions
      : Array.from(progress.skippedQuestions as any),
  }))
  return new Promise((resolve, reject) => {
    const tx = database.transaction(PROGRESS_STORE, 'readwrite')
    tx.objectStore(PROGRESS_STORE).put(sanitized)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getProgress(releaseId: string): Promise<SurveyProgress | null> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(PROGRESS_STORE, 'readonly')
    const request = tx.objectStore(PROGRESS_STORE).get(releaseId)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function clearProgress(releaseId: string): Promise<void> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(PROGRESS_STORE, 'readwrite')
    tx.objectStore(PROGRESS_STORE).delete(releaseId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function saveSession(session: LocalSurveySession): Promise<void> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(session)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getSession(localId: string): Promise<LocalSurveySession | null> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(localId)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function getAllSessions(): Promise<LocalSurveySession[]> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function deleteSession(localId: string): Promise<void> {
  const database = await openDb()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(localId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
