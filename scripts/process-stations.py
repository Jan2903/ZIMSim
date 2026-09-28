#!/usr/bin/env python3
"""
scripts/process-stations.py
Processes stations CSV files and RIS_Texte CSV into optimized runtime formats:
1. Combines public/stations/stations.csv and stations_ext.csv -> public/data/stations.json (compact tuple format)
2. Converts public/stations/RIS_Texte.csv (Windows-1252) -> src/js/core/constants/risPresets.js (UTF-8 ES Module)
"""

import csv
import json
import os
import sys

def process_ris_texts(script_dir, root_dir):
    src_csv = os.path.join(root_dir, "public", "stations", "RIS_Texte.csv")
    out_dir = os.path.join(root_dir, "src", "js", "core", "constants")
    out_file = os.path.join(out_dir, "risPresets.js")

    if not os.path.exists(src_csv):
        print(f"[process-stations] Warning: {src_csv} not found.")
        return

    os.makedirs(out_dir, exist_ok=True)

    presets = []
    with open(src_csv, "r", encoding="windows-1252", errors="replace") as f:
        reader = csv.reader(f, delimiter=";")
        header = next(reader, None)
        for row in reader:
            if len(row) >= 3:
                code = row[0].strip()
                ptype = row[1].strip()
                text = row[2].strip()
                presets.append({
                    "code": code,
                    "type": ptype,
                    "text": text
                })

    js_content = (
        "/**\n"
        " * RIS Verspätungs- und Qualitätsbegründungen (Standard DB RIS).\n"
        " * Automatisch kompiliert aus public/stations/RIS_Texte.csv.\n"
        " */\n"
        f"export const RIS_PRESETS = {json.dumps(presets, ensure_ascii=False, indent=2)};\n"
    )

    if os.path.exists(out_file):
        try:
            with open(out_file, "r", encoding="utf-8") as f:
                if f.read() == js_content:
                    print(f"[process-stations] RIS presets unchanged ({len(presets)} entries).")
                    return
        except Exception:
            pass

    with open(out_file, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"[process-stations] Generated {out_file} ({len(presets)} entries).")

def process_stations(script_dir, root_dir):
    stations_csv = os.path.join(root_dir, "public", "stations", "stations.csv")
    stations_ext_csv = os.path.join(root_dir, "public", "stations", "stations_ext.csv")
    out_dir = os.path.join(root_dir, "public", "data")
    out_file = os.path.join(out_dir, "stations.json")

    os.makedirs(out_dir, exist_ok=True)

    stations = []
    seen_ibnrs = set()

    for path in [stations_csv, stations_ext_csv]:
        if not os.path.exists(path):
            print(f"[process-stations] Warning: {path} not found.")
            continue

        with open(path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            for cols in reader:
                if len(cols) >= 5:
                    ibnr = cols[0].strip()
                    if not ibnr or ibnr in seen_ibnrs:
                        continue
                    seen_ibnrs.add(ibnr)

                    name_field = cols[1].strip()
                    names = [n.strip() for n in name_field.split("<>")]
                    primary_name = names[1] if len(names) > 1 else names[0]
                    name_kurz = cols[2].strip()
                    ds100 = cols[3].strip()
                    kategorie = int(cols[4].strip()) if cols[4].strip().isdigit() else 7
                    aliases = names if len(names) > 1 else []

                    # Compact tuple format:
                    # [ibnr, primary_name, ds100, kategorie, (name_kurz if != primary_name else ''), (aliases if any else [])]
                    row = [ibnr, primary_name, ds100, kategorie]
                    if name_kurz != primary_name or aliases:
                        row.append(name_kurz if name_kurz != primary_name else "")
                        if aliases:
                            row.append(aliases)
                    stations.append(row)

    json_str = json.dumps(stations, ensure_ascii=False, separators=(",", ":"))

    if os.path.exists(out_file):
        try:
            with open(out_file, "r", encoding="utf-8") as f:
                if f.read() == json_str:
                    print(f"[process-stations] Stations unchanged ({len(stations)} entries).")
                    return
        except Exception:
            pass

    with open(out_file, "w", encoding="utf-8") as f:
        f.write(json_str)

    size_kb = os.path.getsize(out_file) / 1024
    print(f"[process-stations] Generated {out_file} ({len(stations)} stations, {size_kb:.1f} KB).")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)

    process_ris_texts(script_dir, root_dir)
    process_stations(script_dir, root_dir)

if __name__ == "__main__":
    main()
