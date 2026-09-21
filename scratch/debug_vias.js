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
    const { ansagenStore } = await import('../src/js/audio/ansagenStore.svelte.js');
    const { Journey } = await import('../src/js/features/journey/journey.svelte.js');
    const { Stop } = await import('../src/js/features/station/stop.svelte.js');

    // Manually parse CSV
    const csvContent = fs.readFileSync(path.resolve('./public/stations/stations.csv'), 'utf-8');
    StationService.parseCSV(csvContent);
    StationService.isLoaded = true;
    console.log(`Loaded ${StationService.stations.length} stations.`);

    console.log("ansagenStore.maxVias:", ansagenStore.maxVias);
    console.log("ansagenStore.viaSortMode:", ansagenStore.viaSortMode);

    // Test 1: Journey created with stops (as in IRIS or manual)
    const j = new Journey({
        id: 'test-1',
        name: 'ICE 552',
        destination: 'Berlin Hbf',
        scheduledTime: '14:32',
        stops: [
            new Stop({ name: 'Fulda', audioVia: false, routeIndex: 0 }),
            new Stop({ name: 'Kassel-Wilhelmshöhe', audioVia: true, routeIndex: 1 }),
            new Stop({ name: 'Göttingen', audioVia: true, routeIndex: 2 }),
            new Stop({ name: 'Wolfsburg Hbf', audioVia: true, routeIndex: 3 }),
            new Stop({ name: 'Berlin Hbf', audioVia: false, routeIndex: 4 })
        ]
    });

    console.log("\n--- TEST 1: Manual audioVia = true on stops ---");
    console.log("j.stops audioVia flags:", j.stops.map(s => ({ name: s.name, audioVia: s.audioVia, nameKurz: s.nameKurz })));
    console.log("j.audioVias:", j.audioVias);

    const playlist = ansagenGenerator.generateEinfahrt(j);
    console.log("Playlist generated entries:");
    for (const item of playlist) {
        console.log(`  [${item.file}] -> "${item.text}"`);
    }

    // Test 2: Destination lookup
    console.log("\n--- TEST 2: Station IBNR lookups ---");
    for (const stopName of ['Berlin Hbf', 'Kassel-Wilhelmshöhe', 'Göttingen', 'Wolfsburg Hbf']) {
        console.log(`_getIbnr('${stopName}') =`, ansagenGenerator._getIbnr(stopName));
    }
}

run().catch(console.error);
