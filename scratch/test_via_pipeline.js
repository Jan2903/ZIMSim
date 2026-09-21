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
globalThis.window = {
    __TAURI__: true,
    localStorage: globalThis.localStorage
};
globalThis.document = {
    createElement: (tag) => {
        if (tag === 'canvas') {
            return {
                getContext: () => ({
                    measureText: (text) => ({ width: text.length * 10 }),
                    font: ''
                })
            };
        }
        return {};
    }
};
globalThis.Path2D = class Path2D {};
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

async function run() {
    console.log("=== STARTING AUDIO VIA & ANNOUNCEMENT VERIFICATION ===");

    const { StationService } = await import('../src/js/features/station/stationService.js');
    const { ansagenGenerator } = await import('../src/js/audio/ansagenGenerator.js');
    const { ansagenStore } = await import('../src/js/audio/ansagenStore.svelte.js');
    const { Journey } = await import('../src/js/features/journey/journey.svelte.js');
    const { Stop } = await import('../src/js/features/station/stop.svelte.js');
    const { JourneyViaService } = await import('../src/js/features/journey/services/journeyViaService.js');
    const { JourneyImportService } = await import('../src/js/features/journey/services/journeyImportService.js');

    // 1. Load CSV
    const csvContent = fs.readFileSync(path.resolve('./public/stations/stations.csv'), 'utf-8');
    StationService.parseCSV(csvContent);
    StationService.isLoaded = true;
    console.log(`[PASS] Loaded ${StationService.stations.length} stations from CSV.`);

    // 2. StationService disambiguation & category tests
    console.log("\n--- TEST 1: Station Matching & Category Disambiguation ---");
    const kolnMatch = StationService.getStationByIdOrName(null, 'Köln');
    console.log(`Matching 'Köln': ${kolnMatch?.name} (IBNR: ${kolnMatch?.ibnr}, Kat: ${kolnMatch?.kategorie})`);
    if (!kolnMatch || kolnMatch.ibnr !== '8000207') {
        throw new Error(`Expected Köln Hbf (8000207), got ${kolnMatch?.name} (${kolnMatch?.ibnr})`);
    }

    const ffAirportMatch = StationService.getStationByIdOrName(null, 'Frankfurt(M) Flughafen Fernbf');
    console.log(`Matching 'Frankfurt(M) Flughafen Fernbf': ${ffAirportMatch?.name} (IBNR: ${ffAirportMatch?.ibnr})`);
    if (!ffAirportMatch || ffAirportMatch.ibnr !== '8070003') {
        throw new Error(`Expected Frankfurt(M) Flughafen Fernbf (8070003), got ${ffAirportMatch?.name} (${ffAirportMatch?.ibnr})`);
    }
    console.log("[PASS] Station disambiguation and normalization successful.");

    // 3. Journey & audioVias getter tests
    console.log("\n--- TEST 2: Journey audioVias getter ---");
    const journey = new Journey({
        id: 'j-1',
        name: 'ICE 623',
        destination: 'München Hbf',
        scheduledTime: '10:15',
        platform: '3',
        stops: [
            new Stop({ name: 'Köln Messe/Deutz', extId: '8003330', audioVia: true, routeIndex: 0 }),
            new Stop({ name: 'Köln Hbf', extId: '8000207', audioVia: false, routeIndex: 1 }),
            new Stop({ name: 'Frankfurt(M) Flughafen Fernbf', extId: '8070003', audioVia: true, routeIndex: 2 }),
            new Stop({ name: 'Nürnberg Hbf', extId: '8000284', audioVia: true, routeIndex: 3 }),
            new Stop({ name: 'München Hbf', extId: '8000261', audioVia: true, routeIndex: 4 }) // Destination stop marked audioVia
        ],
        _currentStopIndex: 1 // Train is currently at Köln Hbf
    });

    const audioVias = journey.audioVias;
    console.log("Computed audioVias at _currentStopIndex = 1:", audioVias);
    
    // Past stop (Köln Messe/Deutz, index 0) and current stop (index 1) must NOT be included
    if (audioVias.some(v => v.name.includes('Köln'))) {
        throw new Error("audioVias must not include past or current stops!");
    }
    // Destination stop (München Hbf, index 4) must NOT be included in audioVias
    if (audioVias.some(v => v.name.includes('München'))) {
        throw new Error("audioVias must not include destination stop!");
    }
    // Future intermediate stops must be included as rich objects
    if (audioVias.length !== 2 || audioVias[0].name !== 'Frankfurt(M) Flughafen Fernbf' || audioVias[1].name !== 'Nürnberg Hbf') {
        throw new Error(`Expected Frankfurt and Nürnberg, got: ${JSON.stringify(audioVias)}`);
    }
    console.log("[PASS] Journey.audioVias correctly filters past stops and destination stop.");

    // 4. AutoGenerateAudioVias chronological sorting even when prioritized
    console.log("\n--- TEST 3: Auto-generate audio vias with priority mode ---");
    const j2 = new Journey({
        id: 'j-2',
        name: 'ICE 123',
        destination: 'Berlin Hbf',
        scheduledTime: '12:00',
        stops: [
            new Stop({ name: 'Fulda', extId: '8000115', stationCategory: 2, routeIndex: 0 }),
            new Stop({ name: 'Bad Hersfeld', extId: '8000021', stationCategory: 3, routeIndex: 1 }),
            new Stop({ name: 'Kassel-Wilhelmshöhe', extId: '8003200', stationCategory: 1, routeIndex: 2 }),
            new Stop({ name: 'Göttingen', extId: '8000128', stationCategory: 2, routeIndex: 3 }),
            new Stop({ name: 'Wolfsburg Hbf', extId: '8000269', stationCategory: 2, routeIndex: 4 }),
            new Stop({ name: 'Berlin Hbf', extId: '8011160', stationCategory: 1, routeIndex: 5 })
        ],
        _currentStopIndex: -1
    });

    // Generate 3 vias in priority mode (sortMode = 1)
    j2.autoGenerateAudioVias(3, 1);
    const selectedVias = j2.stops.filter(s => s.audioVia);
    console.log("Selected audio vias (Priority mode, max 3):", selectedVias.map(s => `${s.name} (Kat ${s.stationCategory}, Idx ${s.routeIndex})`));
    
    // Check that Kassel-Wilhelmshöhe (Kat 1) was selected
    if (!selectedVias.some(s => s.name === 'Kassel-Wilhelmshöhe')) {
        throw new Error("Kassel-Wilhelmshöhe (Kat 1) should be selected in priority mode!");
    }
    // Check that selected audio vias are in chronological order
    for (let i = 1; i < selectedVias.length; i++) {
        if (selectedVias[i].routeIndex <= selectedVias[i - 1].routeIndex) {
            throw new Error("Selected audio vias are not in chronological route order!");
        }
    }
    console.log("[PASS] AutoGenerateAudioVias correctly picks by priority and keeps chronological travel order.");

    // 5. AnsagenGenerator with UEBER and pitch checks
    console.log("\n--- TEST 4: AnsagenGenerator playlist generation with Vias ---");
    const p1 = ansagenGenerator.generateEinfahrt(j2);
    
    const viaEntries = [];
    let ueberFound = false;
    for (const item of p1) {
        if (item.file.includes('UEBER') || item.text === 'über') ueberFound = true;
        if (item.file.includes('/null')) {
            throw new Error(`Playlist contains invalid /null path: ${item.file}`);
        }
        if (item.file.includes('/ziele/')) {
            viaEntries.push(item);
        }
    }
    console.log("Playlist destination & via entries:", viaEntries);
    if (!ueberFound) {
        throw new Error("Expected 'über' in announcement for train with audio vias!");
    }
    // The target must be 'hoch', and last via must be 'tief'
    const targetEntry = viaEntries[0];
    const lastViaEntry = viaEntries[viaEntries.length - 1];
    if (!targetEntry.file.includes('/hoch/')) {
        throw new Error(`Expected target to be 'hoch' when vias follow, got ${targetEntry.file}`);
    }
    if (!lastViaEntry.file.includes('/tief/')) {
        throw new Error(`Expected last via to be 'tief', got ${lastViaEntry.file}`);
    }
    console.log("[PASS] Playlist correctly formatted with UEBER and correct audio pitches.");

    // 6. Manual toggle preserved across IRIS polling updates
    console.log("\n--- TEST 5: Manual toggle preservation across IRIS updates ---");
    const mockExistingJourney = new Journey({
        id: 'iris-101',
        journeyId: 'j-iris-101',
        name: 'ICE 999',
        destination: 'Frankfurt(Main)Hbf',
        stops: [
            new Stop({ name: 'Köln Hbf', extId: '8000207', audioVia: false, routeIndex: 0 }),
            new Stop({ name: 'Siegburg/Bonn', extId: '8005556', audioVia: true, routeIndex: 1 }), // MANUALLY CLICKED SPEAKER!
            new Stop({ name: 'Montabaur', extId: '8004064', audioVia: false, routeIndex: 2 }),
            new Stop({ name: 'Frankfurt(Main)Hbf', extId: '8000105', audioVia: false, routeIndex: 3 })
        ]
    });

    const journeyStore = {
        journeys: [mockExistingJourney]
    };

    // Incoming IRIS diff (stops change, e.g. updated delay or platform)
    const irisJourneys = [{
        id: 'iris-101-raw',
        journeyId: 'j-iris-101',
        name: 'ICE 999',
        ankunft: false,
        destination: 'Frankfurt(Main)Hbf',
        stops: [
            { name: 'Köln Hbf', extId: '8000207', routeIndex: 0 },
            { name: 'Siegburg/Bonn', extId: '8005556', routeIndex: 1, delay: 5 }, // Siegburg updated
            { name: 'Montabaur', extId: '8004064', routeIndex: 2 },
            { name: 'Frankfurt(Main)Hbf', extId: '8000105', routeIndex: 3 }
        ]
    }];

    JourneyImportService.upsertIrisJourneys(journeyStore.journeys, irisJourneys, (j) => journeyStore.journeys.push(j), (id) => {});

    const updatedJourney = journeyStore.journeys.find(j => j.journeyId === 'j-iris-101');
    const siegburgStop = updatedJourney.stops.find(s => s.name.includes('Siegburg'));
    console.log("Siegburg stop audioVia flag after IRIS upsert:", siegburgStop?.audioVia);
    if (!siegburgStop || siegburgStop.audioVia !== true) {
        throw new Error("Manual speaker selection (audioVia = true) was wiped out during IRIS poll!");
    }
    console.log("[PASS] Manual speaker selection preserved across IRIS polling cycles.");

    // 7. Manual speaker selection respected even if maxVias is 0
    console.log("\n--- TEST 6: Manual speaker selection respected even if maxVias is 0 ---");
    ansagenStore.maxVias = 0;
    const manualJourney = new Journey({
        id: 'm-1',
        name: 'RE 1',
        destination: 'Hamm(Westf)Hbf',
        stops: [
            new Stop({ name: 'Düsseldorf Hbf', extId: '8000085', audioVia: false, routeIndex: 0 }),
            new Stop({ name: 'Duisburg Hbf', extId: '8000086', audioVia: true, routeIndex: 1 }), // User manually marked this
            new Stop({ name: 'Essen Hbf', extId: '8000098', audioVia: false, routeIndex: 2 }),
            new Stop({ name: 'Hamm(Westf)Hbf', extId: '8000149', audioVia: false, routeIndex: 3 })
        ],
        _currentStopIndex: 0
    });

    const pManual = ansagenGenerator.generateEinfahrt(manualJourney);
    const hasUeber = pManual.some(item => item.file.includes('UEBER') || item.text === 'über');
    const hasDuisburg = pManual.some(item => item.file.includes('8000086'));
    console.log(`Manual announcement: hasUeber=${hasUeber}, hasDuisburg=${hasDuisburg}`);
    if (!hasUeber || !hasDuisburg) {
        throw new Error("Manually selected speaker stop must be announced even if maxVias = 0!");
    }
    console.log("[PASS] Manually selected stop is announced even when maxVias is 0.");

    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
}

run().catch(err => {
    console.error("\n[FAIL] Test failed:", err);
    process.exit(1);
});
