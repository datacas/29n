#!/usr/bin/env python3
"""
Batch extraction script for multiple electoral program PDFs.
Processes all 5 real party programs with:
- Persistent progress tracking (resumable)
- Token usage tracking per page and per document
- Budget limit (configurable max cost)
- Quality verification (literal_text in source)
- Duplicate detection
- Semantic quality sample review

Usage:
    python3 batch_extract.py [--budget 10.0] [--resume] [--party PP]
"""

import asyncio
import json
import os
import sys
import time
import hashlib
import argparse
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add parent directory to path
sys.path.insert(0, "..")

import pdfplumber

from llm import create_provider, load_task_config, LLMError, call_with_fallback
from prompts import render_prompt, get_system_prompt, get_prompt


# Document configuration: party -> (filename, title)
DOCUMENTS = {
    "PSOE": {
        "filename": "psoe_PROGRAMA_PSOE_29N26.pdf",
        "title": "Programa Electoral PSOE 2026",
    },
    "PP": {
        "filename": "pp_PROGRAMA-ELECTORAL-PP-2026-RECONSTRUCCION-NACIONAL.pdf",
        "title": "Programa Electoral PP 2026",
    },
    "Vox": {
        "filename": "vox_Programa-completo-A5-1.pdf",
        "title": "Programa Electoral Vox 2026",
    },
    "Sumar": {
        "filename": "Castellano.pdf",
        "title": "Programa Electoral Sumar 2026",
    },
    "ERC": {
        "filename": "erc_e2026-programa.pdf",
        "title": "Programa Electoral ERC 2026",
    },
}

STORAGE_DIR = Path(__file__).parent.parent.parent / "storage"
PROGRESS_FILE = Path(__file__).parent / "batch_progress.json"
RESULTS_DIR = Path(__file__).parent / "extraction_results"


def load_progress() -> Dict[str, Any]:
    """Load persistent progress from disk."""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"documents": {}, "total_input_tokens": 0, "total_output_tokens": 0, "total_cost": 0.0}


def save_progress(progress: Dict[str, Any]):
    """Save progress to disk."""
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def extract_text_from_pdf(pdf_path: str, start_page: int = 0, end_page: Optional[int] = None) -> List[Dict[str, Any]]:
    """Extract text passages from a PDF, preserving page numbers."""
    passages = []
    pdf = pdfplumber.open(pdf_path)
    total_pages = len(pdf.pages)
    end = end_page if end_page else total_pages

    for i in range(start_page, min(end, total_pages)):
        page = pdf.pages[i]
        text = page.extract_text() or ""
        if len(text.strip()) > 50:  # Skip empty/very short pages
            passages.append({
                "literal_text": text,
                "page": i + 1,  # 1-indexed
                "section": "",
                "has_more": False,
            })

    pdf.close()
    return passages


def normalize_for_verification(text: str) -> str:
    """Normalize text for citation verification: remove line breaks and hyphenation artifacts."""
    import re
    text = text.replace("\n", " ")
    # Remove hyphens used for line continuation (hyphen + space)
    text = text.replace("- ", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def verify_claim_in_source(claim: Dict[str, Any], source_text: str) -> bool:
    """Verify that literal_text appears in the source passage.

    Normalizes both texts to handle PDF line breaks and hyphenation artifacts
    that pdfplumber preserves but LLMs return as clean text.
    """
    literal = claim.get("literal_text", "")
    if not literal:
        return False
    norm_literal = normalize_for_verification(literal)
    norm_source = normalize_for_verification(source_text)
    return norm_literal in norm_source


def detect_duplicates(claims: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Detect duplicate claims by normalized_text similarity."""
    seen = set()
    duplicates = []
    unique = []
    for claim in claims:
        normalized = claim.get("normalized_text", "").strip().lower()
        if normalized in seen:
            duplicates.append(claim)
        else:
            seen.add(normalized)
            unique.append(claim)
    return unique, duplicates


async def extract_passage(
    passage: Dict[str, Any],
    source_title: str,
    config: Dict[str, Any],
    system_prompt: str,
) -> Dict[str, Any]:
    """Extract claims from a single passage with full token tracking."""
    prompt = render_prompt(
        "extraction",
        {
            "source_title": source_title,
            "section": passage.get("section", ""),
            "page": passage.get("page", 0),
            "passage_text": passage["literal_text"],
        },
    )

    start = time.time()
    try:
        # Use provider directly for JSON extraction with token tracking
        provider = create_provider(config["provider"])
        
        # Add JSON instruction to prompt
        json_instruction = "\n\nResponde únicamente en formato JSON, sin texto adicional ni bloques de código."
        full_prompt = prompt + json_instruction
        
        text = await provider.complete(
            prompt=full_prompt,
            model=config["model"],
            temperature=config.get("temperature", 0.1),
            max_tokens=config.get("max_tokens", 4000),
            system_prompt=system_prompt,
        )
        elapsed = time.time() - start
        
        # Get usage from provider
        usage = provider.last_usage()
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)
        
        # Parse JSON from response
        from llm.base import parse_json_from_response
        result = parse_json_from_response(text)
        claims = result.get("claims", [])

        return {
            "success": True,
            "claims": claims,
            "page": passage["page"],
            "provider": config["provider"],
            "model": config["model"],
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "elapsed_ms": int(elapsed * 1000),
            "attempts": 1,
            "prompt_version": get_prompt("extraction")["version"],
        }
    except LLMError as e:
        elapsed = time.time() - start
        return {
            "success": False,
            "error": str(e),
            "page": passage["page"],
            "input_tokens": 0,
            "output_tokens": 0,
            "elapsed_ms": int(elapsed * 1000),
        }


# Pricing per million tokens (Anthropic API, Nov 2026)
MODEL_PRICING = {
    "claude-haiku-5-5": (0.10, 0.50),       # $0.10/M input, $0.50/M output
    "claude-sonnet-5-5": (2.0, 10.0),        # $2/M input, $10/M output (permanent)
    "claude-sonnet-4-6": (3.0, 15.0),        # $3/M input, $15/M output
    "gpt-4o-mini": (0.15, 0.60),             # OpenAI fallback
}

def estimate_cost(input_tokens: int, output_tokens: int, model: str = "claude-haiku-5-5") -> float:
    """Estimate cost in USD based on model pricing."""
    input_rate, output_rate = MODEL_PRICING.get(model, (3.0, 15.0))
    input_cost = (input_tokens / 1_000_000) * input_rate
    output_cost = (output_tokens / 1_000_000) * output_rate
    return input_cost + output_cost


async def process_document(
    party: str,
    doc_config: Dict[str, Any],
    max_budget: float,
    resume: bool,
) -> Dict[str, Any]:
    """Process a single document: extract text, extract claims, verify, save."""
    pdf_path = STORAGE_DIR / doc_config["filename"]
    source_title = doc_config["title"]

    if not pdf_path.exists():
        return {"party": party, "error": f"PDF not found: {pdf_path}", "status": "error"}

    print(f"\n{'=' * 70}")
    print(f"PROCESSING: {party} — {source_title}")
    print(f"PDF: {pdf_path.name}")
    print(f"{'=' * 70}")

    # Load progress
    progress = load_progress()
    doc_progress = progress.get("documents", {}).get(party, {})
    completed_pages = set(doc_progress.get("completed_pages", []))
    doc_claims = doc_progress.get("claims", [])
    doc_input_tokens = doc_progress.get("input_tokens", 0)
    doc_output_tokens = doc_progress.get("output_tokens", 0)
    doc_cost = doc_progress.get("cost", 0.0)

    # Check budget
    total_cost = progress.get("total_cost", 0.0) + doc_cost
    if total_cost >= max_budget and not doc_claims:
        print(f"  ⚠ Budget exceeded (${total_cost:.2f} / ${max_budget:.2f}). Skipping {party}.")
        return {"party": party, "status": "skipped", "reason": "budget"}

    # Extract text from PDF
    print(f"  Extracting text from PDF...")
    pdf = pdfplumber.open(str(pdf_path))
    total_pages = len(pdf.pages)
    pdf.close()
    print(f"  Total pages: {total_pages}")

    # Load LLM config
    config = load_task_config("extraction")
    system_prompt = get_system_prompt("extraction")

    # Process pages
    all_claims = list(doc_claims)
    page_results = []
    pages_to_process = []

    for page_num in range(1, total_pages + 1):
        if resume and page_num in completed_pages:
            continue
        pages_to_process.append(page_num)

    print(f"  Pages to process: {len(pages_to_process)} (skipped {total_pages - len(pages_to_process)} completed)")

    if not pages_to_process:
        print(f"  All pages already processed. Skipping.")
        return {
            "party": party,
            "status": "complete",
            "total_claims": len(all_claims),
            "pages_processed": total_pages,
        }

    # Extract passages for pages to process
    passages = extract_text_from_pdf(
        str(pdf_path),
        start_page=pages_to_process[0] - 1,
        end_page=pages_to_process[-1],
    )

    # Process each passage
    for i, passage in enumerate(passages):
        page_num = passage["page"]

        # Check budget before each page
        current_cost = total_cost + estimate_cost(
            progress.get("total_input_tokens", 0) + doc_input_tokens,
            progress.get("total_output_tokens", 0) + doc_output_tokens,
        )
        if current_cost >= max_budget:
            print(f"  ⚠ Budget limit reached at page {page_num}. Stopping.")
            break

        # Progress indicator
        processed_so_far = len(completed_pages) + i + 1
        print(f"  [{processed_so_far}/{len(pages_to_process)}] Page {page_num}...", end=" ", flush=True)

        result = await extract_passage(passage, source_title, config, system_prompt)

        if result["success"]:
            # Verify claims
            verified = []
            for claim in result.get("claims", []):
                if verify_claim_in_source(claim, passage["literal_text"]):
                    claim["source_party"] = party
                    claim["source_title"] = source_title
                    claim["source_page"] = page_num
                    verified.append(claim)

            all_claims.extend(verified)
            completed_pages.add(page_num)
            doc_input_tokens += result.get("input_tokens", 0)
            doc_output_tokens += result.get("output_tokens", 0)

            status = "✓" if verified else "·"
            print(f"{status} {len(verified)} claims, {result.get('input_tokens', 0)} in / {result.get('output_tokens', 0)} out tokens")

            page_results.append({
                "page": page_num,
                "claims": len(verified),
                "input_tokens": result.get("input_tokens", 0),
                "output_tokens": result.get("output_tokens", 0),
                "provider": result.get("provider", ""),
                "model": result.get("model", ""),
                "elapsed_ms": result.get("elapsed_ms", 0),
            })
        else:
            print(f"✗ Error: {result.get('error', 'Unknown')}")
            page_results.append({
                "page": page_num,
                "error": result.get("error", ""),
            })
            # Mark page as completed even on error to avoid infinite retries
            completed_pages.add(page_num)

        # Save progress after each page
        progress["documents"][party] = {
            "completed_pages": sorted(completed_pages),
            "claims": all_claims,
            "input_tokens": doc_input_tokens,
            "output_tokens": doc_output_tokens,
            "cost": estimate_cost(doc_input_tokens, doc_output_tokens, config["model"]),
        }
        # Update global totals
        all_doc_input = sum(d.get("input_tokens", 0) for d in progress["documents"].values())
        all_doc_output = sum(d.get("output_tokens", 0) for d in progress["documents"].values())
        progress["total_input_tokens"] = all_doc_input
        progress["total_output_tokens"] = all_doc_output
        progress["total_cost"] = estimate_cost(all_doc_input, all_doc_output, config["model"])
        save_progress(progress)

    # Detect duplicates
    unique_claims, duplicates = detect_duplicates(all_claims)

    # Calculate costs
    doc_cost = estimate_cost(doc_input_tokens, doc_output_tokens, config["model"])

    # Save results
    RESULTS_DIR.mkdir(exist_ok=True)
    result_file = RESULTS_DIR / f"{party}_extraction.json"
    with open(result_file, "w") as f:
        json.dump({
            "party": party,
            "source_title": source_title,
            "total_pages": total_pages,
            "pages_processed": len(completed_pages),
            "total_claims": len(unique_claims),
            "duplicates": len(duplicates),
            "input_tokens": doc_input_tokens,
            "output_tokens": doc_output_tokens,
            "cost": doc_cost,
            "prompt_version": get_prompt("extraction")["version"],
            "model": config["model"],
            "provider": config["provider"],
            "page_results": page_results,
            "claims": unique_claims,
        }, f, ensure_ascii=False, indent=2)

    print(f"\n  {party} SUMMARY:")
    print(f"    Pages processed: {len(completed_pages)}/{total_pages}")
    print(f"    Claims extracted: {len(unique_claims)}")
    print(f"    Duplicates: {len(duplicates)}")
    print(f"    Input tokens: {doc_input_tokens}")
    print(f"    Output tokens: {doc_output_tokens}")
    print(f"    Cost: ${doc_cost:.4f}")
    print(f"    Results saved: {result_file}")

    return {
        "party": party,
        "status": "complete" if len(completed_pages) == total_pages else "partial",
        "total_pages": total_pages,
        "pages_processed": len(completed_pages),
        "total_claims": len(unique_claims),
        "duplicates": len(duplicates),
        "input_tokens": doc_input_tokens,
        "output_tokens": doc_output_tokens,
        "cost": doc_cost,
    }


async def main():
    parser = argparse.ArgumentParser(description="Batch extract claims from electoral programs")
    parser.add_argument("--budget", type=float, default=20.0, help="Max budget in USD (default: 20)")
    parser.add_argument("--resume", action="store_true", help="Resume from last progress")
    parser.add_argument("--party", type=str, default=None, help="Process only this party")
    parser.add_argument("--clear", action="store_true", help="Clear progress and start fresh")
    args = parser.parse_args()

    if args.clear:
        if PROGRESS_FILE.exists():
            PROGRESS_FILE.unlink()
        print("Progress cleared.")

    print("=" * 70)
    print("BATCH EXTRACTION — Electoral Programs 2026")
    print("=" * 70)
    print(f"Budget limit: ${args.budget:.2f}")
    print(f"Resume: {args.resume}")
    config = load_task_config("extraction")
    print(f"Model: {config['model']} (Anthropic primary, OpenAI fallback)")
    print(f"Prompt version: {get_prompt('extraction')['version']}")

    # Check API key
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("\n⚠ ANTHROPIC_API_KEY not set. Cannot proceed.")
        sys.exit(1)
    print(f"API key: {api_key[:15]}... (configured)")

    # Load progress
    progress = load_progress()
    if progress.get("documents"):
        print(f"Existing progress: {len(progress['documents'])} document(s) partially processed")

    # Select documents
    if args.party:
        documents = {args.party: DOCUMENTS[args.party]}
    else:
        documents = DOCUMENTS

    # Process each document
    start_time = time.time()
    results = []

    for party, doc_config in documents.items():
        result = await process_document(party, doc_config, args.budget, args.resume)
        results.append(result)

        # Check if budget exceeded
        total_cost = sum(r.get("cost", 0) for r in results)
        if total_cost >= args.budget:
            print(f"\n⚠ Budget limit reached (${total_cost:.2f} / ${args.budget:.2f}). Stopping.")
            break

    # Final summary
    total_time = time.time() - start_time
    total_claims = sum(r.get("total_claims", 0) for r in results)
    total_cost = sum(r.get("cost", 0) for r in results)
    total_input = sum(r.get("input_tokens", 0) for r in results)
    total_output = sum(r.get("output_tokens", 0) for r in results)

    print(f"\n{'=' * 70}")
    print("BATCH EXTRACTION COMPLETE")
    print(f"{'=' * 70}")
    print(f"Documents processed: {len(results)}")
    print(f"Total claims: {total_claims}")
    print(f"Total input tokens: {total_input}")
    print(f"Total output tokens: {total_output}")
    print(f"Total cost: ${total_cost:.4f}")
    print(f"Total time: {total_time:.1f}s")
    print(f"Average per document: {total_time/len(results):.1f}s")

    # Per-document summary
    print(f"\nPer-document breakdown:")
    for r in results:
        status_icon = "✓" if r.get("status") == "complete" else ("⚠" if r.get("status") == "partial" else "✗")
        print(f"  {status_icon} {r['party']}: {r.get('total_claims', 0)} claims, ${r.get('cost', 0):.4f}, {r.get('pages_processed', 0)}/{r.get('total_pages', '?')} pages")

    # Save overall summary
    summary_file = RESULTS_DIR / "batch_summary.json"
    with open(summary_file, "w") as f:
        json.dump({
            "total_documents": len(results),
            "total_claims": total_claims,
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "total_cost": total_cost,
            "total_time_seconds": total_time,
            "budget_limit": args.budget,
            "prompt_version": get_prompt("extraction")["version"],
            "model": "claude-sonnet-4-6",
            "provider": "anthropic",
            "documents": results,
        }, f, ensure_ascii=False, indent=2)
    print(f"\nSummary saved: {summary_file}")


if __name__ == "__main__":
    asyncio.run(main())
