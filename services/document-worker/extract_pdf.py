#!/usr/bin/env python3
"""
SPIKE-01: PDF text extraction with pdfplumber.
Extracts text, preserves pages, structure and traceability.
"""

import json
import os
import sys
from pathlib import Path

import pdfplumber


def extract_pdf(path: str) -> dict:
    """
    Extract text from a PDF file, preserving page structure.
    
    Returns:
        {
            "pages": [
                {
                    "page_number": int,
                    "text": str,
                    "chars": int,
                    "lines": int,
                    "words": int
                }
            ],
            "total_pages": int,
            "total_chars": int,
            "metadata": {
                "title": str | None,
                "author": str | None,
                "subject": str | None,
                "creator": str | None,
                "producer": str | None
            }
        }
    """
    result = {
        "pages": [],
        "total_pages": 0,
        "total_chars": 0,
        "metadata": {}
    }
    
    with pdfplumber.open(path) as pdf:
        result["total_pages"] = len(pdf.pages)
        
        # Extract metadata
        meta = pdf.metadata or {}
        result["metadata"] = {
            "title": meta.get("Title"),
            "author": meta.get("Author"),
            "subject": meta.get("Subject"),
            "creator": meta.get("Creator"),
            "producer": meta.get("Producer")
        }
        
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            page_data = {
                "page_number": i + 1,
                "text": text,
                "chars": len(text),
                "lines": len(text.splitlines()) if text else 0,
                "words": len(text.split()) if text else 0
            }
            result["pages"].append(page_data)
            result["total_chars"] += page_data["chars"]
    
    return result


def extract_with_tables(path: str) -> dict:
    """
    Extract text and tables from a PDF file.
    
    Returns extraction result with additional "tables" field per page.
    """
    result = extract_pdf(path)
    
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            tables = page.extract_tables() or []
            if tables:
                result["pages"][i]["tables"] = [
                    {
                        "row_count": len(table),
                        "col_count": len(table[0]) if table else 0,
                        "data": [[str(cell) if cell else "" for cell in row] for row in table]
                    }
                    for table in tables
                ]
    
    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_pdf.py <pdf_path> [--tables]")
        sys.exit(1)
    
    path = sys.argv[1]
    if not os.path.exists(path):
        print(f"Error: File not found: {path}")
        sys.exit(1)
    
    with_tables = "--tables" in sys.argv
    
    if with_tables:
        result = extract_with_tables(path)
    else:
        result = extract_pdf(path)
    
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
