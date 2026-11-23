#!/usr/bin/env python3
"""
Seed the pilot question bank into PostgreSQL from questions_corrected.json.

This script reads the corrected question bank JSON and inserts:
1. Questions into the questions table with pilot_question_id linking to Q001-Q023.
2. Positions into the positions table with evidence_jsonb storing all claims.

All positions start with review_status = 'draft' — no auto-approval.

Usage:
  python3 seed_pilot_questions.py

Requires: PostgreSQL running with migrations 001-004 applied.
"""
import json
import os
import sys
from pathlib import Path

import psycopg
from psycopg import sql

RESULTS_DIR = Path(__file__).parent / "extraction_results"
QUESTIONS_FILE = RESULTS_DIR / "questions_corrected.json"

PARTIES = ['PSOE', 'PP', 'Vox', 'Sumar', 'ERC']

# Map dimension names to dimension codes for linking
DIMENSION_MAP = {
    'Estado de bienestar': 'bienestar',
    'Economía': 'economia',
    'Territorio': 'territorio',
    'Justicia': 'justicia',
    'Derechos': 'derechos',
    'Gobernanza': 'gobernanza',
}


def get_db_conn():
    """Get PostgreSQL connection from environment."""
    db_url = os.environ.get(
        'DATABASE_URL',
        'postgresql://app:password@localhost:5432/affinity'
    )
    return psycopg.connect(db_url)


def seed_questions():
    """Seed questions and positions from questions_corrected.json."""
    if not QUESTIONS_FILE.exists():
        print(f"ERROR: {QUESTIONS_FILE} not found")
        sys.exit(1)

    with open(QUESTIONS_FILE) as f:
        data = json.load(f)

    questions = data.get("questions", [])
    if not questions:
        print("ERROR: No questions found in JSON")
        sys.exit(1)

    print(f"Loading {len(questions)} questions from {QUESTIONS_FILE}")

    conn = get_db_conn()
    try:
        with conn.transaction():
            cur = conn.cursor()

            # Get entity IDs by name
            cur.execute("SELECT id, name FROM entities WHERE name = ANY(%s)", [PARTIES])
            entity_map = {row[1]: row[0] for row in cur.fetchall()}
            print(f"Entities found: {list(entity_map.keys())}")

            # Get dimension IDs by code
            dim_codes = list(DIMENSION_MAP.values())
            cur.execute("SELECT id, code FROM dimensions WHERE code = ANY(%s)", [dim_codes])
            dimension_map = {row[1]: row[0] for row in cur.fetchall()}
            print(f"Dimensions found: {list(dimension_map.keys())}")

            # Seed questions
            questions_seeded = 0
            questions_skipped = 0
            question_id_map = {}  # pilot_question_id -> db question_id

            for q in questions:
                qid = q["question_id"]
                canonical_text = q["question"]
                dimension_name = q.get("dimension", "")
                dim_code = DIMENSION_MAP.get(dimension_name)
                dim_id = dimension_map.get(dim_code) if dim_code else None

                # Check if already exists
                cur.execute(
                    "SELECT id FROM questions WHERE pilot_question_id = %s",
                    [qid]
                )
                existing = cur.fetchone()

                if existing:
                    question_id_map[qid] = existing[0]
                    questions_skipped += 1
                    continue

                # Insert question
                cur.execute(
                    """INSERT INTO questions 
                       (pilot_question_id, canonical_text, answer_type, depth_level, status, topic_id)
                       VALUES (%s, %s, 'scale', 1, 'draft', NULL)
                       RETURNING id""",
                    [qid, canonical_text]
                )
                db_question_id = cur.fetchone()[0]
                question_id_map[qid] = db_question_id
                questions_seeded += 1

                # Seed positions for this question
                evidence_by_party = q.get("evidence_by_party", {})
                positions_seeded = 0

                for party in PARTIES:
                    if party not in entity_map:
                        continue

                    evidence_list = evidence_by_party.get(party, [])
                    entity_id = entity_map[party]

                    if not evidence_list:
                        # No evidence for this party — create a position with not_stated stance
                        cur.execute(
                            """INSERT INTO positions 
                               (entity_id, question_id, review_status, stance_status, evidence_jsonb)
                               VALUES (%s, %s, 'draft', 'not_stated', NULL)
                               ON CONFLICT (entity_id, question_id) DO NOTHING""",
                            [entity_id, db_question_id]
                        )
                        continue

                    # Build evidence JSONB array
                    evidence_jsonb = []
                    for ev in evidence_list:
                        evidence_jsonb.append({
                            "literal_text": ev.get("literal_text", ""),
                            "normalized_text": ev.get("normalized_text", ""),
                            "source_page": ev.get("source_page"),
                            "conditions": ev.get("conditions", ""),
                            "stance": ev.get("stance", "unclear"),
                            "affected_area": ev.get("affected_area", ""),
                            "review_status": ev.get("review_status", "draft"),
                        })

                    # Determine overall stance_status from evidence
                    stances = [ev.get("stance", "unclear") for ev in evidence_list]
                    if all(s in ("support", "agrees", "conditional_agrees") for s in stances):
                        stance_status = "approved"  # will be changed to draft for review
                    elif all(s in ("oppose", "disagrees") for s in stances):
                        stance_status = "approved"
                    else:
                        stance_status = "ambiguous"

                    # Insert position with evidence
                    cur.execute(
                        """INSERT INTO positions 
                           (entity_id, question_id, review_status, stance_status, evidence_jsonb, evidence_summary)
                           VALUES (%s, %s, 'draft', %s, %s, %s)
                           ON CONFLICT (entity_id, question_id) 
                           DO UPDATE SET evidence_jsonb = EXCLUDED.evidence_jsonb,
                                         evidence_summary = EXCLUDED.evidence_summary,
                                         stance_status = EXCLUDED.stance_status""",
                        [
                            entity_id,
                            db_question_id,
                            stance_status,
                            json.dumps(evidence_jsonb, ensure_ascii=False),
                            f"{len(evidence_list)} claims extraídos del programa electoral"
                        ]
                    )
                    positions_seeded += 1

                print(f"  {qid}: {positions_seeded} positions seeded")

    finally:
        conn.close()

    print(f"\nQuestions seeded: {questions_seeded}")
    print(f"Questions skipped (existing): {questions_skipped}")
    print(f"Total question_id_map entries: {len(question_id_map)}")

    return question_id_map


def verify_seed():
    """Verify the seed by counting positions and coverage."""
    conn = get_db_conn()
    try:
        cur = conn.cursor()

        # Count questions with pilot_question_id
        cur.execute("SELECT COUNT(*) FROM questions WHERE pilot_question_id IS NOT NULL")
        q_count = cur.fetchone()[0]

        # Count positions
        cur.execute("SELECT COUNT(*) FROM positions p JOIN questions q ON p.question_id = q.id WHERE q.pilot_question_id IS NOT NULL")
        pos_count = cur.fetchone()[0]

        # Count positions with evidence
        cur.execute("SELECT COUNT(*) FROM positions p JOIN questions q ON p.question_id = q.id WHERE q.pilot_question_id IS NOT NULL AND p.evidence_jsonb IS NOT NULL")
        pos_with_evidence = cur.fetchone()[0]

        # Count by review_status
        cur.execute(
            """SELECT review_status, COUNT(*) 
               FROM positions p 
               JOIN questions q ON p.question_id = q.id 
               WHERE q.pilot_question_id IS NOT NULL
               GROUP BY review_status ORDER BY review_status"""
        )
        review_status_counts = cur.fetchall()

        # Coverage by party
        cur.execute(
            """SELECT e.name, 
                      COUNT(*) as total,
                      COUNT(*) FILTER (WHERE p.evidence_jsonb IS NOT NULL) as with_evidence
               FROM entities e
               CROSS JOIN (SELECT DISTINCT question_id FROM questions WHERE pilot_question_id IS NOT NULL) q
               LEFT JOIN positions p ON p.entity_id = e.id AND p.question_id = q.question_id
               WHERE e.name = ANY(%s)
               GROUP BY e.name ORDER BY e.name""",
            [PARTIES]
        )
        party_coverage = cur.fetchall()

        print("\n" + "=" * 60)
        print("VERIFICACIÓN DE SEED")
        print("=" * 60)
        print(f"Preguntas piloto: {q_count}")
        print(f"Posiciones totales: {pos_count}")
        print(f"Posiciones con evidencia: {pos_with_evidence}")
        print(f"Celdas sin evidencia: {pos_count - pos_with_evidence}")
        print(f"Cobertura: {pos_with_evidence}/{pos_count} ({pos_with_evidence/pos_count*100:.1f}%)" if pos_count else "Sin posiciones")
        print()
        print("Estado de revisión:")
        for status, count in review_status_counts:
            print(f"  {status}: {count}")
        print()
        print("Cobertura por partido:")
        for name, total, with_ev in party_coverage:
            print(f"  {name}: {with_ev}/{total} ({with_ev/total*100:.0f}%)" if total else f"  {name}: 0")

        # Reconcile coverage with unique IDs
        print("\n" + "=" * 60)
        print("RECONCILIACIÓN DE COBERTURA (IDs únicos)")
        print("=" * 60)
        cur.execute(
            """SELECT q.pilot_question_id, e.name as party, 
                      p.id as position_id,
                      p.evidence_jsonb IS NOT NULL as has_evidence,
                      p.review_status
               FROM questions q
               CROSS JOIN entities e
               LEFT JOIN positions p ON p.entity_id = e.id AND p.question_id = q.id
               WHERE q.pilot_question_id IS NOT NULL
                 AND e.name = ANY(%s)
               ORDER BY q.pilot_question_id, e.name""",
            [PARTIES]
        )
        rows = cur.fetchall()
        
        total_cells = 0
        cells_with_evidence = 0
        cells_without_evidence = 0
        cells_approved = 0
        
        coverage_by_party = {p: {"total": 0, "with_evidence": 0, "approved": 0} for p in PARTIES}
        
        for qid, party, pos_id, has_ev, review_status in rows:
            total_cells += 1
            coverage_by_party[party]["total"] += 1
            
            if has_ev:
                cells_with_evidence += 1
                coverage_by_party[party]["with_evidence"] += 1
            else:
                cells_without_evidence += 1
            
            if review_status == "approved":
                cells_approved += 1
                coverage_by_party[party]["approved"] += 1

        print(f"Celdas totales (question_id × party_id únicos): {total_cells}")
        print(f"Con evidencia propuesta: {cells_with_evidence} ({cells_with_evidence/total_cells*100:.1f}%)")
        print(f"Sin evidencia: {cells_without_evidence}")
        print(f"Aprobadas: {cells_approved} ({cells_approved/total_cells*100:.1f}%)" if total_cells else "Aprobadas: 0")
        print()
        print("Cobertura por partido (IDs únicos):")
        for party in PARTIES:
            stats = coverage_by_party[party]
            print(f"  {party}: {stats['with_evidence']}/{stats['total']} con evidencia, {stats['approved']} aprobadas")

    finally:
        conn.close()


def main():
    print("=" * 60)
    print("SEED: Banco de preguntas piloto → PostgreSQL")
    print("=" * 60)
    print()

    seed_questions()
    verify_seed()

    print("\n" + "=" * 60)
    print("SEED COMPLETADO")
    print("=" * 60)
    print("Las posiciones están en PostgreSQL con review_status = 'draft'.")
    print("El archivo JSON se mantiene como formato de intercambio.")
    print("Las APIs editoriales deben leer/escribir en PostgreSQL.")


if __name__ == "__main__":
    main()
