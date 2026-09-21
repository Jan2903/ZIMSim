// js/displays/core/contentModes.js

/**
 * Definition der Inhalts-Modi für ZIMSim Displays.
 * Bestimmt, wie die verfügbaren Monitor-Slots fachlich belegt werden.
 */
export const CONTENT_MODES = {
    // 1. Standard Bahnsteiganzeige (Default DB Bahnsteig)
    standard_platform: {
        id: 'standard_platform',
        name: 'Standard Bahnsteig (Zug 1 + Zug 2/3 Rotation)',
        description: 'Hauptmonitor zeigt nächsten Zug mit Wagenreihung; rechter Monitor zeigt Folgezüge und Störungs-/Infoscreen-Rotation.',
        isDefault: true,
        supportedSlots: [1, 2, 3]
    },

    // 2. Voranzeiger links + Wagenstand rechts (Kombi auf 2 Monitoren)
    voranzeiger_and_formation: {
        id: 'voranzeiger_and_formation',
        name: 'Voranzeiger Links + Wagenstand Rechts',
        description: 'Linker Monitor zeigt dynamischen Voranzeiger mit Störung unten; Rechter Monitor zeigt Vollbild-Wagenstandsanzeiger von Zug 1.',
        supportedSlots: [2]
    },

    // 3. Reiner Voranzeiger / Abfahrtstafel Solo
    voranzeiger_solo: {
        id: 'voranzeiger_solo',
        name: 'Voranzeiger / Abfahrtstafel Solo',
        description: 'Reine dynamische Abfahrtsliste mit Live-Uhrzeit, flexibler Zeilenanzahl und Störung ganz unten.',
        supportedSlots: [1, 2]
    },

    // 4. Reiner Wagenstandsanzeiger Solo (z.B. Vitrine 32)
    formation_solo: {
        id: 'formation_solo',
        name: 'Wagenstandsanzeiger Solo',
        description: 'Reine Vollbild-Wagenreihung (ideal für Vitrine 32 oder Einzelmonitore).',
        supportedSlots: [1]
    },

    // 5. Aushangstele 9:16 Portrait (für ZIMvitrine 65h)
    stele_departure: {
        id: 'stele_departure',
        name: 'Stele 9:16 Portrait (Aushang mit 8–10 Fahrten)',
        description: 'Vertikale Abfahrtstafel für 9:16 Stelen mit Kopfzeile, 8-10 Fahrten und Störungszone unten.',
        supportedSlots: [1]
    }
};

/**
 * Holt den Inhalts-Modus anhand seiner ID oder eines Fallbacks.
 * @param {string} id
 * @returns {object} Der Inhalts-Modus
 */
export function getContentMode(id) {
    if (id && CONTENT_MODES[id]) return CONTENT_MODES[id];
    if (id === 'voranzeiger') return CONTENT_MODES.voranzeiger_solo;
    if (id === 'zimvitrine32wagenstand') return CONTENT_MODES.formation_solo;
    return CONTENT_MODES.standard_platform;
}
