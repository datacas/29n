// Segunda tanda de correcciones: Q018 (legislación cultural) y Q005 (impuestos de la vivienda), señaladas por falta de dirección y varios objetos. Decididas el 2026-11-26.
// Se dividen por objeto con DIRECCIÓN EXPLÍCITA en cada mitad. Regla de herencia (más estricta que en la primera tanda): solo se hereda una posición si la cita NOMBRA ese objeto y el signo respecto a la nueva dirección es claro; el valor se fija a mano.
// Quedan sin posición (a recodificar) las que citan el objeto solo de forma genérica o con signo mixto. Las originales no se tocan. Simulación por defecto; --apply escribe en BORRADOR (BD local).
import pg from 'pg'
const APPLY = process.argv.includes('--apply')
const SPEC = [
  { pq: 'Q005', halves: [
    { key: 'a', t: '¿Debe aumentarse el IBI a quienes acumulan viviendas o las tienen desocupadas?', c: 'El IBI es el impuesto municipal sobre los inmuebles. Unos quieren recargarlo a quienes tienen muchas viviendas, vacías o turísticas, para frenar la especulación; otros prefieren no tocarlo porque financia a los ayuntamientos.',
      inherit: [['Compromís', 2, /Béns Immobles/], ['Frente Amplio', 2, /IBI/], ['Adelante Andalucía', 1, /IBI/]] },
    { key: 'b', t: '¿Debe reducirse el impuesto de transmisiones patrimoniales en la compra de la primera vivienda?', c: 'Es el impuesto autonómico que se paga al comprar una casa de segunda mano. Unos piden bajarlo o eximirlo para quien compra su primera vivienda; otros prefieren mantenerlo porque financia a las comunidades.',
      inherit: [['Compromís', 1, /Transmissions Patrimonials/], ['PP', 1, /Transmisiones Patrimoniales/], ['PACMA', 1, /Transmisiones Patrimoniales/]] }] },
  { pq: 'Q018', halves: [
    { key: 'a', t: '¿Debe ampliarse el mecenazgo con mayores deducciones fiscales para quien financia cultura?', c: 'El mecenazgo son las ventajas fiscales para personas y empresas que financian cultura. Unos piden ampliarlas; otros prefieren no reducir ingresos públicos o financiar la cultura directamente.',
      inherit: [['PP', 2, /Mecenazgo/], ['Vox', 2, /Mecenazgo/]] },
    { key: 'b', t: '¿Debe reforzarse la protección de los derechos de autor de creadores y editores?', c: 'Los derechos de autor protegen a creadores y editores frente a copias y usos no autorizados. Unos piden reforzarlos; otros piden ampliar las excepciones para usos educativos y científicos.',
      inherit: [['Democracia21', 2, /Derechos de Autor/]] }] }]
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' }); const c = await pool.connect()
try {
  await c.query('BEGIN')
  for (const s of SPEC) {
    const { rows: [o] } = await c.query('SELECT * FROM questions WHERE pilot_question_id = $1', [s.pq])
    if ((await c.query('SELECT 1 FROM questions WHERE pilot_question_id = $1', [s.pq + 'a'])).rowCount) { console.log(s.pq, 'ya dividida'); continue }
    for (const h of s.halves) {
      const { rows: [nq] } = await c.query(`INSERT INTO questions (consultation_id, topic_id, canonical_text, answer_type, options, depth_level, status, pilot_question_id, theme_code, regional_parties, context_text) VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9,$10) RETURNING id`, [o.consultation_id, o.topic_id, h.t, o.answer_type, o.options, o.depth_level, s.pq + h.key, o.theme_code, o.regional_parties, h.c])
      for (const [party, value, rx] of h.inherit) {
        const { rows: [p] } = await c.query(`SELECT p.* FROM positions p JOIN entities e ON e.id = p.entity_id WHERE p.question_id = $1 AND e.name = $2 AND p.review_status = 'approved'`, [o.id, party])
        if (!p) throw new Error(`sin posición origen: ${s.pq} ${party}`)
        const ev = (p.evidence_jsonb ?? []).filter((e) => e.review_status !== 'rejected' && rx.test(`${e.literal_text ?? ''}`)); if (!ev.length) throw new Error(`la cita no nombra el objeto: ${s.pq}${h.key} ${party}`)
        console.log(`${s.pq}${h.key} ${party}: ${p.value} (original) → ${value} · ${ev.length} cita/s`)
        if (APPLY) await c.query(`INSERT INTO positions (entity_id, question_id, claim_id, value, categorical_value, evidence_summary, conditions, review_status, stance_status, evidence_jsonb, reviewed_by, reviewed_at, review_note) VALUES ($1,$2,NULL,$3,NULL,$4,$5,'approved','approved',$6,'correccion-items-ia',now(),$7)`,
          [p.entity_id, nq.id, value, p.evidence_summary, p.conditions, JSON.stringify(ev), `Heredada de la posición ${p.id} de la pregunta ${s.pq} (sin dirección y varios objetos): la cita nombra el objeto y el signo es claro respecto a la nueva dirección; valor fijado a mano (${p.value} → ${value}). Corrección por IA, sin verificación humana.`])
      }
    }
  }
  if (APPLY) { await c.query('COMMIT'); console.log('Aplicado (borrador).') } else { await c.query('ROLLBACK'); console.log('Simulación: no se ha escrito nada.') }
} catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error(e.message); process.exitCode = 1 } finally { c.release(); await pool.end() }
