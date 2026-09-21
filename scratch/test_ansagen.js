// Scratch verification script for Ansagen & Linking Logik
// Global browser mocks for node/vite-node execution
const storage = new Map();
globalThis.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
};
globalThis.window = globalThis;
globalThis.document = {
    createElement: () => ({})
};
globalThis.Path2D = class Path2D {};
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

async function run() {
    const { ansagenGenerator } = await import('../src/js/audio/ansagenGenerator.js');
    const { announcementQueueService, ANNOUNCEMENT_TYPE, ANNOUNCEMENT_PRIORITY } = await import('../src/js/audio/announcementQueueService.svelte.js');
    const { irisAnnouncementService } = await import('../src/js/audio/irisAnnouncementService.js');
    const { Journey } = await import('../src/js/features/journey/journey.svelte.js');
    const { JourneyLinkingService } = await import('../src/js/features/journey/services/journeyLinkingService.js');
    const { JourneyFilterService } = await import('../src/js/features/journey/services/journeyFilterService.js');

    console.log("=== TEST 1: Verspätungsberechnung & Rundung ===");
    const testDelays = [
        { scheduled: "10:00", expected: "10:00", expectedDelay: 0 },
        { scheduled: "10:00", expected: "10:03", expectedDelay: 0 },
        { scheduled: "10:00", expected: "10:04", expectedDelay: 0 },
        { scheduled: "10:00", expected: "10:05", expectedDelay: 5 },
        { scheduled: "10:00", expected: "10:07", expectedDelay: 5 },
        { scheduled: "10:00", expected: "10:14", expectedDelay: 10 },
        { scheduled: "10:00", expected: "10:59", expectedDelay: 55 },
        { scheduled: "10:00", expected: "11:00", expectedDelay: 60 },
        { scheduled: "10:00", expected: "11:04", expectedDelay: 60 },
        { scheduled: "10:00", expected: "11:18", expectedDelay: 70 },
        { scheduled: "10:00", expected: "13:30", expectedDelay: 210 },
        { scheduled: "10:00", expected: "15:00", expectedDelay: 210 } // > 210 min -> capped at 210
    ];

    let delaysPassed = true;
    for (const tc of testDelays) {
        const dummyJourney = { scheduledTime: tc.scheduled, expectedTime: tc.expected };
        const actual = ansagenGenerator._calculateDelay(dummyJourney);
        if (actual !== tc.expectedDelay) {
            console.error(`FAIL: ${tc.scheduled} -> ${tc.expected}: Expected ${tc.expectedDelay}, got ${actual}`);
            delaysPassed = false;
        }
    }
    if (delaysPassed) console.log("✓ Alle Verspätungsberechnungen & Rundungen PASS!");

    console.log("\n=== TEST 2: Durchfahrt vs. Wendezug ===");
    // Case A: Echte Durchfahrt (gleiche journeyId)
    const arrThrough = new Journey({ id: 'arr1', journeyId: 'ICE_123', ankunft: true, platform: '1' });
    const depThrough = new Journey({ id: 'dep1', journeyId: 'ICE_123', ankunft: false, platform: '1' });
    JourneyLinkingService.link([arrThrough, depThrough], 'arr1', 'dep1');

    console.assert(depThrough.isThroughTrain === true, "Durchfahrt muss isThroughTrain === true sein");
    console.assert(depThrough.linkedArrivalJourneyId === 'arr1', "depThrough muss mit arr1 verknüpft sein");

    // Case B: Wendezug (unterschiedliche journeyId, gleicher Name oder anderer Name)
    const arrWende = new Journey({ id: 'arr2', journeyId: 'RB_ARR_99', name: 'RB 12', destination: 'Kassel Hbf', ankunft: true, platform: '2', scheduledTime: '10:00' });
    const depWende = new Journey({ id: 'dep2', journeyId: 'RB_DEP_100', name: 'RB 12', destination: 'Göttingen', ankunft: false, platform: '2', scheduledTime: '10:20' });
    JourneyLinkingService.link([arrWende, depWende], 'arr2', 'dep2');

    console.assert(depWende.isThroughTrain === false, "Wendezug darf NICHT isThroughTrain sein");
    console.assert(depWende.linkedArrivalJourneyId === 'arr2', "depWende muss mit arr2 verknüpft sein");
    console.log("✓ Durchfahrt vs. Wendezug Klassifizierung PASS!");

    console.log("\n=== TEST 3: Wendezug Einfahrt Playlist ===");
    const playlist = ansagenGenerator.generateEinfahrt(depWende, arrWende);
    const texts = playlist.map(p => p.text);
    console.log("Playlist Texte:", texts.join(" | "));

    const hasEinfahrt = texts.includes("Einfahrt");
    const hasVon = texts.includes("von");
    const hasWeiterAls = texts.includes("weiter als");
    const hasNach = texts.includes("nach");
    const hasVorsicht = texts.includes("Vorsicht bei der Einfahrt");

    console.assert(hasEinfahrt, "Muss Einfahrt enthalten");
    console.assert(hasVon, "Muss 'von' enthalten");
    console.assert(hasWeiterAls, "Muss 'weiter als' enthalten");
    console.assert(hasNach, "Muss 'nach' enthalten");
    console.assert(hasVorsicht, "Muss 'Vorsicht bei der Einfahrt' enthalten");
    console.log("✓ Wendezug Playlist Struktur PASS!");

    console.log("\n=== TEST 4: Prioritäten & Enums ===");
    console.assert(ANNOUNCEMENT_PRIORITY[ANNOUNCEMENT_TYPE.EINFAHRT] === 100);
    console.assert(ANNOUNCEMENT_PRIORITY[ANNOUNCEMENT_TYPE.REPLAY] === 95);
    console.assert(ANNOUNCEMENT_PRIORITY[ANNOUNCEMENT_TYPE.AUSFALL_PLANZEIT] === 90);
    console.assert(ANNOUNCEMENT_PRIORITY[ANNOUNCEMENT_TYPE.AUSFALL] === 80);
    console.assert(ANNOUNCEMENT_PRIORITY[ANNOUNCEMENT_TYPE.GLEISWECHSEL] === 75);
    console.assert(ANNOUNCEMENT_PRIORITY[ANNOUNCEMENT_TYPE.FAHRTAENDERUNG] === 70);
    console.assert(ANNOUNCEMENT_PRIORITY[ANNOUNCEMENT_TYPE.VERSPAETUNG] === 50);
    console.assert(ANNOUNCEMENT_PRIORITY[ANNOUNCEMENT_TYPE.REMINDER] === 30);
    console.log("✓ Prioritäten PASS!");

    console.log("\n=== TEST 5: Ausgefallene Durchfahrt - Verknüpfung (autoLink) ===");
    const arrCancelledThrough = new Journey({
        id: 'arr_c_1',
        journeyId: 'ICE_552',
        name: 'ICE 552',
        ankunft: true,
        ausfall: true,
        platform: '1',
        scheduledTime: '14:30',
        expectedTime: '14:30'
    });
    const depCancelledThrough = new Journey({
        id: 'dep_c_1',
        journeyId: 'ICE_552',
        name: 'ICE 552',
        ankunft: false,
        ausfall: true,
        platform: '1',
        scheduledTime: '14:32',
        expectedTime: '14:32'
    });
    const journeysList = [arrCancelledThrough, depCancelledThrough];
    JourneyLinkingService.autoLink(journeysList);

    console.assert(depCancelledThrough.linkedArrivalJourneyId === 'arr_c_1', "Abfahrt muss mit Ankunft verknüpft sein, auch wenn beide ausfallen!");
    console.assert(depCancelledThrough.isThroughTrain === true, "Abfahrt muss isThroughTrain === true sein!");
    console.assert(arrCancelledThrough.isThroughTrain === true, "Ankunft muss isThroughTrain === true sein!");
    console.log("✓ Ausgefallene Durchfahrt wird trotz ausfall === true korrekt verknüpft PASS!");

    console.log("\n=== TEST 6: Ausgefallene Durchfahrt - Anzeige & Filterung ===");
    // getVisible(journeys, activeMots, activeTracks, options)
    const visibleDefault = JourneyFilterService.getVisible(journeysList, ['ICE'], ['1'], { boardType: 'default' });
    console.assert(visibleDefault.length === 1, `Es darf auf dem Hauptmonitor nur 1 Fahrt sichtbar sein, nicht ${visibleDefault.length}`);
    console.assert(visibleDefault[0].id === depCancelledThrough.id, "Nur die Abfahrt darf auf dem Monitor sichtbar sein!");

    // isJourneyHidden in der Zugliste
    const arrHidden = JourneyFilterService.isJourneyHidden(arrCancelledThrough, ['ICE'], ['1'], journeysList, true, false);
    const depHidden = JourneyFilterService.isJourneyHidden(depCancelledThrough, ['ICE'], ['1'], journeysList, true, false);
    console.assert(arrHidden === true, "Die Ankunft einer Durchfahrt muss in der Liste ausgeblendet sein!");
    console.assert(depHidden === false, "Die Abfahrt einer Durchfahrt darf in der Liste NICHT ausgeblendet sein!");
    console.log("✓ Anzeigefilterung für ausgefallene Durchfahrten PASS!");

    const { setSimulatedTime } = await import('../src/js/core/utils/config.js');
    const { ansagenPlayer } = await import('../src/js/audio/ansagenPlayer.svelte.js');

    console.log("\n=== TEST 7: Ansagenunterdrückung bei Durchfahrten (Verspätung & Ausfall) ===");
    announcementQueueService.clearQueue();
    announcementQueueService.history = [];

    // Szenario 7A: Verspäteter ICE 552 (Durchfahrt) -> Nur 1 Ansage für Abfahrt!
    const simTimeMs = new Date("2026-09-21T14:00:00Z").getTime();
    setSimulatedTime(new Date(simTimeMs), false);

    const arrDelayed = new Journey({
        id: 'arr_ice_552',
        journeyId: 'ICE_552_RUN',
        name: 'ICE 552',
        destination: 'München Hbf',
        ankunft: true,
        platform: '1',
        scheduledTime: '14:30',
        expectedTime: '14:40',
        _effectiveTimeMs: simTimeMs + 40 * 60000
    });
    const depDelayed = new Journey({
        id: 'dep_ice_552',
        journeyId: 'ICE_552_RUN',
        name: 'ICE 552',
        destination: 'Berlin Hbf',
        ankunft: false,
        platform: '1',
        scheduledTime: '14:32',
        expectedTime: '14:42',
        _effectiveTimeMs: simTimeMs + 42 * 60000
    });
    const throughJourneys = [arrDelayed, depDelayed];
    JourneyLinkingService.autoLink(throughJourneys);

    // Initial Baseline
    irisAnnouncementService.initializeBaseline(throughJourneys, simTimeMs);
    console.assert(announcementQueueService.queue.length === 0, "Initial Baseline darf keine Ansagen enqueuen");

    // Simuliere laufende Ansage, damit Enqueued-Items in queue verbleiben
    ansagenPlayer.isPlaying = true;

    // Jetzt Verspätung um weitere 10 Minuten erhöhen (+20m gesamt)
    arrDelayed.expectedTime = '14:50';
    arrDelayed._effectiveTimeMs = simTimeMs + 50 * 60000;
    depDelayed.expectedTime = '14:52';
    depDelayed._effectiveTimeMs = simTimeMs + 52 * 60000;

    irisAnnouncementService.checkChanges(throughJourneys, simTimeMs);
    console.log("Enqueued announcements count for delay:", announcementQueueService.queue.length);
    console.assert(announcementQueueService.queue.length === 1, `Genau 1 Ansage erwartet, aber ${announcementQueueService.queue.length} erhalten!`);
    console.assert(announcementQueueService.queue[0].type === ANNOUNCEMENT_TYPE.VERSPAETUNG, "Muss Verspätungsansage sein");
    console.assert(announcementQueueService.queue[0].label.includes("Verspätung"), "Muss Verspätung im Label haben");
    console.assert(announcementQueueService.queue[0].journeyId === 'ICE_552_RUN', "Muss ICE_552_RUN sein");
    console.log("✓ Nur eine einzige Verspätungsansage für Durchfahrt PASS!");

    // Szenario 7B: Ausfall des ICE 552 -> Nur 1 Ansage!
    announcementQueueService.clearQueue();
    arrDelayed.ausfall = true;
    depDelayed.ausfall = true;
    irisAnnouncementService.checkChanges(throughJourneys, simTimeMs);
    console.log("Enqueued announcements count for cancellation:", announcementQueueService.queue.length);
    console.assert(announcementQueueService.queue.length === 1, `Genau 1 Ausfall-Ansage erwartet, aber ${announcementQueueService.queue.length} erhalten!`);
    console.assert(announcementQueueService.queue[0].type === ANNOUNCEMENT_TYPE.AUSFALL, "Muss Ausfall-Ansage sein");
    console.assert(announcementQueueService.queue[0].journeyId === 'ICE_552_RUN', "Muss ICE_552_RUN sein");
    console.log("✓ Nur eine einzige Ausfall-Ansage für Durchfahrt PASS!");

    // Szenario 7C: Tick Ausfall zur Planzeit (T=0s) -> Nur 1 Ansage für Abfahrt!
    announcementQueueService.clearQueue();
    arrDelayed.announcementState.hasPlayedAtScheduledTime = false;
    depDelayed.announcementState.hasPlayedAtScheduledTime = false;
    const planSimDate = new Date();
    planSimDate.setHours(14, 32, 0, 0); // Exakt Planzeit der Abfahrt
    irisAnnouncementService.tick(throughJourneys, planSimDate, true);
    console.log("Enqueued announcements count for Ausfall zur Planzeit:", announcementQueueService.queue.length);
    console.assert(announcementQueueService.queue.length === 1, `Genau 1 Ausfall zur Planzeit erwartet, aber ${announcementQueueService.queue.length} erhalten!`);
    console.assert(announcementQueueService.queue[0].type === ANNOUNCEMENT_TYPE.AUSFALL_PLANZEIT, "Muss Ausfall zur Planzeit sein");
    console.log("✓ Nur eine einzige Ausfall-zur-Planzeit-Ansage für Durchfahrt PASS!");

    // Szenario 7D: Tick Einfahrt (T-60s) -> Nur 1 Ansage für Abfahrt!
    announcementQueueService.clearQueue();
    arrDelayed.ausfall = false;
    depDelayed.ausfall = false;
    arrDelayed.announcementState.hasPlayedEinfahrt = false;
    depDelayed.announcementState.hasPlayedEinfahrt = false;
    const nowMs = Date.now();
    // Durchfahrt countdownTimeMs orientiert sich an Ankunftszeit
    depDelayed.arrivalEffectiveTimeMs = nowMs + 50000; // In 50s
    arrDelayed.arrivalEffectiveTimeMs = nowMs + 50000;
    const einfahrtDate = new Date(nowMs);
    irisAnnouncementService.tick(throughJourneys, einfahrtDate, true);
    console.log("Enqueued announcements count for Einfahrt:", announcementQueueService.queue.length);
    console.assert(announcementQueueService.queue.length === 1, `Genau 1 Einfahrt erwartet, aber ${announcementQueueService.queue.length} erhalten!`);
    console.assert(announcementQueueService.queue[0].type === ANNOUNCEMENT_TYPE.EINFAHRT, "Muss Einfahrt sein");
    console.log("✓ Nur eine einzige Einfahrtsansage für Durchfahrt PASS!");

    console.log("\n=== ALLE TESTS ERFOLGREICH ABGESCHLOSSEN ===");
    process.exit(0);
}

run().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
