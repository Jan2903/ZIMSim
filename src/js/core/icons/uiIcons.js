// js/core/icons/uiIcons.js

/**
 * @typedef {Object} IconElement
 * @property {string} d - SVG Pfad-Daten
 * @property {string} [fill='currentColor'] - Füllfarbe
 * @property {string} [fillRule='nonzero'] - Füllregel ('nonzero' | 'evenodd')
 */

/**
 * @typedef {Object} IconDefinition
 * @property {number} viewBox - Native Dimension (z.B. 24)
 * @property {IconElement[]} elements - Liste der Pfadelemente
 */

/**
 * Hilfsfunktion zum Erzeugen einer UI-Icon-Definition.
 * @param {number} viewBox - Die native ViewBox (Breite und Höhe)
 * @param {IconElement[]} elements - Array von Pfad-Definitionen
 * @returns {IconDefinition}
 */
function createUiIcon(viewBox, elements) {
    return {
        viewBox,
        elements: elements.map(el => ({
            d: el.d,
            fill: el.fill || 'currentColor',
            fillRule: el.fillRule || 'nonzero'
        }))
    };
}

/**
 * Sammlung aller neutralen UI-Vektor-Icons (Standard 24x24 Koordinatensystem).
 * Alle Icons nutzen `currentColor` und passen sich nahtlos der Textfarbe an.
 */
export const UI_ICONS = {
    // Schließen / Entfernen / Abbrechen
    close: createUiIcon(24, [
        { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" }
    ]),

    // Häkchen / Bestätigt
    check: createUiIcon(24, [
        { d: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" }
    ]),

    // Auge / Sichtbar
    eye: createUiIcon(24, [
        { d: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" }
    ]),

    // Durchgestrichenes Auge / Ausgeblendet / Versteckt
    eye_off: createUiIcon(24, [
        { d: "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.17c0-1.66-1.34-3-3-3l-.17.02z" }
    ]),

    // Lautsprecher hohe Lautstärke / Ansage
    volume_high: createUiIcon(24, [
        { d: "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" }
    ]),

    // Lautsprecher leise / geringe Lautstärke
    volume_low: createUiIcon(24, [
        { d: "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" }
    ]),

    // Lautsprecher stumm / inaktiv
    volume_mute: createUiIcon(24, [
        { d: "M7 9v6h4l5 5V4L11 9H7z" }
    ]),

    // Importieren
    import: createUiIcon(24, [
        { d: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" }
    ]),

    // Exportieren
    export: createUiIcon(24, [
        { d: "M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" }
    ]),

    // Komplett drehen / Umkehren
    rotate: createUiIcon(24, [
        { d: "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" }
    ]),

    // Löschen / Mülleimer
    trash: createUiIcon(24, [
        { d: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" }
    ]),

    // Zug frontal / Triebzug
    train: createUiIcon(24, [
        { d: "M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zm0 2c3.5 0 6 .4 6 2H6c0-1.6 2.5-2 6-2zm6 11.5c0 .83-.67 1.5-1.5 1.5h-9c-.83 0-1.5-.67-1.5-1.5V13h12v2.5zm0-4.5H6V8h12v3zm-8.5 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" }
    ]),

    // Schnellzug / ICE
    train_fast: createUiIcon(24, [
        { d: "M12 2c-4 0-8 .5-8 4v10c0 1.66 1.34 3 3 3l-1.5 1.5v.5h13v-.5L17 19c1.66 0 3-1.34 3-3V6c0-3.5-4-4-8-4zm6 14H6v-4h12v4zm0-6H6V6h12v4z" }
    ]),

    // Verknüpfen / Koppeln
    link: createUiIcon(24, [
        { d: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" }
    ]),

    // Entkoppeln / Trennen
    unlink: createUiIcon(24, [
        { d: "M17 7h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1 0 1.43-.98 2.63-2.31 2.98l1.46 1.46C20.88 15.61 22 13.95 22 12c0-2.76-2.24-5-5-5zm-1 4h-2.19l2 2H16v-2zM2 4.27l3.11 3.11C3.8 8.08 3 9.94 3 12c0 2.76 2.24 5 5 5h4v-1.9H8c-1.71 0-3.1-1.39-3.1-3.1 0-1.59 1.21-2.9 2.76-3.07L10.19 11H8v2h4.19l6.54 6.54L20 18.27 3.27 3 2 4.27z" }
    ]),

    // Auto-Vias / Blitz
    bolt: createUiIcon(24, [
        { d: "M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.9 17.55 11 21 11 21z" }
    ]),

    // Wiedergabe
    play: createUiIcon(24, [
        { d: "M8 5v14l11-7z" }
    ]),

    // Stopp
    stop: createUiIcon(24, [
        { d: "M6 6h12v12H6z" }
    ]),

    // Neustart / Replay
    restart: createUiIcon(24, [
        { d: "M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" }
    ]),

    // Speichern / WAV Export
    save: createUiIcon(24, [
        { d: "M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" }
    ]),

    // Warnung
    warning: createUiIcon(24, [
        { d: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" }
    ]),

    // Ausfall / Gesperrt
    cancelled: createUiIcon(24, [
        { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z" }
    ]),

    // Drag-Handle (6 Grip-Punkte)
    drag_handle: createUiIcon(24, [
        { d: "M9 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10-14a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" }
    ]),

    // Chevrons (Akkordeon & Dropdown)
    chevron_right: createUiIcon(24, [
        { d: "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" }
    ]),
    chevron_left: createUiIcon(24, [
        { d: "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" }
    ]),
    chevron_down: createUiIcon(24, [
        { d: "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" }
    ]),
    chevron_up: createUiIcon(24, [
        { d: "M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" }
    ]),

    // Verschiebe-Pfeile
    arrow_up: createUiIcon(24, [
        { d: "M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" }
    ]),
    arrow_down: createUiIcon(24, [
        { d: "M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" }
    ]),
    arrow_left: createUiIcon(24, [
        { d: "M20 11H7.83l5.59-5.58L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" }
    ]),
    arrow_right: createUiIcon(24, [
        { d: "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" }
    ]),

    // Kamera / Screenshot
    camera: createUiIcon(24, [
        { d: "M9.4 4l-1.8 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-3.6l-1.8-2H9.4zM12 19c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" }
    ]),

    // Display-Zoom-Toggles (Fit vs. Scroll)
    zoom_fit: createUiIcon(24, [
        { d: "M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z" }
    ]),
    zoom_scroll: createUiIcon(24, [
        { d: "M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z" }
    ]),

    // Plus für Hinzufügen
    plus: createUiIcon(24, [
        { d: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" }
    ])
};
