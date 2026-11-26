// Correcciones de preguntas con DOBLE CONTENIDO (clase A de la primera auditoría), decididas por la persona responsable el 2026-11-26 («la 3, sí hazlo ya»).
// Cada pregunta compuesta se DIVIDE en preguntas de una sola proposición. Las originales NO se modifican (siguen en el release 2.1.2 publicado, congelado). Las nuevas se crean como borrador en la BD LOCAL
// y heredan una posición SOLO si la evidencia citada nombra explícitamente el objeto de la nueva pregunta (términos por mitad); si la evidencia solo habla del objeto de forma genérica, NO se hereda (queda para recodificar).
// Las preguntas señaladas pero NO divididas (el segundo elemento es un ejemplo o instrumento del mismo objeto, regionales con pocos partidos, o sin dirección que no se puede fijar sin inventarla) se listan con su motivo.
//   node scripts/methodology/item_corrections.mjs            # simulación: muestra qué crearía y cuántas posiciones se heredan
//   node scripts/methodology/item_corrections.mjs --apply    # crea las preguntas y posiciones en BORRADOR en la BD local (no publica nada)
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { OUT, ROOT } from './lib.mjs'
const APPLY = process.argv.includes('--apply')
const re = (s) => new RegExp(s, 'i')
// n = número de la pregunta en el release 2.1.2 (orden de la auditoría). halves: texto nuevo, contexto neutral nuevo y términos que identifican su objeto en la evidencia.
const C = [
  { n: 1, halves: [
    { t: '¿Debe aumentarse la presión fiscal sobre los patrimonios elevados?', c: 'Se refiere al impuesto sobre el patrimonio y a las grandes fortunas. Unos piden subirlo; otros temen que expulse capital y ahorro.', k: 'patrimonio|fortuna|riqueza' },
    { t: '¿Debe aumentarse la presión fiscal sobre las empresas?', c: 'Se refiere al impuesto de sociedades y a otros gravámenes a las empresas. Unos piden subirlos; otros prefieren bajarlos para favorecer la inversión.', k: 'sociedades|empresas|beneficios empresariales' }] },
  { n: 10, halves: [
    { t: '¿Debe reducirse la jornada laboral legal por debajo de las 40 horas semanales?', c: 'La jornada legal máxima es de 40 horas semanales. Unos piden reducirla por ley; otros prefieren que se negocie en cada sector.', k: 'jornada|horas semanales|37,5|35 horas' },
    { t: '¿Debe garantizarse que una reducción de la jornada laboral no suponga una bajada de salario?', c: 'Si se reduce la jornada, hay que decidir si el salario se mantiene. Unos defienden mantenerlo por ley; otros dicen que lo decidan empresas y sindicatos.', k: 'sin (reducci[oó]n|merma|p[eé]rdida|baja)[^.]{0,40}salari|manten[^.]{0,40}salari|mismo salario' }] },
  { n: 12, halves: [
    { t: '¿Debe flexibilizarse la normativa de contratación?', c: 'Se refiere a los tipos de contrato y a las condiciones para contratar. Unos piden más flexibilidad para las empresas; otros más protección para quien trabaja.', k: 'contrat' },
    { t: '¿Debe flexibilizarse la normativa de despido?', c: 'Se refiere a las causas y los costes del despido. Unos piden abaratarlo o simplificarlo; otros defienden mantener las garantías actuales.', k: 'despid' }] },
  { n: 21, halves: [
    { t: '¿Debe ampliarse la duración de las prestaciones por desempleo?', c: 'Se refiere a durante cuánto tiempo se cobra el paro. Unos piden alargarlo; otros temen que desincentive buscar empleo.', k: 'duraci|durante m[aá]s|meses de prestaci|tiempo de (cobro|prestaci)' },
    { t: '¿Debe ampliarse la cuantía de las prestaciones por desempleo?', c: 'Se refiere a cuánto se cobra del paro. Unos piden subirla; otros prefieren no encarecer el sistema.', k: 'cuant[ií]a|importe|subir (la|el) (prestaci|subsidio)|aumentar (la|el) (prestaci|subsidio)' }] },
  { n: 23, halves: [
    { t: '¿Debe reducirse la carga fiscal sobre los carburantes?', c: 'Se refiere a los impuestos sobre gasolina y diésel. Unos piden bajarlos para aliviar el gasto; otros defienden mantenerlos por motivos ambientales.', k: 'carburante|gasolina|di[eé]sel|hidrocarburo' },
    { t: '¿Debe reducirse la carga fiscal sobre la electricidad?', c: 'Se refiere al IVA y a otros impuestos de la factura de la luz. Unos piden bajarlos; otros prefieren otras ayudas.', k: 'electricidad|la luz|factura el[eé]ctrica|energ[ií]a el[eé]ctrica' }] },
  { n: 25, halves: [
    { t: '¿Debe crearse un impuesto extraordinario sobre los beneficios de la banca?', c: 'Se refiere a un gravamen temporal sobre los beneficios de los bancos. Unos lo defienden para financiar servicios públicos; otros temen que reduzca el crédito.', k: 'banca|bancos|entidades financieras' },
    { t: '¿Debe crearse un impuesto extraordinario sobre los beneficios de las grandes energéticas?', c: 'Se refiere a un gravamen temporal sobre los beneficios de las grandes empresas de energía. Unos lo defienden para financiar servicios públicos; otros temen que reduzca la inversión.', k: 'energ[eé]tic|el[eé]ctric|petrolera|empresas de energ' }] },
  { n: 27, halves: [
    { t: '¿Debe ser obligatorio el registro horario digital?', c: 'Se refiere a que las empresas registren de forma digital la hora de entrada y salida. Unos lo piden para controlar los abusos; otros temen la carga para las pequeñas empresas.', k: 'registro horario|fichaje|control horario' },
    { t: '¿Debe perseguirse con más medios el impago de horas extra?', c: 'Se refiere a la inspección de las horas extra no pagadas. Unos piden reforzarla; otros consideran que ya hay suficientes controles.', k: 'horas extra|horas extraordinarias' }] },
  { n: 31, halves: [
    { t: '¿Deben prohibirse los vuelos de corto recorrido con alternativa ferroviaria?', c: 'Se refiere a vuelos que pueden hacerse en tren en un tiempo razonable. Unos piden prohibirlos por motivos ambientales; otros defienden la libertad de elección.', k: 'corto recorrido|vuelos (cortos|dom[eé]sticos)|alternativa ferroviaria' },
    { t: '¿Deben prohibirse los jets privados?', c: 'Se refiere a los vuelos en aviones privados de uso personal. Unos piden prohibirlos por su impacto ambiental; otros lo consideran una restricción excesiva.', k: 'jets? privad|aviaci[oó]n privada' }] },
  { n: 39, halves: [
    { t: '¿Deben prohibirse las corridas de toros?', c: 'Unos piden prohibirlas por el sufrimiento animal; otros las defienden como tradición y patrimonio cultural.', k: 'toros|tauromaq|corridas' },
    { t: '¿Deben prohibirse los espectáculos con animales distintos de las corridas de toros, como los circos con animales?', c: 'Se refiere a circos con animales, delfinarios y otros espectáculos. Unos piden prohibirlos; otros defienden regularlos.', k: 'circo|espect[aá]culos con animales|delfinari|zool[oó]gico' }] },
  { n: 45, halves: [
    { t: '¿Debe reforzarse la legítima defensa en el domicilio?', c: 'Se refiere a cuándo se puede repeler una agresión dentro de la vivienda. Unos piden ampliar ese derecho; otros temen un uso desproporcionado de la fuerza.', k: 'domicilio|vivienda|hogar' },
    { t: '¿Debe reforzarse la legítima defensa en el negocio?', c: 'Se refiere a cuándo se puede repeler una agresión dentro de un comercio o empresa. Unos piden ampliar ese derecho; otros temen un uso desproporcionado de la fuerza.', k: 'negocio|comercio|establecimiento' }] },
  { n: 48, halves: [
    { t: '¿Debe reducirse el número de ministerios?', c: 'Se refiere al tamaño del Consejo de Ministros. Unos piden reducirlo para ahorrar; otros defienden que cada área tenga un ministerio.', k: 'ministerios|carteras' },
    { t: '¿Debe reducirse el número de altos cargos?', c: 'Se refiere a secretarios de Estado, directores generales y puestos similares. Unos piden reducirlos para ahorrar; otros defienden su necesidad para gestionar.', k: 'altos cargos|cargos p[uú]blicos|directores generales' },
    { t: '¿Debe reducirse el número de asesores?', c: 'Se refiere al personal eventual de confianza de los cargos públicos. Unos piden reducirlo; otros defienden su utilidad.', k: 'asesores|personal eventual|cargos de confianza' }] },
  { n: 49, halves: [
    { t: '¿Debe eliminarse la financiación pública a los sindicatos?', c: 'Se refiere a las subvenciones y ayudas públicas a los sindicatos. Unos piden eliminarlas; otros defienden mantenerlas por su papel social.', k: 'sindicat' },
    { t: '¿Debe eliminarse la financiación pública a las organizaciones empresariales?', c: 'Se refiere a las subvenciones y ayudas públicas a las patronales. Unos piden eliminarlas; otros defienden mantenerlas por su papel social.', k: 'patronal|empresarial' }] },
  { n: 53, halves: [
    { t: '¿Deben endurecerse las penas por corrupción de los cargos públicos?', c: 'Se refiere a las penas de prisión por delitos de corrupción. Unos piden endurecerlas; otros consideran que las actuales son suficientes.', k: 'penas|prisi[oó]n|c[aá]rcel|cumplimiento' },
    { t: '¿Debe endurecerse la inhabilitación de los cargos públicos condenados por corrupción?', c: 'Se refiere a la prohibición de ocupar cargos públicos tras una condena. Unos piden hacerla más larga o definitiva; otros defienden mantener los plazos actuales.', k: 'inhabilit' }] },
  { n: 67, halves: [
    { t: '¿Debe garantizarse por ley que el Gobierno no nombre libremente al Fiscal General del Estado?', c: 'Se refiere a cómo se elige a quien dirige el Ministerio Fiscal. Unos piden limitar la decisión del Gobierno; otros defienden el sistema actual.', k: 'nombr|elecci[oó]n|designaci[oó]n' },
    { t: '¿Debe garantizarse por ley que el Gobierno no cese libremente al Fiscal General del Estado?', c: 'Se refiere a cuándo puede el Gobierno destituir a quien dirige el Ministerio Fiscal. Unos piden blindar el mandato; otros defienden el sistema actual.', k: 'cese|cesar|destituc|inamovib|mandato' }] },
  { n: 88, halves: [
    { t: '¿Debe eliminarse la financiación pública de la Iglesia?', c: 'Se refiere a la asignación tributaria y otras ayudas a la Iglesia católica. Unos piden eliminarlas; otros defienden mantenerlas.', k: 'iglesia|asignaci[oó]n tributaria|confesion' },
    { t: '¿Debe eliminarse la financiación pública de la enseñanza religiosa?', c: 'Se refiere a la asignatura de religión y a los conciertos con centros religiosos. Unos piden eliminar esa financiación; otros defienden mantenerla.', k: 'enseñanza religiosa|clase de religi[oó]n|religi[oó]n en|asignatura de religi' }] },
  { n: 96, halves: [
    { t: '¿Debe aumentarse la ayuda oficial al desarrollo (AOD)?', c: 'La AOD es el dinero público que España destina a cooperación con países en desarrollo. Unos piden aumentarla; otros prefieren priorizar el gasto interno.', k: 'ayuda oficial al desarrollo|cooperaci[oó]n al desarrollo|AOD' },
    { t: '¿Debe alcanzarse el 0,7 % de la renta nacional bruta en ayuda oficial al desarrollo?', c: 'El 0,7 % es el objetivo internacional de ayuda al desarrollo. Unos piden cumplirlo por ley; otros consideran que debe decidirse según la situación económica.', k: '0,7|0\\.7' }] },
  { n: 101, halves: [
    { t: '¿Deben ser deducibles fiscalmente los gastos en sanidad privada?', c: 'Se refiere a poder restar del IRPF el coste de seguros o servicios médicos privados. Unos lo defienden por la libertad de elección; otros lo ven una ventaja para quien más tiene.', k: 'sanidad|seguro m[eé]dico|salud' },
    { t: '¿Deben ser deducibles fiscalmente los gastos en educación privada?', c: 'Se refiere a poder restar del IRPF el coste de colegios o enseñanzas privadas. Unos lo defienden por la libertad de elección; otros lo ven una ventaja para quien más tiene.', k: 'educaci[oó]n|enseñanza|colegio|matr[ií]cula' }] },
  { n: 106, halves: [
    { t: '¿Deben reforzarse los derechos de los inquilinos frente a los desahucios?', c: 'Se refiere a la protección frente al desalojo y a la prórroga de contratos. Unos piden más protección; otros temen que los propietarios dejen de alquilar.', k: 'desahuci|lanzamiento|pr[oó]rroga|desalojo' },
    { t: '¿Deben reforzarse los derechos de los inquilinos frente a las subidas de renta?', c: 'Se refiere a limitar cuánto puede subir el alquiler. Unos piden topes; otros temen que reduzcan la oferta.', k: 'subidas? de (renta|alquiler)|l[ií]mite[^.]{0,30}(renta|alquiler)|tope|regul[^.]{0,30}alquiler|precio[^.]{0,30}alquiler' }] },
  { n: 111, halves: [
    { t: '¿Debe endurecerse el control de fronteras?', c: 'Se refiere a la vigilancia y los medios en las fronteras. Unos piden reforzarlos; otros priorizan la acogida.', k: 'control de fronteras|frontera|vigilancia|frontex' },
    { t: '¿Debe facilitarse la devolución de quienes entran de forma irregular?', c: 'Se refiere a devolver a su país a quien entra sin autorización. Unos piden facilitarlo; otros defienden garantías y vías de regularización.', k: 'devoluci|expulsi|repatri|retorno' }] },
  { n: 118, halves: [
    { t: '¿Debe priorizarse la financiación de la escuela pública frente a la concertada?', c: 'La concertada es privada con financiación pública. Unos piden priorizar la pública; otros defienden la libertad de elección de centro.', k: 'concertad' },
    { t: '¿Debe priorizarse la financiación de la escuela pública frente a la privada?', c: 'Se refiere a los centros privados sin concierto. Unos piden priorizar la pública; otros defienden la libertad de elección de centro.', k: 'centros privados|escuela privada|enseñanza privada|privad' }] },
  { n: 122, halves: [
    { t: '¿Deben ampliarse los permisos por nacimiento retribuidos por el Estado?', c: 'Se refiere a las semanas de permiso tras un nacimiento. Unos piden ampliarlas; otros temen el coste para empresas y presupuesto.', k: 'nacimiento|paternidad|maternidad|semanas' },
    { t: '¿Deben ampliarse los permisos por cuidado de hijos retribuidos por el Estado?', c: 'Se refiere a permisos y excedencias para cuidar a hijos más allá del nacimiento. Unos piden ampliarlos; otros temen el coste.', k: 'cuidado|excedencia|conciliaci' }] },
  { n: 123, halves: [
    { t: '¿Debe ampliarse la gratuidad de la Formación Profesional?', c: 'Se refiere a que los ciclos de FP no cuesten dinero a quien estudia. Unos piden ampliarla; otros prefieren otras ayudas.', k: 'formaci[oó]n profesional|\\bFP\\b|ciclos formativos' },
    { t: '¿Debe ampliarse la gratuidad de la matrícula universitaria?', c: 'Se refiere a que la matrícula en la universidad pública no cueste dinero a quien estudia. Unos piden ampliarla; otros prefieren becas selectivas.', k: 'universit|matr[ií]cula' }] },
  { n: 132, halves: [
    { t: '¿Debe limitarse la compra de viviendas por grandes tenedores?', c: 'Se refiere a quienes poseen muchas viviendas. Unos piden limitar sus compras para moderar los precios; otros temen que reduzca la oferta de alquiler.', k: 'grandes tenedores|tenedores' },
    { t: '¿Debe limitarse la compra de viviendas por fondos de inversión?', c: 'Se refiere a fondos que compran vivienda para alquilar o revender. Unos piden limitarlo para moderar los precios; otros temen que reduzca la inversión.', k: 'fondos|inversi[oó]n|especulaci|socimi' }] },
  { n: 38, halves: [
    { t: '¿Debe ampliarse la desalación?', c: 'Se refiere a plantas que convierten agua de mar en agua potable o de riego. Unos piden ampliarlas para asegurar el suministro; otros temen su coste energético y ambiental.', k: 'desalaci|desalad|desalinizad' },
    { t: '¿Deben ampliarse las infraestructuras hidráulicas, como presas, canales y trasvases?', c: 'Se refiere a presas, canales, conducciones y trasvases. Unos piden ampliarlas; otros prefieren priorizar la eficiencia y la restauración de los ríos.', k: 'presa|embalse|trasvase|infraestructuras hidr|canal|conducci|regad' }] },
  { n: 133, halves: [
    { t: '¿Debe ampliarse la red de ferrocarril de alta velocidad?', c: 'Se refiere a nuevas líneas de alta velocidad. Unos piden ampliarlas para conectar más territorios; otros prefieren mejorar la red convencional.', k: 'alta velocidad|\\bAVE\\b' },
    { t: '¿Debe ampliarse la red de ferrocarril de cercanías?', c: 'Se refiere a los trenes de cercanías y rodalies. Unos piden más servicios y líneas; otros priorizan otras inversiones.', k: 'cercan[ií]as|rodalies|rodalia' }] },
  { n: 138, halves: [
    { t: '¿Deben crearse incentivos fiscales en las zonas rurales despobladas?', c: 'Se refiere a bajar impuestos o dar deducciones a quien vive o monta un negocio en zonas despobladas. Unos los defienden para fijar población; otros dudan de su eficacia.', k: 'incentivos fiscales|deducci|bonificaci|fiscalidad' },
    { t: '¿Deben garantizarse servicios públicos mínimos en las zonas rurales despobladas?', c: 'Se refiere a sanidad, educación, transporte y conexión a internet en pueblos pequeños. Unos piden garantizarlos por ley; otros los consideran inviables por su coste.', k: 'servicios (p[uú]blicos|b[aá]sicos|garantizados)|sanidad|escuela|transporte|banda ancha|internet' }] },
  { n: 142, halves: [
    { t: '¿Debe reformarse el sistema de financiación de la Comunitat Valenciana?', c: 'Se refiere al reparto de recursos entre el Estado y la Comunitat Valenciana. Unos piden cambiarlo; otros defienden el sistema actual.', k: 'financiaci[oó]n' },
    { t: '¿Debe condonarse parte de la deuda de la Comunitat Valenciana?', c: 'Se refiere a que el Estado asuma parte de la deuda de la Comunitat Valenciana. Unos lo piden; otros lo rechazan por equidad con otras comunidades.', k: 'deuda|condon' }] },
  { n: 143, halves: [
    { t: '¿Debe reforzarse el régimen económico y fiscal especial de Canarias?', c: 'El REF es el conjunto de ventajas fiscales y económicas propias de Canarias. Unos piden reforzarlo; otros lo ven un privilegio.', k: 'r[eé]gimen econ[oó]mico y fiscal|\\bREF\\b|fiscal especial' },
    { t: '¿Debe reforzarse la financiación de la conectividad entre las islas?', c: 'Se refiere a ayudas al transporte aéreo y marítimo entre islas. Unos piden aumentarlas; otros consideran que ya son suficientes.', k: 'conectividad|transporte (a[eé]reo|mar[ií]timo)|descuento de residente|entre las islas|interinsular' }] },
  { n: 145, halves: [
    { t: '¿Debe ampliarse el concierto económico de Euskadi?', c: 'El concierto es el sistema por el que Euskadi recauda sus impuestos y paga al Estado un cupo. Unos piden ampliarlo; otros lo critican por privilegiado.', k: 'concierto' },
    { t: '¿Deben ampliarse las competencias de Euskadi?', c: 'Se refiere a que Euskadi gestione más materias propias. Unos piden transferirlas; otros prefieren mantener el reparto actual.', k: 'competencias|transferencias|autogobierno|estatuto' }] }
]
const KEEP = [
  [17, 'el segundo elemento (modelos propios) forma parte de la misma infraestructura de IA'], [28, 'requiere acotar «sectores estratégicos» sin inventar una lista'], 
  [61, 'una sola medida (embargo de armas y material de doble uso a un país); la absolutez de «toda» se revisará con la segunda auditoría'], [72, 'regulación y trámites son un mismo objeto (carga administrativa)'],
  [77, 'sin dirección: no se puede fijar sin inventar una; pendiente de decidir con la evidencia'], [104, 'sin dirección y tres impuestos: no se puede fijar sin inventar una; pendiente'], 
  [146, 'regional con un solo partido']]
const first = JSON.parse(fs.readFileSync(path.join(OUT, 'auditoria_items.json'), 'utf8')).items; const idOf = (n) => first.find((x) => x.n === n).questionId
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5433/affinity' }); const c = await pool.connect()
const plan = []
try {
  for (const corr of C) {
    const qid = idOf(corr.n); const { rows: [q] } = await c.query('SELECT * FROM questions WHERE id = $1', [qid])
    if ((await c.query('SELECT 1 FROM questions WHERE pilot_question_id = $1', [`${q.pilot_question_id}a`])).rowCount) continue   // ya aplicada (idempotente)
    if (!q || corr.halves.some((h) => !h.t.trim().endsWith('?'))) throw new Error('Pregunta no encontrada o texto no válido: ' + corr.n)
    const { rows: pos } = await c.query(`SELECT * FROM positions WHERE question_id = $1 AND review_status = 'approved' AND value IS NOT NULL`, [qid])
    const halves = corr.halves.map((h, i) => ({ ...h, key: String.fromCharCode(97 + i), carried: [], recode: [] }))
    for (const p of pos) {
      const ev = (p.evidence_jsonb ?? []).filter((e) => e.review_status !== 'rejected'); let any = false
      for (const h of halves) { const hit = ev.filter((e) => re(h.k).test(`${e.literal_text ?? ''} ${e.translation_es ?? ''}`)); if (hit.length) { h.carried.push({ pos: p, ev: hit }); any = true } }
      if (!any) for (const h of halves) h.recode.push(p.entity_id)
    }
    plan.push({ n: corr.n, original: q, halves, positions: pos.length })
  }
  console.log('Pregunta original → mitades (partidos que heredan posición / sin evidencia específica)')
  for (const p of plan) console.log(`Q${p.n} (${p.positions} posiciones): ` + p.halves.map((h) => `${h.key}) ${h.carried.length} heredan` ).join(' · ') + (p.halves[0].recode.length ? ` · ${p.halves[0].recode.length} sin evidencia específica (recodificar)` : ''))
  const newQ = plan.reduce((s, p) => s + p.halves.length, 0), carried = plan.reduce((s, p) => s + p.halves.reduce((a, h) => a + h.carried.length, 0), 0), withTwo = plan.reduce((s, p) => s + p.halves.filter((h) => h.carried.length >= 2).length, 0)
  console.log(`\nPreguntas divididas: ${plan.length} → ${newQ} nuevas (${withTwo} con ≥2 partidos con posición heredada); posiciones heredadas: ${carried}. Señaladas y NO divididas: ${KEEP.length}.`)
  if (!APPLY) { console.log('Simulación: no se ha escrito nada. Usa --apply.'); process.exit(0) }
  await c.query('BEGIN'); let nq = 0, np = 0
  for (const p of plan) for (const h of p.halves) {
    const o = p.original
    const { rows: [nqRow] } = await c.query(`INSERT INTO questions (consultation_id, topic_id, canonical_text, answer_type, options, depth_level, status, pilot_question_id, theme_code, regional_parties, context_text) VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9,$10) RETURNING id`,
      [o.consultation_id, o.topic_id, h.t, o.answer_type, o.options, o.depth_level, `${o.pilot_question_id}${h.key}`, o.theme_code, o.regional_parties, h.c]); nq++
    for (const { pos, ev } of h.carried) {
      await c.query(`INSERT INTO positions (entity_id, question_id, claim_id, value, categorical_value, evidence_summary, conditions, review_status, stance_status, evidence_jsonb, reviewed_by, reviewed_at, review_note) VALUES ($1,$2,NULL,$3,$4,$5,$6,'approved',$7,$8,'correccion-items-ia',now(),$9)`,
        [pos.entity_id, nqRow.id, pos.value, pos.categorical_value, pos.evidence_summary, pos.conditions, pos.stance_status, JSON.stringify(ev), `Heredada de la posición ${pos.id} de la pregunta compuesta ${o.pilot_question_id}: la evidencia citada nombra explícitamente el objeto de esta pregunta. Corrección de doble contenido (2026-11-26), asistida por IA, sin verificación humana.`]); np++
    }
  }
  await c.query('COMMIT'); console.log(`Creadas ${nq} preguntas (borrador) y ${np} posiciones heredadas (aprobadas, reviewed_by=correccion-items-ia).`)
  fs.writeFileSync(path.join(ROOT, 'docs/methodology/local/correcciones_items.json'), JSON.stringify({ aplicado: new Date().toISOString(), divididas: C.map((x) => ({ n: x.n, nuevas: x.halves.map((h) => h.t) })), noDivididas: KEEP.map(([n, m]) => ({ n, motivo: m })) }, null, 1))
} catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error(e.message); process.exitCode = 1 } finally { c.release(); await pool.end() }
