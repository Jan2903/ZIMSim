import fs from 'fs';
import path from 'path';

// Browser mocks
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

async function run() {
    const { StationService } = await import('../src/js/features/station/stationService.js');
    const { ansagenGenerator } = await import('../src/js/audio/ansagenGenerator.js');

    const csvContent = fs.readFileSync(path.resolve('./public/stations/stations.csv'), 'utf-8');
    StationService.parseCSV(csvContent);
    StationService.isLoaded = true;

    const testStations = [
        "Fulda",
        "Kassel-Wilhelmshöhe",
        "Kassel Hbf",
        "Göttingen",
        "Hannover Hbf",
        "Frankfurt(Main)Hbf",
        "Frankfurt(M) Flughafen Fernbf",
        "Frankfurt(Main)Süd",
        "Frankfurt (Main) Hbf",
        "Berlin Hbf",
        "Berlin Hbf (tief)",
        "Berlin Gesundbrunnen",
        "Berlin Südkreuz",
        "Hamburg Hbf",
        "Hamburg-Altona",
        "Hamburg-Harburg",
        "München Hbf",
        "Nürnberg Hbf",
        "Würzburg Hbf",
        "Erfurt Hbf",
        "Leipzig Hbf",
        "Dresden Hbf",
        "Stuttgart Hbf",
        "Köln Hbf",
        "Köln Messe/Deutz",
        "Düsseldorf Hbf",
        "Dortmund Hbf",
        "Essen Hbf",
        "Duisburg Hbf",
        "Bremen Hbf",
        "Braunschweig Hbf",
        "Wolfsburg Hbf",
        "Bebra",
        "Bad Hersfeld",
        "Wabern(Bz Kassel)",
        "Treysa",
        "Gießen",
        "Marburg(Lahn)",
        "Friedberg(Hess)"
    ];

    console.log("=== CHECKING COMMON IRIS / REAL DB NAMES IN stations.csv ===");
    let missingCount = 0;
    for (const name of testStations) {
        const ibnr = ansagenGenerator._getIbnr(name);
        if (!ibnr) {
            console.log(`❌ NOT FOUND: "${name}"`);
            missingCount++;
        } else {
            console.log(`✓ FOUND: "${name}" -> ${ibnr}`);
        }
    }
    console.log(`Total checked: ${testStations.length}, Missing: ${missingCount}`);
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
