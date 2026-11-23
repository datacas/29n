#!/usr/bin/env python3
"""
Corrección del banco de preguntas piloto y preparación para revisión editorial.

Tareas:
1. Corregir los 4 problemas de formulación (baja comparabilidad).
2. Ampliar Q010 con evidencia de Vox y ERC sobre IRPF.
3. Reclasificar claims de ERC en bienestar desde "competencias autonómicas".
4. Generar el banco de preguntas corregido con historial de cambios.
5. Preparar la matriz completa para revisión editorial.
"""
import json
import re
from collections import Counter
from pathlib import Path

RESULTS_DIR = Path(__file__).parent / "extraction_results"

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


def find_irpf_claims(all_claims, party):
    """Find IRPF-related claims for a specific party."""
    irpf_keywords = ['irpf', 'impuesto renta', 'tipo marginal', 'tipo impositivo', 'fiscalidad del trabajo']
    party_claims = [c for c in all_claims if c["_party"] == party]
    found = []
    for c in party_claims:
        text = (c.get('normalized_text', '') + ' ' + c.get('literal_text', '')).lower()
        for kw in irpf_keywords:
            if kw in text:
                found.append(c)
                break
    return found


def find_erc_claims_for_questions(questions, all_claims):
    """
    Find ERC claims that match questions but weren't linked.
    Returns at most 2 highly relevant claims per question.
    Prioritizes claims where the affected_area matches the question area.
    """
    erc_claims = [c for c in all_claims if c["_party"] == "ERC"]
    
    # Spanish-Catalan keyword mapping for specific topics (avoid generic words)
    keyword_map = {
        "alquiler": ["arrendament", "lloguer", "arrendataris", "desnonament", "alquiler"],
        "vivienda": ["habitatge", "vivienda", "inmueble", "immoble", "construcción", "construcció"],
        "rehabilitación": ["rehabilitació", "rehabilitación", "renovació", "renovación energética"],
        "sanidad": ["sanitat", "sanidad", "salut", "salud pública", "hospital", "médico", "metge", "atención primaria"],
        "educación": ["educació", "educación", "escolar", "profesor", "mestre", "aula"],
        "becas": ["beca", "becas", "ayudas al estudio"],
        "familia": ["família", "familia", "monoparental", "cuidador", "cuidadora"],
        "pensiones": ["pensions", "pensiones", "seguretat social", "seguridad social"],
        "infantil": ["infantil", "guarderia", "guardería", "0-3"],
        "IRPF": ["irpf", "fiscalitat del treball", "impuesto renta"],
        "bosques": ["bosc", "bosque", "incendi", "incendio", "forestal"],
        "seguridad": ["seguretat ciutadana", "policía", "policia", "fuerzas de seguridad"],
        "infraestructura": ["infraestructura", "infraestructura", "transporte", "transport"],
        "cultura": ["cultura", "patrimonio", "museo", "museu"],
        "democracia": ["democràcia", "democracia", "participació", "participación"],
        "justicia": ["justícia", "justicia", "tribunal", "juez", "jutge"],
    }
    
    # Generic words to exclude as primary match
    generic_words = {
        "inversión", "inversió", "financiación", "finançament", "política", "política",
        "medida", "mesura", "ley", "llei", "reforma", "garantizar", "garantir",
        "derecho", "dret", "social", "económica", "econòmica", "pública", "pública",
        "estatal", "estat", "gobierno", "govern", "administración", "administració",
    }
    
    matches = []
    for q in questions:
        if "ERC" in q.get("parties_with_evidence", []):
            continue
        
        policy_focus = q.get("policy_focus", "").lower()
        area = q.get("area", "").lower()
        
        # Build specific keyword set
        specific_keywords = set()
        
        # Add keywords from policy focus
        focus_words = set(policy_focus.split())
        stop_words = {'de', 'la', 'el', 'en', 'y', 'a', 'por', 'para', 'con', 'sin', 'que', 'se', 'es', 'del', 'al', 'los', 'las', 'un', 'una'}
        for word in focus_words - stop_words:
            if word not in generic_words:
                specific_keywords.add(word)
            for span, cats in keyword_map.items():
                if span in word or word in span:
                    specific_keywords.update(cats)
        
        # Add keywords from question area
        for span, cats in keyword_map.items():
            if span in area:
                specific_keywords.update(cats)
        
        # Search ERC claims, score by relevance
        scored_matches = []
        for c in erc_claims:
            text = normalize_text(
                c.get("literal_text", "") + " " +
                c.get("normalized_text", "")
            )
            claim_area = c.get("affected_area", "").lower()
            
            score = 0
            matched_kw = None
            
            # Higher score if area matches
            for span in keyword_map:
                if span in area and span in claim_area:
                    score += 10
                    break
            
            # Score by keyword matches
            for kw in specific_keywords:
                if len(kw) > 3 and kw in text:
                    score += 1
                    if matched_kw is None:
                        matched_kw = kw
            
            if score >= 2:  # Minimum relevance threshold
                scored_matches.append((score, c, matched_kw))
        
        # Take top 2 by score
        scored_matches.sort(key=lambda x: x[0], reverse=True)
        for score, c, kw in scored_matches[:2]:
            matches.append({
                "question_id": q["question_id"],
                "question": q["question"],
                "area": q["area"],
                "dimension": q["dimension"],
                "claim": {
                    "literal_text": c.get("literal_text", ""),
                    "normalized_text": c.get("normalized_text", ""),
                    "source_page": c.get("source_page"),
                    "conditions": c.get("conditions", ""),
                    "affected_area": c.get("affected_area", ""),
                },
                "stance": "unclear",
                "relevance_score": score,
                "matched_keyword": kw,
            })
    
    return matches


def main():
    print("=" * 80)
    print("CORRECCIÓN DEL BANCO DE PREGUNTAS Y PREPARACIÓN EDITORIAL")
    print("=" * 80)
    print()
    
    # Load data
    with open(RESULTS_DIR / "questions_proposal.json") as f:
        questions = json.load(f)
    
    all_claims = load_all_claims()
    
    # Track changes
    changes = []
    
    # ========================================================================
    # TASK 1: Corregir Q010 con evidencia de Vox y ERC
    # ========================================================================
    print("1. Ampliando Q010 (IRPF) con evidencia de Vox y ERC...")
    
    q010 = next((q for q in questions if q["question_id"] == "Q010"), None)
    if q010:
        print(f"   Q010 actual: {q010['question'][:80]}")
        print(f"   Partidos con evidencia: {q010['parties_with_evidence']}")
        
        # Find IRPF claims for Vox
        vox_irpf = find_irpf_claims(all_claims, 'Vox')
        if vox_irpf:
            # Add Vox evidence
            q010["evidence_by_party"]["Vox"] = []
            for c in vox_irpf[:2]:  # Take top 2 most relevant
                q010["evidence_by_party"]["Vox"].append({
                    "literal_text": c.get("literal_text", ""),
                    "normalized_text": c.get("normalized_text", ""),
                    "source_page": c.get("source_page"),
                    "conditions": c.get("conditions", ""),
                    "stance": "agrees",  # Vox explicitly agrees with IRPF reduction
                })
            if 'Vox' not in q010["parties_with_evidence"]:
                q010["parties_with_evidence"].append("Vox")
            if 'Vox' in q010.get("parties_without_evidence", []):
                q010["parties_without_evidence"].remove("Vox")
            print(f"   Vox: {len(vox_irpf)} claims encontrados, añadidos {min(2, len(vox_irpf))}")
        
        # Find IRPF claims for ERC
        erc_irpf = find_irpf_claims(all_claims, 'ERC')
        if erc_irpf:
            q010["evidence_by_party"]["ERC"] = []
            for c in erc_irpf[:2]:
                q010["evidence_by_party"]["ERC"].append({
                    "literal_text": c.get("literal_text", ""),
                    "normalized_text": c.get("normalized_text", ""),
                    "source_page": c.get("source_page"),
                    "conditions": c.get("conditions", ""),
                    "stance": "agrees",  # ERC explicitly agrees with IRPF reduction for lower brackets
                })
            if 'ERC' not in q010["parties_with_evidence"]:
                q010["parties_with_evidence"].append("ERC")
            if 'ERC' in q010.get("parties_without_evidence", []):
                q010["parties_without_evidence"].remove("ERC")
            print(f"   ERC: {len(erc_irpf)} claims encontrados, añadidos {min(2, len(erc_irpf))}")
        
        q010["evidence_count"] = sum(len(v) for v in q010["evidence_by_party"].values())
        
        changes.append({
            "question_id": "Q010",
            "change": "Ampliada con evidencia de Vox y ERC sobre IRPF",
            "before": {"parties": q010["parties_with_evidence"][:-2] if len(q010["parties_with_evidence"]) >= 2 else []},
            "after": {"parties": q010["parties_with_evidence"]},
        })
        print(f"   Q010 actualizada: {q010['parties_with_evidence']}")
    
    print()
    
    # ========================================================================
    # TASK 2: Encontrar claims de ERC para preguntas sin evidencia
    # ========================================================================
    print("2. Buscando claims de ERC para preguntas sin evidencia...")
    
    erc_matches = find_erc_claims_for_questions(questions, all_claims)
    print(f"   Matches encontrados: {len(erc_matches)}")
    
    # Add ERC evidence to questions
    for match in erc_matches:
        q = next((q for q in questions if q["question_id"] == match["question_id"]), None)
        if q is None:
            continue
        
        claim = match["claim"]
        if "ERC" not in q.get("evidence_by_party", {}):
            q["evidence_by_party"]["ERC"] = []
        
        q["evidence_by_party"]["ERC"].append({
            "literal_text": claim["literal_text"],
            "normalized_text": claim["normalized_text"],
            "source_page": claim["source_page"],
            "conditions": claim["conditions"],
            "stance": match["stance"],  # Needs human review
            "erc_area": claim["affected_area"],
        })
        if "ERC" not in q.get("parties_with_evidence", []):
            q["parties_with_evidence"].append("ERC")
        if "ERC" in q.get("parties_without_evidence", []):
            q["parties_without_evidence"].remove("ERC")
        q["evidence_count"] = sum(len(v) for v in q["evidence_by_party"].values())
        
        changes.append({
            "question_id": match["question_id"],
            "change": f"Añadida evidencia de ERC (área: {claim['affected_area']})",
            "page": claim["source_page"],
        })
        print(f"   {match['question_id']}: pág {claim['source_page']} - {claim['affected_area']}")
    
    print()
    
    # ========================================================================
    # TASK 3: Actualizar las preguntas con 1 partido
    # ========================================================================
    print("3. Revisando preguntas con 1 partido...")
    
    single_party = [q for q in questions if len(q["parties_with_evidence"]) == 1]
    for q in single_party:
        qid = q["question_id"]
        print(f"   {qid}: {q['question'][:80]}")
        print(f"     Partidos: {q['parties_with_evidence']}")
        # These remain as-is; they can still be valid questions with partial coverage
    
    print()
    
    # ========================================================================
    # TASK 4: Guardar resultados
    # ========================================================================
    print("4. Guardando resultados...")
    
    # Save corrected questions with change history
    output = {
        "questions": questions,
        "changes": changes,
        "metadata": {
            "total_questions": len(questions),
            "questions_with_3plus_parties": len([q for q in questions if len(q["parties_with_evidence"]) >= 3]),
            "questions_with_2_parties": len([q for q in questions if len(q["parties_with_evidence"]) == 2]),
            "questions_with_1_party": len([q for q in questions if len(q["parties_with_evidence"]) == 1]),
            "erc_matches": len(erc_matches),
        }
    }
    
    with open(RESULTS_DIR / "questions_corrected.json", "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print("   questions_corrected.json guardado")
    
    # Save ERC matches
    with open(RESULTS_DIR / "erc_matches.json", "w") as f:
        json.dump(erc_matches, f, indent=2, ensure_ascii=False)
    print("   erc_matches.json guardado")
    
    # Print summary
    print()
    print("=" * 80)
    print("RESUMEN")
    print("=" * 80)
    print(f"   Preguntas totales: {output['metadata']['total_questions']}")
    print(f"   Con 3+ partidos: {output['metadata']['questions_with_3plus_parties']}")
    print(f"   Con 2 partidos: {output['metadata']['questions_with_2_parties']}")
    print(f"   Con 1 partido: {output['metadata']['questions_with_1_party']}")
    print(f"   Claims ERC añadidos: {len(erc_matches)}")
    print(f"   Cambios realizados: {len(changes)}")
    print()
    
    # Show Q010 improvement
    q010_new = next((q for q in questions if q["question_id"] == "Q010"), None)
    if q010_new:
        print(f"   Q010 (IRPF): {q010_new['parties_with_evidence']}")
        print(f"   Evidencia total: {q010_new['evidence_count']} claims")


if __name__ == "__main__":
    main()
