// js/displays/constants.js
// Zentralisierte Konstanten für alle Display-Module

/** Wiederkehrende Farbwerte */
export const COLORS = {
    WHITE: 'white',
    NAVY: 'navy',
    MIDNIGHT_BLUE: 'midnightblue',
    MIDNIGHT_BLUE_ALT: '#141460',
    MIDNIGHT_BLUE_HEADER: '#121258',
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

/**
 * Schrift-Hilfsfunktionen für "Open Sans Condensed".
 * Es wird bewusst ein konkreter Schnitt (600 statt 400, 700 statt "bold")
 * angegeben, damit jeder Browser denselben echten Font-Face wählt und nicht
 * selbst Fett/Kursiv synthetisiert (das verursachte abweichende Textpositionen).
 * Der generische Fallback `sans-serif` hält die Metriken stabil, falls die
 * Webfont-Datei noch nicht geladen ist.
 */
export const FONTS = {
    FAMILY: '"Open Sans Condensed", sans-serif',
    regular: (size) => `600 ${size}px ${FONTS.FAMILY}`,
    bold: (size) => `700 ${size}px ${FONTS.FAMILY}`,
    italic: (size) => `italic 600 ${size}px ${FONTS.FAMILY}`,
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
