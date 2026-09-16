#!/usr/bin/env python3
"""
Extract high-resolution page images from the authoritative Qira'at PDF in iCloud.

Source:
  iCloud / 07. Quran & Islamic / Islamic Books / Books / مصحف القراءات العشر-1.pdf
  (Total: 630 pages, ~399.4 MB)
  Printed Page 1 corresponds to PDF Page 6 (offset: +5).
"""

import argparse
import os
import sys
import pdfplumber

DEFAULT_DIR = "/Users/amrelshazly/Library/Mobile Documents/com~apple~CloudDocs/07. Quran & Islamic/Islamic Books/Books"

def find_pdf_path(custom_path=None):
    if custom_path and os.path.isfile(custom_path):
        return custom_path
    
    if not os.path.isdir(DEFAULT_DIR):
        raise FileNotFoundError(f"iCloud directory not found: {DEFAULT_DIR}")
    
    # Locate file handling bidirectional unicode marks (\u200e, \u2068, etc.)
    for fname in os.listdir(DEFAULT_DIR):
        if "مصحف القراءات العشر-1" in fname and fname.endswith(".pdf"):
            return os.path.join(DEFAULT_DIR, fname)
            
    raise FileNotFoundError("Could not find 'مصحف القراءات العشر-1.pdf' in " + DEFAULT_DIR)

def extract_page(pdf_page_num, output_path, dpi=150, pdf_path=None):
    path = find_pdf_path(pdf_path)
    print(f"Opening PDF: {path}")
    print(f"Extracting PDF page {pdf_page_num} at {dpi} DPI...")
    
    with pdfplumber.open(path) as pdf:
        if pdf_page_num < 1 or pdf_page_num > len(pdf.pages):
            raise ValueError(f"Page {pdf_page_num} out of bounds (1..{len(pdf.pages)})")
        
        page = pdf.pages[pdf_page_num - 1]
        im = page.to_image(resolution=dpi)
        
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        im.save(output_path, format="PNG")
        print(f"Saved: {output_path} ({os.path.getsize(output_path):,} bytes)")

def main():
    parser = argparse.ArgumentParser(description="Extract page image from Qira'at authority PDF.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pdf-page", type=int, help="1-indexed PDF page number (e.g. 6 for Surah Al-Fatihah)")
    group.add_argument("--mushaf-page", type=int, help="Printed Mushaf page number (page 1 maps to PDF page 6)")
    parser.add_argument("--dpi", type=int, default=150, help="Image resolution DPI (default: 150)")
    parser.add_argument("--out", type=str, default=None, help="Output PNG file path")
    parser.add_argument("--pdf", type=str, default=None, help="Custom path to PDF file")
    
    args = parser.parse_args()
    
    if args.mushaf_page is not None:
        # Mushaf page 1 = PDF page 6
        pdf_page = args.mushaf_page + 5
    else:
        pdf_page = args.pdf_page
        
    out_file = args.out or f"docs/qiraat/source-pages/pdf-page-{pdf_page:03d}.png"
    extract_page(pdf_page, out_file, dpi=args.dpi, pdf_path=args.pdf)

if __name__ == "__main__":
    main()
