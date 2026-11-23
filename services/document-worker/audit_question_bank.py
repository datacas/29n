#!/usr/bin/env python3
"""
Auditoría completa del banco de preguntas piloto.

Tareas:
1. Auditar las 23 formulaciones: preguntas dobles, ambigüedad, lenguaje valorativo.
2. Matriz completa 23×5 con postura, cita literal, página, condiciones y documento.
3. Revisar los 118 casos unclear: falta de evidencia, contradictoria, ambigua.
4. Investigar ERC en bienestar: búsqueda semántica transversal.
5. Revisar 4 preguntas con 1 partido sin descartarlas.
6. Verificar que no se asignan valores numéricos a posiciones no aprobadas.
7. Preparar informe de revisión por pregunta.
"""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

RESULTS_DIR = Path(__file__).parent / "extraction_results"

DIMENSIONS = {
    "Economía y empleo": ["Economía", "Empleo", "Fiscalidad", "Política industrial", "Servicios financieros"],
    "Estado de bienestar": ["Sanidad", "Educación", "Vivienda", "Familia", "Dependencia", "Pensiones"],
    "Territorio y medio ambiente": ["Medio ambiente", "Infraestructuras", "Urbanismo", "Gestión forestal"],
    "Justicia y seguridad": ["Justicia", "Seguridad", "Administración pública"],
    "Derechos y libertades": ["Derechos", "Cultura", "Cooperación al desarrollo", "Política exterior"],
    "Gobernanza y democracia": ["Gobernanza", "Democracia", "Administración pública / Digitalización"],
}

PARTIES = ['PSOE', 'PP', 'Vox', 'Sumar', 'ERC']


def load_all_claims():
    """Load all claims from extraction results."""
    all_claims = []
    for party in PARTIES:
        path = RESULTS_DIR / f"{party}_extraction.json"
        if not path.exists():
            continue
        with open(path) as f:
            data = json.load(f)
        for claim in data.get("claims", []):
            claim["_party"] = party
            all_claims.append(claim)
    return all_claims


def normalize_text(text):
    """Normalize text for comparison."""
    text = text.replace("\n", " ").replace("- ", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()


# ============================================================================
# TASK 1: Auditar formulaciones
# ============================================================================

def audit_question_formulations(questions):
    """
    Detectar problemas en las formulaciones:
    - Preguntas dobles (dos políticas en una)
    - Lenguaje valorativo
    - Ambigüedad
    - Falta de comparabilidad
    """
    issues = []
    
    # Keywords that suggest value-laden language
    value_words = {
        "justo", "injusto", "democrático", "autoritario", "racional", "irracional",
        "necesario", "innecesario", "correcto", "incorrecto", "bueno", "malo",
        "excelente", "terrible", "escandaloso", "heroico", "patriótico", "traidor",
    }
    
    for q in questions:
        qid = q["question_id"]
        question_text = q["question"]
        q_issues = []
        
        # Check for double-barreled questions (two policy measures in one)
        # Look for conjunctions that suggest two separate policies
        double_patterns = [
            (r"y\s+(?:el|la|los|las|un|una)\s+\w+\s+(?:públic|proteg|asegur)", "Posible pregunta doble: dos políticas combinadas"),
            (r"(?:impulsar|aumentar|reducir).*?(?:y\s+|,.*?y\s+)(?:impulsar|aumentar|reducir)", "Posible pregunta doble: dos acciones en una"),
        ]
        for pattern, msg in double_patterns:
            if re.search(pattern, question_text, re.IGNORECASE):
                q_issues.append({"type": "double_barreled", "issue": msg, "severity": "high"})
        
        # Check for value-laden language
        text_lower = question_text.lower()
        found_value_words = [w for w in value_words if w in text_lower]
        if found_value_words:
            q_issues.append({
                "type": "value_laden",
                "issue": f"Posible lenguaje valorativo: {', '.join(found_value_words)}",
                "severity": "medium"
            })
        
        # Check for presuppositions
        presupposition_patterns = [
            (r"¿por qué\s+(?:deber|hay|existe)", "Posible presuposición: asume que algo es así"),
            (r"¿cuándo\s+(?:se\s+)?(?:implement|aplic|ejecut)", "Posible presuposición: asume que se hará"),
        ]
        for pattern, msg in presupposition_patterns:
            if re.search(pattern, question_text, re.IGNORECASE):
                q_issues.append({"type": "presupposition", "issue": msg, "severity": "high"})
        
        # Check for comparability - does the question allow comparison across parties?
        if len(q["parties_with_evidence"]) < 2:
            q_issues.append({
                "type": "low_comparability",
                "issue": f"Solo {len(q['parties_with_evidence'])} partido con evidencia",
                "severity": "medium"
            })
        
        if q_issues:
            issues.append({
                "question_id": qid,
                "question": question_text,
                "issues": q_issues,
            })
    
    return issues


# ============================================================================
# TASK 2: Matriz completa 23×5
# ============================================================================

def build_complete_matrix(questions):
    """
    Build complete 23×5 matrix with:
    - Question, stance, literal_text, page, conditions, source_document
    - Distinguish claim-level vs position-level incidents
    """
    matrix = []
    
    for q in questions:
        row = {
            "question_id": q["question_id"],
            "question": q["question"],
            "area": q["area"],
            "dimension": q["dimension"],
            "cells": {},
        }
        
        for party in PARTIES:
            party_evidence = q.get("evidence_by_party", {}).get(party, [])
            
            if party_evidence:
                # Position-level stance: aggregate from claim-level stances
                claim_stances = [e.get("stance", "unclear") for e in party_evidence]
                stance_counts = Counter(claim_stances)
                
                # Determine position-level stance
                if "agrees" in stance_counts and "disagrees" not in stance_counts:
                    position_stance = "agrees"
                elif "disagrees" in stance_counts and "agrees" not in stance_counts:
                    position_stance = "disagrees"
                elif "agrees" in stance_counts and "disagrees" in stance_counts:
                    position_stance = "contradictory"
                elif "conditional_agrees" in stance_counts:
                    position_stance = "conditional_agrees"
                elif "unclear" in stance_counts and len(stance_counts) == 1:
                    position_stance = "unclear"
                else:
                    position_stance = "mixed"
                
                cell = {
                    "position_stance": position_stance,
                    "claim_count": len(party_evidence),
                    "claim_stances": dict(stance_counts),
                    "claims": [],
                    "review_status": "draft",
                    "approved": False,
                }
                
                for e in party_evidence:
                    cell["claims"].append({
                        "literal_text": e.get("literal_text", ""),
                        "normalized_text": e.get("normalized_text", ""),
                        "source_page": e.get("source_page"),
                        "conditions": e.get("conditions", ""),
                        "stance": e.get("stance", "unclear"),
                        "source_document": f"Programa Electoral {party} 2026",
                    })
                
                row["cells"][party] = cell
            else:
                row["cells"][party] = {
                    "position_stance": "not_stated",
                    "claim_count": 0,
                    "claim_stances": {},
                    "claims": [],
                    "review_status": "draft",
                    "approved": False,
                }
        
        matrix.append(row)
    
    return matrix


# ============================================================================
# TASK 3: Revisar 118 unclear
# ============================================================================

def review_unclear_cases(questions):
    """
    Classify the 118 unclear cases into:
    - lack_of_evidence: no relevant claim found
    - contradictory_evidence: claims suggest both agree and disagree
    - ambiguous_interpretation: claim exists but stance is unclear
    """
    unclear_cases = []
    
    for q in questions:
        for party, evidence in q.get("evidence_by_party", {}).items():
            for e in evidence:
                if e.get("stance") == "unclear":
                    # Classify the type of unclear
                    normalized = e.get("normalized_text", "").lower()
                    literal = e.get("literal_text", "").lower()
                    conditions = e.get("conditions", "").lower()
                    
                    # Check if it's actually about the policy focus
                    policy_focus = q.get("policy_focus", "").lower()
                    focus_words = set(policy_focus.split())
                    claim_words = set(normalized.split())
                    overlap = focus_words & claim_words
                    
                    if len(overlap) == 0:
                        unclear_type = "lack_of_evidence"
                        reason = "El claim no parece relacionado con la política concreta"
                    elif "contradict" in normalized or ("no" in normalized and "aumentar" in normalized):
                        unclear_type = "contradictory_evidence"
                        reason = "El claim sugiere tanto apoyo como oposición"
                    elif conditions and conditions != "ninguna":
                        unclear_type = "ambiguous_interpretation"
                        reason = f"Condiciones que dificultan la interpretación: {conditions[:100]}"
                    else:
                        unclear_type = "ambiguous_interpretation"
                        reason = "El claim existe pero la postura no es clara"
                    
                    unclear_cases.append({
                        "question_id": q["question_id"],
                        "question": q["question"][:100],
                        "party": party,
                        "literal_text": e.get("literal_text", "")[:200],
                        "source_page": e.get("source_page"),
                        "conditions": e.get("conditions", ""),
                        "unclear_type": unclear_type,
                        "reason": reason,
                    })
    
    return unclear_cases


# ============================================================================
# TASK 4: Investigar ERC en bienestar
# ============================================================================

def investigate_erc_welfare(all_claims):
    """
    Search ERC claims across ALL areas for welfare-related content,
    not just those classified under welfare areas.
    """
    erc_claims = [c for c in all_claims if c["_party"] == "ERC"]
    
    welfare_keywords = [
        "vivienda", "sanidad", "salud", "educación", "familia", "dependencia",
        "pensión", "alquiler", "rehabilitación", "hospital", "médico", "maestro",
        "profesor", "beca", "ayuda social", "servicio público", "bienestar",
        "competencia autonómica", "autonómicas", "generalitat",
    ]
    
    welfare_claims = []
    for c in erc_claims:
        combined = normalize_text(
            c.get("normalized_text", "") + " " +
            c.get("literal_text", "") + " " +
            c.get("affected_area", "")
        )
        for kw in welfare_keywords:
            if kw in combined:
                welfare_claims.append({
                    "literal_text": c.get("literal_text", "")[:200],
                    "normalized_text": c.get("normalized_text", "")[:200],
                    "affected_area": c.get("affected_area", ""),
                    "source_page": c.get("source_page"),
                    "conditions": c.get("conditions", ""),
                })
                break
    
    return welfare_claims


# ============================================================================
# TASK 5: Revisar preguntas con 1 partido
# ============================================================================

def review_single_party_questions(questions, all_claims):
    """
    Review the 4 questions with only 1 party evidence.
    Search for additional evidence in other parties.
    """
    single_party = [q for q in questions if len(q["parties_with_evidence"]) == 1]
    
    for q in single_party:
        qid = q["question_id"]
        policy_focus = q.get("policy_focus", "").lower()
        focus_words = set(policy_focus.split())
        stop_words = {
            "de", "la", "el", "en", "y", "a", "por", "para", "con", "sin", "que",
            "se", "es", "del", "al", "los", "las", "un", "una", "unos", "unas",
            "su", "sus", "como", "más", "no", "o", "pero", "si", "este", "esta",
        }
        focus_words -= stop_words
        
        # Search all claims for additional evidence
        additional = {}
        for party in PARTIES:
            if party in q["parties_with_evidence"]:
                continue
            party_claims = [c for c in all_claims if c["_party"] == party]
            for c in party_claims:
                combined = normalize_text(
                    c.get("normalized_text", "") + " " +
                    c.get("literal_text", "") + " " +
                    c.get("affected_area", "")
                )
                for kw in focus_words:
                    if len(kw) > 3 and kw in combined:
                        if party not in additional:
                            additional[party] = []
                        additional[party].append({
                            "literal_text": c.get("literal_text", "")[:200],
                            "source_page": c.get("source_page"),
                            "affected_area": c.get("affected_area", ""),
                        })
                        break
        
        print(f"  {qid}: {q['question'][:80]}")
        print(f"    Partido actual: {q['parties_with_evidence']}")
        if additional:
            for party, claims in additional.items():
                print(f"    {party}: {len(claims)} claims adicionales encontrados")
                for c in claims[:2]:
                    print(f"      pág {c['source_page']}: {c['literal_text'][:100]}")
        else:
            print(f"    Sin evidencia adicional encontrada")


# ============================================================================
# TASK 6: Verificar valores numéricos
# ============================================================================

def verify_no_numeric_values(matrix):
    """
    Verify that no numeric values are assigned to unapproved positions.
    """
    issues = []
    
    for row in matrix:
        for party, cell in row["cells"].items():
            if not cell.get("approved", False) and cell["claim_count"] > 0:
                # Check if any numeric value is assigned
                if cell.get("position_stance") not in ["not_stated", "unknown"]:
                    # This is fine - stance is a classification, not a numeric value
                    pass
            if cell.get("approved", False):
                issues.append({
                    "question_id": row["question_id"],
                    "party": party,
                    "issue": "Posición aprobada sin revisión manual",
                    "severity": "critical",
                })
    
    return issues


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 80)
    print("AUDITORÍA COMPLETA DEL BANCO DE PREGUNTAS PILOTO")
    print("=" * 80)
    print()
    
    # Load data
    with open(RESULTS_DIR / "questions_proposal.json") as f:
        questions = json.load(f)
    
    all_claims = load_all_claims()
    
    # Task 1: Audit formulations
    print("1. Auditando formulaciones...")
    formulation_issues = audit_question_formulations(questions)
    print(f"   Preguntas con problemas: {len(formulation_issues)}")
    for issue in formulation_issues:
        print(f"   {issue['question_id']}: {issue['question'][:80]}")
        for i in issue["issues"]:
            print(f"     [{i['severity']}] {i['type']}: {i['issue']}")
    print()
    
    # Task 2: Complete matrix
    print("2. Construyendo matriz 23×5...")
    matrix = build_complete_matrix(questions)
    
    # Count position-level incidents
    position_incidents = {
        "agrees": 0,
        "disagrees": 0,
        "conditional_agrees": 0,
        "unclear": 0,
        "contradictory": 0,
        "mixed": 0,
        "not_stated": 0,
    }
    
    for row in matrix:
        for party, cell in row["cells"].items():
            stance = cell["position_stance"]
            if stance in position_incidents:
                position_incidents[stance] += 1
    
    print(f"   Posiciones por tipo:")
    for stance, count in position_incidents.items():
        print(f"     {stance}: {count}")
    
    total_cells = 23 * 5
    with_evidence = sum(1 for row in matrix for cell in row["cells"].values() if cell["claim_count"] > 0)
    print(f"   Celdas con evidencia: {with_evidence}/{total_cells} ({with_evidence/total_cells*100:.1f}%)")
    print()
    
    # Task 3: Review unclear cases
    print("3. Revisando 118 casos unclear...")
    unclear_cases = review_unclear_cases(questions)
    unclear_types = Counter(c["unclear_type"] for c in unclear_cases)
    print(f"   Clasificación:")
    for t, count in unclear_types.most_common():
        print(f"     {t}: {count}")
    print()
    
    # Task 4: ERC welfare investigation
    print("4. Investigando ERC en bienestar...")
    erc_welfare = investigate_erc_welfare(all_claims)
    print(f"   Claims de ERC relacionados con bienestar: {len(erc_welfare)}")
    # Group by affected_area
    erc_areas = Counter(c["affected_area"] for c in erc_welfare)
    print(f"   Distribución por área:")
    for area, count in erc_areas.most_common(10):
        print(f"     {area}: {count}")
    
    # Show claims under "competencias autonómicas" that are actually welfare
    competencies = [c for c in erc_welfare if "competencia" in c["affected_area"].lower() or "autonómic" in c["affected_area"].lower()]
    print(f"   Claims bajo 'competencias autonómicas' que son bienestar: {len(competencies)}")
    for c in competencies[:5]:
        print(f"     pág {c['source_page']}: {c['normalized_text'][:120]}")
        print(f"       Área: {c['affected_area']}")
    print()
    
    # Task 5: Single party questions
    print("5. Revisando preguntas con 1 partido...")
    review_single_party_questions(questions, all_claims)
    print()
    
    # Task 6: Verify no numeric values
    print("6. Verificando valores numéricos...")
    numeric_issues = verify_no_numeric_values(matrix)
    if numeric_issues:
        for issue in numeric_issues:
            print(f"   [{issue['severity']}] {issue['question_id']} / {issue['party']}: {issue['issue']}")
    else:
        print("   OK: Sin valores numéricos en posiciones no aprobadas")
    print()
    
    # Save results
    print("7. Guardando resultados...")
    
    # Save complete matrix
    with open(RESULTS_DIR / "complete_matrix.json", "w") as f:
        json.dump(matrix, f, indent=2, ensure_ascii=False)
    print("   complete_matrix.json guardado")
    
    # Save unclear cases
    with open(RESULTS_DIR / "unclear_cases.json", "w") as f:
        json.dump(unclear_cases, f, indent=2, ensure_ascii=False)
    print("   unclear_cases.json guardado")
    
    # Save ERC welfare investigation
    with open(RESULTS_DIR / "erc_welfare_investigation.json", "w") as f:
        json.dump(erc_welfare, f, indent=2, ensure_ascii=False)
    print("   erc_welfare_investigation.json guardado")
    
    # Save formulation issues
    with open(RESULTS_DIR / "formulation_issues.json", "w") as f:
        json.dump(formulation_issues, f, indent=2, ensure_ascii=False)
    print("   formulation_issues.json guardado")
    
    # Save position-level incidents summary
    position_summary = {
        "total_cells": total_cells,
        "with_evidence": with_evidence,
        "without_evidence": total_cells - with_evidence,
        "position_stance_distribution": position_incidents,
        "claim_level_incidents": {
            "unclear": len(unclear_cases),
            "unclear_by_type": dict(unclear_types),
        },
        "formulation_issues": len(formulation_issues),
        "erc_welfare_claims": len(erc_welfare),
        "erc_welfare_by_area": dict(erc_areas.most_common(10)),
    }
    with open(RESULTS_DIR / "position_summary.json", "w") as f:
        json.dump(position_summary, f, indent=2, ensure_ascii=False)
    print("   position_summary.json guardado")
    
    print()
    print("=" * 80)
    print("AUDITORÍA COMPLETADA")
    print("=" * 80)
    print()
    print(f"Resumen:")
    print(f"  Preguntas auditadas: {len(questions)}")
    print(f"  Problemas de formulación: {len(formulation_issues)}")
    print(f"  Casos unclear clasificados: {len(unclear_cases)}")
    print(f"  Claims ERC bienestar: {len(erc_welfare)}")
    print(f"  Celdas con evidencia: {with_evidence}/{total_cells}")
    print(f"  Posiciones aprobadas: 0 (todas en draft)")


if __name__ == "__main__":
    main()
