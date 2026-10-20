// src/js/core/utils/numberUtils.js

/**
 * Begrenzt einen numerischen Wert auf den erlaubten Bereich.
 *
 * @param {number} value - Der zu begrenzende Wert
 * @param {number} min - Untere Grenze
 * @param {number} max - Obere Grenze
 * @returns {number} Der auf den Bereich begrenzte Wert
 */
export function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Liest einen numerischen Wert aus einem Eingabefeld.
 *
 * @param {Event} e - Das Eingabeereignis
 * @returns {number|null} Der geparste Wert oder null bei leerer/ungültiger Eingabe
 */
export function readNumericInput(e) {
    const value = parseInt(e.target.value, 10);
    return Number.isNaN(value) ? null : value;
}

/**
 * Wertet eine manuelle Eingabe in einem numerischen Feld aus.
 * Werte außerhalb des erlaubten Bereichs werden verworfen, damit der Nutzer
 * seine Eingabe korrigieren kann (der Feldinhalt bleibt unverändert).
 *
 * @param {Event} e - Das Eingabeereignis
 * @param {number} min - Untere Grenze
 * @param {number} max - Obere Grenze
 * @returns {number|null} Der übernommene Wert oder null, wenn die Eingabe verworfen wurde
 */
export function applyNumericInput(e, min, max) {
    const value = readNumericInput(e);
    if (value === null || value < min || value > max) return null;
    return value;
}

/**
 * Wertet eine manuelle Eingabe in einem numerischen Feld aus und begrenzt das
 * Ergebnis auf den erlaubten Bereich. Im Gegensatz zu applyNumericInput wird
 * die Eingabe also korrigiert statt verworfen.
 *
 * @param {Event} e - Das Eingabeereignis
 * @param {number} min - Untere Grenze
 * @param {number} max - Obere Grenze
 * @returns {number|null} Der begrenzte Wert oder null bei leerer/ungültiger Eingabe
 */
export function clampNumericInput(e, min, max) {
    const value = readNumericInput(e);
    if (value === null) return null;
    return clampValue(value, min, max);
}

/**
 * Stellt beim Verlassen eines numerischen Feldes einen gültigen Wert sicher.
 * Der Feldinhalt wird auf den gültigen Wert normalisiert.
 *
 * @param {Event} e - Das Blur-Ereignis
 * @param {number} min - Untere Grenze
 * @param {number} max - Obere Grenze
 * @param {number} current - Aktueller Wert als Fallback bei ungültiger Eingabe
 * @returns {number} Der gültige Wert
 */
export function resolveNumericBlur(e, min, max, current) {
    const parsed = readNumericInput(e);
    const value = parsed === null ? current : clampValue(parsed, min, max);
    e.target.value = value;
    return value;
}
