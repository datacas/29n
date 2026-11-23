# Metodología de cálculo de compatibilidad

**Fecha:** 2026-11-13  
**Especificación:** v1.1  
**Estado:** Propuesta para validación metodológica

---

## 1. Principios fundamentales

1. **Determinismo:** Mismas entradas → mismo resultado. Sin aleatoriedad, sin LLM, sin estado servidor.
2. **Independencia por entidad:** El score de A no cambia por añadir B si preguntas, respuestas y versión permanecen iguales.
3. **Sin imputación:** Ausencia de posición verificable ≠ neutralidad ≠ oposición. Se excluye del numerador y denominador.
4. **Transparencia:** Fórmula pública, código abierto, pruebas de referencia, casos límite documentados.
5. **No recomendación:** El porcentaje no es probabilidad, certeza estadística, predicción ni recomendación de voto.

---

## 2. Escala de respuestas

### Escala de acuerdo (5 niveles + omitir)

| Valor | Significado | Código |
|---|---|---|
| -2 | Totalmente en desacuerdo | `strongly_disagree` |
| -1 | En desacuerdo | `disagree` |
| 0 | Neutral / Indeciso | `neutral` |
| +1 | De acuerdo | `agree` |
| +2 | Totalmente de acuerdo | `strongly_agree` |
| null | No sé / Prefiero omitir | `skipped` |

### Codificación de posiciones verificadas

Las posiciones de entidades se codifican en la misma escala `[-2, 2]` basada en la interpretación de la evidencia documental:

| Valor | Interpretación documental |
|---|---|
| -2 | El documento se opone explícitamente |
| -1 | El documento se opone parcialmente |
| 0 | El documento declara explícitamente neutralidad (no es ausencia de posición) |
| +1 | El documento apoya parcialmente |
| +2 | El documento apoya explícitamente |

**Nota:** El valor 0 solo se asigna cuando el documento contiene una declaración explícita de neutralidad. Si el documento no menciona el tema, la posición se marca como `not_stated` y se excluye del scoring.

### Estados de posición — distinción obligatoria

Es fundamental **nunca convertir ausencia de información en neutralidad**. Cada estado tiene un significado distinto y un tratamiento distinto en el scoring:

| Estado | Significado | Causa | Tratamiento en scoring |
|---|---|---|---|
| `explicit_neutral` | La entidad declara explícitamente una posición neutral | El documento dice "no tomamos posición" o presenta ambas opciones sin preferencia | **Incluida** con valor 0. Es una posición verificada. |
| `ambiguous` | El documento contiene señales contradictorias | El documento apoya y se opone en diferentes secciones | **Excluida** hasta revisión humana. No se infiere neutralidad. |
| `not_stated` | El tema no se menciona en el documento | Ausencia de referencia al tema en el programa | **Excluida** de numerador y denominador. No es neutralidad. |
| `unknown` | No se ha analizado aún o el análisis ha fallido | El pipeline no ha procesado esta pregunta-entidad | **Excluida** de numerador y denominador. |
| `conflicting_sources` | Fuentes diferentes dan posiciones opuestas | El programa dice X, pero un discurso del líder dice Y | **Excluida** hasta revisión humana. No se promedia. |
| `not_comparable` | La pregunta no es comparable en el contexto histórico | Diferencias institucionales, temporales o semánticas | **Excluida**, se indica en UI. |
| `conditional` | La posición depende de una condición | "Si se reduce el IVA, entonces..." | **Incluida** con nota de condición visible. |

**Regla crítica:** `not_stated`, `unknown`, `ambiguous` y `conflicting_sources` se excluyen del numerador **y** del denominador. Nunca se asigna valor 0 a una posición ausente.

**Diferencia clave:** `explicit_neutral` (valor 0, incluida) ≠ `not_stated` (excluida). La primera es una posición verificada; la segunda es ausencia de información.

---

## 3. Fórmula unidimensional (base)

### Proximidad por pregunta

Para una pregunta `i` respondida por el usuario con valor `u_i` y una entidad `p` con posición verificada `v_{ip}`:

```
s_{ip} = 1 - |u_i - v_{ip}| / 4
```

Donde `s_{ip} ∈ [0, 1]`:
- `s_{ip} = 1` → coincidencia total (`u_i = v_{ip}`)
- `s_{ip} = 0` → desacuerdo total (`|u_i - v_{ip}| = 4`, p. ej. -2 vs +2)
- `s_{ip} = 0.5` → neutralidad (`|u_i - v_{ip}| = 2`)

### Peso del usuario

El usuario asigna importancia a cada pregunta:

| Importancia | Peso `w_i` |
|---|---|
| Baja | 0.5 |
| Media (default) | 1.0 |
| Alta | 2.0 |

### Conjunto evaluable

Para una entidad `p`:

```
E_p = { i | i respondida por usuario ∧ posición de p en i es verificada y aprobada }
```

### Compatibilidad global

```
C_p = 100 × (Σ_{i∈E_p} w_i × s_{ip}) / (Σ_{i∈E_p} w_i)
```

### Cobertura global

```
coverage_p = |E_p| / |R|
```

Donde `R` es el conjunto de preguntas respondidas por el usuario (no omitidas).

### Cobertura por dimensión

```
R_d = {i ∈ R : i pertenece a dimensión d}  (preguntas respondidas en dimensión d)
coverage_{p,d} = |D_{pd}| / |R_d|
```

Donde:
- `D_{pd}` = preguntas evaluables de la entidad `p` en dimensión `d`.
- `R_d` = preguntas **respondidas por el usuario** que pertenecen a la dimensión `d`.

El denominador es `|R_d|` (preguntas respondidas en esa dimensión), **no** `|R|` (total de preguntas respondidas). Esto evita que la cobertura por dimensión se diluya artificialmente por preguntas de otras dimensiones.

### Dimensiones con cobertura

```
dimensionsWithCoverage_p = |{d : D_{pd} ≠ ∅}|
```

Número de dimensiones con al menos una pregunta evaluable para la entidad `p`.

### Casos límite

| Condición | Resultado |
|---|---|
| `E_p = ∅` (ninguna posición verificada) | "Sin datos suficientes" |
| `|E_p| = 1` | Se muestra porcentaje con advertencia de cobertura baja |
| `coverage_p < 0.2` | Se muestra porcentaje con advertencia visible |
| `w_i = 0` para todas | No aplicable: pesos mínimos 0.5 |

---

## 4. Fórmula multidimensional (modelo aprobado)

**Decisión aprobada:** El modelo es compatibilidad ponderada y multidimensional desde el MVP. La fórmula de agregación entre dimensiones es una **media ponderada de dimensiones** con pesos configurables y positivos.

**Estado:** ✅ **Confirmada.** La fórmula global usa pesos por dimensión `λ_d` (Σ λ_d = 1). Pesos iguales por defecto, salvo configuración distinta del administrador.

### Estructura de dimensiones

Cada pregunta pertenece a un tema, y cada tema pertenece a una dimensión:

```
question → topic → dimension
```

### Compatibilidad por dimensión

Para una dimensión `d` y entidad `p`:

```
D_{pd} = { i ∈ E_p | i pertenece a dimensión d }
```

```
C_{pd} = 100 × (Σ_{i∈D_{pd}} w_i × s_{ip}) / (Σ_{i∈D_{pd}} w_i)
```

Si `D_{pd} = ∅`, la dimensión no se muestra para esa entidad.

### Fórmula de agregación por dimensión — media ponderada con renormalización

La fórmula aprobada para combinar los scores por dimensión en un score global es:

```
D_p = {d : D_{pd} ≠ ∅}  (dimensiones evaluables de la entidad p)
μ_d = λ_d / Σ_{e∈D_p} λ_e  (pesos renormalizados entre dimensiones evaluables)
C_p = 100 × Σ_{d∈D_p} μ_d × avg_s_{pd}
```

Donde:
- `avg_s_{pd} = (Σ_{i∈D_{pd}} w_i × s_{ip}) / (Σ_{i∈D_{pd}} w_i)` — proximidad media en dimensión `d`.
- `λ_d` — peso de calibración de dimensión `d` (de los tres modos de calibración).
- `μ_d` — peso renormalizado: se redistribuyen los pesos λ solo entre las dimensiones donde la entidad tiene evidencia.
- `Σ_{d∈D_p} μ_d = 1` siempre.
- Si no hay dimensiones con preguntas evaluables: "Sin datos suficientes".

**Renormalización:** Los pesos se renormalizan entre las dimensiones evaluables de cada entidad. Si una entidad solo tiene evidencia en una dimensión y coincide al 100 %, su resultado será 100 % con cobertura parcial visible, no un porcentaje reducido artificialmente por dimensiones sin evidencia.

**Ventajas:**
- Respeta la importancia asignada por el usuario entre dimensiones evaluables.
- Una entidad con evidencia en una sola dimensión no se penaliza por dimensiones sin datos.
- Con pesos iguales, equivale a la media simple de dimensiones evaluables.
- Simple de implementar y explicar.
- Determinista y reproducible.

**Inconvenientes:**
- Si una entidad tiene cobertura en solo 2 de 6 dimensiones, el score global se basa en poca información.
- La cobertura por dimensión debe mostrarse siempre junto al score.

**Prueba de sensibilidad:**
- Dos dimensiones, con calibración seria (λ_Economía=0.7, λ_Derechos=0.3):
  - Economía: avg_s=1.0, Derechos: avg_s=0.0
  - Renormalización: μ_Economía=0.7/1.0=0.7, μ_Derechos=0.3/1.0=0.3
  - `C = 100 × (0.7×1.0 + 0.3×0.0) = 70%`
- Entidad con evidencia solo en Economía (Derechos sin evidencia):
  - Renormalización: μ_Economía=0.7/0.7=1.0
  - `C = 100 × (1.0×1.0) = 100%` con cobertura parcial visible
- Con calibración omitida (pesos iguales, λ=1/6 cada uno), entidad con evidencia en 2 dimensiones:
  - Renormalización: μ=0.5 cada uno
  - `C = 100 × (0.5×1.0 + 0.5×0.0) = 50%`
- **Resultado:** La calibración afecta significativamente el resultado. La renormalización evita penalizar entidades por dimensiones sin evidencia. La cobertura por dimensión debe mostrarse siempre.

### 4.1 Sistema de calibración de prioridades (confirmado)

La calibración de prioridades tiene tres modos, todos produciendo el mismo contrato de pesos para el scoring multidimensional.

#### Modos de calibración

| Modo | Descripción | Contrato de salida |
|---|---|---|
| **Seria** | Comparaciones por pares entre dimensiones, con selección adaptativa y reproducible | Pesos positivos normalizados por dimensión |
| **Rápida** | Asignación baja/media/alta a cada dimensión | Pesos discretos normalizados |
| **Omitida** | Se usan pesos predeterminados configurados por el administrador | Pesos por defecto |

#### Calibración seria: comparaciones por pares

**Algoritmo (pendiente de validación técnica en SPIKE-11):**

1. **Entrada:** Conjunto de dimensiones `D` con al menos una pregunta evaluable.
2. **Comparaciones por pares:** El usuario compara dos dimensiones a la vez, indicando cuál es más importante o si son equivalentes.
3. **Selección adaptativa:** La siguiente comparación se elige según la información e incertidumbre acumuladas (algoritmo determinista, versionado).
4. **Empates y omisiones:** El usuario puede declarar empate o omitir una comparación.
5. **Equilibrado:** El algoritmo equilibra la exposición de las dimensiones para evitar sesgo por orden.
6. **Salida:** Pesos positivos normalizados `λ_d` tales que `Σ λ_d = 1`.

**Propiedades requeridas:**
- **Determinismo:** Mismas respuestas → mismos pesos.
- **Versionado:** El algoritmo tiene versión semántica.
- **Ejecución 100% en navegador:** Sin estado servidor.
- **Reproducibilidad:** Los pesos se guardan en la exportación y se reproducen al importar.
- **Empates:** Dos dimensiones con la misma importancia reciben pesos iguales.
- **Omisiones:** Las dimensiones no comparadas reciben peso proporcional al resto.

#### Calibración rápida

El usuario asigna a cada dimensión una de tres categorías:

| Categoría | Peso base |
|---|---|
| Baja | 0.5 |
| Media | 1.0 |
| Alta | 2.0 |

Los pesos se normalizan: `λ_d = w_d / Σ w_d`.

#### Calibración omitida

Se utilizan pesos predeterminados configurados por el administrador en el release. Por defecto, pesos iguales (equivalente a la media simple).

#### Aplicación de los pesos de calibración

Una vez obtenidos los pesos `λ_d`, el score global se calcula con renormalización entre las dimensiones evaluables de cada entidad:

```
D_p = {d : D_{pd} ≠ ∅}  (dimensiones evaluables de la entidad p)
μ_d = λ_d / Σ_{e∈D_p} λ_e  (renormalización)
C_p = 100 × Σ_{d∈D_p} μ_d × avg_s_{pd}
```

Donde:
- `avg_s_{pd} = (Σ_{i∈D_{pd}} w_i × s_{ip}) / (Σ_{i∈D_{pd}} w_i)` — proximidad media en dimensión `d`.
- `λ_d` — peso de calibración de dimensión `d`.
- `μ_d` — peso renormalizado entre dimensiones evaluables. `Σ_{d∈D_p} μ_d = 1`.
- Si no hay dimensiones con preguntas evaluables: "Sin datos suficientes".

**Renormalización:** Es esencial renormalizar porque una entidad puede tener evidencia solo en un subconjunto de dimensiones. Sin renormalización, una entidad con evidencia en una sola dimensión y coincidencia al 100 % obtendría un score reducido artificialmente. Con renormalización, obtiene 100 % con cobertura parcial visible.

**Nota:** El modelo funcional (media ponderada con tres modos de calibración) está aprobado. El algoritmo matemático específico de calibración seria sigue sujeto a validación técnica (SPIKE-11).

---

## 5. Tratamiento de posiciones condicionadas

Una posición condicionada tiene una condición asociada (p. ej. "si se reduce el IVA", "en caso de emergencia").

### Opciones de tratamiento

1. **Incluir sin ajuste:** Tratar como posición normal, mostrar condición en UI.
2. **Reducir peso:** Aplicar factor de atenuación (p. ej. 0.5) a la proximidad.
3. **Excluir:** No incluir en scoring, mostrar como "posición condicionada".

**Recomendación:** Opción 1 para MVP. Incluir con peso normal pero mostrar la condición explícitamente en la evidencia. La atenuación se evalúa tras análisis de impacto.

---

## 6. Cobertura documental

### Métricas a mostrar

| Métrica | Fórmula | Descripción |
|---|---|---|
| `n_evaluable` | `\|E_p\|` | Preguntas con posición verificada y respondida |
| `n_respondidas` | `\|R\|` | Preguntas respondidas por el usuario |
| `coverage_percent` | `100 × n_evaluable / n_respondidas` | Porcentaje de cobertura global |
| `dimensionsWithCoverage` | `\|{d \| D_{pd} ≠ ∅}\|` | Dimensiones con al menos una pregunta evaluable |
| `totalDimensions` | `\|D\|` | Total de dimensiones en el release |
| `coverage_by_dimension` | `100 × \|D_{pd}\| / \|R_d\|` | Cobertura por dimensión |

### Reglas de visualización

- Siempre mostrar `n_evaluable`, `n_respondidas` y `dimensionsWithCoverage` junto al porcentaje.
- Si `coverage_percent < 20`, mostrar **advertencia informativa**: "Cobertura limitada: solo X de Y preguntas tienen posición verificada".
- **El porcentaje NO se oculta ni se invalida por baja cobertura.** La advertencia es puramente informativa.
- Si `dimensionsWithCoverage < 3`, mostrar advertencia: "Cobertura limitada a X dimensiones de Y".
- Si `n_evaluable = 0`, mostrar "Sin datos suficientes" en lugar de 0%.
- Mostrar tabla de dimensiones con score, cobertura y número de preguntas por dimensión.
- Dimensiones sin preguntas evaluables se muestran como "Sin datos".
- **Orden y marca de pocos datos** (`app/lib/scoring/ranking.ts`): un resultado se marca
  «Pocos datos» si `coverage_percent < 25` **o** `n_evaluable < 8` (sin exigir más de las
  respondidas). Los marcados se ordenan **al final** de la lista aunque su porcentaje sea
  mayor, y los que no tienen datos al final del todo. El porcentaje mostrado no se altera:
  solo cambia el orden para que una muestra de 5-6 preguntas no encabece la clasificación
  por azar. Esta regla no excluye a ningún partido (decisión 4: sin umbral mínimo fijo).

---

## 7. Comparaciones históricas

### Reglas adicionales

1. **Etiquetado obligatorio:** Mostrar país, año y tipo de documento (p. ej. "NSDAP, programa de 1920").
2. **Comparabilidad por dimensión:** Marcar dimensiones `not_comparable` cuando el contexto histórico lo requiera.
3. **Sin identificación:** No presentar "eres X% nazi/comunista". Presentar "coincidencia con posiciones documentadas de [entidad, año]".
4. **Contexto visible:** Mostrar diferencias estructurales entre marcos institucionales.

### Tratamiento de `not_comparable`

- La pregunta se excluye de `E_p` para esa entidad.
- Se indica en UI: "Esta pregunta no es comparable con [entidad]".
- No afecta el score de otras entidades.

---

## 8. Ejemplos matemáticos

### Ejemplo 1: Coincidencia total

Usuario responde 5 preguntas, todas con posición verificada para entidad A:

| Pregunta | `u_i` | `v_{iA}` | `s_{iA}` | `w_i` |
|---|---|---|---|---|
| Q1 | +2 | +2 | 1.0 | 1.0 |
| Q2 | +1 | +1 | 1.0 | 1.0 |
| Q3 | -1 | -1 | 1.0 | 1.0 |
| Q4 | 0 | 0 | 1.0 | 1.0 |
| Q5 | +2 | +2 | 1.0 | 2.0 (alta) |

```
C_A = 100 × (1×1 + 1×1 + 1×1 + 1×1 + 1×2) / (1 + 1 + 1 + 1 + 2)
    = 100 × 6 / 6 = 100%
coverage = 5/5 = 100%
```

### Ejemplo 2: Desacuerdo parcial

| Pregunta | `u_i` | `v_{iA}` | `s_{iA}` | `w_i` |
|---|---|---|---|---|
| Q1 | +2 | -2 | 0.0 | 1.0 |
| Q2 | +1 | +1 | 1.0 | 1.0 |
| Q3 | -1 | +1 | 0.5 | 1.0 |
| Q4 | 0 | null | excluida | — |
| Q5 | +2 | +2 | 1.0 | 2.0 |

`E_A = {Q1, Q2, Q3, Q5}` (Q4 excluida: sin posición)

```
C_A = 100 × (0×1 + 1×1 + 0.5×1 + 1×2) / (1 + 1 + 1 + 2)
    = 100 × 3.5 / 5 = 70%
coverage = 4/5 = 80%
```

### Ejemplo 3: Sin datos suficientes

| Pregunta | `u_i` | `v_{iA}` |
|---|---|---|
| Q1 | +2 | null |
| Q2 | +1 | null |
| Q3 | -1 | null |

`E_A = ∅` → "Sin datos suficientes"

### Ejemplo 4: Cobertura baja

| Pregunta | `u_i` | `v_{iA}` |
|---|---|---|
| Q1 | +2 | +2 |
| Q2 | +1 | null |
| Q3 | -1 | null |
| Q4 | 0 | null |
| Q5 | +2 | null |

`E_A = {Q1}`

```
C_A = 100 × (1×1) / 1 = 100%
coverage = 1/5 = 20%
```

Se muestra: "100% de coincidencia (1 de 5 preguntas con posición verificada). Cobertura limitada."

### Ejemplo 5: Pesos variables

| Pregunta | `u_i` | `v_{iA}` | `s_{iA}` | `w_i` |
|---|---|---|---|---|
| Q1 | +2 | +2 | 1.0 | 2.0 (alta) |
| Q2 | +1 | -1 | 0.5 | 0.5 (baja) |
| Q3 | -1 | -1 | 1.0 | 1.0 (media) |

```
C_A = 100 × (1×2 + 0.5×0.5 + 1×1) / (2 + 0.5 + 1)
    = 100 × 3.25 / 3.5 = 92.9%
```

---

## 9. Pruebas de sensibilidad y sesgos

### S-01: Sesgo por selección de preguntas

**Prueba:** Calcular score con dos pools de preguntas distintos (A y B) para la misma entidad y mismo usuario.

**Criterio:** La diferencia entre `C_A` y `C_B` no debe exceder 10 puntos porcentuales para cobertura > 50%.

**Mitigación:** Revisión editorial de pools. Matriz de cobertura visible.

### S-02: Sesgo por ponderación

**Prueba:** Calcular score con todos los pesos en "alta" vs. todos en "baja".

**Criterio:** El ranking de entidades no debe cambiar (solo la magnitud del score).

**Resultado esperado:** Cumplido, ya que la fórmula es una media ponderada.

### S-03: Sesgo por cobertura desigual

**Prueba:** Comparar entidad con programa extenso (90% cobertura) vs. entidad con programa breve (30% cobertura).

**Criterio:** El score no se infla artificialmente por baja cobertura.

**Mitigación:** Mostrar cobertura junto al score. Advertencia visible para cobertura < 20%.

### S-04: Invariancia por orden de entidades

**Prueba:** Calcular score para entidad A con y sin entidad B seleccionada.

**Criterio:** `C_A` es idéntico en ambos casos si preguntas, respuestas y versión son iguales.

**Resultado esperado:** Cumplido por diseño (cada entidad se calcula independientemente).

### S-05: Reproducibilidad

**Prueba:** Calcular score 1000 veces con los mismos inputs.

**Criterio:** Resultado idéntico en las 1000 ejecuciones.

**Resultado esperado:** Cumplido (fórmula determinista, sin aleatoriedad).

---

## 10. Casos límite

| Caso | Comportamiento esperado |
|---|---|
| Todas las respuestas "no sé" | Score no calculable, mensaje "Responde al menos una pregunta" |
| Una sola pregunta respondida | Score calculado, advertencia de cobertura |
| Todos los pesos en "baja" | Score calculado normalmente con pesos 0.5 |
| Entidad sin ninguna posición verificada | "Sin datos suficientes" |
| Pregunta con posición `conflicting_sources` | Requiere revisión humana, no se incluye hasta resolución |
| Cambio de release | Resultados antiguos conservados con release original |
| Recalculo con nueva fórmula | Acción explícita del usuario, muestra diferencias |

---

## 11. Implementación en TypeScript

```typescript
// lib/scoring/calculate.ts

// --- Inputs ---

interface Answer {
  questionId: string;
  value: number; // [-2, 2]
  skipped: boolean;
}

interface Position {
  entityId: string;
  questionId: string;
  value: number; // [-2, 2]
  status: 'approved' | 'explicit_neutral' | 'conditional'
    | 'unknown' | 'not_stated' | 'not_comparable'
    | 'ambiguous' | 'conflicting_sources';
  conditions?: string;
  evidenceRef?: string; // claim_id o referencia a evidencia
  dimensionId: string; // dimensión a la que pertenece la pregunta
}

interface Weight {
  questionId: string;
  importance: 'low' | 'medium' | 'high';
}

interface DimensionCalibration {
  mode: 'serious' | 'quick' | 'skipped';
  weights: Record<string, number>; // dimensionId -> positive weight
}

interface EntityInfo {
  entityId: string;
  historical: boolean;
}

// --- Outputs ---

interface DimensionResult {
  dimensionId: string;
  dimensionName: string;
  affinityPercent: number;
  evaluableQuestions: number;
  answeredQuestionsInDimension: number; // preguntas respondidas en esta dimensión
  coveragePercent: number;
}

interface ScoringResult {
  entityId: string;
  affinityPercent: number | null; // null = "Sin datos suficientes"
  evaluableQuestions: number;
  answeredQuestions: number;
  coveragePercent: number;
  dimensions: DimensionResult[];
  evidenceRefs: string[];
  historical: boolean;
  dimensionsWithCoverage: number; // cuántas dimensiones tienen al menos 1 pregunta evaluable
  totalDimensions: number; // cuántas dimensiones existen en el release
}

// --- Constants ---

const WEIGHT_MAP: Record<string, number> = { low: 0.5, medium: 1.0, high: 2.0 };

const EVALUABLE_STATUSES = new Set([
  'approved', 'explicit_neutral', 'conditional'
]);

// --- Core functions ---

function proximity(userValue: number, positionValue: number): number {
  return 1 - Math.abs(userValue - positionValue) / 4;
}

function getWeight(weights: Weight[], questionId: string): number {
  const w = weights.find(w => w.questionId === questionId);
  return WEIGHT_MAP[w?.importance] ?? WEIGHT_MAP['medium'];
}

export function calculateScoring(
  answers: Answer[],
  positions: Position[],
  weights: Weight[],
  entities: EntityInfo[],
  dimensionNames: Record<string, string>, // dimensionId -> nombre
  calibration?: DimensionCalibration // pesos de calibración por dimensión (opcional)
): ScoringResult[] {
  const answered = answers.filter(a => !a.skipped);
  
  // Contar preguntas respondidas por dimensión (denominador de cobertura por dimensión)
  const answeredByDimension = new Map<string, Set<string>>();
  for (const answer of answered) {
    // Buscar la dimensión de esta pregunta desde las posiciones
    for (const pos of positions) {
      if (pos.questionId === answer.questionId) {
        if (!answeredByDimension.has(pos.dimensionId))
          answeredByDimension.set(pos.dimensionId, new Set());
        answeredByDimension.get(pos.dimensionId)!.add(answer.questionId);
        break;
      }
    }
  }
  
  const totalDimensions = new Set(positions.map(p => p.dimensionId));

  // Agrupar por entidad y dimensión
  const entityData = new Map<string, {
    dimensions: Map<string, Array<{
      proximity: number;
      weight: number;
      questionId: string;
      evidenceRef?: string;
    }>>;
    historical: boolean;
  }>();

  // Inicializar todas las entidades (incluidas las sin posiciones evaluables)
  for (const entity of entities) {
    entityData.set(entity.entityId, {
      dimensions: new Map(),
      historical: entity.historical
    });
  }

  // Procesar respuestas contra posiciones
  for (const answer of answered) {
    if (answer.skipped) continue;
    const weight = getWeight(weights, answer.questionId);

    for (const pos of positions) {
      if (pos.questionId !== answer.questionId) continue;
      if (!EVALUABLE_STATUSES.has(pos.status)) continue;

      const entity = entityData.get(pos.entityId);
      if (!entity) continue;

      const dimEntries = entity.dimensions.get(pos.dimensionId) || [];
      dimEntries.push({
        proximity: proximity(answer.value, pos.value),
        weight,
        questionId: answer.questionId,
        evidenceRef: pos.evidenceRef
      });
      entity.dimensions.set(pos.dimensionId, dimEntries);
    }
  }

  // Calcular resultados por entidad
  return Array.from(entityData.entries()).map(([entityId, data]) => {
    const dimensionResults: DimensionResult[] = [];
    const allEvidenceRefs: string[] = [];
    let totalEvaluable = 0;
    const evaluableDimIds = new Set<string>();

    for (const [dimId, entries] of data.dimensions) {
      if (entries.length === 0) continue;

      const numerator = entries.reduce((sum, e) => sum + e.weight * e.proximity, 0);
      const denominator = entries.reduce((sum, e) => sum + e.weight, 0);
      const dimAffinity = denominator > 0
        ? Math.round((numerator / denominator) * 1000) / 10
        : 0;

      // Cobertura por dimensión: denominador = preguntas respondidas en esta dimensión
      const answeredInDim = answeredByDimension.get(dimId)?.size || 0;
      const dimCoverage = answeredInDim > 0
        ? Math.round((entries.length / answeredInDim) * 1000) / 10
        : 0;

      dimensionResults.push({
        dimensionId: dimId,
        dimensionName: dimensionNames[dimId] || dimId,
        affinityPercent: dimAffinity,
        evaluableQuestions: entries.length,
        answeredQuestionsInDimension: answeredInDim,
        coveragePercent: dimCoverage
      });

      evaluableDimIds.add(dimId);
      totalEvaluable += entries.length;

      // Recoger evidencias
      for (const e of entries) {
        if (e.evidenceRef && !allEvidenceRefs.includes(e.evidenceRef)) {
          allEvidenceRefs.push(e.evidenceRef);
        }
      }
    }

    // Score global: media ponderada con renormalización entre dimensiones evaluables
    let affinityPercent: number | null = null;
    if (evaluableDimIds.size > 0) {
      if (calibration && calibration.weights) {
        // Renormalizar λ entre dimensiones evaluables de esta entidad
        const sumLambda = Array.from(evaluableDimIds).reduce(
          (sum, d) => sum + (calibration.weights[d] || 0), 0
        );
        
        if (sumLambda > 0) {
          const weightedSum = dimensionResults.reduce((sum, dim) => {
            const lambda = calibration.weights[dim.dimensionId] || 0;
            const mu = lambda / sumLambda; // peso renormalizado
            return sum + mu * dim.affinityPercent;
          }, 0);
          affinityPercent = Math.round(weightedSum * 10) / 10;
        } else {
          // Fallback: pesos iguales si todos los λ son 0
          const dimensionScores = dimensionResults.map(d => d.affinityPercent);
          affinityPercent = Math.round(
            (dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length) * 10
          ) / 10;
        }
      } else {
        // Pesos iguales (default - calibración omitida)
        // Equivalente a renormalización con λ iguales
        const dimensionScores = dimensionResults.map(d => d.affinityPercent);
        affinityPercent = Math.round(
          (dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length) * 10
        ) / 10;
      }
    }

    return {
      entityId,
      affinityPercent,
      evaluableQuestions: totalEvaluable,
      answeredQuestions: answered.length,
      coveragePercent: answered.length > 0
        ? Math.round((totalEvaluable / answered.length) * 1000) / 10
        : 0,
      dimensions: dimensionResults.sort((a, b) => a.dimensionName.localeCompare(b.dimensionName)),
      evidenceRefs: allEvidenceRefs,
      historical: data.historical,
      dimensionsWithCoverage: evaluableDimIds.size,
      totalDimensions: totalDimensions.size
    };
  });
}
```

---

## 12. Ejemplos multidimensionales

### Ejemplo 6: Score multidimensional con renormalización

Usuario responde 6 preguntas en 3 dimensiones. Entidad A tiene posiciones verificadas en 2 dimensiones.

| Pregunta | Dimensión | `u_i` | `v_{iA}` | `s_{iA}` | `w_i` |
|---|---|---|---|---|---|
| Q1 | Economía | +2 | +2 | 1.0 | 1.0 |
| Q2 | Economía | +1 | +1 | 1.0 | 1.0 |
| Q3 | Social | -1 | null | excluida | — |
| Q4 | Social | 0 | null | excluida | — |
| Q5 | Derechos | +2 | +2 | 1.0 | 2.0 |
| Q6 | Derechos | +1 | -1 | 0.5 | 1.0 |

`E_A = {Q1, Q2, Q5, Q6}` (Q3, Q4 excluidas: sin posición)

**Por dimensión:**
- Economía: `avg_s = (1.0×1 + 1.0×1) / (1 + 1) = 1.0` → 100%
  - Cobertura: 2/2 = 100% (2 respondidas en Economía, 2 evaluables)
- Social: `D_{p,Social} = ∅` → no se muestra
- Derechos: `avg_s = (1.0×2 + 0.5×1) / (2 + 1) = 0.833` → 83.3%
  - Cobertura: 2/2 = 100% (2 respondidas en Derechos, 2 evaluables)

**Score global con renormalización (calibración omitida, pesos iguales):**
```
D_A = {Economía, Derechos} (2 dimensiones evaluables de 3)
λ_Economía = 1/6, λ_Derechos = 1/6 (pesos iguales por defecto)
μ_Economía = (1/6) / (1/6 + 1/6) = 0.5
μ_Derechos = (1/6) / (1/6 + 1/6) = 0.5
C_A = 100 × (0.5×100 + 0.5×83.3) = 91.7%
```

**Cobertura:**
- `n_evaluable = 4`, `n_respondidas = 6` → 66.7%
- `dimensionsWithCoverage = 2`, `totalDimensions = 3`
- Se muestra: "91.7% de coincidencia (4 de 6 preguntas, 2 de 3 dimensiones)"

### Ejemplo 7: Entidad con evidencia en una sola dimensión (renormalización)

Entidad B solo tiene posiciones verificadas en Economía. Mismo usuario que el ejemplo 6.

| Pregunta | Dimensión | `u_i` | `v_{iB}` | `s_{iB}` | `w_i` |
|---|---|---|---|---|---|
| Q1 | Economía | +2 | +2 | 1.0 | 1.0 |
| Q2 | Economía | +1 | +1 | 1.0 | 1.0 |
| Q3 | Social | -1 | null | excluida | — |
| Q4 | Social | 0 | null | excluida | — |
| Q5 | Derechos | +2 | null | excluida | — |
| Q6 | Derechos | +1 | null | excluida | — |

`E_B = {Q1, Q2}` (solo Economía)

**Por dimensión:**
- Economía: `avg_s = (1.0×1 + 1.0×1) / (1 + 1) = 1.0` → 100%
  - Cobertura: 2/2 = 100%
- Social: `D_{p,Social} = ∅` → no se muestra
- Derechos: `D_{p,Derechos} = ∅` → no se muestra

**Score global con renormalización:**
```
D_B = {Economía} (1 dimensión evaluable de 3)
λ_Economía = 1/6 (peso por defecto)
μ_Economía = (1/6) / (1/6) = 1.0 (renormalizado a 1)
C_B = 100 × (1.0×100) = 100%
```

**Sin renormalización (error que se evita):**
```
C_B = 100 × (1/6 × 100) = 16.7% ← penalización artificial por dimensiones sin evidencia
```

**Cobertura:**
- `n_evaluable = 2`, `n_respondidas = 6` → 33.3%
- `dimensionsWithCoverage = 1`, `totalDimensions = 3`
- Se muestra: "100% de coincidencia (2 de 6 preguntas, 1 de 3 dimensiones). Cobertura limitada."

### Ejemplo 8: Calibración seria con renormalización

Mismo escenario que el ejemplo 6, pero con calibración seria:
- λ_Economía = 0.7, λ_Derechos = 0.3, λ_Social = 0.0 (no calibrada, sin evidencia)

**Renormalización para Entidad A (evidencia en Economía y Derechos):**
```
sum_λ = 0.7 + 0.3 = 1.0
μ_Economía = 0.7 / 1.0 = 0.7
μ_Derechos = 0.3 / 1.0 = 0.3
C_A = 100 × (0.7×100 + 0.3×83.3) = 95.0%
```

**Renormalización para Entidad B (evidencia solo en Economía):**
```
sum_λ = 0.7
μ_Economía = 0.7 / 0.7 = 1.0
C_B = 100 × (1.0×100) = 100%
```

---

## 13. Decisiones pendientes

1. **Fórmula de agregación entre dimensiones (D-02):** ✅ **Confirmada.** Media ponderada de dimensiones con tres modos de calibración (seria, rápida, omitida). El algoritmo matemático específico de calibración seria sigue sujeto a validación técnica (SPIKE-11).
2. **Tratamiento de posiciones condicionadas:** ¿Peso normal o atenuado? Recomendación actual: peso normal con condición visible. Requiere análisis de impacto.
3. **Umbral de advertencia de cobertura (D-06):** 20% como advertencia informativa (no obligatorio). El porcentaje nunca se oculta por baja cobertura. Requiere pruebas de usabilidad.
4. **Umbral mínimo de dimensiones:** ¿3 dimensiones es el umbral correcto para advertencia? Requiere validación.
5. **Precisión del porcentaje:** ¿1 decimal, entero o 2 decimales? Recomendación: 1 decimal para claridad.
6. **Algoritmo de calibración seria:** Diseño del algoritmo de comparaciones por pares con selección adaptativa. Requiere pruebas de determinismo, estabilidad, cobertura de dimensiones, sensibilidad, empates, omisiones y reproducibilidad entre sesiones (SPIKE-11).
