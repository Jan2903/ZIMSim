#!/usr/bin/env node
/**
 * scripts/process-line-colors.js
 * Node.js script (used by GitHub Actions) to fetch line-colors.csv from traewelling/line-colors,
 * remove unused columns, harmonize line names and shapes, and write an optimized public/data/line-colors.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPSTREAM_URL = 'https://raw.githubusercontent.com/Traewelling/line-colors/main/line-colors.csv';

function normalizeShape(rawShape) {
    if (!rawShape) return 'rounded';
    const s = rawShape.trim().toLowerCase();
    if (s === 'pill') return 'pill';
    if (s === 'rectangle') return 'rectangle';
    if (['rectangle-rounded-corner', 'rounded', 'circle', 'hexagon', 'trapezoid'].includes(s)) {
        return 'rounded';
    }
    return 'rounded';
}

function normalizeLineName(lineName) {
    const cleaned = (lineName || '').trim();
    if (!cleaned) return [];
    
    const variants = [cleaned];
    const m1 = cleaned.match(/^([A-Za-z]+)(\d+.*)$/);
    if (m1) {
        const spaced = `${m1[1]} ${m1[2]}`;
        if (!variants.includes(spaced)) variants.push(spaced);
    }
    const m2 = cleaned.match(/^([A-Za-z]+)\s+(\d+.*)$/);
    if (m2) {
        const unspaced = `${m2[1]}${m2[2]}`;
        if (!variants.includes(unspaced)) variants.push(unspaced);
    }
    return variants;
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    const header = lines[0].split(',').map(h => h.trim());
    const results = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Simple comma split handling quotes if any
        const cols = [];
        let curr = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                cols.push(curr.trim());
                curr = '';
            } else {
                curr += char;
            }
        }
        cols.push(curr.trim());
        
        const row = {};
        for (let k = 0; k < header.length; k++) {
            row[header[k]] = cols[k] || '';
        }
        results.push(row);
    }
    return results;
}

/**
 * Vergleicht zwei Objekte oder Werte rekursiv auf inhaltliche Gleichheit (unabhängig von der Schlüssel-Reihenfolge).
 * @param {any} a - Erster Wert
 * @param {any} b - Zweiter Wert
 * @returns {boolean} true bei identischem Inhalt
 */
function isDeepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (!isDeepEqual(a[key], b[key])) return false;
    }
    return true;
}

async function main() {
    const rootDir = path.resolve(__dirname, '..');
    const aliasesPath = path.join(__dirname, 'operator-aliases.json');
    const outDir = path.join(rootDir, 'public', 'data');
    const outPath = path.join(outDir, 'line-colors.json');

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    let aliases = {};
    if (fs.existsSync(aliasesPath)) {
        aliases = JSON.parse(fs.readFileSync(aliasesPath, 'utf-8'));
    }

    let csvText = '';
    const localCsv = path.join(__dirname, 'line-colors.csv');
    if (process.argv[2] && fs.existsSync(process.argv[2])) {
        console.log(`Reading from ${process.argv[2]}...`);
        csvText = fs.readFileSync(process.argv[2], 'utf-8');
    } else if (fs.existsSync(localCsv)) {
        console.log(`Reading from local ${localCsv}...`);
        csvText = fs.readFileSync(localCsv, 'utf-8');
    } else {
        console.log(`Fetching from ${UPSTREAM_URL}...`);
        const res = await fetch(UPSTREAM_URL, {
            headers: { 'User-Agent': 'ZIMSim-LineColors-Updater/1.0' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} when fetching upstream CSV`);
        csvText = await res.text();
    }

    const rows = parseCSV(csvText);
    const operatorsData = {};
    const lineToOps = {};

    let rowCount = 0;
    for (const row of rows) {
        rowCount++;
        const op = (row.shortOperatorName || '').trim();
        const line = (row.lineName || '').trim();
        const bg = (row.backgroundColor || '').trim();
        const fg = (row.textColor || '').trim();
        const border = (row.borderColor || '').trim();
        const shape = normalizeShape(row.shape);

        if (!op || !line || !bg) continue;

        const styleEntry = {
            bg,
            fg: fg || '#ffffff',
            shape
        };
        if (border && border.toLowerCase() !== 'transparent') {
            styleEntry.border = border;
        }

        if (!operatorsData[op]) operatorsData[op] = {};

        const lineVariants = normalizeLineName(line);
        for (const lv of lineVariants) {
            operatorsData[op][lv] = styleEntry;
        }

        // Track uniqueness for line names using space-insensitive uppercase key (e.g. "RE30" for both "RE 30" and "RE30")
        const canonicalKey = line.replace(/\s+/g, '').toUpperCase();
        if (!lineToOps[canonicalKey]) lineToOps[canonicalKey] = [];
        if (!lineToOps[canonicalKey].some(entry => entry.op === op)) {
            lineToOps[canonicalKey].push({ op, style: styleEntry, variants: lineVariants });
        }
    }

    const uniqueLines = {};
    for (const [canonicalKey, opList] of Object.entries(lineToOps)) {
        if (opList.length === 1) {
            // Skip purely numeric lines (e.g. '70', '404') to avoid collisions with train numbers or ambiguous buses
            if (/^\d+$/.test(canonicalKey)) continue;

            const { op: opName, style, variants } = opList[0];
            for (const lv of variants) {
                uniqueLines[lv] = {
                    bg: style.bg,
                    fg: style.fg,
                    shape: style.shape,
                    op: opName
                };
                if (style.border) uniqueLines[lv].border = style.border;
            }
        }
    }

    const output = {
        version: 1,
        updatedAt: new Date().toISOString(),
        totalRowsProcessed: rowCount,
        operatorCount: Object.keys(operatorsData).length,
        irisAliases: aliases.irisAliases || {},
        sbahnNetworksByDs100Prefix: aliases.sbahnNetworksByDs100Prefix || {},
        operators: operatorsData,
        uniqueLines
    };

    // Inhaltliche Integritätsprüfung: Nicht überschreiben, wenn sich die fachlichen Daten nicht geändert haben
    if (fs.existsSync(outPath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
            const { updatedAt: _oldTs, ...oldData } = existing;
            const { updatedAt: _newTs, ...newData } = output;

            if (isDeepEqual(oldData, newData)) {
                console.log(`No data changes detected in line-colors. Upstream is up to date (kept timestamp: ${existing.updatedAt}).`);
                return;
            }
        } catch (e) {
            console.warn('Could not read existing line-colors.json for comparison, proceeding with write:', e.message);
        }
    }

    fs.writeFileSync(outPath, JSON.stringify(output), 'utf-8');
    const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.log(`Successfully processed ${rowCount} rows across ${Object.keys(operatorsData).length} operators.`);
    console.log(`Generated ${outPath} (${sizeKb} KB)`);
}

main().catch(err => {
    console.error('Fatal error in process-line-colors.js:', err);
    process.exit(1);
});
