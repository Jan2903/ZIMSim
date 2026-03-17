// js/utils/utils.js
import { config } from './config.js';
import { trainData, trainDisplay } from '../main.js';

export const images = {};
export const pictogramNames = ['wagen_fehlen', 'wagenreihung_fahrrad', 'wagenreihung_gastronomie', 'wagenreihung_mehrzweck', 'wagenreihung_rollstuhl'];

export function preloadImages() {
    const promises = pictogramNames.map(name => {
        return new Promise((resolve) => {
            images[name] = new Image();
            images[name].src = `images/icons/${name}.png`;
            images[name].onload = () => {
                images[name].isLoaded = true;
                resolve();
            };
            images[name].onerror = () => {
                console.warn(`Failed to load image: images/icons/${name}.png`);
                images[name].isBroken = true;
                resolve(); // Resolve even on error so Promise.all doesn't reject
            };
        });
    });
    return Promise.all(promises);
}

export function startRotation() {
    if (config.zug_rotation_timer) clearTimeout(config.zug_rotation_timer);  // Alten Timer löschen
    updateRotatingDisplay();
    config.zug_rotation_timer = setTimeout(startRotation, 3000);  // Neuen Timer setzen
}

export function updateRotatingDisplay() {
    const available_zugs = []; // Speichert 1-basierte Zug-IDs (3-6)
    for (let i = 3; i <= 6; i++) {
        const departure = trainData.departures[i - 1];
        // Prüfen, ob die Abfahrt relevante Daten für eine Anzeige hat
        if (departure && (departure.groups[0]?.trainNumber || departure.groups[0]?.scheduledTime || departure.scrollText)) {
            available_zugs.push(i);
        }
    }

    if (available_zugs.length === 0) {
        config.current_rotating_zug = 3; // Auf Standard zurücksetzen
        // Slot leeren, indem mit einem leeren/nicht existierenden Index aktualisiert wird
        trainDisplay.update(2, 'display2_zug2', 'display2_zug2_wagenreihung', false);
        return;
    }

    let currentIndex = available_zugs.indexOf(config.current_rotating_zug);
    // Falls der aktuelle Zug nicht mehr in der Liste ist (z.B. gelöscht), von vorne anfangen
    if (currentIndex === -1) currentIndex = -1;

    const nextIndex = (currentIndex + 1) % available_zugs.length;
    config.current_rotating_zug = available_zugs[nextIndex];

    // Die Anzeige mit dem 0-basierten Index aktualisieren
    trainDisplay.update(config.current_rotating_zug - 1, 'display2_zug2', 'display2_zug2_wagenreihung', false);
}