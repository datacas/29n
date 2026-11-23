#!/usr/bin/env python3
"""
Corrección del banco de preguntas tras la auditoría de ERC.

Elimina las evidencias no pertinentes de ERC y recalcula la cobertura real.
"""
import json
from pathlib import Path

RESULTS_DIR = Path(__file__).parent / "extraction_results"

PARTIES = ['PSOE', 'PP', 'Vox', 'Sumar', 'ERC']


def main():
    print("=" * 80)
    print("CORRECCIÓN DEL BANCO DE PREGUNTAS - Eliminación de evidencias no pertinentes")
    print("=" * 80)
    print()
    
    # Load corrected questions
    with open(RESULTS_DIR / "questions_corrected.json") as f:
        data = json.load(f)
    
    questions = data["questions"]
    
    # Load audit results to know which to remove
    with open(RESULTS_DIR / "erc_audit.json") as f:
        audit = json.load(f)
    
    # Build set of (question_id, literal_text) that are not_pertinent or contradictory
    remove_set = set()
    for item in audit["classifications"]["not_pertinent"]:
        remove_set.add((item["question_id"], item["literal_text"]))
    for item in audit["classifications"]["contradictory"]:
        remove_set.add((item["question_id"], item["literal_text"]))
    
    print(f"Evidencias a eliminar: {len(remove_set)}")
    print()
    
    removed_count = 0
    kept_count = 0
    
    for q in questions:
        qid = q["question_id"]
        if "ERC" not in q.get("evidence_by_party", {}):
            continue
        
        original_count = len(q["evidence_by_party"]["ERC"])
        new_evidence = []
        
        for ev in q["evidence_by_party"]["ERC"]:
            literal = ev.get("literal_text", "")
            key = (qid, literal)
            if key in remove_set:
                removed_count += 1
                print(f"  Eliminado: {qid} - {literal[:80]}...")
            else:
                new_evidence.append(ev)
                kept_count += 1
        
        if new_evidence:
            q["evidence_by_party"]["ERC"] = new_evidence
        else:
            # Remove ERC from evidence_by_party if no evidence left
            del q["evidence_by_party"]["ERC"]
            if "ERC" in q.get("parties_with_evidence", []):
                q["parties_with_evidence"].remove("ERC")
            if "ERC" not in q.get("parties_without_evidence", []):
                if "parties_without_evidence" not in q:
                    q["parties_without_evidence"] = []
                q["parties_without_evidence"].append("ERC")
        
        # Recalculate evidence_count
        q["evidence_count"] = sum(len(v) for v in q["evidence_by_party"].values())
    
    print()
    print(f"Eliminadas: {removed_count}")
    print(f"Mantenidas: {kept_count}")
    print()
    
    # Recalculate coverage
    total_cells = 0
    cells_with_evidence = 0
    coverage_by_party = {party: 0 for party in PARTIES}
    
    for q in questions:
        for party in PARTIES:
            total_cells += 1
            has_evidence = party in q.get("evidence_by_party", {}) and len(q["evidence_by_party"][party]) > 0
            if has_evidence:
                cells_with_evidence += 1
                coverage_by_party[party] += 1
    
    print("COBERTURA CORREGIDA:")
    print(f"  Celdas totales: {total_cells}")
    print(f"  Con evidencia: {cells_with_evidence} ({cells_with_evidence/total_cells*100:.1f}%)")
    print(f"  Sin evidencia: {total_cells - cells_with_evidence}")
    print()
    for party in PARTIES:
        print(f"  {party}: {coverage_by_party[party]}/{total_cells} ({coverage_by_party[party]/len(questions)*100:.0f}%)")
    
    # Save corrected bank
    data["changes"].append({
        "change": "Eliminadas evidencias no pertinentes de ERC tras auditoría",
        "removed": removed_count,
        "kept": kept_count,
        "audit_file": "erc_audit.json"
    })
    
    with open(RESULTS_DIR / "questions_corrected.json", "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print()
    print("Banco corregido guardado en questions_corrected.json")
    print()


if __name__ == "__main__":
    main()
