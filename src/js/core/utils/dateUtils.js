// src/js/core/utils/dateUtils.js

/**
 * Formatiert ein Datum oder einen Timestamp als 'HH:MM'.
 *
 * @param {Date|number|string} dateOrTimestamp - Date-Objekt, Timestamp in Millisekunden oder Datums-String
 * @returns {string} Formatierter Zeit-String 'HH:MM' (oder '' bei ungültigem Wert)
 */
export function formatHHMM(dateOrTimestamp) {
    if (!dateOrTimestamp) return '';
    const date = dateOrTimestamp instanceof Date ? dateOrTimestamp : new Date(dateOrTimestamp);
    if (isNaN(date.getTime())) return '';
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Formatiert ein Datum oder einen Timestamp als 'YYYY-MM-DD'.
 *
 * @param {Date|number|string} dateOrTimestamp - Date-Objekt, Timestamp in Millisekunden oder Datums-String
 * @returns {string} Formatierter Datums-String 'YYYY-MM-DD' (oder '' bei ungültigem Wert)
 */
export function formatYYYYMMDD(dateOrTimestamp) {
    if (!dateOrTimestamp) return '';
    const date = dateOrTimestamp instanceof Date ? dateOrTimestamp : new Date(dateOrTimestamp);
    if (isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Wandelt einen Zeitstring im Format 'HH:MM' in Minuten seit Mitternacht um.
 *
 * @param {string} timeStr - Zeitstring im Format 'HH:MM'
 * @returns {number|null} Minuten seit Mitternacht oder null bei ungültigem Format
 */
export function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
}

/**
 * Wandelt Minuten seit Mitternacht in einen 'HH:MM'-String um.
 *
 * @param {number} totalMinutes - Minuten seit Mitternacht
 * @returns {string} Formatierter Zeit-String 'HH:MM'
 */
export function formatTimeFromMinutes(totalMinutes) {
    if (typeof totalMinutes !== 'number' || isNaN(totalMinutes)) return '00:00';
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    const h = Math.floor(normalized / 60).toString().padStart(2, '0');
    const m = (normalized % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Berechnet die Verspätungsdifferenz in Minuten zwischen Plan- und Ist-Zeit.
 * Berücksichtigt automatisch einen Tageswechsel über Mitternacht (z.B. Plan 23:55, Ist 00:05).
 *
 * @param {string} scheduledTime - Geplante Abfahrts-/Ankunftszeit ('HH:MM')
 * @param {string} expectedTime - Erwartete Abfahrts-/Ankunftszeit ('HH:MM')
 * @returns {number} Verspätung in Minuten (positiv = verspätet, negativ = verfrüht)
 */
export function calculateDelayMinutes(scheduledTime, expectedTime) {
    if (!scheduledTime || !expectedTime) return 0;
    const [sh, sm] = scheduledTime.split(':').map(Number);
    const [eh, em] = expectedTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;

    let diff = (eh * 60 + em) - (sh * 60 + sm);
    // Tageswechsel-Kompensation (+/- 12 Stunden)
    if (diff < -720) diff += 1440;
    else if (diff > 720) diff -= 1440;
    return diff;
}
