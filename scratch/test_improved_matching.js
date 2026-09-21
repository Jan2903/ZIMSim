import fs from 'fs';
import path from 'path';

const storage = new Map();
globalThis.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
};
globalThis.window = globalThis;
globalThis.document = { createElement: () => ({}) };
globalThis.Path2D = class Path2D {};
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/straße|strasse/gi, 'str')
        .replace(/hauptbahnhof/gi, 'hbf')
        .replace(/fernbahnhof|fernbhf|fernbf/gi, 'fernbhf')
        .replace(/regionalbahnhof|regiobhf|regiobf/gi, 'regiobf')
        .replace(/\(m\)/g, 'm')
        .replace(/\(main\)/g, 'm')
        .replace(/am\s*main/g, 'm')
        .replace(/\(oder\)/g, 'oder')
        .replace(/am\s*oder/g, 'oder')
        .replace(/[\s\(\)\-\.,]/g, '');
}

function getStationByIdOrName(stations, extId, name) {
    if (!stations || stations.length === 0) return null;
    let found = null;
    if (extId) {
        found = stations.find(s => s.ibnr === extId);
    }
    if (!found && name) {
        const normName = normalizeName(name);

        // 1. Exakter Match auf normalisierten Namen oder Aliase (niedrigste Kategorie zuerst)
        const exactMatches = stations.filter(s => {
            const matchesAlias = (s.aliases || []).some(alias => normalizeName(alias) === normName);
            return matchesAlias || normalizeName(s.name) === normName;
        });
        if (exactMatches.length > 0) {
            exactMatches.sort((a, b) => a.kategorie - b.kategorie);
            found = exactMatches[0];
        }

        // 2. Match auf nameKurz
        if (!found) {
            const kurzMatches = stations.filter(s => normalizeName(s.nameKurz) === normName);
            if (kurzMatches.length > 0) {
                kurzMatches.sort((a, b) => a.kategorie - b.kategorie);
                found = kurzMatches[0];
            }
        }

        // 3. Fallback: Substring Match
        if (!found && normName.length > 3) {
            const subMatches = stations.filter(s => {
                const normCsvName = normalizeName(s.name);
                const normCsvKurz = normalizeName(s.nameKurz);
                return (normName.includes(normCsvName) || normCsvName.includes(normName)) ||
                       (normCsvKurz && (normName.includes(normCsvKurz) || normCsvKurz.includes(normName)));
            });
            if (subMatches.length > 0) {
                subMatches.sort((a, b) => a.kategorie - b.kategorie);
                found = subMatches[0];
            }
        }
    }
    return found;
}

const csvContent = fs.readFileSync(path.resolve('./public/stations/stations.csv'), 'utf-8');
const stations = [];
for (const line of csvContent.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    if (cols.length >= 5) {
        const nameField = cols[1].trim();
        const names = nameField.split('<>').map(n => n.trim());
        stations.push({
            ibnr: cols[0].trim(),
            name: names.length > 1 ? names[1] : names[0],
            aliases: names,
            nameKurz: cols[2].trim(),
            ds100: cols[3].trim(),
            kategorie: parseInt(cols[4].trim()) || 7
        });
    }
}

console.log("=== Testing improved station matcher ===");
const tests = [
    { input: "Köln", expectedIbnr: "8000207", desc: "Köln Hbf (not Hansaring!)" },
    { input: "München", expectedIbnr: "8000261", desc: "München Hbf" },
    { input: "Hannover", expectedIbnr: "8000152", desc: "Hannover Hbf" },
    { input: "Frankfurt(M) Flughafen Fernbf", expectedIbnr: "8070003", desc: "Frankfurt Fernbahnhof" },
    { input: "Frankfurt(Main)Hbf", expectedIbnr: "8000105", desc: "Frankfurt Hbf" },
    { input: "Frankfurt(M)Hbf", expectedIbnr: "8000105", desc: "Frankfurt Hbf via M" },
    { input: "Berlin Hbf (tief)", expectedIbnr: "8011160", desc: "Berlin Hbf" },
    { input: "Kassel-Wilh.", expectedIbnr: "8003200", desc: "Kassel-Wilhelmshöhe" },
    { input: "Göttingen", expectedIbnr: "8000128", desc: "Göttingen" }
];

let allOk = true;
for (const t of tests) {
    const res = getStationByIdOrName(stations, null, t.input);
    const matchOk = res && res.ibnr === t.expectedIbnr;
    console.log(`${matchOk ? '✓' : '❌'} "${t.input}" -> ${res ? res.name + ' (' + res.ibnr + ', Kat ' + res.kategorie + ')' : 'NULL'} | Expected: ${t.expectedIbnr} (${t.desc})`);
    if (!matchOk) allOk = false;
}

if (!allOk) process.exit(1);
console.log("\nALL MATCHES PERFECT!");
process.exit(0);
