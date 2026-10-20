// src/js/core/constants/theme.js

/**
 * Gemeinsame Farb- und Schriftwerte für Canvas-Rendering und HTML-Badges.
 * Hier liegen nur die generell nutzbaren Grundwerte - geometriespezifische
 * Maße (FORMATION, INFO, COUPLING) bleiben in den Display-Konstanten.
 */

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
