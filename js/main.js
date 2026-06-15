// js/main.js
import { JourneyStore } from './models/journeyStore.js';
import { Journey } from './models/journey.js';
import { Formation } from './models/formation.js';
import { TrainDisplay } from './displays/trainDisplay.js';
import { initEvents } from './events.js';
import { preloadImages } from './utils/utils.js';

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
                    { type: 'middle_car',  length: 25, coachClass: 2, coachNumber: '36', amenities: [], open: true },
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
}

// Warten, bis das DOM vollständig geladen ist
document.addEventListener('DOMContentLoaded', () => {
    createDemoData();
    initEvents();
    preloadImages().then(() => {
        document.fonts.ready.then(() => {
            trainDisplay.updateAll();
        });
    });
});