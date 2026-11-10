// js/core/utils/blinkUtils.js

/** Dauer einer vollständigen Blinkphase in Millisekunden (1 s an, 1 s aus). */
export const BLINK_PERIOD_MS = 2000;

/** Dauer der sichtbaren Teilphase in Millisekunden. */
export const BLINK_ON_MS = 1000;

/**
 * Prüft, ob die gemeinsame Blinkphase aktuell sichtbar ist.
 * Wird von der digitalen Uhr (Doppelpunkt) und dem Abfahrtsalarm genutzt,
 * damit beide Elemente pixelgenau synchron blinken.
 *
 * @param {number} [nowMs=Date.now()] - Aktueller Zeitstempel in Millisekunden.
 * @returns {boolean} True, wenn die sichtbare Blinkphase aktiv ist.
 */
export function isBlinkPhaseOn(nowMs = Date.now()) {
    return (nowMs % BLINK_PERIOD_MS) < BLINK_ON_MS;
}
