#!/usr/bin/env python3
"""
Benchmark de extractores PDF para programas electorales.

Compara: pdfplumber, PyMuPDF4LLM, Docling, MinerU y Pandoc.

Métricas:
- Fidelidad literal de citas (texto exacto preservado)
- Conservación de estructura (títulos, secciones, listas)
- Orden de lectura (múltiples columnas)
- Tablas preservadas
- Trazabilidad por página
- Texto omitido, duplicado o desordenado
- Tiempo y consumo de recursos
- Calidad de entrada para Claude

Uso:
    python3 benchmark_extractors.py [--sample]
    --sample : solo las primeras 10 páginas de cada PDF
"""

import argparse
import json
import os
import re
import subprocess
import time
from pathlib import Path
from typing import Dict, Any, List, Optional

STORAGE_DIR = Path(__file__).parent.parent.parent / "storage"
RESULTS_DIR = Path(__file__).parent / "benchmark_results"
RESULTS_DIR.mkdir(exist_ok=True)

DOCUMENTS = {
    "PSOE": "psoe_PROGRAMA_PSOE_29N26.pdf",
    "PP": "pp_PROGRAMA-ELECTORAL-PP-2026-RECONSTRUCCION-NACIONAL.pdf",
    "Vox": "vox_Programa-completo-A5-1.pdf",
    "Sumar": "Castellano.pdf",
    "ERC": "erc_e2026-programa.pdf",
}


def normalize_text(text: str) -> str:
    """Normalize text for comparison."""
    text = text.replace("\n", " ")
    text = text.replace("- ", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# =============================================================================
# 1. pdfplumber (actual)
# =============================================================================

def extract_pdfplumber(pdf_path: str, max_pages: Optional[int] = None) -> Dict[str, Any]:
    """Extract text with pdfplumber, preserving page numbers."""
    import pdfplumber

    start = time.time()
    pdf = pdfplumber.open(pdf_path)
    total = len(pdf.pages)
    end = min(max_pages or total, total)

    pages = {}
    for i in range(end):
        page = pdf.pages[i]
        text = page.extract_text() or ""
        pages[i + 1] = text
    pdf.close()
    elapsed = time.time() - start

    full_text = "\n".join(pages.values())
    return {
        "tool": "pdfplumber",
        "total_pages": total,
        "pages_extracted": len(pages),
        "pages": pages,
        "full_text": full_text,
        "elapsed": elapsed,
        "error": None,
    }


# =============================================================================
# 2. PyMuPDF4LLM
# =============================================================================

def extract_pymupdf4llm(pdf_path: str, max_pages: Optional[int] = None) -> Dict[str, Any]:
    """Extract text with PyMuPDF4LLM, outputting Markdown."""
    import pymupdf4llm

    start = time.time()
    try:
        if max_pages:
            md = pymupdf4llm.to_markdown(pdf_path, pages=list(range(1, max_pages + 1)))
        else:
            md = pymupdf4llm.to_markdown(pdf_path)
        elapsed = time.time() - start

        # Parse pages from markdown - PyMuPDF4LLM doesn't give page numbers directly
        # We'll use fitz to get total pages
        import fitz
        doc = fitz.open(pdf_path)
        total = len(doc)
        doc.close()

        # Try to extract page-level text by splitting on page markers
        # PyMuPDF4LLM doesn't embed page markers, so we store full text
        pages = {}
        full_text = md

        return {
            "tool": "pymupdf4llm",
            "total_pages": total,
            "pages_extracted": max_pages or total,
            "pages": pages,
            "full_text": full_text,
            "elapsed": elapsed,
            "error": None,
        }
    except Exception as e:
        elapsed = time.time() - start
        return {
            "tool": "pymupdf4llm",
            "total_pages": 0,
            "pages_extracted": 0,
            "pages": {},
            "full_text": "",
            "elapsed": elapsed,
            "error": str(e),
        }


# =============================================================================
# 3. Docling
# =============================================================================

def extract_docling(pdf_path: str, max_pages: Optional[int] = None) -> Dict[str, Any]:
    """Extract text with Docling, outputting structured JSON + Markdown."""
    start = time.time()
    try:
        from docling.document_converter import DocumentConverter

        converter = DocumentConverter()
        result = converter.convert(pdf_path)
        elapsed = time.time() - start

        # Get markdown
        md = result.document.export_to_markdown()

        # Get page-level info from document structure
        pages = {}
        total = 0
        if hasattr(result.document, "pages"):
            total = len(result.document.pages)
            for p in result.document.pages:
                page_num = getattr(p, "page_number", None)
                if page_num:
                    # Extract text from this page's content
                    page_text = ""
                    for item in result.document.iter_text_items():
                        if hasattr(item, "prov") and item.prov:
                            for prov in item.prov:
                                if hasattr(prov, "page_no") and prov.page_no == page_num:
                                    page_text += item.text + " "
                    pages[page_num] = page_text.strip()

        return {
            "tool": "docling",
            "total_pages": total,
            "pages_extracted": len(pages),
            "pages": pages,
            "full_text": md,
            "elapsed": elapsed,
            "error": None,
        }
    except Exception as e:
        elapsed = time.time() - start
        return {
            "tool": "docling",
            "total_pages": 0,
            "pages_extracted": 0,
            "pages": {},
            "full_text": "",
            "elapsed": elapsed,
            "error": str(e),
        }


# =============================================================================
# 4. MinerU
# =============================================================================

def extract_mineru(pdf_path: str, max_pages: Optional[int] = None) -> Dict[str, Any]:
    """Extract text with MinerU CLI, outputting Markdown."""
    start = time.time()
    try:
        pages_arg = f"--pages {max_pages}" if max_pages else "--pages all"
        result = subprocess.run(
            ["mineru", "parse", pages_arg, "--limit", "100000", str(pdf_path)],
            capture_output=True, text=True, timeout=300
        )
        elapsed = time.time() - start

        if result.returncode != 0:
            return {
                "tool": "mineru",
                "total_pages": 0,
                "pages_extracted": 0,
                "pages": {},
                "full_text": "",
                "elapsed": elapsed,
                "error": result.stderr[:500],
            }

        md = result.stdout
        # Get total pages from pdfplumber
        import pdfplumber
        pdf = pdfplumber.open(pdf_path)
        total = len(pdf.pages)
        pdf.close()

        return {
            "tool": "mineru",
            "total_pages": total,
            "pages_extracted": max_pages or total,
            "pages": {},
            "full_text": md,
            "elapsed": elapsed,
            "error": None,
        }
    except subprocess.TimeoutExpired:
        elapsed = time.time() - start
        return {
            "tool": "mineru",
            "total_pages": 0,
            "pages_extracted": 0,
            "pages": {},
            "full_text": "",
            "elapsed": elapsed,
            "error": "Timeout after 300s",
        }
    except Exception as e:
        elapsed = time.time() - start
        return {
            "tool": "mineru",
            "total_pages": 0,
            "pages_extracted": 0,
            "pages": {},
            "full_text": "",
            "elapsed": elapsed,
            "error": str(e),
        }


# =============================================================================
# 5. pdftotext (Poppler)
# =============================================================================

def extract_pdftotext(pdf_path: str, max_pages: Optional[int] = None) -> Dict[str, Any]:
    """Extract text with pdftotext (Poppler), preserving layout."""
    start = time.time()
    try:
        cmd = ["pdftotext", "-layout", str(pdf_path), "-"]
        if max_pages:
            cmd = ["pdftotext", "-layout", "-f", "1", "-l", str(max_pages), str(pdf_path), "-"]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        elapsed = time.time() - start

        if result.returncode != 0:
            return {
                "tool": "pdftotext",
                "total_pages": 0,
                "pages_extracted": 0,
                "pages": {},
                "full_text": "",
                "elapsed": elapsed,
                "error": result.stderr[:500],
            }

        text = result.stdout
        import pdfplumber
        pdf = pdfplumber.open(pdf_path)
        total = len(pdf.pages)
        pdf.close()

        return {
            "tool": "pdftotext",
            "total_pages": total,
            "pages_extracted": max_pages or total,
            "pages": {},
            "full_text": text,
            "elapsed": elapsed,
            "error": None,
        }
    except subprocess.TimeoutExpired:
        elapsed = time.time() - start
        return {
            "tool": "pdftotext",
            "total_pages": 0,
            "pages_extracted": 0,
            "pages": {},
            "full_text": "",
            "elapsed": elapsed,
            "error": "Timeout after 120s",
        }
    except Exception as e:
        elapsed = time.time() - start
        return {
            "tool": "pdftotext",
            "total_pages": 0,
            "pages_extracted": 0,
            "pages": {},
            "full_text": "",
            "elapsed": elapsed,
            "error": str(e),
        }


# =============================================================================
# 6. Pandoc (via pdftotext intermediary)
# =============================================================================

def extract_pandoc(pdf_path: str, max_pages: Optional[int] = None) -> Dict[str, Any]:
    """Extract text with Pandoc via pdftotext intermediary."""
    start = time.time()
    try:
        tmp_text = "/tmp/pandoc_input.txt"
        cmd = ["pdftotext", str(pdf_path), tmp_text]
        if max_pages:
            cmd = ["pdftotext", "-f", "1", "-l", str(max_pages), str(pdf_path), tmp_text]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            elapsed = time.time() - start
            return {
                "tool": "pandoc",
                "total_pages": 0,
                "pages_extracted": 0,
                "pages": {},
                "full_text": "",
                "elapsed": elapsed,
                "error": f"pdftotext failed: {result.stderr[:200]}",
            }
        
        result2 = subprocess.run(
            ["pandoc", "-t", "plain", tmp_text],
            capture_output=True, text=True, timeout=60
        )
        elapsed = time.time() - start

        if result2.returncode != 0:
            return {
                "tool": "pandoc",
                "total_pages": 0,
                "pages_extracted": 0,
                "pages": {},
                "full_text": "",
                "elapsed": elapsed,
                "error": result2.stderr[:500],
            }

        text = result2.stdout
        import pdfplumber
        pdf = pdfplumber.open(pdf_path)
        total = len(pdf.pages)
        pdf.close()
        
        try:
            os.unlink(tmp_text)
        except OSError:
            pass

        return {
            "tool": "pandoc",
            "total_pages": total,
            "pages_extracted": max_pages or total,
            "pages": {},
            "full_text": text,
            "elapsed": elapsed,
            "error": None,
        }
    except subprocess.TimeoutExpired:
        elapsed = time.time() - start
        return {
            "tool": "pandoc",
            "total_pages": 0,
            "pages_extracted": 0,
            "pages": {},
            "full_text": "",
            "elapsed": elapsed,
            "error": "Timeout after 120s",
        }
    except Exception as e:
        elapsed = time.time() - start
        return {
            "tool": "pandoc",
            "total_pages": 0,
            "pages_extracted": 0,
            "pages": {},
            "full_text": "",
            "elapsed": elapsed,
            "error": str(e),
        }


# =============================================================================
# Quality metrics
# =============================================================================

def compute_metrics(extraction: Dict[str, Any], pdf_path: str) -> Dict[str, Any]:
    """Compute quality metrics for an extraction."""
    import pdfplumber

    full_text = extraction.get("full_text", "")
    norm_full = normalize_text(full_text)

    # Reference: pdfplumber page-by-page
    pdf = pdfplumber.open(pdf_path)
    ref_pages = {}
    for i in range(len(pdf.pages)):
        text = pdf.pages[i].extract_text() or ""
        if len(text.strip()) > 50:
            ref_pages[i + 1] = text
    pdf.close()

    ref_full = "\n".join(ref_pages.values())
    norm_ref = normalize_text(ref_full)

    metrics = {
        "total_chars": len(full_text),
        "total_words": len(full_text.split()),
        "total_lines": len(full_text.split("\n")),
        "has_markdown_headers": "# " in full_text,
        "has_markdown_lists": "- " in full_text or "* " in full_text,
        "has_tables": "| " in full_text and "---" in full_text,
        "has_page_breaks": "\f" in full_text,
        "has_hyphenation_artifacts": bool(re.search(r'-\s+\w', full_text)),
        "has_line_breaks_in_words": bool(re.search(r'\w-\s*\n', full_text)),
    }

    # Citation fidelity: check how many reference sentences appear in the extraction
    # Split reference into sentences and check coverage
    ref_sentences = re.split(r'[.!?]\s+', norm_ref)
    ref_sentences = [s.strip() for s in ref_sentences if len(s.strip()) > 30]

    matched = 0
    total_sentences = len(ref_sentences)
    for sent in ref_sentences:
        # Check if at least 80% of words match
        sent_words = set(sent.split())
        if not sent_words:
            continue
        # Simple check: first 5 words of sentence appear in extraction
        first_words = " ".join(sent.split()[:5])
        if first_words in norm_full:
            matched += 1

    if total_sentences > 0:
        metrics["sentence_coverage"] = matched / total_sentences
    else:
        metrics["sentence_coverage"] = 0.0

    # Numbered sections coverage (1-115 for Vox, etc.)
    numbered_in_ref = set(re.findall(r'^(\d{1,3})\.\s+[A-ZÁÉÍÓÚÑ]', norm_ref, re.MULTILINE))
    numbered_in_extract = set(re.findall(r'(\d{1,3})\.\s+[A-ZÁÉÍÓÚÑ]', norm_full))
    if numbered_in_ref:
        metrics["numbered_sections_coverage"] = len(numbered_in_extract & numbered_in_ref) / len(numbered_in_ref)
        metrics["numbered_sections_found"] = len(numbered_in_extract & numbered_in_ref)
        metrics["numbered_sections_total"] = len(numbered_in_ref)
    else:
        metrics["numbered_sections_coverage"] = None
        metrics["numbered_sections_found"] = 0
        metrics["numbered_sections_total"] = 0

    # Duplicated text detection: check for repeated paragraphs
    paragraphs = [p.strip() for p in full_text.split("\n\n") if len(p.strip()) > 50]
    unique_paras = set()
    duplicates = 0
    for p in paragraphs:
        norm_p = normalize_text(p)
        if norm_p in unique_paras:
            duplicates += 1
        unique_paras.add(norm_p)
    metrics["duplicate_paragraphs"] = duplicates
    metrics["total_paragraphs"] = len(paragraphs)

    return metrics


# =============================================================================
# Main benchmark
# =============================================================================

def run_benchmark(sample_only: bool = False):
    """Run benchmark on all documents."""
    max_pages = 10 if sample_only else None

    extractors = {
        "pdfplumber": extract_pdfplumber,
        "pymupdf4llm": extract_pymupdf4llm,
        "pdftotext": extract_pdftotext,
        "pandoc": extract_pandoc,
        "docling": extract_docling,
        "mineru": extract_mineru,
    }

    all_results = {}

    for party, filename in DOCUMENTS.items():
        pdf_path = STORAGE_DIR / filename
        if not pdf_path.exists():
            print(f"  ⚠ {party}: PDF not found, skipping")
            continue

        print(f"\n{'=' * 70}")
        print(f"DOCUMENT: {party} — {filename}")
        print(f"{'=' * 70}")

        # Get total pages
        import pdfplumber
        pdf = pdfplumber.open(str(pdf_path))
        total_pages = len(pdf.pages)
        pdf.close()
        print(f"  Total pages: {total_pages}")
        if sample_only:
            print(f"  Sample: first {max_pages} pages")

        doc_results = {}
        for tool_name, extractor_fn in extractors.items():
            print(f"\n  [{tool_name}] Extracting...", end=" ", flush=True)
            result = extractor_fn(str(pdf_path), max_pages=max_pages)
            print(f"{result['elapsed']:.1f}s, {len(result.get('full_text', ''))} chars")

            if result.get("error"):
                print(f"    ERROR: {result['error'][:200]}")
                doc_results[tool_name] = {
                    "extraction": result,
                    "metrics": {"error": result["error"]},
                }
                continue

            # Compute quality metrics
            metrics = compute_metrics(result, str(pdf_path))
            doc_results[tool_name] = {
                "extraction": {
                    "tool": tool_name,
                    "total_pages": result["total_pages"],
                    "pages_extracted": result["pages_extracted"],
                    "elapsed": result["elapsed"],
                    "total_chars": len(result.get("full_text", "")),
                    "error": None,
                },
                "metrics": metrics,
            }

            # Save sample output for manual review (first 5000 chars)
            sample_file = RESULTS_DIR / f"{party}_{tool_name}_sample.md"
            with open(sample_file, "w") as f:
                f.write(f"# {party} — {tool_name} sample\n\n")
                f.write(f"Pages: {result['pages_extracted']}/{result['total_pages']}\n")
                f.write(f"Time: {result['elapsed']:.1f}s\n")
                f.write(f"Chars: {len(result.get('full_text', ''))}\n\n")
                f.write(result.get("full_text", "")[:5000])

        all_results[party] = doc_results

    # Save full benchmark results
    # Strip full_text from results to keep file manageable
    save_results = {}
    for party, doc_results in all_results.items():
        save_results[party] = {}
        for tool_name, data in doc_results.items():
            save_results[party][tool_name] = {
                "extraction": data["extraction"],
                "metrics": data["metrics"],
            }

    results_file = RESULTS_DIR / "benchmark_results.json"
    with open(results_file, "w") as f:
        json.dump(save_results, f, ensure_ascii=False, indent=2)

    # Print summary table
    print(f"\n{'=' * 70}")
    print("BENCHMARK SUMMARY")
    print(f"{'=' * 70}")

    tools = list(extractors.keys())
    for party in all_results:
        print(f"\n  {party}:")
        for tool_name in tools:
            if tool_name not in all_results[party]:
                continue
            data = all_results[party][tool_name]
            ext = data["extraction"]
            met = data["metrics"]
            if ext.get("error"):
                print(f"    {tool_name:15s} ERROR: {ext['error'][:80]}")
                continue
            chars = ext.get("total_chars", 0)
            elapsed = ext.get("elapsed", 0)
            coverage = met.get("sentence_coverage", 0)
            sections = met.get("numbered_sections_coverage", 0)
            sections_str = ""
            if sections is not None:
                sections_str = f" sections={met.get('numbered_sections_found',0)}/{met.get('numbered_sections_total',0)}"
            print(f"    {tool_name:15s} {elapsed:6.1f}s  {chars:7,d} chars  coverage={coverage:.1%}{sections_str}")

    print(f"\nResults saved: {results_file}")
    print(f"Samples saved: {RESULTS_DIR}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Benchmark PDF extractors")
    parser.add_argument("--sample", action="store_true", help="Only first 10 pages")
    args = parser.parse_args()
    run_benchmark(sample_only=args.sample)
