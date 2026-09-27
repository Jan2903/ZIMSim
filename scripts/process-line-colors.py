#!/usr/bin/env python3
"""
scripts/process-line-colors.py
Fetches line-colors.csv from traewelling/line-colors, removes unused columns,
harmonizes line names and shapes, and writes an optimized public/data/line-colors.json.
"""

import csv
import io
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

UPSTREAM_URL = "https://raw.githubusercontent.com/Traewelling/line-colors/main/line-colors.csv"

def normalize_shape(raw_shape):
    if not raw_shape:
        return "rounded"
    s = raw_shape.strip().lower()
    if s == "pill":
        return "pill"
    if s == "rectangle":
        return "rectangle"
    if s in ("rectangle-rounded-corner", "rounded", "circle", "hexagon", "trapezoid"):
        return "rounded"
    return "rounded"

def normalize_line_name(line_name):
    """Returns canonical line name, e.g. 'RE70' -> 'RE 70' or 'S5' -> 'S 5' and 'S5'"""
    cleaned = (line_name or "").strip()
    if not cleaned:
        return []
    
    # E.g. 'S 5' or 'S5'
    variants = [cleaned]
    # Check if there is letter+digit without space (e.g. 'RE70' or 'S5')
    m1 = re.match(r"^([A-Za-z]+)(\d+.*)$", cleaned)
    if m1:
        spaced = f"{m1.group(1)} {m1.group(2)}"
        if spaced not in variants:
            variants.append(spaced)
    
    # Check if there is letter+space+digit (e.g. 'RE 70')
    m2 = re.match(r"^([A-Za-z]+)\s+(\d+.*)$", cleaned)
    if m2:
        unspaced = f"{m2.group(1)}{m2.group(2)}"
        if unspaced not in variants:
            variants.append(unspaced)
            
    return variants

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    aliases_path = os.path.join(script_dir, "operator-aliases.json")
    out_dir = os.path.join(root_dir, "public", "data")
    out_path = os.path.join(out_dir, "line-colors.json")

    os.makedirs(out_dir, exist_ok=True)

    # 1. Load Aliases
    aliases = {}
    if os.path.exists(aliases_path):
        with open(aliases_path, "r", encoding="utf-8") as f:
            aliases = json.load(f)

    # 2. Fetch or load CSV
    csv_text = ""
    local_csv = os.path.join(script_dir, "line-colors.csv")
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        print(f"Reading from {sys.argv[1]}...")
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            csv_text = f.read()
    elif os.path.exists(local_csv):
        print(f"Reading from local {local_csv}...")
        with open(local_csv, "r", encoding="utf-8") as f:
            csv_text = f.read()
    else:
        print(f"Fetching from {UPSTREAM_URL}...")
        req = urllib.request.Request(
            UPSTREAM_URL,
            headers={"User-Agent": "ZIMSim-LineColors-Updater/1.0"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            csv_text = resp.read().decode("utf-8")

    reader = csv.DictReader(io.StringIO(csv_text))
    
    operators_data = {}
    line_to_ops = {}

    row_count = 0
    for row in reader:
        row_count += 1
        op = (row.get("shortOperatorName") or "").strip()
        line = (row.get("lineName") or "").strip()
        bg = (row.get("backgroundColor") or "").strip()
        fg = (row.get("textColor") or "").strip()
        border = (row.get("borderColor") or "").strip()
        shape = normalize_shape(row.get("shape"))

        if not op or not line or not bg:
            continue

        style_entry = {
            "bg": bg,
            "fg": fg or "#ffffff",
            "shape": shape
        }
        if border and border.lower() != "transparent":
            style_entry["border"] = border

        if op not in operators_data:
            operators_data[op] = {}

        line_variants = normalize_line_name(line)
        for lv in line_variants:
            operators_data[op][lv] = style_entry

        # Track uniqueness for line names using space-insensitive uppercase key (e.g. "RE30" for both "RE 30" and "RE30")
        canonical_key = re.sub(r"\s+", "", line).upper()
        if canonical_key not in line_to_ops:
            line_to_ops[canonical_key] = []
        if not any(entry[0] == op for entry in line_to_ops[canonical_key]):
            line_to_ops[canonical_key].append((op, style_entry, line_variants))

    # Determine uniqueLines (lines that exist under only 1 operator and are transit/rail prefixed)
    unique_lines = {}
    for canonical_key, op_list in line_to_ops.items():
        if len(op_list) == 1:
            # Skip purely numeric lines (e.g. '70', '404') to avoid collisions with train numbers or ambiguous buses
            if canonical_key.isdigit():
                continue
            op_name, style, variants = op_list[0]
            # Add both spaced and unspaced variants
            for lv in variants:
                unique_lines[lv] = {
                    "bg": style["bg"],
                    "fg": style["fg"],
                    "shape": style["shape"],
                    "op": op_name
                }
                if "border" in style:
                    unique_lines[lv]["border"] = style["border"]

    output = {
        "version": 1,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "totalRowsProcessed": row_count,
        "operatorCount": len(operators_data),
        "irisAliases": aliases.get("irisAliases", {}),
        "sbahnNetworksByDs100Prefix": aliases.get("sbahnNetworksByDs100Prefix", {}),
        "operators": operators_data,
        "uniqueLines": unique_lines
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(out_path) / 1024
    print(f"Successfully processed {row_count} rows across {len(operators_data)} operators.")
    print(f"Generated {out_path} ({size_kb:.1f} KB)")

if __name__ == "__main__":
    main()
