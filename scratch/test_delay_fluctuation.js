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
    console.log("=== STARTING DELAY FLUCTUATION & FAHRTAENDERUNG TEST ===");

    const { StationService } = await import('../src/js/features/station/stationService.js');
    const { ansagenGenerator } = await import('../src/js/audio/ansagenGenerator.js');
    const { Journey } = await import('../src/js/features/journey/journey.svelte.js');
    const { Stop } = await import('../src/js/features/station/stop.svelte.js');
    const { irisAnnouncementService } = await import('../src/js/audio/irisAnnouncementService.js');
    const { announcementQueueService } = await import('../src/js/audio/announcementQueueService.svelte.js');

    // 1. Test generateInformation with no disruption
    console.log("\n--- TEST 1: Empty playlist when no disruption ---");
    const onTimeJourney = new Journey({
        id: 'ontime-1',
        name: 'RB 72',
        destination: 'Paderborn Hbf',
        scheduledTime: '22:20',
        expectedTime: '22:24', // 4 min diff -> delay < 5 -> no disruption!
        ankunft: true,
        stops: [
            new Stop({ name: 'Paderborn Hbf' }),
            new Stop({ name: 'Altenbeken' }),
            new Stop({ name: 'Detmold' })
        ]
    });
    const infoPlaylist = ansagenGenerator.generateInformation(onTimeJourney);
    console.log("infoPlaylist length for 4min delay:", infoPlaylist.length);
    if (infoPlaylist.length !== 0) {
        throw new Error(`Expected empty playlist for 4 min delay, got ${infoPlaylist.length} items`);
    }
    console.log("[PASS] generateInformation returns empty playlist for delay < 5.");

    // 2. Test Rapid Delay Fluctuation (4 min <-> 5 min <-> 6 min)
    console.log("\n--- TEST 2: Delay Fluctuation Hysteresis & Cooldown ---");
    announcementQueueService.queue = [];
    announcementQueueService.history = [];
    announcementQueueService.currentAnnouncement = null;

    let simTime = Date.now();
    const futureBase = simTime + 20 * 60 * 1000; // 20 min in future

    const fluctuatingTrain = new Journey({
        id: 'rb72',
        journeyId: 'j-rb72',
        name: 'RB 72 / 90682',
        destination: 'Herford',
        scheduledTime: '12:00',
        expectedTime: '12:04', // 4 min initially
        ankunft: false,
        _effectiveTimeMs: futureBase + 4 * 60 * 1000,
        stops: [
            new Stop({ name: 'Paderborn Hbf', routeIndex: 0 }),
            new Stop({ name: 'Altenbeken', routeIndex: 1 }),
            new Stop({ name: 'Herford', routeIndex: 2 })
        ]
    });

    const journeys = [fluctuatingTrain];

    // Initialize baseline (4 min delay -> delay < 5 -> delay 0)
    irisAnnouncementService.initializeBaseline(journeys, simTime);
    if (fluctuatingTrain.announcementState.lastAnnouncedDelay !== 0) {
        throw new Error("Initial lastAnnouncedDelay should be 0");
    }

    // Poll 1 (30s later): delay becomes 5 minutes
    simTime += 30000;
    fluctuatingTrain.expectedTime = '12:05';
    fluctuatingTrain._effectiveTimeMs = futureBase + 5 * 60 * 1000;
    irisAnnouncementService.checkChanges(journeys, simTime);

    console.log("History count after Poll 1 (delay = 5m):", announcementQueueService.history.length);
    if (announcementQueueService.history.length !== 1) {
        throw new Error(`Expected 1 announcement in history after jump to 5 min, got ${announcementQueueService.history.length}`);
    }
    const firstAnn = announcementQueueService.history[0];
    console.log("First announcement label:", firstAnn.label);
    if (!firstAnn.label.includes('+5m')) {
        throw new Error("Expected +5m announcement");
    }

    // Poll 2 (30s later): delay drops to 4 minutes
    simTime += 30000;
    fluctuatingTrain.expectedTime = '12:04';
    fluctuatingTrain._effectiveTimeMs = futureBase + 4 * 60 * 1000;
    irisAnnouncementService.checkChanges(journeys, simTime);
    console.log("History count after Poll 2 (delay drops to 4m):", announcementQueueService.history.length);
    if (announcementQueueService.history.length !== 1) {
        throw new Error("No new announcement should play when delay drops to 4 min");
    }

    // Poll 3 (30s later): delay jumps back to 5 minutes
    simTime += 30000;
    fluctuatingTrain.expectedTime = '12:05';
    fluctuatingTrain._effectiveTimeMs = futureBase + 5 * 60 * 1000;
    irisAnnouncementService.checkChanges(journeys, simTime);
    console.log("History count after Poll 3 (delay jumps back to 5m):", announcementQueueService.history.length);
    if (announcementQueueService.history.length !== 1) {
        throw new Error("FLICKER BUG: Announcement played again when jumping back to 5 min!");
    }

    // Poll 4 (30s later): delay jumps to 6 minutes -> rounds to 5 minutes
    simTime += 30000;
    fluctuatingTrain.expectedTime = '12:06';
    fluctuatingTrain._effectiveTimeMs = futureBase + 6 * 60 * 1000;
    irisAnnouncementService.checkChanges(journeys, simTime);
    console.log("History count after Poll 4 (delay = 6m, rounded 5m):", announcementQueueService.history.length);
    if (announcementQueueService.history.length !== 1) {
        throw new Error("FLICKER BUG: Announcement played for 6 min when 5 min was already announced!");
    }

    // Poll 5 (3 minutes later): delay jumps to 10 minutes
    simTime += 180000;
    announcementQueueService.currentAnnouncement = null; // simulate playback completed
    fluctuatingTrain.expectedTime = '12:10';
    fluctuatingTrain._effectiveTimeMs = futureBase + 10 * 60 * 1000;
    irisAnnouncementService.checkChanges(journeys, simTime);
    console.log("History count after Poll 5 (delay = 10m):", announcementQueueService.history.length);
    if (announcementQueueService.history.length !== 2) {
        throw new Error(`Expected 2 announcements in history after jump to 10 min, got ${announcementQueueService.history.length}`);
    }
    console.log("Poll 5 announcement label:", announcementQueueService.history[0].label);
    if (!announcementQueueService.history[0].label.includes('+10m')) {
        throw new Error("Expected +10m announcement");
    }
    console.log("[PASS] Delay fluctuations between 4 and 6 minutes are completely filtered out!");

    // 3. Test Arrival Fahrplanänderung Suppression
    console.log("\n--- TEST 3: Arrival trains never trigger phantom Fahrplanänderung ---");
    announcementQueueService.queue = [];
    
    // Arrival train without any deviations
    const arrivalTrain = new Journey({
        id: 'arr-1',
        journeyId: 'j-arr-1',
        name: 'RB 72 / 90682',
        destination: 'Herford',
        scheduledTime: '22:20',
        expectedTime: '22:20',
        ankunft: true,
        _effectiveTimeMs: new Date('2026-09-21T22:20:00').getTime(),
        stops: [
            new Stop({ name: 'Paderborn Hbf', routeIndex: 0 }),
            new Stop({ name: 'Altenbeken', routeIndex: 1 }),
            new Stop({ name: 'Herford', routeIndex: 2 })
        ]
    });

    irisAnnouncementService.initializeBaseline([arrivalTrain], simTime);
    
    // Multiple polls
    for (let p = 1; p <= 5; p++) {
        simTime += 30000;
        irisAnnouncementService.checkChanges([arrivalTrain], simTime);
    }
    console.log("Queue count after 5 polls of arrival train:", announcementQueueService.queue.length);
    if (announcementQueueService.queue.length !== 0) {
        throw new Error(`Expected 0 announcements for normal arrival train, got ${announcementQueueService.queue.length}`);
    }
    console.log("[PASS] Arrival train never triggers phantom Fahrplanänderung!");

    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
}

run().catch(err => {
    console.error("\n[FAIL] Test failed:", err);
    process.exit(1);
});
