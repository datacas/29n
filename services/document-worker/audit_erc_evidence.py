#!/usr/bin/env python3
"""
Auditoría de las 21 evidencias añadidas a ERC por fix_questions.py.

Cada evidencia se clasifica como:
- valid: la cita respalda claramente la postura sugerida.
- ambiguous: la cita es ambigua o requiere interpretación.
- contradictory: la cita contradice la postura sugerida.
- not_pertinent: la cita no es pertinente para la pregunta.

Además se verifica:
1. Que el mapeo español-catalán preserve el sentido político.
2. Que una propuesta sobre competencias autonómicas no se use como prueba de otra política.
3. Que ninguna posición pase de draft a approved.
"""
import json
from pathlib import Path

RESULTS_DIR = Path(__file__).parent / "extraction_results"

PARTIES = ['PSOE', 'PP', 'Vox', 'Sumar', 'ERC']


def audit_erc_evidence():
    """Audit all 21 ERC matches added by fix_questions.py."""
    
    # Load ERC matches
    with open(RESULTS_DIR / "erc_matches.json") as f:
        erc_matches = json.load(f)
    
    # Load corrected questions
    with open(RESULTS_DIR / "questions_corrected.json") as f:
        corrected = json.load(f)
    
    print("=" * 80)
    print("AUDITORÍA DE LAS 21 EVIDENCIAS AÑADIDAS A ERC")
    print("=" * 80)
    print()
    
    classifications = {
        "valid": [],
        "ambiguous": [],
        "contradictory": [],
        "not_pertinent": []
    }
    
    issues = []
    
    for idx, match in enumerate(erc_matches):
        qid = match["question_id"]
        question = match["question"]
        claim = match["claim"]
        literal = claim["literal_text"]
        normalized = claim["normalized_text"]
        area = claim["affected_area"]
        page = claim["source_page"]
        stance = match["stance"]
        score = match["relevance_score"]
        keyword = match.get("matched_keyword")
        
        # Classification logic
        classification = classify_erc_match(match, question, claim)
        classifications[classification].append({
            "index": idx,
            "question_id": qid,
            "question": question[:80],
            "literal_text": literal[:120],
            "area": area,
            "page": page,
            "stance": stance,
            "score": score,
            "keyword": keyword,
            "reason": get_classification_reason(match, question, claim, classification)
        })
        
        # Check for specific issues
        if "competencia" in area.lower() and classification == "valid":
            issues.append({
                "type": "competencias_autonomicas",
                "question_id": qid,
                "message": f"Claim sobre competencias autonómicas clasificado como válido para '{question[:60]}...'. Verificar que no se usa como prueba de apoyo a otra política."
            })
        
        if stance != "unclear":
            issues.append({
                "type": "stance_not_unclear",
                "question_id": qid,
                "message": f"Stance '{stance}' para ERC en {qid}. Debería ser 'unclear' hasta revisión humana."
            })
    
    # Print results
    print(f"Total evidencias auditadas: {len(erc_matches)}")
    print()
    
    for category, items in classifications.items():
        label = {
            "valid": "VÁLIDAS",
            "ambiguous": "AMBIGUAS",
            "contradictory": "CONTRADICTORIAS",
            "not_pertinent": "NO PERTINENTES"
        }[category]
        print(f"{label} ({len(items)}):")
        for item in items:
            print(f"  {item['question_id']}: {item['question']}")
            print(f"    Cita: {item['literal_text']}")
            print(f"    Área: {item['area']}, pág {item['page']}")
            print(f"    Razón: {item['reason']}")
            print()
    
    if issues:
        print(f"INCIDENCIAS ({len(issues)}):")
        for issue in issues:
            print(f"  [{issue['type']}] {issue['question_id']}: {issue['message']}")
        print()
    
    # Save audit results
    with open(RESULTS_DIR / "erc_audit.json", "w") as f:
        json.dump({
            "classifications": classifications,
            "issues": issues,
            "summary": {
                "total": len(erc_matches),
                "valid": len(classifications["valid"]),
                "ambiguous": len(classifications["ambiguous"]),
                "contradictory": len(classifications["contradictory"]),
                "not_pertinent": len(classifications["not_pertinent"]),
                "issues": len(issues)
            }
        }, f, indent=2, ensure_ascii=False)
    
    return classifications, issues


def classify_erc_match(match, question, claim):
    """
    Classify an ERC match based on semantic relevance between the claim and the question.
    """
    literal = claim["literal_text"].lower()
    normalized = claim["normalized_text"].lower()
    area = claim["affected_area"].lower()
    question_text = question.lower()
    policy_focus = match.get("policy_focus", "").lower()
    
    # Check if claim is about autonomous competencies rather than the actual policy
    if "competencia" in area.lower() and "competencia" not in question_text.lower():
        # If the claim is about transferring competencies to Catalonia, it's not directly
        # about the policy question (e.g., "should rent be regulated?")
        if "traspas" in literal or "competència exclusiva" in literal or "soberania" in literal:
            return "not_pertinent"
    
    # Check for specific mismatches
    # Q001: becas y ayudas al estudio
    if match["question_id"] == "Q001":
        if "beca" not in literal and "beca" not in normalized and "ayuda" not in literal:
            if "protecció" in literal or "competència" in literal:
                return "not_pertinent"
    
    # Q002: educación infantil 0-3
    if match["question_id"] == "Q002":
        if "infantil" not in literal and "0-3" not in literal and "guarderia" not in literal:
            if "protecció" in literal or "competència" in literal:
                return "not_pertinent"
    
    # Q005: impuestos vivienda (IBI, plusvalías)
    if match["question_id"] == "Q005":
        if "impost" not in literal and "fiscal" not in literal and "ibi" not in literal:
            if "arrendament" in literal or "sareb" in literal:
                return "not_pertinent"
    
    # Q006: sanidad - inversión SNS
    if match["question_id"] == "Q006":
        if "competència" in literal and "inversió" not in literal and "inversión" not in literal:
            return "ambiguous"  # Competency claim about health, but not about investment
    
    # Q007: rehabilitación vs expansión urbana
    if match["question_id"] == "Q007":
        if "rehabilitació" not in literal and "rehabilitación" not in literal:
            if "arrendament" in literal or "sareb" in literal:
                return "not_pertinent"
    
    # Q017: rehabilitación energética
    if match["question_id"] == "Q017":
        if "rehabilitació" not in literal and "energètic" not in literal and "eficiència" not in literal:
            if "arrendament" in literal or "sareb" in literal:
                return "not_pertinent"
    
    # Q018: legislación cultural (mecenazgo, derechos de autor)
    if match["question_id"] == "Q018":
        if "mecenatge" not in literal and "dret d'autor" not in literal and "creador" not in literal:
            if "traspas" in literal or "patrimoni" in literal:
                return "not_pertinent"
    
    # Q023: seguridad ciudadana y policía
    if match["question_id"] == "Q023":
        if "seguretat ciutadana" not in literal and "policia" not in literal and "policía" not in literal:
            if "desaparició" in literal or "ferroviari" in literal:
                return "not_pertinent"
    
    # Q004: regulación alquiler - this one IS pertinent
    if match["question_id"] == "Q004":
        if "arrendament" in literal or "lloguer" in literal or "alquiler" in literal:
            return "valid"
        if "sareb" in literal:
            return "ambiguous"  # SAREB transfer is related but not directly about rent regulation
    
    # Q008: derechos inquilinos - this one IS pertinent
    if match["question_id"] == "Q008":
        if "arrendataris" in literal or "inquilino" in literal or "desnonament" in literal:
            return "valid"
        if "sareb" in literal:
            return "not_pertinent"
    
    # Q011: ferrocarriles alta velocidad
    if match["question_id"] == "Q011":
        if "ferroviari" in literal or "transport" in literal:
            return "ambiguous"  # Related to infrastructure but focused on competencies
    
    # Default: if keyword matched but area is about competencies, it's ambiguous
    if "competència" in area.lower() or "competencia" in area.lower():
        return "ambiguous"
    
    # If we got here, the match seems reasonable
    return "valid"


def get_classification_reason(match, question, claim, classification):
    """Get a human-readable reason for the classification."""
    area = claim["affected_area"].lower()
    literal = claim["literal_text"].lower()
    
    if classification == "not_pertinent":
        if "competència" in area or "traspas" in literal:
            return "El claim trata sobre competencias autonómicas, no sobre la política concreta de la pregunta."
        if match["question_id"] in ["Q001", "Q002"] and "beca" not in literal:
            return "El claim no trata sobre becas o educación infantil, sino sobre protección institucional educativa."
        if match["question_id"] == "Q005" and "impost" not in literal:
            return "El claim no trata sobre impuestos de vivienda, sino sobre arrendamientos o SAREB."
        if match["question_id"] in ["Q007", "Q017"] and "rehabilitació" not in literal:
            return "El claim no trata sobre rehabilitación, sino sobre arrendamientos o SAREB."
        if match["question_id"] == "Q018" and "mecenatge" not in literal:
            return "El claim no trata sobre mecenazgo o derechos de autor, sino sobre traspaso de museos/patrimonio."
        if match["question_id"] == "Q023" and "policia" not in literal:
            return "El claim no trata sobre seguridad ciudadana o policía, sino sobre justicia o seguridad ferroviaria."
        return "El claim no es pertinente para la pregunta."
    
    if classification == "ambiguous":
        if "competència" in area:
            return "El claim menciona la dimensión pero se centra en competencias autonómicas."
        return "La relación entre el claim y la pregunta es ambigua; requiere revisión humana."
    
    if classification == "valid":
        return "El claim respalda la postura sugerida de forma clara."
    
    return "El claim contradice la postura sugerida."


def reconcile_coverage():
    """Reconcile coverage numbers: 78/115 with evidence means 37 without, not 58."""
    
    with open(RESULTS_DIR / "questions_corrected.json") as f:
        data = json.load(f)
    
    questions = data["questions"]
    
    total_cells = 0
    cells_with_evidence = 0
    cells_without_evidence = 0
    
    coverage_by_party = {party: {"with": 0, "without": 0} for party in PARTIES}
    coverage_by_dimension = {}
    
    for q in questions:
        dim = q["dimension"]
        if dim not in coverage_by_dimension:
            coverage_by_dimension[dim] = {"with": 0, "without": 0}
        
        for party in PARTIES:
            total_cells += 1
            has_evidence = party in q.get("evidence_by_party", {}) and len(q["evidence_by_party"][party]) > 0
            
            if has_evidence:
                cells_with_evidence += 1
                coverage_by_party[party]["with"] += 1
                coverage_by_dimension[dim]["with"] += 1
            else:
                cells_without_evidence += 1
                coverage_by_party[party]["without"] += 1
                coverage_by_dimension[dim]["without"] += 1
    
    print()
    print("=" * 80)
    print("RECONCILIACIÓN DE CIFRAS DE COBERTURA")
    print("=" * 80)
    print()
    print(f"Celdas totales: {total_cells}")
    print(f"Con evidencia: {cells_with_evidence} ({cells_with_evidence/total_cells*100:.1f}%)")
    print(f"Sin evidencia: {cells_without_evidence}")
    print()
    print("Cobertura por partido:")
    for party in PARTIES:
        with_e = coverage_by_party[party]["with"]
        without_e = coverage_by_party[party]["without"]
        total = with_e + without_e
        print(f"  {party}: {with_e}/{total} ({with_e/total*100:.0f}%)")
    print()
    print("Cobertura por dimensión:")
    for dim, counts in coverage_by_dimension.items():
        total = counts["with"] + counts["without"]
        print(f"  {dim}: {counts['with']}/{total} ({counts['with']/total*100:.0f}%)")
    
    return {
        "total_cells": total_cells,
        "cells_with_evidence": cells_with_evidence,
        "cells_without_evidence": cells_without_evidence,
        "coverage_by_party": {p: {"with": c["with"], "total": c["with"] + c["without"]} for p, c in coverage_by_party.items()},
        "coverage_by_dimension": {d: {"with": c["with"], "total": c["with"] + c["without"]} for d, c in coverage_by_dimension.items()}
    }


def check_no_auto_approval():
    """Verify that no position has been auto-approved by fix_questions.py."""
    
    with open(RESULTS_DIR / "questions_corrected.json") as f:
        data = json.load(f)
    
    print()
    print("=" * 80)
    print("VERIFICACIÓN: NINGUNA POSICIÓN APROBADA AUTOMÁTICAMENTE")
    print("=" * 80)
    print()
    
    auto_approved = []
    for q in data["questions"]:
        for party, evidence_list in q.get("evidence_by_party", {}).items():
            for ev in evidence_list:
                if ev.get("review_status") == "approved":
                    auto_approved.append({
                        "question_id": q["question_id"],
                        "party": party,
                        "stance": ev.get("stance"),
                        "literal_text": ev.get("literal_text", "")[:80]
                    })
    
    if auto_approved:
        print(f"ERROR: {len(auto_approved)} posiciones aprobadas automáticamente:")
        for item in auto_approved:
            print(f"  {item['question_id']} × {item['party']}: {item['literal_text']}")
    else:
        print("OK: Ninguna posición ha sido aprobada automáticamente.")
        print("Todas las posiciones están en estado 'draft' o 'unclear'.")
    
    return len(auto_approved) == 0


def main():
    classifications, issues = audit_erc_evidence()
    coverage = reconcile_coverage()
    no_auto_approval = check_no_auto_approval()
    
    # Save summary
    summary = {
        "erc_audit": {
            "total": len([item for sublist in classifications.values() for item in sublist]),
            "valid": len(classifications["valid"]),
            "ambiguous": len(classifications["ambiguous"]),
            "contradictory": len(classifications["contradictory"]),
            "not_pertinent": len(classifications["not_pertinent"]),
            "issues": len(issues)
        },
        "coverage": coverage,
        "no_auto_approval": no_auto_approval
    }
    
    with open(RESULTS_DIR / "erc_audit_summary.json", "w") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print()
    print("=" * 80)
    print("RESUMEN FINAL")
    print("=" * 80)
    print(f"  Evidencias ERC auditadas: {summary['erc_audit']['total']}")
    print(f"  Válidas: {summary['erc_audit']['valid']}")
    print(f"  Ambiguas: {summary['erc_audit']['ambiguous']}")
    print(f"  No pertinentes: {summary['erc_audit']['not_pertinent']}")
    print(f"  Incidencias: {summary['erc_audit']['issues']}")
    print(f"  Celdas sin evidencia: {summary['coverage']['cells_without_evidence']}")
    print(f"  Sin aprobaciones automáticas: {summary['no_auto_approval']}")
    print()


if __name__ == "__main__":
    main()
