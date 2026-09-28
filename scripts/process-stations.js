#!/usr/bin/env node
/**
 * scripts/process-stations.js
 * Node.js script (used by GitHub Actions build) to process stations CSV files and RIS_Texte CSV into optimized runtime formats:
 * 1. Combines public/stations/stations.csv and stations_ext.csv -> public/data/stations.json (compact tuple format)
 * 2. Converts public/stations/RIS_Texte.csv (Windows-1252) -> src/js/core/constants/risPresets.js (UTF-8 ES Module)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Parst CSV-Zeilen sicher unter Berücksichtigung von Anführungszeichen.
 * @param {string} text - CSV-Textinhalt
 * @param {string} [delimiter=','] - Trennzeichen
 * @returns {string[][]} Array von Zeilen-Arrays
 */
function parseCsvSimple(text, delimiter = ',') {
    const lines = text.split(/\r?\n/);
    const result = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = [];
        let curr = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                cols.push(curr.trim());
                curr = '';
            } else {
                curr += char;
            }
        }
        cols.push(curr.trim());
        result.push(cols);
    }
    return result;
}

/**
 * Verarbeitet die RIS_Texte.csv und generiert das ES-Modul risPresets.js.
 */
function processRisTexts() {
    const srcCsv = path.join(rootDir, 'public', 'stations', 'RIS_Texte.csv');
    const outDir = path.join(rootDir, 'src', 'js', 'core', 'constants');
    const outFile = path.join(outDir, 'risPresets.js');

    if (!fs.existsSync(srcCsv)) {
        console.warn(`[process-stations] Warning: ${srcCsv} not found.`);
        return;
    }

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    // Windows-1252 / ANSI Decodierung
    const buffer = fs.readFileSync(srcCsv);
    const decoder = new TextDecoder('windows-1252');
    const text = decoder.decode(buffer);
    const rows = parseCsvSimple(text, ';');

    const presets = [];
    // Überspringe Header (i = 1)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length >= 3) {
            presets.push({
                code: row[0].trim(),
                type: row[1].trim(),
                text: row[2].trim()
            });
        }
    }

    const jsContent = (
        '/**\n' +
        ' * RIS Verspätungs- und Qualitätsbegründungen (Standard DB RIS).\n' +
        ' * Automatisch kompiliert aus public/stations/RIS_Texte.csv.\n' +
        ' */\n' +
        `export const RIS_PRESETS = ${JSON.stringify(presets, null, 2)};\n`
    );

    if (fs.existsSync(outFile)) {
        try {
            if (fs.readFileSync(outFile, 'utf-8') === jsContent) {
                console.log(`[process-stations] RIS presets unchanged (${presets.length} entries).`);
                return;
            }
        } catch {}
    }

    fs.writeFileSync(outFile, jsContent, 'utf-8');
    console.log(`[process-stations] Generated ${outFile} (${presets.length} entries).`);
}

/**
 * Führt stations.csv und stations_ext.csv zu public/data/stations.json zusammen.
 */
function processStations() {
    const stationsCsv = path.join(rootDir, 'public', 'stations', 'stations.csv');
    const stationsExtCsv = path.join(rootDir, 'public', 'stations', 'stations_ext.csv');
    const outDir = path.join(rootDir, 'public', 'data');
    const outFile = path.join(outDir, 'stations.json');

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const stations = [];
    const seenIbnrs = new Set();

    for (const srcPath of [stationsCsv, stationsExtCsv]) {
        if (!fs.existsSync(srcPath)) {
            console.warn(`[process-stations] Warning: ${srcPath} not found.`);
            continue;
        }

        const text = fs.readFileSync(srcPath, 'utf-8');
        const rows = parseCsvSimple(text, ',');

        // Überspringe Header (i = 1)
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if (cols.length >= 5) {
                const ibnr = cols[0].trim();
                if (!ibnr || seenIbnrs.has(ibnr)) continue;
                seenIbnrs.add(ibnr);

                const nameField = cols[1].trim();
                const names = nameField.split('<>').map(n => n.trim());
                const primaryName = names.length > 1 ? names[1] : names[0];
                const nameKurz = cols[2].trim();
                const ds100 = cols[3].trim();
                const kategorie = parseInt(cols[4].trim(), 10) || 7;
                const aliases = names.length > 1 ? names : [];

                // Kompaktes Tupel-Format:
                // [ibnr, primaryName, ds100, kategorie, (nameKurz != primaryName ? nameKurz : ''), (aliases.length ? aliases : undefined)]
                const row = [ibnr, primaryName, ds100, kategorie];
                if (nameKurz !== primaryName || aliases.length > 0) {
                    row.push(nameKurz !== primaryName ? nameKurz : '');
                    if (aliases.length > 0) {
                        row.push(aliases);
                    }
                }
                stations.push(row);
            }
        }
    }

    const jsonStr = JSON.stringify(stations);

    if (fs.existsSync(outFile)) {
        try {
            if (fs.readFileSync(outFile, 'utf-8') === jsonStr) {
                console.log(`[process-stations] Stations unchanged (${stations.length} entries).`);
                return;
            }
        } catch {}
    }

    fs.writeFileSync(outFile, jsonStr, 'utf-8');
    const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
    console.log(`[process-stations] Generated ${outFile} (${stations.length} stations, ${sizeKb} KB).`);
}

function main() {
    processRisTexts();
    processStations();
}

main();
