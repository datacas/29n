#!/usr/bin/env python3
"""
Construcción del banco de preguntas piloto a partir de 2,121 claims.

Enfoque: Las 17 áreas temáticas con ≥3 partidos son el punto de partida.
Para cada área, se recopilan los claims de todos los partidos y se propone
una pregunta neutral que capture la política concreta en juego.

Las preguntas se formulan manualmente (plantillas por área) para evitar
preguntas dobles, lenguaje valorativo o presuposiciones.

Fase 1 — Recopilación por área:
  Para cada una de las 17 áreas, listar claims por partido.

Fase 2 — Preguntas neutrales por área:
  Una o dos preguntas por área, formuladas para la escala aprobada.

Fase 3 — Matriz editorial:
  Matriz pregunta × partido con evidencia, condiciones y estado editorial.

Entrega:
  - questions_proposal.json: preguntas propuestas con evidencias
  - editorial_matrix.json: matriz pregunta × partido
  - coverage_matrix.json: cobertura preliminar por dimensión
  - incidents.json: incidencias y ambigüedades
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

RESULTS_DIR = Path(__file__).parent / "extraction_results"
DOCS_DIR = Path(__file__).parent.parent / "docs"

# Dimensions from seeds
DIMENSIONS = {
    "Economía y empleo": ["Economía", "Empleo", "Fiscalidad", "Política industrial", "Servicios financieros"],
    "Estado de bienestar": ["Sanidad", "Educación", "Vivienda", "Familia", "Dependencia", "Pensiones"],
    "Territorio y medio ambiente": ["Medio ambiente", "Infraestructuras", "Urbanismo", "Gestión forestal"],
    "Justicia y seguridad": ["Justicia", "Seguridad", "Administración pública"],
    "Derechos y libertades": ["Derechos", "Cultura", "Cooperación al desarrollo", "Política exterior"],
    "Gobernanza y democracia": ["Gobernanza", "Democracia", "Administración pública / Digitalización"],
}

# Manual question templates per area — neutral, answerable via approved scale
# Each area gets 1-2 questions that capture the concrete policy measure
AREA_QUESTIONS = {
    "Educación": [
        {
            "question": "¿El Estado debe aumentar la inversión en becas y ayudas al estudio para hacer la educación más accesible?",
            "policy_focus": "inversión en becas educativas",
        },
        {
            "question": "¿Debe ampliarse la oferta de plazas públicas de educación infantil (0-3 años)?",
            "policy_focus": "plazas educación infantil",
        },
    ],
    "Vivienda": [
        {
            "question": "¿Debe el Estado impulsar la construcción de vivienda pública y protegida para aumentar la oferta de vivienda asequible?",
            "policy_focus": "construcción vivienda pública",
        },
        {
            "question": "¿Deben regularse los precios del alquiler en las zonas tensionadas?",
            "policy_focus": "regulación alquiler",
        },
    ],
    "Vivienda / Fiscalidad": [
        {
            "question": "¿Deben modificarse los impuestos relacionados con la vivienda (IBI, plusvalías, transmisión patrimonial) para favorecer el acceso a la vivienda?",
            "policy_focus": "fiscalidad vivienda",
        },
    ],
    "Sanidad": [
        {
            "question": "¿Debe aumentarse la inversión en el Sistema Nacional de Salud para reducir listas de espera y mejorar la atención primaria?",
            "policy_focus": "inversión sanidad",
        },
    ],
    "Vivienda / Urbanismo": [
        {
            "question": "¿Debe fomentarse la rehabilitación de edificios y barrios existentes en lugar de la expansión urbana?",
            "policy_focus": "rehabilitación urbana",
        },
    ],
    "Vivienda / Alquiler": [
        {
            "question": "¿Deben protegerse los derechos de los inquilinos frente al despido y la subida descontrolada de rentas?",
            "policy_focus": "protección inquilinos",
        },
    ],
    "Fiscalidad": [
        {
            "question": "¿Debe aumentarse la presión fiscal sobre las grandes fortunas y empresas para financiar los servicios públicos?",
            "policy_focus": "presión fiscal grandes fortunas",
        },
        {
            "question": "¿Deben reducirse los impuestos sobre la renta de las personas físicas (IRPF) para las clases medias y trabajadoras?",
            "policy_focus": "reducción IRPF",
        },
    ],
    "Infraestructuras ferroviarias": [
        {
            "question": "¿Debe ampliarse la red de ferrocarriles de alta velocidad y cercanías para mejorar la conectividad territorial?",
            "policy_focus": "ampliación red ferroviaria",
        },
    ],
    "Fiscalidad / IRPF": [
        {
            "question": "¿Debe reformarse el IRPF para que las familias con hijos reciban mayores deducciones y bonificaciones?",
            "policy_focus": "IRPF familias",
        },
    ],
    "Medio ambiente / Gestión forestal": [
        {
            "question": "¿Debe reforzarse la gestión y protección de los bosques frente a los incendios forestales?",
            "policy_focus": "protección bosques",
        },
    ],
    "Cooperación al desarrollo": [
        {
            "question": "¿Debe mantenerse o aumentarse la ayuda oficial al desarrollo (AOD) hasta alcanzar el 0,7 % de la renta nacional bruta (RNB)?",
            "policy_focus": "ayuda al desarrollo",
        },
    ],
    "Administración pública / Digitalización": [
        {
            "question": "¿Debe impulsarse la digitalización de la administración pública para mejorar la eficiencia y el acceso a los servicios?",
            "policy_focus": "digitalización administración",
        },
    ],
    "Política industrial": [
        {
            "question": "¿Debe el Estado impulsar políticas industriales activas para atraer inversión y crear empleo estratégico?",
            "policy_focus": "política industrial",
        },
    ],
    "Vivienda / Rehabilitación": [
        {
            "question": "¿Deben incentivarse las obras de rehabilitación energética de edificios para mejorar la eficiencia y reducir emisiones?",
            "policy_focus": "rehabilitación energética",
        },
    ],
    "Cultura / Legislación": [
        {
            "question": "¿Debe reformarse la legislación cultural (mecenazgo, derechos de autor) para apoyar a los creadores y la industria cultural?",
            "policy_focus": "legislación cultural",
        },
    ],
    "Política exterior / Derechos humanos": [
        {
            "question": "¿Debe la política exterior española priorizar la defensa de los derechos humanos y la democracia en las relaciones internacionales?",
            "policy_focus": "derechos humanos política exterior",
        },
    ],
    "Cultura / Patrimonio": [
        {
            "question": "¿Debe el Estado aumentar la inversión en la protección y puesta en valor del patrimonio cultural?",
            "policy_focus": "patrimonio cultural",
        },
    ],
    "Gobernanza y democracia": [
        {
            "question": "¿Debe reformarse el sistema electoral para mejorar la representatividad parlamentaria?",
            "policy_focus": "reforma electoral representatividad",
        },
        {
            "question": "¿Deben ampliarse los mecanismos de participación ciudadana directa (referéndums, iniciativas populares)?",
            "policy_focus": "participación ciudadana referéndum",
        },
    ],
    "Justicia y seguridad": [
        {
            "question": "¿Debe aumentarse la inversión en seguridad ciudadana y fuerzas de policía?",
            "policy_focus": "inversión seguridad policía",
        },
    ],
}


def load_all_claims():
    """Load all claims from extraction results."""
    all_claims = []
    for party in ['PSOE', 'PP', 'Vox', 'Sumar', 'ERC']:
        path = RESULTS_DIR / f"{party}_extraction.json"
        if not path.exists():
            print(f"  ⚠ {party}_extraction.json no encontrado")
            continue
        with open(path) as f:
            data = json.load(f)
        for claim in data.get("claims", []):
            claim["_party"] = party
            all_claims.append(claim)
    return all_claims


def get_dimension_for_area(area):
    """Map affected_area to dimension."""
    area_lower = area.lower()
    for dim, keywords in DIMENSIONS.items():
        for kw in keywords:
            if kw.lower() in area_lower:
                return dim
    for dim, keywords in DIMENSIONS.items():
        for kw in keywords:
            if kw.lower() in area_lower or area_lower in kw.lower():
                return dim
    return "Derechos y libertades"  # Default


def normalize_text(text):
    """Normalize text for comparison."""
    text = text.replace("\n", " ").replace("- ", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()


def find_matching_claims(claim, policy_focus):
    """
    Check if a claim is relevant to a policy focus.
    Uses keyword overlap between the claim and the policy focus.
    Searches in normalized_text, literal_text, AND affected_area.
    """
    # Combine all text fields for matching
    claim_text = normalize_text(
        claim.get("normalized_text", "") + " " +
        claim.get("literal_text", "") + " " +
        claim.get("affected_area", "")
    )
    focus_text = normalize_text(policy_focus)
    
    # Extract keywords from policy focus
    focus_words = set(focus_text.split())
    # Remove stop words
    stop_words = {
        "de", "la", "el", "en", "y", "a", "por", "para", "con", "sin", "que",
        "se", "es", "del", "al", "los", "las", "un", "una", "unos", "unas",
        "su", "sus", "como", "más", "no", "o", "pero", "si", "este", "esta",
        "estos", "estas", "ese", "esa", "esos", "esas", "ser", "estar", "tener",
        "hacer", "poder", "deber", "sobre", "entre", "desde", "hasta", "cada",
        "todo", "toda", "todos", "todas", "muy", "tan", "solo", "sólo", "ya",
        "sin", "tras", "ante", "durante", "según", "cual", "cualquier",
    }
    focus_words -= stop_words
    
    if not focus_words:
        return False
    
    # Check if any focus keyword appears in the claim
    matches = 0
    for word in focus_words:
        if word in claim_text:
            matches += 1
    
    # Require at least one keyword match
    return matches >= 1


def classify_stance(claim, policy_focus):
    """
    Classify the stance of a claim relative to a policy focus.
    Returns: agrees, disagrees, conditional, neutral, or unclear
    """
    normalized = claim.get("normalized_text", "").lower()
    literal = claim.get("literal_text", "").lower()
    conditions = claim.get("conditions", "").lower()
    combined = normalized + " " + literal
    
    # Keywords that indicate agreement/support
    agrees_keywords = [
        "aumentar", "incrementar", "reforzar", "fortalecer", "impulsar",
        "garantizar", "promover", "fomentar", "ampliar", "mejorar",
        "inversión", "apostar", "compromiso", "defender", "proteger",
        "crear", "construir", "establecer", "implementar", "desarrollar",
        "acceder", "acceso", "derecho", "universal", "gratuito",
    ]
    
    # Keywords that indicate disagreement/opposition
    disagrees_keywords = [
        "reducir", "disminuir", "recortar", "eliminar", "abolir",
        "privatizar", "liberalizar", "desmantelar", "derogar",
        "suprimir", "cancelar", "detener", "frenar", "limitar",
        "restringir", "prohibir", "impedir",
    ]
    
    agrees_count = sum(1 for kw in agrees_keywords if kw in combined)
    disagrees_count = sum(1 for kw in disagrees_keywords if kw in combined)
    
    if agrees_count > disagrees_count and agrees_count > 0:
        if conditions:
            return "conditional_agrees"
        return "agrees"
    elif disagrees_count > agrees_count and disagrees_count > 0:
        return "disagrees"
    elif agrees_count > 0 or disagrees_count > 0:
        if conditions:
            return "conditional"
        return "neutral"
    else:
        return "unclear"


def build_editorial_matrix(questions):
    """
    Build editorial matrix: question × party with suggested position, evidence, coverage.
    """
    matrix = []
    
    for q in questions:
        row = {
            "question_id": q["question_id"],
            "question": q["question"],
            "area": q["area"],
            "dimension": q["dimension"],
            "parties": {},
        }
        
        for party in ['PSOE', 'PP', 'Vox', 'Sumar', 'ERC']:
            party_evidence = q.get("evidence_by_party", {}).get(party, [])
            
            if party_evidence:
                position = {
                    "stance": party_evidence[0].get("stance", "unclear"),
                    "evidence": party_evidence[:3],
                    "conditions": [e.get("conditions", "") for e in party_evidence if e.get("conditions")],
                    "review_status": "draft",
                    "stance_status": "needs_review",
                }
                row["parties"][party] = position
            else:
                row["parties"][party] = {
                    "stance": "not_stated",
                    "evidence": [],
                    "conditions": [],
                    "review_status": "draft",
                    "stance_status": "not_stated",
                }
        
        matrix.append(row)
    
    return matrix


def build_coverage_matrix(questions):
    """Build preliminary coverage matrix by dimension."""
    coverage = {}
    for dim in DIMENSIONS.keys():
        dim_questions = [q for q in questions if q["dimension"] == dim]
        coverage[dim] = {
            "total_questions": len(dim_questions),
            "parties_coverage": {},
        }
        
        for party in ['PSOE', 'PP', 'Vox', 'Sumar', 'ERC']:
            with_evidence = sum(
                1 for q in dim_questions
                if party in q.get("parties_with_evidence", [])
            )
            coverage[dim]["parties_coverage"][party] = {
                "questions_with_evidence": with_evidence,
                "coverage_percentage": round(with_evidence / max(len(dim_questions), 1) * 100, 1),
            }
    
    return coverage


def detect_incidents(questions):
    """Detect incidents and ambiguities."""
    incidents = []
    
    for q in questions:
        # 1. Questions with only 1 party evidence
        if len(q["parties_with_evidence"]) == 1:
            incidents.append({
                "type": "single_party_evidence",
                "question_id": q["question_id"],
                "question": q["question"][:100],
                "parties": q["parties_with_evidence"],
                "severity": "medium",
                "recommendation": "Buscar evidencia en otros partidos o reformular pregunta",
            })
        
        # 2. Questions with only 2 parties
        if len(q["parties_with_evidence"]) == 2:
            incidents.append({
                "type": "two_party_evidence",
                "question_id": q["question_id"],
                "question": q["question"][:100],
                "parties": q["parties_with_evidence"],
                "severity": "low",
                "recommendation": "Aceptable si la pregunta es específica; buscar más evidencia si es posible",
            })
        
        # 3. Questions with conditional claims
        for party, evidence in q.get("evidence_by_party", {}).items():
            for e in evidence:
                if e.get("conditions"):
                    incidents.append({
                        "type": "conditional_claim",
                        "question_id": q["question_id"],
                        "question": q["question"][:100],
                        "party": party,
                        "condition": e["conditions"][:150],
                        "severity": "info",
                        "recommendation": "Verificar que la condición no invalide la posición",
                    })
        
        # 4. Questions with unclear stance
        for party, evidence in q.get("evidence_by_party", {}).items():
            for e in evidence:
                if e.get("stance") == "unclear":
                    incidents.append({
                        "type": "unclear_stance",
                        "question_id": q["question_id"],
                        "question": q["question"][:100],
                        "party": party,
                        "severity": "medium",
                        "recommendation": "Revisar manualmente: la postura no es clara a partir del claim",
                    })
    
    return incidents


def main():
    print("=" * 80)
    print("CONSTRUCCIÓN DEL BANCO DE PREGUNTAS PILOTO")
    print("=" * 80)
    print()
    
    # Load all claims
    print("1. Cargando claims...")
    all_claims = load_all_claims()
    print(f"   Total: {len(all_claims)} claims")
    
    # Group by area
    by_area = defaultdict(list)
    for c in all_claims:
        area = c.get("affected_area", "")
        if area:
            by_area[area].append(c)
    
    # Find areas with 3+ parties
    cross_party_areas = {}
    for area, claims in by_area.items():
        parties = set(c["_party"] for c in claims)
        if len(parties) >= 3:
            cross_party_areas[area] = (claims, parties)
    
    print(f"   Áreas con 3+ partidos: {len(cross_party_areas)}")
    print()
    
    # Phase 1 & 2: Generate questions from templates
    print("2. Fases 1-2 — Preguntas neutrales por área temática...")
    questions = []
    question_id = 1
    
    for area, templates in AREA_QUESTIONS.items():
        # Use cross-party area claims if available, otherwise search all claims
        if area in cross_party_areas:
            area_claims, parties = cross_party_areas[area]
        else:
            # Search all claims for this area (including sub-areas)
            area_lower = area.lower()
            area_claims = [
                c for c in all_claims
                if area_lower in c.get("affected_area", "").lower()
            ]
            # If still no claims, search by keywords in all claims
            if not area_claims:
                # Use policy_focus keywords from templates to find relevant claims
                focus_keywords = []
                for t in templates:
                    focus_keywords.extend(t["policy_focus"].split())
                area_claims = []
                for c in all_claims:
                    combined = normalize_text(
                        c.get("normalized_text", "") + " " +
                        c.get("literal_text", "") + " " +
                        c.get("affected_area", "")
                    )
                    for kw in focus_keywords:
                        if len(kw) > 3 and kw in combined:
                            area_claims.append(c)
                            break
            parties = set(c["_party"] for c in area_claims)
            if not area_claims:
                print(f"   ⚠ {area}: sin claims encontrados")
                continue
        
        dimension = get_dimension_for_area(area)
        
        for template in templates:
            question_text = template["question"]
            policy_focus = template["policy_focus"]
            
            # Find matching claims for each party
            evidence_by_party = {}
            parties_with_evidence = set()
            
            for party in ['PSOE', 'PP', 'Vox', 'Sumar', 'ERC']:
                party_claims = [c for c in area_claims if c["_party"] == party]
                matching = []
                
                for c in party_claims:
                    if find_matching_claims(c, policy_focus):
                        stance = classify_stance(c, policy_focus)
                        matching.append({
                            "literal_text": c.get("literal_text", ""),
                            "normalized_text": c.get("normalized_text", ""),
                            "source_page": c.get("source_page"),
                            "conditions": c.get("conditions"),
                            "stance": stance,
                        })
                
                if matching:
                    parties_with_evidence.add(party)
                    evidence_by_party[party] = matching
            
            q = {
                "question_id": f"Q{question_id:03d}",
                "question": question_text,
                "area": area,
                "dimension": dimension,
                "policy_focus": policy_focus,
                "parties_with_evidence": sorted(list(parties_with_evidence)),
                "parties_without_evidence": sorted(list(set(['PSOE', 'PP', 'Vox', 'Sumar', 'ERC']) - parties_with_evidence)),
                "evidence_count": sum(len(v) for v in evidence_by_party.values()),
                "evidence_by_party": evidence_by_party,
            }
            questions.append(q)
            question_id += 1
    
    print(f"   Preguntas generadas: {len(questions)}")
    print(f"   Por dimensión:")
    dim_counter = Counter(q["dimension"] for q in questions)
    for dim in DIMENSIONS.keys():
        count = dim_counter.get(dim, 0)
        print(f"     {dim}: {count}")
    print()
    
    # Phase 3: Editorial matrix
    print("3. Fase 3 — Matriz editorial...")
    matrix = build_editorial_matrix(questions)
    coverage = build_coverage_matrix(questions)
    incidents = detect_incidents(questions)
    
    print(f"   Filas en matriz: {len(matrix)}")
    print(f"   Incidencias: {len(incidents)}")
    print()
    
    # Save outputs
    print("4. Guardando entregables...")
    
    # Questions proposal
    questions_output = []
    for q in questions:
        q_out = {
            "question_id": q["question_id"],
            "question": q["question"],
            "area": q["area"],
            "dimension": q["dimension"],
            "policy_focus": q["policy_focus"],
            "parties_with_evidence": q["parties_with_evidence"],
            "parties_without_evidence": q["parties_without_evidence"],
            "evidence_count": q["evidence_count"],
            "evidence_by_party": {},
        }
        for party, evidence in q.get("evidence_by_party", {}).items():
            q_out["evidence_by_party"][party] = [
                {
                    "literal_text": e.get("literal_text", ""),
                    "normalized_text": e.get("normalized_text", ""),
                    "source_page": e.get("source_page"),
                    "conditions": e.get("conditions"),
                    "stance": e.get("stance"),
                }
                for e in evidence
            ]
        questions_output.append(q_out)
    
    with open(RESULTS_DIR / "questions_proposal.json", "w") as f:
        json.dump(questions_output, f, indent=2, ensure_ascii=False)
    print(f"   questions_proposal.json: {len(questions_output)} preguntas")
    
    # Editorial matrix
    with open(RESULTS_DIR / "editorial_matrix.json", "w") as f:
        json.dump(matrix, f, indent=2, ensure_ascii=False)
    print(f"   editorial_matrix.json: {len(matrix)} filas")
    
    # Coverage matrix
    with open(RESULTS_DIR / "coverage_matrix.json", "w") as f:
        json.dump(coverage, f, indent=2, ensure_ascii=False)
    print(f"   coverage_matrix.json: {len(coverage)} dimensiones")
    
    # Incidents
    with open(RESULTS_DIR / "incidents.json", "w") as f:
        json.dump(incidents, f, indent=2, ensure_ascii=False)
    print(f"   incidents.json: {len(incidents)} incidencias")
    
    print()
    print("=" * 80)
    print("RESUMEN")
    print("=" * 80)
    print(f"  Claims procesados: {len(all_claims)}")
    print(f"  Áreas con 3+ partidos: {len(cross_party_areas)}")
    print(f"  Preguntas generadas: {len(questions)}")
    print(f"  Incidencias: {len(incidents)}")
    print()
    
    # Quality metrics
    multi_party = sum(1 for q in questions if len(q["parties_with_evidence"]) >= 3)
    two_party = sum(1 for q in questions if len(q["parties_with_evidence"]) == 2)
    single_party = sum(1 for q in questions if len(q["parties_with_evidence"]) == 1)
    print(f"  Calidad de preguntas:")
    print(f"    Con 3+ partidos: {multi_party}/{len(questions)} ({multi_party/max(len(questions),1)*100:.0f}%)")
    print(f"    Con 2 partidos: {two_party}/{len(questions)} ({two_party/max(len(questions),1)*100:.0f}%)")
    print(f"    Con 1 partido: {single_party}/{len(questions)} ({single_party/max(len(questions),1)*100:.0f}%)")
    print()
    
    # Coverage summary
    print("  Cobertura por dimensión:")
    for dim, cov in coverage.items():
        print(f"    {dim}: {cov['total_questions']} preguntas")
        for party, pcov in cov["parties_coverage"].items():
            print(f"      {party}: {pcov['questions_with_evidence']}/{cov['total_questions']} ({pcov['coverage_percentage']}%)")
    print()
    
    # Incidents summary
    inc_counter = Counter(i["type"] for i in incidents)
    print("  Incidencias por tipo:")
    for inc_type, count in inc_counter.most_common():
        print(f"    {inc_type}: {count}")
    print()
    
    print("  Recomendación: revisar manualmente las preguntas antes de aprobar.")
    print("  No publicar release hasta validación editorial completa.")


if __name__ == "__main__":
    main()
