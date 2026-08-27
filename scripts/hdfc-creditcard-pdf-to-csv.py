#!/usr/bin/env python3
"""
Convert HDFC credit card year-end statement PDF to CSV.

Uses pypdf for text extraction (pip install pypdf).

Usage:
    python scripts/hdfc-creditcard-pdf-to-csv.py "Hdfc creditcard_april34tomarch24.pdf"
    python scripts/hdfc-creditcard-pdf-to-csv.py input.pdf -o output.csv
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError as exc:
    raise SystemExit(
        "pypdf is required. Install with: pip install pypdf"
    ) from exc

TX_LINE = re.compile(
    r"^(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+(DR|CR)\s+(\S+)\s*$"
)

SKIP_MARKERS = (
    "Account Summary for the period",
    "Monthly Statement wise Summary",
    "Primary Card Holder Name",
    "Transaction Details",
    "Year End Statement",
    "HDFC Bank Credit Cards",
    "Page ",
    "Card Number",
    "Purchases & Debits",
    "MEDHA RAGHAVAN",
    "GSTIN",
    "HSN Code",
    "Number of Add-on",
    "Credit Limit",
)


def parse_amount(value: str) -> float:
    return float(value.replace(",", ""))


def format_amount(value: float) -> str:
    if value == int(value):
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def should_skip(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    return any(marker in stripped for marker in SKIP_MARKERS)


def extract_pdf_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def parse_transactions(text: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if should_skip(line):
            continue

        match = TX_LINE.match(line)
        if not match:
            continue

        date, description, amount_raw, dr_cr, card_number = match.groups()
        amount = parse_amount(amount_raw)
        txn_type = "debit" if dr_cr.upper() == "DR" else "credit"

        rows.append(
            {
                "Date": date,
                "Description": re.sub(r"\s+", " ", description.strip()),
                "Amount": format_amount(amount),
                "Type": txn_type,
                "DR/CR": dr_cr.upper(),
                "Card Number": card_number,
            }
        )

    return rows


def default_output_path(pdf_path: Path) -> Path:
    stem = pdf_path.stem.replace(" ", "_").replace("-", "_")
    return pdf_path.with_name(f"{stem}.csv")


def write_csv(transactions: list[dict[str, str]], output_path: Path) -> None:
    fieldnames = ["Date", "Description", "Amount", "Type", "DR/CR", "Card Number"]
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(transactions)


def convert(pdf_path: Path, output_path: Path) -> int:
    text = extract_pdf_text(pdf_path)
    transactions = parse_transactions(text)
    if not transactions:
        raise RuntimeError(f"No transactions found in {pdf_path}")

    write_csv(transactions, output_path)
    return len(transactions)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert an HDFC credit card statement PDF into CSV."
    )
    parser.add_argument("pdf", type=Path, help="Path to the HDFC credit card statement PDF")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Output CSV path (default: same name as PDF with .csv extension)",
    )
    args = parser.parse_args()

    pdf_path = args.pdf.expanduser().resolve()
    if not pdf_path.is_file():
        print(f"Error: PDF not found: {pdf_path}", file=sys.stderr)
        return 1

    output_path = (
        args.output.expanduser().resolve()
        if args.output
        else default_output_path(pdf_path)
    )

    try:
        count = convert(pdf_path, output_path)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Wrote {count} transactions to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
