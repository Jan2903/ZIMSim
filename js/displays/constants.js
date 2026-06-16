// js/displays/constants.js
// Zentralisierte Konstanten für alle Display-Module

/** Wiederkehrende Farbwerte */
export const COLORS = {
    WHITE: 'white',
    NAVY: 'navy',
    MIDNIGHT_BLUE: 'midnightblue',
    ORANGE: 'orange',
    DARK_RED: 'DarkRed',
    DIM_GREY: 'DimGrey',
    LIME: 'lime',
    RED: 'red',
    GREEN: 'green',
    YELLOW: 'yellow',
    BLUE: 'blue',
    CYAN: 'cyan',
    MAGENTA: 'magenta',
};

/** Schrift-Hilfsfunktionen für "Open Sans Condensed" */
export const FONTS = {
    FAMILY: '"Open Sans Condensed"',
    regular: (size) => `${size}px "Open Sans Condensed"`,
    bold: (size) => `bold ${size}px "Open Sans Condensed"`,
    italic: (size) => `italic ${size}px "Open Sans Condensed"`,
};

/** Maße für die Wagenreihung */
export const FORMATION = {
    COACH_Y_OFFSET: 70,         // Vertikale Position der Wagen
    COACH_HEIGHT: 80,           // Höhe der Wagen-Box
    PLATFORM_LINE_Y: 150,       // Y-Position der Bahnsteig-Linie
    THRESHOLD: 50,              // Linker Rand
    ARROW_BUFFER: 50,           // Fixer Puffer pro Seite für Richtungspfeil
    COACH_GAP_FULL: 8,          // Abstand zwischen Wagen (Vollbild)
    COACH_GAP_COMPACT: 0,       // Abstand zwischen Wagen (Kompakt)
    GROUP_GAP: 28,              // Abstand zwischen Zugteilen
    USABLE_WIDTH_FULL: 1820,    // Nutzbare Pixelbreite Hauptmonitor
    USABLE_WIDTH_COMPACT: 860,  // Nutzbare Pixelbreite Nebenmonitor
    FIRST_CLASS_BAR_HEIGHT: 20, // Höhe des 1.-Klasse-Balkens
};

/** Maße für den Info-Bereich */
export const INFO = {
    HEADER_HEIGHT: 100,         // Höhe des Info-Headers
    SIDE_SCREEN_WIDTH: 960,     // Breite der Nebenmonitore
    PICTOGRAM_SIZE: 100,        // Piktogramm-Boxgröße
    PICTOGRAM_STEP: 105,        // Abstand zwischen Piktogrammen
};

/** Kupplung zwischen Zugteilen */
export const COUPLING = {
    DOT_RADIUS: 6,
    NUM_DOTS: 6,
    START_Y_OFFSET: -6,         // Relativ zu COACH_Y_OFFSET
    END_Y_OFFSET: 86,           // Relativ zu COACH_Y_OFFSET
};
