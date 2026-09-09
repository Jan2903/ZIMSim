// js/utils/utils.js
import { config } from './config.js';
import { journeyStore, trainDisplay } from '../state/stores.js';

export const images = {};
export const pictogramFiles = {
    'wagen_fehlen': 'png',
    'wagenreihung_fahrrad': 'svg',
    'wagenreihung_gastronomie': 'png',
    'wagenreihung_bistro': 'png',
    'wagenreihung_mehrzweck': 'png',
    'wagenreihung_rollstuhl': 'png',
    'wagenreihung_schlafwagen': 'svg',
    'wagenreihung_liegewagen': 'svg'
};

export function preloadImages() {
    const promises = Object.entries(pictogramFiles).map(([name, ext]) => {
        return new Promise((resolve) => {
            images[name] = new Image();
            
            images[name].onload = () => {
                images[name].isLoaded = true;
                resolve();
            };
            
            images[name].onerror = () => {
                console.warn(`Failed to load image: images/icons/${name}.${ext}`);
                images[name].isBroken = true;
                resolve();
            };

            images[name].src = `images/icons/${name}.${ext}`;
        });
    });
    return Promise.all(promises);
}

/**
 * Startet die Rotation für den rotierenden Monitor (Slot 3).
 * Rotiert durch alle sichtbaren Journeys, die nicht auf Slot 1 oder 2 fest zugewiesen sind.
 */
export function startRotation() {
    if (config.zug_rotation_timer) clearTimeout(config.zug_rotation_timer);
    updateRotatingDisplay();
    config.zug_rotation_timer = setTimeout(startRotation, 3000);
}

export function updateRotatingDisplay() {
    const rotating = journeyStore.getRotatingJourneys();

    if (rotating.length === 0) {
        config.current_rotating_index = 0;
        trainDisplay.updateAll();
        return;
    }

    // Zum nächsten rotierenden Journey wechseln
    config.current_rotating_index = (config.current_rotating_index + 1) % rotating.length;
    trainDisplay.updateAll();
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @returns {Function} Returns the new debounced function.
 */
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}
