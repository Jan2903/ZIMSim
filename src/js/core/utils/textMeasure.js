// src/js/core/utils/textMeasure.js
import { FONTS } from '../constants/theme.js';

let _measuringCtx = null;
const _textLinesCache = new Map();
const MAX_TEXT_LINES_CACHE = 1000;

/**
 * Berechnet, wie viele Zeilen ein gegebener Text bei einer maximalen Breite einnimmt.
 * Nutzt einen gecachten Canvas-Kontext und einen Lookup-Cache für optimale Performance ohne Garbage-Collection-Overhead.
 *
 * @param {string} text - Der zu messende Text
 * @param {number} maxWidth - Maximale Breite in Pixeln
 * @param {string} [font=FONTS.regular(75)] - Font-Definition (z.B. FONTS.regular(75))
 * @returns {number} Anzahl der Zeilen
 */
export function measureTextLines(text, maxWidth, font = FONTS.regular(75)) {
    if (!text) return 0;
    if (typeof document === 'undefined') return 1;

    const cacheKey = `${font}|${maxWidth}|${text}`;
    if (_textLinesCache.has(cacheKey)) {
        return _textLinesCache.get(cacheKey);
    }

    if (!_measuringCtx) {
        const canvas = document.createElement('canvas');
        _measuringCtx = canvas.getContext('2d');
    }

    _measuringCtx.font = font;
    const words = text.split(' ');
    let lines = 1;
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + words[i] + ' ';
        const testWidth = _measuringCtx.measureText(testLine).width;

        if (testWidth > maxWidth && i > 0) {
            lines++;
            currentLine = words[i] + ' ';
        } else {
            currentLine = testLine;
        }
    }

    if (_textLinesCache.size >= MAX_TEXT_LINES_CACHE) {
        _textLinesCache.clear();
    }
    _textLinesCache.set(cacheKey, lines);

    return lines;
}

/**
 * Leert den Zeilenmessungs-Cache. Muss aufgerufen werden, nachdem die
 * Webfonts fertig geladen sind, da zuvor ggf. mit den Metriken des
 * Fallback-Fonts gemessen wurde (falsche Zeilenumbrüche/Breiten).
 * @returns {void}
 */
export function clearTextLinesCache() {
    _textLinesCache.clear();
    _measuringCtx = null;
}
