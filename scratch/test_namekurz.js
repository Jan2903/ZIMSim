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

async function test() {
    const { StationService } = await import('../src/js/features/station/stationService.js');
    const { ansagenGenerator } = await import('../src/js/audio/ansagenGenerator.js');

    const csvContent = fs.readFileSync(path.resolve('./public/stations/stations.csv'), 'utf-8');
    StationService.parseCSV(csvContent);
    StationService.isLoaded = true;

    const shortNames = [
        "Frankfurt(M)Hbf",
        "Frankfurt(M)",
        "Frankfurt(M) Süd",
        "Kassel-Wilh.",
        "Hannover",
        "Düsseldorf",
        "München",
        "Nürnberg",
        "Köln",
        "Stuttgart",
        "Berlin Hbf",
        "Hamburg Hbf",
        "Würzburg",
        "Erfurt"
    ];

    console.log("=== Testing nameKurz matching in _getIbnr ===");
    for (const name of shortNames) {
        const ibnr = ansagenGenerator._getIbnr(name);
        console.log(`_getIbnr("${name}") -> ${ibnr || '❌ NULL'}`);
    }
    process.exit(0);
}

test().catch(console.error);
