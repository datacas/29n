#!/usr/bin/env python3
"""
SPIKE-01: Test PDF extraction with pdfplumber.
Creates test PDFs and verifies extraction quality.
"""

import json
import os
import sys
import tempfile
from pathlib import Path

# Create test PDFs using reportlab or pypdf
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False

import pdfplumber


def create_test_pdf_simple(path: str):
    """Create a simple test PDF with known text."""
    if not HAS_REPORTLAB:
        print("SKIP: reportlab not installed")
        return False
    
    c = canvas.Canvas(path, pagesize=A4)
    c.setFont("Helvetica", 12)
    
    # Page 1
    c.drawString(100, 750, "Programa Electoral de Prueba")
    c.drawString(100, 730, "Sección 1: Economía")
    c.drawString(100, 710, "Propuesta 1: Reducir el IVA del 21% al 15%.")
    c.drawString(100, 690, "Propuesta 2: Aumentar la inversión en I+D al 3% del PIB.")
    c.drawString(100, 670, "Propuesta 3: Crear un fondo de garantía para pymes.")
    c.showPage()
    
    # Page 2
    c.drawString(100, 750, "Sección 2: Educación")
    c.drawString(100, 730, "Propuesta 4: Aumentar el gasto educativo al 6% del PIB.")
    c.drawString(100, 710, "Propuesta 5: Reformar la LOE con participación social.")
    c.drawString(100, 690, "Propuesta 6: Gratuidad en universidades públicas.")
    c.showPage()
    
    # Page 3
    c.drawString(100, 750, "Sección 3: Medio Ambiente")
    c.drawString(100, 730, "Propuesta 7: Transición energética al 100% renovable para 2040.")
    c.drawString(100, 710, "Propuesta 8: Prohibir la extracción de combustibles fósiles.")
    c.showPage()
    
    c.save()
    return True


def create_test_pdf_with_table(path: str):
    """Create a test PDF with a table."""
    if not HAS_REPORTLAB:
        print("SKIP: reportlab not installed")
        return False
    
    c = canvas.Canvas(path, pagesize=A4)
    c.setFont("Helvetica", 12)
    c.drawString(100, 750, "Datos presupuestarios")
    
    # Draw a simple table
    data = [
        ["Concepto", "2024", "2025", "2026"],
        ["Educación", "45.2B", "47.8B", "50.1B"],
        ["Sanidad", "120.5B", "125.3B", "130.0B"],
        ["Defensa", "12.1B", "12.8B", "13.5B"],
    ]
    
    x_start = 100
    y_start = 700
    row_height = 25
    col_widths = [150, 100, 100, 100]
    
    for i, row in enumerate(data):
        y = y_start - i * row_height
        for j, cell in enumerate(row):
            x = x_start + sum(col_widths[:j])
            c.drawString(x, y, cell)
            # Draw borders
            c.rect(x, y - 15, col_widths[j], row_height)
    
    c.save()
    return True


def create_test_pdf_multilingual(path: str):
    """Create a test PDF with multiple languages."""
    if not HAS_REPORTLAB:
        print("SKIP: reportlab not installed")
        return False
    
    c = canvas.Canvas(path, pagesize=A4)
    c.setFont("Helvetica", 12)
    
    c.drawString(100, 750, "Español: Propuesta de reforma económica")
    c.drawString(100, 730, "English: Economic reform proposal")
    c.drawString(100, 710, "Català: Proposta de reforma econòmica")
    c.drawString(100, 690, "Euskara: Ekonomia erreformaren proposamena")
    c.showPage()
    
    c.save()
    return True


def test_extraction(pdf_path: str, expected_pages: int, expected_text: list) -> dict:
    """Test PDF extraction and verify results."""
    result = {
        "pdf": os.path.basename(pdf_path),
        "pages": 0,
        "total_chars": 0,
        "text_found": [],
        "errors": []
    }
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            result["pages"] = len(pdf.pages)
            
            if result["pages"] != expected_pages:
                result["errors"].append(
                    f"Expected {expected_pages} pages, got {result['pages']}"
                )
            
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                result["total_chars"] += len(text)
                
                # Check expected text fragments
                for expected in expected_text:
                    if expected in text:
                        result["text_found"].append(expected[:50])
            
            # Check metadata
            meta = pdf.metadata or {}
            if meta:
                result["metadata"] = True
    
    except Exception as e:
        result["errors"].append(str(e))
    
    return result


def main():
    test_dir = Path("/tmp/spike-01-tests")
    test_dir.mkdir(exist_ok=True)
    
    results = []
    
    # Test 1: Simple PDF
    pdf1 = str(test_dir / "simple.pdf")
    if create_test_pdf_simple(pdf1):
        r = test_extraction(pdf1, 3, [
            "Programa Electoral de Prueba",
            "Reducir el IVA",
            "Transición energética"
        ])
        results.append(r)
        print(f"Test 1 (simple): {r['pages']} pages, {r['total_chars']} chars, "
              f"{len(r['text_found'])} fragments found, {len(r['errors'])} errors")
    
    # Test 2: PDF with table
    pdf2 = str(test_dir / "table.pdf")
    if create_test_pdf_with_table(pdf2):
        r = test_extraction(pdf2, 1, ["Educación", "Sanidad", "Defensa"])
        results.append(r)
        print(f"Test 2 (table): {r['pages']} pages, {r['total_chars']} chars, "
              f"{len(r['text_found'])} fragments found, {len(r['errors'])} errors")
    
    # Test 3: Multilingual PDF
    pdf3 = str(test_dir / "multilingual.pdf")
    if create_test_pdf_multilingual(pdf3):
        r = test_extraction(pdf3, 1, ["Español", "English", "Català"])
        results.append(r)
        print(f"Test 3 (multilingual): {r['pages']} pages, {r['total_chars']} chars, "
              f"{len(r['text_found'])} fragments found, {len(r['errors'])} errors")
    
    # Test 4: Empty PDF
    pdf4 = str(test_dir / "empty.pdf")
    if HAS_REPORTLAB:
        c = canvas.Canvas(pdf4, pagesize=A4)
        c.showPage()
        c.save()
        r = test_extraction(pdf4, 1, [])
        results.append(r)
        print(f"Test 4 (empty): {r['pages']} pages, {r['total_chars']} chars, "
              f"{len(r['errors'])} errors")
    
    # Summary
    total_tests = len(results)
    passed = sum(1 for r in results if not r["errors"])
    print(f"\n=== SPIKE-01 Summary ===")
    print(f"Tests: {total_tests}, Passed: {passed}, Failed: {total_tests - passed}")
    
    for r in results:
        status = "PASS" if not r["errors"] else "FAIL"
        print(f"  [{status}] {r['pdf']}: {r['pages']} pages, {r['total_chars']} chars")
        if r["errors"]:
            for err in r["errors"]:
                print(f"    Error: {err}")
    
    # Save results
    output_path = test_dir / "results.json"
    with open(output_path, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nResults saved to: {output_path}")
    
    return 0 if passed == total_tests else 1


if __name__ == "__main__":
    sys.exit(main())
