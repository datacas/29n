#!/usr/bin/env python3
"""
LLM-powered claim extraction from document passages.
Integrates the multi-provider LLM system with versioned prompts.
"""

import asyncio
import json
import sys
import time
from typing import List, Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, "..")

from llm import create_provider, load_task_config, LLMError
from prompts import render_prompt, get_system_prompt, get_prompt


def extract_claims_from_passage(
    passage: Dict[str, Any],
    source_title: str = "",
    provider_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Extract claims from a single passage using LLM.

    Args:
        passage: Dict with 'literal_text', 'page', 'section', etc.
        source_title: Title of the source document.
        provider_name: Override provider name.

    Returns:
        Dict with claims, metadata, and coverage info.
    """
    config = load_task_config("extraction")
    if provider_name:
        config["provider"] = provider_name

    prompt = render_prompt(
        "extraction",
        {
            "source_title": source_title,
            "section": passage.get("section", ""),
            "page": passage.get("page", 0),
            "passage_text": passage["literal_text"],
        },
    )
    system_prompt = get_system_prompt("extraction")

    async def _run():
        provider = create_provider(config["provider"])
        result = await provider.complete_json(
            prompt=prompt,
            model=config["model"],
            temperature=config.get("temperature", 0.1),
            max_tokens=config.get("max_tokens", 4000),
            system_prompt=system_prompt,
        )
        return result

    try:
        result = asyncio.run(_run())
        claims = result.get("claims", [])
        has_more = result.get("has_more", False)

        # Validate claims
        validated_claims = []
        for claim in claims:
            if (
                claim.get("literal_text")
                and claim.get("normalized_text")
                and claim["literal_text"] in passage["literal_text"]
            ):
                validated_claims.append(claim)

        return {
            "success": True,
            "claims": validated_claims,
            "has_more": has_more,
            "provider": config["provider"],
            "model": config["model"],
            "prompt_version": get_prompt("extraction")["version"],
            "passage_page": passage.get("page"),
            "total_claims": len(validated_claims),
        }
    except LLMError as e:
        return {
            "success": False,
            "error": str(e),
            "provider": config["provider"],
            "retryable": isinstance(e, LLMError) and e.retryable,
        }


def extract_claims_from_document(
    passages: List[Dict[str, Any]],
    source_title: str = "",
    max_iterations: int = 5,
    provider_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Extract claims from all passages in a document.

    Args:
        passages: List of passage dicts from PDF extraction.
        source_title: Title of the source document.
        max_iterations: Max iterations per passage for has_more.
        provider_name: Override provider name.

    Returns:
        Dict with all claims, coverage stats, and metadata.
    """
    all_claims = []
    coverage = {
        "pages_processed": 0,
        "pages_with_claims": set(),
        "pages_empty": set(),
        "total_iterations": 0,
        "errors": [],
    }

    for passage in passages:
        page = passage.get("page", 0)
        coverage["pages_processed"] += 1

        iteration = 0
        while iteration < max_iterations:
            iteration += 1
            coverage["total_iterations"] += 1

            result = extract_claims_from_passage(
                passage, source_title, provider_name
            )

            if not result["success"]:
                coverage["errors"].append(
                    {
                        "page": page,
                        "iteration": iteration,
                        "error": result.get("error", "Unknown error"),
                    }
                )
                break

            all_claims.extend(result["claims"])
            if result["claims"]:
                coverage["pages_with_claims"].add(page)

            if not result.get("has_more", False):
                break

        if not any(c.get("passage_page") == page for c in all_claims):
            coverage["pages_empty"].add(page)

    # Convert sets to lists for JSON serialization
    coverage["pages_with_claims"] = sorted(coverage["pages_with_claims"])
    coverage["pages_empty"] = sorted(coverage["pages_empty"])

    return {
        "success": True,
        "claims": all_claims,
        "total_claims": len(all_claims),
        "coverage": coverage,
        "prompt_version": get_prompt("extraction")["version"],
    }


if __name__ == "__main__":
    # CLI usage: python extract_llm.py --passages-file passages.json --source-title "Programa electoral"
    import argparse

    parser = argparse.ArgumentParser(description="Extract claims from passages using LLM")
    parser.add_argument("--passages-file", required=True, help="JSON file with passages")
    parser.add_argument("--source-title", default="", help="Source document title")
    parser.add_argument("--provider", default=None, help="Override LLM provider")
    parser.add_argument("--max-iterations", type=int, default=5, help="Max iterations per passage")
    args = parser.parse_args()

    with open(args.passages_file) as f:
        passages = json.load(f)

    result = extract_claims_from_document(
        passages,
        source_title=args.source_title,
        max_iterations=args.max_iterations,
        provider_name=args.provider,
    )

    print(json.dumps(result, indent=2, ensure_ascii=False))
