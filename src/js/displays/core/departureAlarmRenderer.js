// js/displays/core/departureAlarmRenderer.js
import { COLORS } from '../../core/constants/theme.js';
import { config, getSimulatedTime } from '../../core/utils/config.js';
import { isBlinkPhaseOn } from '../../core/utils/blinkUtils.js';
import { JourneyConnectionService } from '../../features/journey/services/journeyConnectionService.js';

/**
 * Liefert die effektive Abfahrtszeit als Unix-Timestamp (ms).
 * Bevorzugt bereits geparste Echtzeitdaten (_effectiveTimeMs), fällt auf
 * Parsing von expectedTime/scheduledTime zurück. Behandelt Tageswechsel.
 * @param {import('../../features/journey/journey.svelte.js').Journey} train
 * @returns {number|null} Unix-Timestamp in ms oder null wenn keine Zeit verfügbar
 */
export function getEffectiveDepartureMs(train) {
    const now = getSimulatedTime();
    // Keine Abfahrtszeit gesetzt -> kein Alarm
    if (!train.expectedTime && !train.scheduledTime && !train._effectiveTimeMs) return null;
    return JourneyConnectionService.getJourneyTimeMs(train, now, true);
}

/**
 * Prüft, ob der Abfahrtsalarm (weißer Punkt) für eine Fahrt angezeigt werden soll.
 * @param {import('../../features/journey/journey.svelte.js').Journey} train
 * @returns {{visible: boolean, blinking: boolean}}
 */
export function getDepartureAlarmState(train) {
    if (!config.departureAlarmEnabled) return { visible: false, blinking: false };
    if (train.ausfall || train.isCancelled) return { visible: false, blinking: false };

    const depMs = getEffectiveDepartureMs(train);
    if (depMs == null) return { visible: false, blinking: false };

    const now = getSimulatedTime().getTime();
    const diffMinutes = (depMs - now) / 60000;

    // Noch nicht in der Alarm-Zeitspanne oder bereits abgefahren
    if (diffMinutes > config.departureAlarmLeadMinutes || diffMinutes < 0) {
        return { visible: false, blinking: false };
    }

    const blinking = diffMinutes <= config.departureAlarmBlinkMinutes;
    return { visible: true, blinking };
}

/**
 * Zeichnet den Abfahrtsalarm-Punkt (ausgefüllt blinkend oder als Outline).
 * Nutzt dieselbe Blinkphase wie der Doppelpunkt der digitalen Uhr.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Mittelpunkt X.
 * @param {number} y - Mittelpunkt Y.
 * @param {object} [options={}] - Darstellungsoptionen.
 * @param {number} [options.radius=8] - Radius des Punktes.
 * @param {number} [options.lineWidth=3] - Linienstärke der Outline.
 * @param {string} [options.color=COLORS.WHITE] - Farbe des Punktes.
 * @param {boolean} [options.blinking=false] - Ob der Punkt im Blink-Modus ist.
 * @returns {void}
 */
export function drawDepartureAlarmMarker(ctx, x, y, options = {}) {
    const {
        radius = 8,
        lineWidth = 3,
        color = COLORS.WHITE,
        blinking = false
    } = options;

    if (blinking) {
        // Blink-Modus: ausgefüllter Kreis, Ein-/Ausblenden über die gemeinsame Blinkphase
        if (!isBlinkPhaseOn()) return;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Nicht-blinkend: Kreis als Umrandung (Outline)
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
    }
}
