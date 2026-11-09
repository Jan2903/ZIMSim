// js/displays/core/infoTextDisplayUtils.js
import { drawText } from './textUtils.js';
import { ANSCHLUSSTAFEL_TEXT_TYPES } from '../../features/journey/services/infoTextTypes.js';

/** Fallback-Text für komplett ausgefallene Fahrten. */
export const AUSFALL_FALLBACK = 'Fahrt fällt aus';

/**
 * Liefert die in der Via-Zeile anzuzeigenden Meldungen.
 * Nur haltbezogene Meldungen; Kontexttexte werden ignoriert.
 *
 * `delayReason` wird bewusst NICHT berücksichtigt: Verspätungsgründe
 * werden in keinem Layout auf dem Canvas angezeigt.
 *
 * @param {object} train
 * @returns {string[]}
 */
export function getHaltMessages(train) {
    if (!train) return [];

    // 1. Kompletter Ausfall: Invertierung bleibt, Via-Zeile zeigt Ausfalltext.
    if (train.ausfall) {
        const visibleAusfallText = (train.infoTexts || []).find(
            t => t.visible && /ausfall|fällt heute aus|fahrt fällt aus/i.test(t.text || '')
        )?.text;
        return [visibleAusfallText || AUSFALL_FALLBACK];
    }

    const messages = [];

    // 2. "Zug verkehrt heute ab X" aus Flag
    if (train.verkehrtAb && train.verkehrtAb !== '0' && train.verkehrtAb !== 0) {
        messages.push(`Zug verkehrt heute ab ${train.verkehrtAb}`);
    }

    // 3. Sichtbare haltbezogene InfoTexts in Editor-Reihenfolge
    for (const info of train.infoTexts || []) {
        if (info.visible && ANSCHLUSSTAFEL_TEXT_TYPES.has(info.type) && info.text) {
            messages.push(info.text);
        }
    }

    return messages;
}

/**
 * Fasst die haltbezogenen Meldungen zu einem Anzeigetext zusammen.
 * @param {object} train
 * @returns {string}
 */
export function getHaltMessageText(train) {
    return getHaltMessages(train).join(' +++ ');
}

/**
 * Ermittelt den Text für Qualitäts-Piktogramme. Alle InfoTexts werden
 * unabhängig von ihrer Sichtbarkeit berücksichtigt, damit Piktogramme
 * auch nach einem Layoutwechsel (ausgeblendete Q-Texte) erhalten bleiben.
 * @param {object} train
 * @returns {string}
 */
export function getQualityText(train) {
    if (!train) return '';

    let qualityText = '';

    if (Array.isArray(train.infoTexts)) {
        qualityText = train.infoTexts.map(t => t.text || '').join(' ');
    }

    if (train.hasReservation || train.needsReservation || /flx|flixtrain/i.test(train.displayTitle || '')) {
        qualityText += ' Zug reservierungspflichtig';
    }
    if (train.hasBike || train.bike || (train.amenities && (train.amenities.includes('bike') || train.amenities.includes('bicycle')))) {
        qualityText += ' Fahrradmitnahme reservierungspflichtig';
    }

    return qualityText.trim();
}

/**
 * Zeichnet Text; bei Überbreite als horizontal scrollender Marquee.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x - linker Rand
 * @param {number} y - Text-Baseline/Mittelachse (wie drawText)
 * @param {number} maxWidth - verfügbare Breite
 * @param {string} font
 * @param {string} color
 * @param {object} renderCtx - enthält tickerOffset
 * @param {object} [options]
 * @param {number} [options.speed=1.8] - Multiplikator auf tickerOffset
 * @param {number} [options.clipHeight] - Höhe des Clip-Rechtecks
 * @returns {void}
 */
export function drawScrollingText(ctx, text, x, y, maxWidth, font, color, renderCtx, options = {}) {
    if (!text) return;

    ctx.font = font;
    const textWidth = ctx.measureText(text).width;

    if (textWidth <= maxWidth) {
        drawText(ctx, text, x, y, font, color, 'left');
        return;
    }

    const speed = options.speed ?? 1.8;
    const clipHeight = options.clipHeight ?? 60;
    const item = `+++ ${text} `;
    const itemWidth = ctx.measureText(item).width;
    const offset = ((renderCtx?.tickerOffset || 0) * speed) % itemWidth;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y - clipHeight / 2, maxWidth, clipHeight);
    ctx.clip();

    // Drei Kopien reichen für einen lückenlosen Umlauf
    drawText(ctx, item + item + item, x - offset, y, font, color, 'left');
    ctx.restore();
}
