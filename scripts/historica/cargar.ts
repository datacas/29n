/**
 * Carga la encuesta histórica (programas de 1917–1936) en la base local y construye su versión.
 *
 *   node scripts/historica/cargar.ts            → prueba en seco: lo hace todo en una transacción y la deshace
 *   node scripts/historica/cargar.ts --apply    → confirma la carga y deja la versión en borrador
 *   node scripts/historica/cargar.ts --apply --publish  → además la publica (manifiesto + huella)
 *
 * Fuente de verdad: docs/historica/propuestas-y-preguntas.md (preguntas) y docs/historica/citas/*.md (posiciones y citas).
 * Es repetible: actualiza lo que ya existe en lugar de duplicarlo. Una versión publicada nunca se toca.
 *
 * Barandillas para no mezclarse con el 29N:
 *  - entidades con type='historical' (el generador del 29N solo coge type='party');
 *  - preguntas con código H-… y consultation_id de esta encuesta (el generador del 29N las excluye).
 *
 * Notación de las citas → posición: + → 2, − → −2, (+) → 1, (−) → −1 (approved);
 * (−)c → −1 conditional con la condición escrita; ~ → ambiguous (no puntúa).
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { loadReleaseContent } from '../../app/lib/release/content.ts'

const apply = process.argv.includes('--apply')
const publish = process.argv.includes('--publish')
const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const VERSION = arg('version', '1.0.0')
const DOCS = join(process.cwd(), 'docs', 'historica')

const CONSULTATION = {
  slug: 'historia-programas-1917-1936',
  title: 'Programas del siglo XX (1917–1936)',
  description:
    'Compara tu opinión con diez programas de Europa y España entre 1917 y 1936: el bolchevismo, el fascismo italiano, el nazismo y los partidos de la Segunda República. Cada porcentaje se apoya en una cita del texto.',
  metadata: {
    kind: 'historical',
    shortName: '29N Historia',
    entityNoun: { singular: 'programa', plural: 'programas' },
    minEvaluableQuestions: 5
  }
}

// Cuatro bloques, ordenados por su código. Los dos de 3 preguntas oscilan más en el resultado por bloque,
// pero así la calibración distingue régimen, sociedad, economía y trabajo.
const DIMENSIONS = {
  regimen: { code: 'h1-regimen', name: 'Régimen y nación' },
  sociedad: { code: 'h2-sociedad', name: 'Iglesia, escuela y ejército' },
  economia: { code: 'h3-economia', name: 'Propiedad y economía' },
  trabajo: { code: 'h4-trabajo', name: 'Trabajo' }
} as const

const QUESTIONS: Array<{ letter: string; dim: keyof typeof DIMENSIONS; text: string }> = [
  { letter: 'A', dim: 'regimen', text: 'El Parlamento debe elegirse por sufragio universal, votando a partidos.' },
  { letter: 'C', dim: 'regimen', text: 'Hay que romper con el orden constitucional existente y construir un Estado de nuevo tipo.' },
  { letter: 'D', dim: 'regimen', text: 'Las libertades de prensa, reunión y asociación deben valer por igual para todas las ideologías, también para las contrarias al Gobierno.' },
  { letter: 'E', dim: 'regimen', text: 'Las regiones con lengua e identidad propias deben tener autonomía política.' },
  { letter: 'F', dim: 'regimen', text: 'Un país debe aspirar a ampliar su territorio o su influencia imperial.' },
  { letter: 'G', dim: 'economia', text: 'La tierra de los grandes propietarios debe expropiarse sin pagarles indemnización.' },
  { letter: 'H', dim: 'economia', text: 'La banca debe ser pública.' },
  { letter: 'I', dim: 'economia', text: 'Las grandes empresas y los servicios públicos deben estar en manos privadas, no del Estado.' },
  { letter: 'J', dim: 'economia', text: 'Los impuestos deben ser progresivos: quien más tiene paga un porcentaje mayor.' },
  { letter: 'K', dim: 'trabajo', text: 'Los trabajadores deben poder controlar las decisiones de sus empresas.' },
  { letter: 'L', dim: 'trabajo', text: 'Debe prohibirse la huelga en los servicios públicos.' },
  { letter: 'N', dim: 'trabajo', text: 'El Estado debe pagar un subsidio a quien está en paro sin culpa.' },
  { letter: 'O', dim: 'sociedad', text: 'La Iglesia y el Estado deben estar separados, sin religión oficial ni dinero público para el culto.' },
  { letter: 'P', dim: 'sociedad', text: 'Los colegios privados y religiosos deben poder enseñar con libertad, sin que el Estado decida sus contenidos.' },
  { letter: 'U', dim: 'sociedad', text: 'El ejército profesional debe sustituirse por una milicia o un ejército del pueblo.' }
]

// Ficha de contexto de cada programa (sale en la encuesta como descripción). Incluye lo que no es pregunta.
const PROGRAMS: Array<{ code: string; name: string; period: string; country: string; language: string; year: number; url: string; description: string }> = [
  {
    code: 'TESIS17', name: 'Tesis de abril (Lenin)', period: 'Rusia, 1917', country: 'Rusia', language: 'es', year: 1917,
    url: 'https://www.marxists.org/espanol/lenin/obras/1910s/abril.htm',
    description: 'Programa con el que Lenin propuso a los bolcheviques tomar el poder tras la caída del zar. En octubre de 1917 derrocaron al Gobierno Provisional; siguieron una guerra civil y una dictadura de partido único.'
  },
  {
    code: 'PCR19', name: 'Partido Comunista de Rusia', period: 'Rusia soviética, 1919', country: 'Rusia', language: 'en', year: 1919,
    url: 'https://www.marxists.org/history/ussr/government/1919/03/22.htm',
    description: 'Programa del VIII Congreso del partido bolchevique, aprobado en plena guerra civil. Defendía la dictadura del proletariado. La Unión Soviética derivó en una dictadura de partido único y, con Stalin, en represión masiva. También proclamaba la plena igualdad de la mujer, que no es pregunta de esta encuesta.'
  },
  {
    code: 'FASCI19', name: 'Fasci di combattimento', period: 'Italia, 1919', country: 'Italia', language: 'it', year: 1919,
    url: 'https://axl.cefan.ulaval.ca/europe/Italie-manifeste_fasciste-1919.htm',
    description: 'Movimiento fundado por Mussolini en Milán en marzo de 1919. Su primer programa mezclaba reformas sociales radicales (voto de la mujer, jornada de ocho horas, impuesto sobre el capital) con nacionalismo. En 1921 se convirtió en el Partido Nacional Fascista.'
  },
  {
    code: 'PNF21', name: 'Partido Nacional Fascista', period: 'Italia, 1921', country: 'Italia', language: 'it', year: 1921,
    url: 'http://www.instoria.it/home/programma_partito_nazionale_fascista.htm',
    description: 'Partido de Mussolini. Tomó el poder en 1922 tras la Marcha sobre Roma y desde 1925 impuso una dictadura de partido único que duró hasta 1943, con persecución de la oposición, leyes raciales (1938) y alianza con la Alemania nazi.'
  },
  {
    code: 'NSDAP20', name: 'Partido Nazi (NSDAP)', period: 'Alemania, 1920', country: 'Alemania', language: 'de', year: 1920,
    url: 'https://germanhistorydocs.org/de/die-weimarer-republik-1918-1933/programm-der-nationalsozialistischen-deutschen-arbeiterpartei-1920',
    description: 'Programa de 25 puntos presentado por Hitler en Múnich. El partido llegó al poder en 1933 e impuso una dictadura totalitaria responsable de la Segunda Guerra Mundial y del Holocausto. El programa ya negaba la ciudadanía a los judíos y exigía expulsar a los inmigrantes; esos puntos no son preguntas de esta encuesta. Solo se citan fragmentos.'
  },
  {
    code: 'FE34', name: 'Falange Española de las JONS', period: 'España, 1934', country: 'España', language: 'es', year: 1934,
    url: 'https://www.uv.es/Ivorra/Historia/SXX/Falange.html',
    description: 'Partido fascista español fundado por José Antonio Primo de Rivera. En 1937 Franco lo fusionó con los carlistas en el partido único de su dictadura, que adoptó 26 de estos 27 puntos.'
  },
  {
    code: 'BN34', name: 'Bloque Nacional', period: 'España, 1934', country: 'España', language: 'es', year: 1934,
    url: 'https://www.juntadeandalucia.es/sites/default/files/2020-04/La_Segunda_Republica_Espanola.pdf',
    description: 'Coalición monárquica y antirrepublicana dirigida por José Calvo Sotelo. Proponía «la conquista del Estado» y un Estado corporativo sin Parlamento de partidos. Calvo Sotelo fue asesinado en julio de 1936, días antes del golpe militar que abrió la Guerra Civil.'
  },
  {
    code: 'CEDA33', name: 'CEDA', period: 'España, 1933', country: 'España', language: 'es', year: 1933,
    url: 'https://www.boe.es/biblioteca_juridica/pdf/PUB-DH-2023-292.pdf',
    description: 'Confederación de derechas católicas dirigida por Gil Robles. Ganó las elecciones de 1933, apoyó a los gobiernos del Partido Radical y entró en ellos en 1934. Aceptaba la República en la práctica, pero quería revisar la Constitución de 1931. Parte de sus posiciones se apoyan en un resumen académico del programa original (BOE, 2023).'
  },
  {
    code: 'DER33', name: 'Candidatura antimarxista de Madrid', period: 'España, 1933', country: 'España', language: 'es', year: 1933,
    url: 'https://prensahistorica.mcu.es/catalogo_imagenes/grupo.do?path=2001110589',
    description: 'Manifiesto electoral conjunto de la CEDA, los monárquicos y otras derechas en Madrid, firmado entre otros por Gil Robles, Goicoechea y Calvo Sotelo (El Debate, 1 de noviembre de 1933). Es un texto corto: por eso aparece con pocos datos.'
  },
  {
    code: 'FP36', name: "Frente Popular / Front d'Esquerres", period: 'España, 1936', country: 'España', language: 'es', year: 1936,
    url: 'https://www.nodulo.org/bib/drio/193602.htm',
    description: "Coalición de republicanos de izquierda, socialistas, comunistas y otros partidos obreros, con su versión catalana (Front d'Esquerres, con ERC, que añadía el Estatuto). Ganó las elecciones de febrero de 1936; en julio, un golpe militar abrió la Guerra Civil. El propio programa dice que los republicanos rechazaron cuatro medidas que pedían los socialistas: nacionalizar la tierra y la banca, el control obrero y el subsidio de paro."
  }
]

const CONDITION_FP = 'Los partidos republicanos no aceptan esta medida, propuesta por los socialistas y otros partidos obreros de la coalición.'

type Cell = { letter: string; mark: string; quote: string; translation: string | null; where: string }

/** Lee la tabla de un fichero de citas. Columnas: Pregunta | Posición | Cita | Traducción | Dónde. */
function readCitations(code: string): Cell[] {
  const md = readFileSync(join(DOCS, 'citas', `${code.toLowerCase()}.md`), 'utf8')
  const cells: Cell[] = []
  for (const line of md.split('\n')) {
    const m = line.match(/^\| ([A-Z]) \| ([^|]+) \| (.*) \|$/)
    if (!m) continue
    const rest = m[3].split(' | ')
    if (rest.length < 3) throw new Error(`${code}/${m[1]}: fila de citas mal formada`)
    const where = rest.pop()!.trim()
    const translation = rest.pop()!.trim()
    const quote = rest.join(' | ').trim()
    cells.push({
      letter: m[1], mark: m[2].trim(), quote, where,
      translation: /^\((Original en castellano|Paráfrasis)\)$/.test(translation) ? null : translation
    })
  }
  return cells
}

function stance(mark: string): { value: number | null; status: string; conditional: boolean } {
  switch (mark) {
    case '+': return { value: 2, status: 'approved', conditional: false }
    case '−': return { value: -2, status: 'approved', conditional: false }
    case '(+)': return { value: 1, status: 'approved', conditional: false }
    case '(−)': return { value: -1, status: 'approved', conditional: false }
    case '(−)c': return { value: -1, status: 'conditional', conditional: true }
    case '~': return { value: null, status: 'ambiguous', conditional: false }
    default: throw new Error(`Notación desconocida: «${mark}»`)
  }
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity', max: 2 })
const client = await pool.connect()
const q = (sql: string, params?: unknown[]) => client.query(sql, params)

try {
  await q('BEGIN')

  // Encuesta, con sus ajustes en el propio alta (así quedan congelados en el manifiesto)
  const consultationId = (await q(
    `INSERT INTO consultations (slug, title, description, category, base_locale, metadata)
     VALUES ($1,$2,$3,'politics','es',$4::jsonb)
     ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, metadata = EXCLUDED.metadata, updated_at = now()
     RETURNING id`,
    [CONSULTATION.slug, CONSULTATION.title, CONSULTATION.description, JSON.stringify(CONSULTATION.metadata)]
  )).rows[0].id

  // Bloques y un tema por bloque (las preguntas cuelgan de un tema, y el tema de su bloque)
  const topicOf: Record<string, string> = {}
  for (const [key, d] of Object.entries(DIMENSIONS)) {
    const dimId = (await q(
      `INSERT INTO dimensions (name, code, is_scoring_dimension) VALUES ($1,$2,true)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [d.name, d.code]
    )).rows[0].id
    const existing = await q(`SELECT id FROM topics WHERE code = $1`, [d.code])
    topicOf[key] = existing.rows[0]?.id ?? (await q(
      `INSERT INTO topics (name, code, dimension_id, depth) VALUES ($1,$2,$3,1) RETURNING id`, [d.name, d.code, dimId]
    )).rows[0].id
    await q(`UPDATE topics SET name = $2, dimension_id = $3 WHERE id = $1`, [topicOf[key], d.name, dimId])
  }

  // Preguntas H-…
  const questionOf: Record<string, string> = {}
  for (const x of QUESTIONS) {
    const code = `H-${x.letter}`
    const existing = await q(`SELECT id FROM questions WHERE pilot_question_id = $1`, [code])
    if (existing.rows[0]) {
      questionOf[x.letter] = existing.rows[0].id
      await q(`UPDATE questions SET canonical_text = $2, topic_id = $3, consultation_id = $4, status = 'published' WHERE id = $1`,
        [questionOf[x.letter], x.text, topicOf[x.dim], consultationId])
    } else {
      questionOf[x.letter] = (await q(
        `INSERT INTO questions (consultation_id, topic_id, canonical_text, answer_type, depth_level, status, pilot_question_id)
         VALUES ($1,$2,$3,'scale',1,'published',$4) RETURNING id`, [consultationId, topicOf[x.dim], x.text, code]
      )).rows[0].id
    }
  }

  // Programas (entidades históricas), su fuente y sus posiciones
  const entityIds: string[] = []
  const summary: string[] = []
  for (const p of PROGRAMS) {
    const found = await q(`SELECT id FROM entities WHERE name = $1 AND type = 'historical'`, [p.name])
    const entityId = found.rows[0]?.id ?? (await q(
      `INSERT INTO entities (name, type, is_historical) VALUES ($1,'historical',true) RETURNING id`, [p.name]
    )).rows[0].id
    await q(`UPDATE entities SET is_historical = true, period_label = $2, country = $3, description = $4 WHERE id = $1`,
      [entityId, p.period, p.country, p.description])
    entityIds.push(entityId)

    // Fuente: da el título que se muestra bajo cada cita. No se aloja el texto (storage_path es solo una referencia).
    const src = await q(`SELECT id FROM sources WHERE entity_id = $1 AND type = 'program'`, [entityId])
    const srcTitle = `${p.name} (${p.period})`
    if (src.rows[0]) {
      await q(`UPDATE sources SET title = $2, original_url = $3, language = $4, year = $5, status = 'accepted' WHERE id = $1`,
        [src.rows[0].id, srcTitle, p.url, p.language, p.year])
    } else {
      await q(`INSERT INTO sources (entity_id, title, type, original_url, storage_path, language, year, status, license)
               VALUES ($1,$2,'program',$3,$4,$5,$6,'accepted','dominio público o cita con fines informativos')`,
        [entityId, srcTitle, p.url, `historica/${p.code.toLowerCase()}`, p.language, p.year])
    }

    // Posiciones: se reemplazan las de esta entidad en las preguntas de la encuesta
    await q(`DELETE FROM positions WHERE entity_id = $1 AND question_id = ANY($2)`, [entityId, Object.values(questionOf)])
    const cells = readCitations(p.code)
    let evaluable = 0
    for (const c of cells) {
      const questionId = questionOf[c.letter]
      if (!questionId) throw new Error(`${p.code}: la pregunta ${c.letter} no está en el banco`)
      const st = stance(c.mark)
      if (st.value !== null) evaluable++
      const evidence = [{ literal_text: c.quote.replace(/^«|»$/g, ''), translation_es: c.translation, source_page: null, review_status: 'approved', source: 'historica' }]
      await q(
        `INSERT INTO positions (entity_id, question_id, value, stance_status, conditions, evidence_summary, review_status, evidence_jsonb, reviewed_by, reviewed_at)
         VALUES ($1,$2,$3,$4,$5,$6,'approved',$7::jsonb,'historica',now())`,
        [entityId, questionId, st.value, st.status, st.conditional ? CONDITION_FP : null, `Dónde: ${c.where}`, JSON.stringify(evidence)]
      )
    }
    summary.push(`${p.code} ${evaluable}/${cells.length}`)
  }

  // Versión: borrador (o refresco del borrador) con todas las preguntas y programas
  const existing = await q(`SELECT id, status FROM survey_releases WHERE consultation_id = $1 AND version = $2`, [consultationId, VERSION])
  if (existing.rows[0] && existing.rows[0].status !== 'draft') throw new Error(`La versión ${VERSION} ya está ${existing.rows[0].status}: no se toca. Usa --version.`)
  let releaseId: string
  if (existing.rows[0]) {
    releaseId = existing.rows[0].id
    await q(`DELETE FROM release_questions WHERE release_id = $1`, [releaseId])
    await q(`DELETE FROM release_entities WHERE release_id = $1`, [releaseId])
  } else {
    releaseId = (await q(`INSERT INTO survey_releases (consultation_id, version, status, scoring_model_version) VALUES ($1,$2,'draft','1.0.0') RETURNING id`,
      [consultationId, VERSION])).rows[0].id
  }
  for (const id of Object.values(questionOf)) await q(`INSERT INTO release_questions (release_id, question_id) VALUES ($1,$2)`, [releaseId, id])
  for (const id of entityIds) await q(`INSERT INTO release_entities (release_id, entity_id) VALUES ($1,$2)`, [releaseId, id])

  const content = await loadReleaseContent(q as any, releaseId)
  const manifest = {
    version: VERSION,
    scoring_model_version: '1.0.0',
    consultation: { slug: CONSULTATION.slug, title: CONSULTATION.title, description: CONSULTATION.description, settings: CONSULTATION.metadata },
    question_ids: Object.values(questionOf).sort(),
    entity_ids: [...entityIds].sort(),
    content
  }
  const hash = createHash('sha256').update(canonical(manifest)).digest('hex')
  await q(`UPDATE survey_releases SET manifest_jsonb = $2::jsonb, manifest_hash = $3 WHERE id = $1`, [releaseId, JSON.stringify(manifest), hash])
  if (publish) await q(`UPDATE survey_releases SET status = 'published', published_at = now() WHERE id = $1`, [releaseId])

  console.log(`Encuesta ${CONSULTATION.slug} · versión ${VERSION} (${publish ? 'publicada' : 'borrador'}) · release ${releaseId}`)
  console.log(`Preguntas: ${content.questions.length} · programas: ${content.entities.length} · posiciones: ${content.positions.length}`)
  console.log(`Evaluables/total por programa: ${summary.join(' · ')}`)
  console.log(`Huella: ${hash.slice(0, 16)}…`)

  if (apply) {
    await q('COMMIT')
    console.log('Aplicado.')
  } else {
    await q('ROLLBACK')
    console.log('Prueba en seco: no se ha guardado nada (usa --apply).')
  }
} catch (e) {
  await q('ROLLBACK')
  console.error('Error:', (e as Error).message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
