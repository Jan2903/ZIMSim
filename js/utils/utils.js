// js/utils/utils.js
import { config } from './config.js'; // Für config.rotate_3_6 usw.
import { train_data, train_display } from '../main.js'; // Für Zugriff auf Instanzen (alternativ: als Parameter übergeben, aber hier importiert für Einfachheit)

export const images = {};
export const pictogramNames = ['wagen_fehlen', 'wagenreihung_fahrrad', 'wagenreihung_gastronomie', 'wagenreihung_mehrzweck', 'wagenreihung_rollstuhl'];

// Preloading-Code hier (images[name] = new Image(); ...)
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

export function start_rotation() {
    if (config.config.rotation_timer) clearTimeout(config.config.rotation_timer);
    update_rotating_display();
    config.config.rotation_timer = setTimeout(start_rotation, 4000);
}

export function update_rotating_display() {
    const available_zugs = [];
    for (let i = 3; i <= 6; i++) {
        const zd = train_data.zug_daten[i];
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
    train_display.update_train_display(config.current_rotating_zug, 'display2_zug2', 'display2_zug2_wagenreihung', false);
}