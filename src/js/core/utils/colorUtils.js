// src/js/core/utils/colorUtils.js

/**
 * Farb-Hilfsfunktionen für Kontrastprüfungen nach WCAG 2.2.
 * Bewusst DOM-frei (kein Canvas, kein getComputedStyle), damit die Utilities
 * auch in Canvas-Renderern und Node-Skripten verwendet werden können.
 */

/** Farbnamen, die im Projekt (theme.js / Line-Badge-Defaults) vorkommen. */
const NAMED_COLORS = Object.freeze({
    white: '#ffffff',
    black: '#000000',
    navy: '#000080',
    midnightblue: '#191970',
    orange: '#ffa500',
    darkred: '#8b0000',
    dimgrey: '#696969',
    lime: '#00ff00',
    red: '#ff0000',
    green: '#008000',
    yellow: '#ffff00',
    blue: '#0000ff',
    cyan: '#00ffff',
    magenta: '#ff00ff'
});

/**
 * Parst eine Farbangabe (Hex 3/6 Stellen oder einer der genutzten Farbnamen).
 *
 * @param {string} color - Farbwert, z. B. `#1e3a8a`, `#fff`, `navy`
 * @returns {{ r: number, g: number, b: number } | null} RGB-Komponenten (0–255) oder null
 */
export function parseColor(color) {
    if (typeof color !== 'string') return null;
    const value = color.trim().toLowerCase();
    if (!value || value === 'transparent') return null;

    let hex = NAMED_COLORS[value] || value;
    if (/^#[0-9a-f]{3}$/i.test(hex)) {
        hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;

    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16)
    };
}

/**
 * Berechnet die relative Leuchtdichte einer Farbe nach WCAG 2.2.
 *
 * @param {string} color - Farbwert
 * @returns {number | null} Leuchtdichte (0–1) oder null bei unbekannter Farbe
 */
export function relativeLuminance(color) {
    const rgb = parseColor(color);
    if (!rgb) return null;

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(channel => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Berechnet das Kontrastverhältnis zweier Farben nach WCAG 2.2.
 *
 * @param {string} foreground - Vordergrundfarbe
 * @param {string} background - Hintergrundfarbe
 * @returns {number | null} Kontrast (1–21) oder null bei unbekannter Farbe
 */
export function contrastRatio(foreground, background) {
    const l1 = relativeLuminance(foreground);
    const l2 = relativeLuminance(background);
    if (l1 === null || l2 === null) return null;

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Prüft, ob ein Kontrastverhältnis die WCAG-AA-Anforderung erfüllt.
 *
 * @param {number | null} ratio - Kontrastverhältnis
 * @param {boolean} [isLargeText=false] - Große Schrift (≥ 18,66 px fett bzw. 24 px) → 3:1
 * @returns {boolean} true, wenn die Anforderung erfüllt ist
 */
export function meetsWcagAA(ratio, isLargeText = false) {
    if (ratio === null || Number.isNaN(ratio)) return false;
    return ratio >= (isLargeText ? 3 : 4.5);
}

/**
 * Wählt zwischen schwarzer und weißer Schrift die besser lesbare Variante.
 *
 * @param {string} backgroundColor - Hintergrundfarbe des Badges
 * @returns {string} `#000000` oder `#ffffff`
 */
export function bestTextColor(backgroundColor) {
    const black = contrastRatio('#000000', backgroundColor);
    const white = contrastRatio('#ffffff', backgroundColor);
    if (black === null || white === null) return '#ffffff';
    return black >= white ? '#000000' : '#ffffff';
}

/**
 * Stellt sicher, dass eine Schriftfarbe den Mindestkontrast erreicht.
 * Bevorzugt wird die gewünschte Farbe; nur bei Unterschreitung wird auf
 * schwarz/weiß gewechselt (Marken-/Linienfarben bleiben unverändert).
 *
 * @param {string} backgroundColor - Hintergrundfarbe des Badges
 * @param {string} [preferredColor='#ffffff'] - Ursprünglich vorgesehene Schriftfarbe
 * @param {number} [minRatio=3] - Mindestkontrast (3 entspricht WCAG AA für große Schrift)
 * @returns {string} Verwendbare Schriftfarbe
 */
export function ensureReadableTextColor(backgroundColor, preferredColor = '#ffffff', minRatio = 3) {
    if (contrastRatio(backgroundColor, backgroundColor) === null) {
        // Unbekannte/transparente Fläche: Wunschfarbe unverändert zurückgeben
        return preferredColor;
    }
    const preferredRatio = contrastRatio(preferredColor, backgroundColor);
    if (preferredRatio !== null && preferredRatio >= minRatio) {
        return preferredColor;
    }
    return bestTextColor(backgroundColor);
}

/**
 * Erkennt sehr helle Flächen, die auf weißem Grund praktisch unsichtbar sind.
 *
 * @param {string} color - Zu prüfende Fläche
 * @param {string} [reference='#ffffff'] - Umgebungsfarbe
 * @param {number} [threshold=1.12] - Kontrastschwelle zur Umgebung
 * @returns {boolean} true, wenn die Fläche kaum von der Umgebung abweicht
 */
export function isVeryLightColor(color, reference = '#ffffff', threshold = 1.12) {
    const ratio = contrastRatio(color, reference);
    return ratio !== null && ratio < threshold;
}
