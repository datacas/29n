/**
 * Integration tests for repositories against real PostgreSQL 17.
 * These tests verify that all SQL queries work correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'

let pool: Pool

beforeAll(() => {
  // Base de datos de PRUEBAS, separada de la real (estos tests insertan y borran filas).
  // Crear con: docker exec 29n-db-1 psql -U app -d postgres -c "CREATE DATABASE affinity_test"
  // y aplicar db/migrations/*.sql y db/seeds/001_dimensions.sql.
  pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity_test',
  })
})

afterAll(async () => {
  await pool.end()
})

async function query(text: string, params?: unknown[]) {
  return pool.query(text, params)
}

describe('Integration: Entities repository', () => {
  it('should create and list entities', async () => {
    const { rows: [created] } = await query(`
      INSERT INTO entities (name, type, is_historical)
      VALUES ('Test Party Integration', 'party', false)
      RETURNING id, name, type, is_historical
    `)
    expect(created).toBeDefined()
    expect(created.name).toBe('Test Party Integration')
    expect(created.type).toBe('party')

    const { rows: list } = await query(`
      SELECT id, name, type, is_historical FROM entities
      WHERE name = 'Test Party Integration'
      ORDER BY is_historical DESC, name
    `)
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list[0].name).toBe('Test Party Integration')

    // Cleanup
    await query('DELETE FROM entities WHERE name = $1', ['Test Party Integration'])
  })

  it('should update entity fields', async () => {
    const { rows: [created] } = await query(`
      INSERT INTO entities (name, type) VALUES ('Update Test', 'party')
      RETURNING id
    `)
    await query('UPDATE entities SET name = $1 WHERE id = $2', ['Updated Name', created.id])
    const { rows: [updated] } = await query(
      'SELECT name FROM entities WHERE id = $1', [created.id]
    )
    expect(updated.name).toBe('Updated Name')
    await query('DELETE FROM entities WHERE id = $1', [created.id])
  })

  it('should delete entity', async () => {
    const { rows: [created] } = await query(`
      INSERT INTO entities (name, type) VALUES ('Delete Test', 'party')
      RETURNING id
    `)
    await query('DELETE FROM entities WHERE id = $1', [created.id])
    const { rows } = await query('SELECT id FROM entities WHERE id = $1', [created.id])
    expect(rows.length).toBe(0)
  })
})

describe('Integration: Sources repository', () => {
  it('should create a source linked to an entity', async () => {
    // Create entity first
    const { rows: [entity] } = await query(`
      INSERT INTO entities (name, type) VALUES ('Source Test Entity', 'party')
      RETURNING id
    `)

    const { rows: [source] } = await query(`
      INSERT INTO sources (entity_id, title, type, storage_path, language)
      VALUES ($1, 'Test Program', 'program', './storage/test.pdf', 'es')
      RETURNING id, entity_id, title, status
    `, [entity.id])

    expect(source).toBeDefined()
    expect(source.entity_id).toBe(entity.id)
    expect(source.status).toBe('uploaded')

    // Update status
    await query('UPDATE sources SET status = $1 WHERE id = $2', ['parsed', source.id])
    const { rows: [updated] } = await query(
      'SELECT status FROM sources WHERE id = $1', [source.id]
    )
    expect(updated.status).toBe('parsed')

    // Cleanup
    await query('DELETE FROM sources WHERE id = $1', [source.id])
    await query('DELETE FROM entities WHERE id = $1', [entity.id])
  })

  it('should list sources with entity join', async () => {
    const { rows: [entity] } = await query(`
      INSERT INTO entities (name, type) VALUES ('Join Test Entity', 'party')
      RETURNING id
    `)
    await query(`
      INSERT INTO sources (entity_id, title, type, storage_path, language)
      VALUES ($1, 'Join Test', 'program', './storage/join.pdf', 'es')
    `, [entity.id])

    const { rows } = await query(`
      SELECT s.id, s.title, e.name AS entity_name
      FROM sources s
      JOIN entities e ON e.id = s.entity_id
      WHERE s.title = 'Join Test'
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].entity_name).toBe('Join Test Entity')

    // Cleanup
    await query("DELETE FROM sources WHERE title = 'Join Test'")
    await query("DELETE FROM entities WHERE name = 'Join Test Entity'")
  })
})

describe('Integration: Taxonomy repository', () => {
  it('should list seeded dimensions', async () => {
    const { rows } = await query('SELECT id, code, name FROM dimensions ORDER BY code')
    expect(rows.length).toBeGreaterThanOrEqual(6)
    const codes = rows.map(r => r.code)
    expect(codes).toContain('economy')
    expect(codes).toContain('social')
  })

  it('should list seeded topics', async () => {
    const { rows } = await query('SELECT id, code, name FROM topics ORDER BY code')
    expect(rows.length).toBeGreaterThanOrEqual(12)
  })

  it('should create a new topic', async () => {
    const { rows: [dim] } = await query("SELECT id FROM dimensions WHERE code = 'economy'")
    const { rows: [topic] } = await query(`
      INSERT INTO topics (dimension_id, name, code)
      VALUES ($1, 'Integration Test Topic', 'integration_test')
      RETURNING id, code
    `, [dim.id])
    expect(topic.code).toBe('integration_test')
    await query("DELETE FROM topics WHERE code = 'integration_test'")
  })
})

describe('Integration: Questions repository', () => {
  it('should create a question with topic', async () => {
    const { rows: [topic] } = await query("SELECT id FROM topics WHERE code = 'economy.fiscal'")
    const { rows: [question] } = await query(`
      INSERT INTO questions (topic_id, canonical_text, answer_type, depth_level, status)
      VALUES ($1, 'Integration test question', 'scale', 1, 'draft')
      RETURNING id, topic_id, status
    `, [topic.id])
    expect(question).toBeDefined()
    expect(question.status).toBe('draft')
    await query('DELETE FROM questions WHERE id = $1', [question.id])
  })

  it('should filter questions by status', async () => {
    const { rows: [topic] } = await query("SELECT id FROM topics WHERE code = 'economy.fiscal'")
    await query(`
      INSERT INTO questions (topic_id, canonical_text, answer_type, status)
      VALUES ($1, 'Published Q', 'scale', 'published')
    `, [topic.id])
    await query(`
      INSERT INTO questions (topic_id, canonical_text, answer_type, status)
      VALUES ($1, 'Draft Q', 'scale', 'draft')
    `, [topic.id])

    const { rows: published } = await query(
      "SELECT id FROM questions WHERE status = 'published' AND canonical_text = 'Published Q'"
    )
    expect(published.length).toBe(1)

    const { rows: drafts } = await query(
      "SELECT id FROM questions WHERE status = 'draft' AND canonical_text = 'Draft Q'"
    )
    expect(drafts.length).toBe(1)

    // Cleanup
    await query("DELETE FROM questions WHERE canonical_text IN ('Published Q', 'Draft Q')")
  })
})

describe('Integration: Positions repository', () => {
  it('should create a position with review_status and stance_status', async () => {
    const { rows: [entity] } = await query(`
      INSERT INTO entities (name, type) VALUES ('Position Test Entity', 'party')
      RETURNING id
    `)
    const { rows: [topic] } = await query("SELECT id FROM topics WHERE code = 'economy.fiscal'")
    const { rows: [question] } = await query(`
      INSERT INTO questions (topic_id, canonical_text, answer_type, status)
      VALUES ($1, 'Position test question', 'scale', 'published')
      RETURNING id
    `, [topic.id])

    const { rows: [position] } = await query(`
      INSERT INTO positions (entity_id, question_id, value, review_status, stance_status)
      VALUES ($1, $2, 1, 'approved', 'approved')
      RETURNING id, review_status, stance_status
    `, [entity.id, question.id])

    expect(position.review_status).toBe('approved')
    expect(position.stance_status).toBe('approved')

    // Verify review_status and stance_status are independent
    await query(`
      UPDATE positions SET stance_status = 'conditional' WHERE id = $1
    `, [position.id])
    const { rows: [updated] } = await query(
      'SELECT review_status, stance_status FROM positions WHERE id = $1', [position.id]
    )
    expect(updated.review_status).toBe('approved')
    expect(updated.stance_status).toBe('conditional')

    // Cleanup
    await query('DELETE FROM positions WHERE id = $1', [position.id])
    await query('DELETE FROM questions WHERE id = $1', [question.id])
    await query("DELETE FROM entities WHERE name = 'Position Test Entity'")
  })

  it('should calculate coverage matrix', async () => {
    // Setup: entity + questions in different dimensions
    const { rows: [entity] } = await query(`
      INSERT INTO entities (name, type) VALUES ('Coverage Test', 'party')
      RETURNING id
    `)

    const { rows: [topic1] } = await query("SELECT id FROM topics WHERE code = 'economy.fiscal'")
    const { rows: [topic2] } = await query("SELECT id FROM topics WHERE code = 'social.health'")

    const { rows: [q1] } = await query(`
      INSERT INTO questions (topic_id, canonical_text, answer_type, status)
      VALUES ($1, 'Coverage Q1', 'scale', 'published')
      RETURNING id
    `, [topic1.id])
    const { rows: [q2] } = await query(`
      INSERT INTO questions (topic_id, canonical_text, answer_type, status)
      VALUES ($1, 'Coverage Q2', 'scale', 'published')
      RETURNING id
    `, [topic2.id])

    // Create position for q1 only (partial coverage)
    await query(`
      INSERT INTO positions (entity_id, question_id, value, review_status, stance_status)
      VALUES ($1, $2, 1, 'approved', 'approved')
    `, [entity.id, q1.id])

    // Check coverage: 1 of 2 questions covered = 50%
    const { rows: [coverage] } = await query(`
      SELECT
        e.id AS entity_id,
        e.name AS entity_name,
        COUNT(p.id) AS total_positions,
        (SELECT COUNT(*) FROM questions q WHERE q.status = 'published') AS total_questions,
        ROUND(
          COUNT(p.id)::numeric /
          NULLIF((SELECT COUNT(*) FROM questions q WHERE q.status = 'published'), 0) * 100,
          1
        ) AS coverage_pct
      FROM entities e
      LEFT JOIN positions p ON p.entity_id = e.id
      LEFT JOIN questions q ON q.id = p.question_id AND q.status = 'published'
      WHERE e.id = $1
      GROUP BY e.id, e.name
    `, [entity.id])

    expect(Number(coverage.total_positions)).toBe(1)
    expect(Number(coverage.coverage_pct)).toBeGreaterThan(0)

    // Cleanup
    await query('DELETE FROM positions WHERE entity_id = $1', [entity.id])
    await query('DELETE FROM questions WHERE id IN ($1, $2)', [q1.id, q2.id])
    await query("DELETE FROM entities WHERE name = 'Coverage Test'")
  })
})

describe('Integration: Claims repository', () => {
  it('should create and update claims', async () => {
    const { rows: [entity] } = await query(`
      INSERT INTO entities (name, type) VALUES ('Claim Test Entity', 'party')
      RETURNING id
    `)
    const { rows: [source] } = await query(`
      INSERT INTO sources (entity_id, title, type, storage_path, language)
      VALUES ($1, 'Claim Test Source', 'program', './storage/claim.pdf', 'es')
      RETURNING id
    `, [entity.id])

    const { rows: [claim] } = await query(`
      INSERT INTO claims (source_id, literal_text, normalized_text, status)
      VALUES ($1, 'Test literal text', 'Test normalized text', 'ready_for_batch')
      RETURNING id, status
    `, [source.id])

    expect(claim.status).toBe('ready_for_batch')

    // Update status
    await query("UPDATE claims SET status = 'approved' WHERE id = $1", [claim.id])
    const { rows: [updated] } = await query(
      'SELECT status FROM claims WHERE id = $1', [claim.id]
    )
    expect(updated.status).toBe('approved')

    // Cleanup
    await query('DELETE FROM claims WHERE id = $1', [claim.id])
    await query('DELETE FROM sources WHERE id = $1', [source.id])
    await query("DELETE FROM entities WHERE name = 'Claim Test Entity'")
  })

  it('should batch update claims', async () => {
    const { rows: [entity] } = await query(`
      INSERT INTO entities (name, type) VALUES ('Batch Test Entity', 'party')
      RETURNING id
    `)
    const { rows: [source] } = await query(`
      INSERT INTO sources (entity_id, title, type, storage_path, language)
      VALUES ($1, 'Batch Test', 'program', './storage/batch.pdf', 'es')
      RETURNING id
    `, [entity.id])

    // Create multiple claims
    const { rows: claims } = await query(`
      INSERT INTO claims (source_id, literal_text, normalized_text, status)
      VALUES
        ($1, 'Batch claim 1', 'Batch norm 1', 'ready_for_batch'),
        ($1, 'Batch claim 2', 'Batch norm 2', 'ready_for_batch'),
        ($1, 'Batch claim 3', 'Batch norm 3', 'ready_for_batch')
      RETURNING id
    `, [source.id])

    expect(claims.length).toBe(3)

    // Batch update
    const ids = claims.map(c => c.id)
    await query(`
      UPDATE claims SET status = 'approved'
      WHERE id = ANY($1::uuid[])
    `, [ids])

    const { rows: updated } = await query(
      'SELECT status FROM claims WHERE id = ANY($1::uuid[])', [ids]
    )
    expect(updated.every(r => r.status === 'approved')).toBe(true)

    // Cleanup
    await query('DELETE FROM claims WHERE source_id = $1', [source.id])
    await query('DELETE FROM sources WHERE id = $1', [source.id])
    await query("DELETE FROM entities WHERE name = 'Batch Test Entity'")
  })
})

describe('Integration: Document jobs', () => {
  it('should create and update document jobs', async () => {
    const { rows: [entity] } = await query(`
      INSERT INTO entities (name, type) VALUES ('Job Test Entity', 'party')
      RETURNING id
    `)
    const { rows: [source] } = await query(`
      INSERT INTO sources (entity_id, title, type, storage_path, language)
      VALUES ($1, 'Job Test', 'program', './storage/job.pdf', 'es')
      RETURNING id
    `, [entity.id])

    const { rows: [job] } = await query(`
      INSERT INTO document_jobs (source_id, status)
      VALUES ($1, 'pending')
      RETURNING id, status
    `, [source.id])

    expect(job.status).toBe('pending')

    // Update to extracting
    await query(`
      UPDATE document_jobs SET status = 'extracting', started_at = NOW()
      WHERE id = $1
    `, [job.id])

    // Update to completed with metadata
    await query(`
      UPDATE document_jobs SET status = 'completed', completed_at = NOW(),
      metadata = '{"total_pages": 10, "total_claims": 25}'::jsonb
      WHERE id = $1
    `, [job.id])

    const { rows: [final] } = await query(
      'SELECT status, metadata FROM document_jobs WHERE id = $1', [job.id]
    )
    expect(final.status).toBe('completed')
    expect(final.metadata.total_pages).toBe(10)

    // Cleanup
    await query('DELETE FROM document_jobs WHERE id = $1', [job.id])
    await query('DELETE FROM sources WHERE id = $1', [source.id])
    await query("DELETE FROM entities WHERE name = 'Job Test Entity'")
  })
})

describe('Integration: Release immutability', () => {
  it('should verify release triggers exist', async () => {
    // Check that triggers on survey_releases exist
    const { rows: triggers } = await query(`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'survey_releases'::regclass
    `)
    expect(triggers.length).toBeGreaterThan(0)
  })

  it('should prevent publishing without manifest', async () => {
    // Use unique slug to avoid conflicts with previous test runs
    const uniqueId = randomUUID().slice(0, 8)
    const slug = `test-consultation-${uniqueId}`
    const version = `test-${uniqueId}-1.0`

    // Create a consultation first (required by schema), ignore if exists
    await query(`
      INSERT INTO consultations (slug, title, category, base_locale)
      VALUES ($1, 'Test Consultation', 'politics', 'es')
      ON CONFLICT (slug) DO NOTHING
    `, [slug])

    const { rows: [consultation] } = await query(
      'SELECT id FROM consultations WHERE slug = $1', [slug]
    )

    // Create a draft release
    const { rows: [draft] } = await query(`
      INSERT INTO survey_releases (consultation_id, version, status)
      VALUES ($1, $2, 'draft')
      RETURNING id
    `, [consultation.id, version])

    // Try to publish without manifest (should fail via trigger)
    try {
      await query(`
        UPDATE survey_releases SET status = 'published' WHERE id = $1
      `, [draft.id])
      // If no error, the trigger exists but may allow it - check constraints
      const { rows: [release] } = await query(
        'SELECT manifest_jsonb, manifest_hash FROM survey_releases WHERE id = $1',
        [draft.id]
      )
      // The trigger should have blocked this or required manifest
      expect(release.manifest_jsonb).not.toBeNull()
    } catch (e) {
      // Expected: trigger prevents publishing without manifest
      expect(e.message).toMatch(/manifest|not null/i)
    }

    // Cleanup
    await query('DELETE FROM survey_releases WHERE version = $1', [version])
    await query('DELETE FROM consultations WHERE slug = $1', [slug])
  })
})

describe('Integration: API endpoint permissions', () => {
  // Skip if Nuxt server is not running
  const skipIfNoServer = process.env.NUXT_RUNNING === 'true'
  const baseUrl = process.env.NUXT_BASE_URL || 'http://localhost:3000'

  it.skipIf(!skipIfNoServer)('should require authentication for entities endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/entities`, {
      headers: { 'Accept': 'application/json' },
    })
    expect(res.status).toBe(401)
  }, { timeout: 5000 })

  it.skipIf(!skipIfNoServer)('should require authentication for sources endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/sources`, {
      headers: { 'Accept': 'application/json' },
    })
    expect(res.status).toBe(401)
  }, { timeout: 5000 })

  it.skipIf(!skipIfNoServer)('should require authentication for positions endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/positions`, {
      headers: { 'Accept': 'application/json' },
    })
    expect(res.status).toBe(401)
  }, { timeout: 5000 })

  it.skipIf(!skipIfNoServer)('should require authentication for coverage endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/coverage`, {
      headers: { 'Accept': 'application/json' },
    })
    expect(res.status).toBe(401)
  }, { timeout: 5000 })
})
