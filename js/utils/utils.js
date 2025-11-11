// js/utils/utils.js
import { config } from './config.js';
import { trainData, trainDisplay } from '../main.js';

export const images = {};
export const pictogramNames = ['wagen_fehlen', 'wagenreihung_fahrrad', 'wagenreihung_gastronomie', 'wagenreihung_mehrzweck', 'wagenreihung_rollstuhl'];

// Preload images
pictogramNames.forEach(name => {
    images[name] = new Image();
    images[name].src = `images/icons/${name}.png`;
    images[name].onerror = () => {
        console.warn(`Failed to load image: icons/formation/${name}.png`);
        images[name].isBroken = true;
    };
    images[name].onload = () => {
        images[name].isLoaded = true;
    };
});

export function startRotation() {
    if (config.zug_rotation_timer) clearTimeout(config.zug_rotation_timer);  // Alten Timer löschen
    updateRotatingDisplay();
    config.zug_rotation_timer = setTimeout(startRotation, 6000);  // Neuen Timer setzen
}

export function updateRotatingDisplay() {
    const available_zugs = [];
    for (let i = 3; i <= 6; i++) {
        const zd = trainData.zugDaten[i];
        if (zd.Zugnummer || zd.Abfahrt || zd.Informationen) {
            available_zugs.push(i);
        }
    }
    if (available_zugs.length === 0) {
        config.current_rotating_zug = 3;
        return;
    }
    let index = available_zugs.indexOf(config.current_rotating_zug);
    if (index === -1) index = -1;
    index = (index + 1) % available_zugs.length;
    config.current_rotating_zug = available_zugs[index];
    trainDisplay.update(config.current_rotating_zug, 'display2_zug2', 'display2_zug2_wagenreihung', false);
}