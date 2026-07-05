// js/main.js
import { JourneyStore } from './models/journeyStore.js';
import { Journey } from './models/journey.js';
import { Formation } from './models/formation.js';
import { TrainDisplay } from './displays/trainDisplay.js';
import { initEvents } from './events.js';
import { preloadImages } from './utils/utils.js';
import { StationService } from './utils/stationService.js';
import { RisTextService } from './utils/risTextService.js';

export const journeyStore = new JourneyStore();
export const trainDisplay = new TrainDisplay(journeyStore);


/**
 * Erstellt die Beispiel-Daten (ein ICE-Flügelzug als Demo).
 */
function createDemoData() {
    const j1 = journeyStore.addJourney({
        category: 'ICE',
        number: '543',
        destination: 'Düsseldorf Hbf',
        scheduledTime: '14:30',
        expectedTime: '14:32',
        vias: ['Hamm (Westf) Hbf', 'Dortmund Hbf', 'Bochum Hbf'],
        direction: 1,
        startMeter: 50,
        scrollText: 'Zugteilung in Hamm (Westf) Hbf',
        formation: {
            groups: [{
                name: 'ICE543',
                transport: {
                    category: 'ICE',
                    destination: { name: 'Düsseldorf Hbf' },
                    number: 543
                },
                coaches: [
                    { type: 'control_car', length: 25, coachClass: 1, coachNumber: '37', amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 1, coachNumber: '36', amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '35', amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '34', amenities: ['g'], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '33', amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '32', amenities: [], open: true },
                    { type: 'control_car', length: 25, coachClass: 2, coachNumber: '31', amenities: ['f'], open: true }
                ]
            }]
        }
    });

    const j2 = journeyStore.addJourney({
        category: 'ICE',
        number: '553',
        destination: 'Köln Hbf',
        scheduledTime: '14:30',
        expectedTime: '14:32',
        vias: ['Hamm (Westf) Hbf', 'Wuppertal Hbf', 'Solingen Hbf'],
        direction: 1,
        startMeter: 50,
        scrollText: 'Zugteilung in Hamm (Westf) Hbf',
        formation: {
            groups: [{
                name: 'ICE553',
                transport: {
                    category: 'ICE',
                    destination: { name: 'Köln Hbf' },
                    number: 553
                },
                coaches: [
                    { type: 'control_car', length: 25, coachClass: 1, coachNumber: '27', amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 1, coachNumber: '26', amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '25', amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '24', amenities: [], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '23', amenities: ['g'], open: true },
                    { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '22', amenities: [], open: true },
                    { type: 'control_car', length: 25, coachClass: 2, coachNumber: '21', amenities: ['f'], open: true }
                ]
            }]
        }
    });

    // Koppeln (Flügelzug)
    journeyStore.coupleJourneys(j1.id, j2.id);

    // Dritter Zug: ICE L 2310 nach Westerland(Sylt) - Langes Gleis, kurzer Zug -> Gut für Zoom
    journeyStore.addJourney({
        category: 'ICE',
        number: '2310',
        destination: 'Westerland(Sylt)',
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
                    { type: 'locomotive', length: 19.975, coachClass: null, coachNumber: '', amenities: [], open: true },
                    { type: 'middle_car', length: 18.317, coachClass: 2, coachNumber: '1', amenities: ['f'], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, coachNumber: '2', amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, coachNumber: '3', amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, coachNumber: '4', amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, coachNumber: '5', amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, coachNumber: '6', amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, coachNumber: '7', amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, coachNumber: '8', amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, coachNumber: '9', amenities: ['r'], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, coachNumber: '10', amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, coachNumber: '11', amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, coachNumber: '12', amenities: [], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 2, coachNumber: '13', amenities: ['r'], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: null, coachNumber: '14', amenities: ['g'], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 1, coachNumber: '15', amenities: ['r'], open: true },
                    { type: 'middle_car', length: 13.3, coachClass: 1, coachNumber: '16', amenities: [], open: true },
                    { type: 'control_car', length: 18.33, coachClass: 1, coachNumber: '17', amenities: [], open: true }
                ]
            }]
        }
    });
}

// Warten, bis das DOM vollständig geladen ist
document.addEventListener('DOMContentLoaded', () => {
    createDemoData();
    StationService.loadStations(); // Asynchrones Laden im Hintergrund starten
    RisTextService.load(); // Lade RIS-Texte
    initEvents();
    preloadImages().then(() => {
        document.fonts.ready.then(() => {
            trainDisplay.updateAll();
        });
    });
});