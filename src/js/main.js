// js/main.js
import { mount } from 'svelte';
import App from '../App.svelte';
import { journeyStore, trainDisplay } from './core/state/stores.js';
import { StationService } from './features/station/stationService.js';
import { RisTextService } from './core/services/risTextService.js';
import { clearTextMetricsCache } from './displays/core/textUtils.js';

/**
 * Lädt alle genutzten Schnitte der Anzeigeschrift "Open Sans Condensed" und
 * wartet, bis sie verfügbar sind. Erst danach darf gezeichnet werden, damit
 * Canvas-Text nicht mit den Metriken eines Fallback-Fonts gemessen/gerendert
 * wird (das führte zu browserabhängigen, abweichenden Textpositionen).
 * @returns {Promise<void>}
 */
async function loadDisplayFonts() {
    if (typeof document === 'undefined' || !document.fonts) return;
    try {
        await Promise.all([
            document.fonts.load('600 100px "Open Sans Condensed"'),
            document.fonts.load('700 100px "Open Sans Condensed"'),
            document.fonts.load('italic 600 100px "Open Sans Condensed"'),
        ]);
        await document.fonts.ready;
    } catch (err) {
        console.warn('[ZIMSim] Font-Laden fehlgeschlagen, nutze Fallback:', err);
    }
    // Vor dem Font-Load gecachte Zeilenmessungen verwerfen (Fallback-Metriken).
    clearTextMetricsCache();
    // Bereits erzeugte Scroll-Overlays wurden ggf. mit Fallback-Breiten
    // aufgebaut (Wiederholungsanzahl/Dauer); neu erzeugen lassen.
    trainDisplay.scrollManager.clearAll();
}


/**
 * Erstellt die Beispiel-Daten (ein ICE-Flügelzug als Demo).
 */
function createDemoData() {
    const j1 = journeyStore.addJourney({
        name: 'ICE 543',
        destination: 'Düsseldorf Hbf',
        platform: '1',
        scheduledTime: '14:30',
        expectedTime: '14:32',
        vias: ['Hamm (Westf) Hbf', 'Dortmund Hbf', 'Bochum Hbf'],
        direction: 1,
        startMeter: 50,
        formation: {
            groups: [{
                name: 'ICE543',
                transport: {
                    category: 'ICE',
                    destination: { name: 'Düsseldorf Hbf' },
                    number: 543
                },
                coaches: [
                    { type: 'control_car', length: 25, coachClass: 1, wagonIdentificationNumber: 37, amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 1, wagonIdentificationNumber: 36, amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, wagonIdentificationNumber: 35, amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, wagonIdentificationNumber: 34, amenities: ['BOARD_RESTAURANT'], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, wagonIdentificationNumber: 33, amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, wagonIdentificationNumber: 32, amenities: [], open: true },
                    { type: 'control_car', length: 25, coachClass: 2, wagonIdentificationNumber: 31, amenities: ['BIKE_SPACE'], open: true }
                ]
            }]
        }
    });

    const j2 = journeyStore.addJourney({
        name: 'ICE 553',
        destination: 'Köln Hbf',
        platform: '1',
        scheduledTime: '14:30',
        expectedTime: '14:32',
        vias: ['Hamm (Westf) Hbf', 'Wuppertal Hbf', 'Solingen Hbf'],
        direction: 1,
        startMeter: 50,
        formation: {
            groups: [{
                name: 'ICE553',
                transport: {
                    category: 'ICE',
                    destination: { name: 'Köln Hbf' },
                    number: 553
                },
                coaches: [
                    { type: 'control_car', length: 25, coachClass: 1, wagonIdentificationNumber: 27, amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 1, wagonIdentificationNumber: 26, amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, wagonIdentificationNumber: 25, amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, wagonIdentificationNumber: 24, amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, wagonIdentificationNumber: 23, amenities: ['BOARD_RESTAURANT'], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, wagonIdentificationNumber: 22, amenities: [], open: true },
                    { type: 'control_car', length: 25, coachClass: 2, wagonIdentificationNumber: 21, amenities: ['BIKE_SPACE'], open: true }
                ]
            }]
        }
    });

    // Koppeln (Flügelzug)
    journeyStore.coupleJourneys(j1.id, j2.id);

    // Dritter Zug: ICE L 2310 nach Westerland(Sylt) - Langes Gleis, kurzer Zug -> Gut für Zoom
    journeyStore.addJourney({
        name: 'ICE 2310',
        destination: 'Westerland(Sylt)',
        platform: '2',
        scheduledTime: '15:15',
        expectedTime: '15:15',
        vias: ['Hamburg Hbf', 'Husum', 'Niebüll'],
        direction: 1,
        startMeter: 19.975,
        skalieren: true, // Auto-Zoom per Default an
        formation: {
            groups: [{
                name: 'ICE1808',
                transport: {
                    category: 'ICE',
                    destination: { name: 'Westerland(Sylt)' },
                    number: 2310
                },
                coaches: [
                    { type: 'locomotive', length: 19.975, coachClass: null, wagonIdentificationNumber: null, amenities: [], open: true },
                    { type: 'middle_car', length: 18.317, coachClass: 2, wagonIdentificationNumber: 1, amenities: ['BIKE_SPACE'], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, wagonIdentificationNumber: 2, amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, wagonIdentificationNumber: 3, amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, wagonIdentificationNumber: 4, amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, wagonIdentificationNumber: 5, amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, wagonIdentificationNumber: 6, amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, wagonIdentificationNumber: 7, amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, wagonIdentificationNumber: 8, amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, wagonIdentificationNumber: 9, amenities: ['WHEELCHAIR_SPACE'], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, wagonIdentificationNumber: 10, amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, wagonIdentificationNumber: 11, amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, wagonIdentificationNumber: 12, amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, wagonIdentificationNumber: 13, amenities: ['WHEELCHAIR_SPACE'], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: null, wagonIdentificationNumber: 14, amenities: ['BOARD_RESTAURANT'], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 1, wagonIdentificationNumber: 15, amenities: ['WHEELCHAIR_SPACE'], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 1, wagonIdentificationNumber: 16, amenities: [], open: true },
                    { type: 'control_car', length: 18.33, coachClass: 1, wagonIdentificationNumber: 17, amenities: [], open: true }
                ]
            }]
        }
    });

    // Weitere Fahrten für realistische Multi-Screen- & Anschlusstafeln (füllt beide Spalten)
    journeyStore.addJourney({
        name: 'RE 1',
        destination: 'Aachen Hbf',
        platform: '3',
        scheduledTime: '14:35',
        expectedTime: '14:35',
        vias: ['Bochum Hbf', 'Essen Hbf', 'Duisburg Hbf', 'Düsseldorf Hbf', 'Köln Hbf'],
        direction: 1
    });

    journeyStore.addJourney({
        name: 'S 1',
        destination: 'Solingen Hbf',
        platform: '7',
        scheduledTime: '14:42',
        expectedTime: '14:47',
        vias: ['Bochum Hbf', 'Essen Hbf', 'Mülheim(Ruhr)Hbf', 'Duisburg Hbf'],
        direction: 1
    });

    journeyStore.addJourney({
        name: 'RE 6',
        destination: 'Minden(Westf)',
        platform: '4',
        scheduledTime: '14:45',
        expectedTime: '14:45',
        vias: ['Kamen', 'Hamm(Westf)Hbf', 'Bielefeld Hbf', 'Herford'],
        direction: 1
    });

    journeyStore.addJourney({
        name: 'ICE 102',
        destination: 'Hamburg-Altona',
        platform: '2',
        scheduledTime: '14:50',
        expectedTime: '14:50',
        vias: ['Münster(Westf)Hbf', 'Osnabrück Hbf', 'Bremen Hbf', 'Hamburg Hbf'],
        direction: 1
    });

    journeyStore.addJourney({
        name: 'RB 53',
        destination: 'Iserlohn',
        platform: '5',
        scheduledTime: '14:55',
        expectedTime: '14:55',
        vias: ['Schwerte(Ruhr)', 'Iserlohnerheide'],
        direction: 1
    });

    journeyStore.addJourney({
        name: 'RE 11',
        destination: 'Kassel-Wilhelmshöhe',
        platform: '4',
        scheduledTime: '15:02',
        expectedTime: '15:05',
        vias: ['Soest', 'Lippstadt', 'Paderborn Hbf', 'Altenbeken'],
        direction: 1
    });

    // Abschnitte aller Demo-Fahrten dynamisch berechnen
    journeyStore.updateAllJourneySectors();
}

// Warten, bis das DOM vollständig geladen ist
document.addEventListener('DOMContentLoaded', async () => {
    // Zuerst die Anzeigeschrift laden: Datenaufbau und erster Render dürfen
    // nicht mit den Metriken des Fallback-Fonts messen (Vias, Zeilenumbrüche,
    // Scroll-Overlays würden sonst mit falschen Breiten persistieren).
    await loadDisplayFonts();

    createDemoData();
    StationService.loadStations(); // Asynchrones Laden im Hintergrund starten
    RisTextService.load(); // Lade RIS-Texte

    mount(App, {
        target: document.getElementById('app')
    });

    trainDisplay.updateAll();
});
