// js/features/journey/services/infoTextTypes.js
// Zentrale, importfreie Typ-Konstanten für automatisch generierte Infotexte.

/**
 * Typen, die automatisch aus der Halteliste erzeugt werden und in den
 * Anschlusstafel-Layouts die Via-Kette ersetzen dürfen.
 */
export const AUTO_INFO_TEXT_TYPES = Object.freeze({
    NO_CONTINUATION: 'keine-weiterfahrt',
    SKIPPED_STOPS: 'ohne-halt',
    ADDITIONAL_STOPS: 'zusatz-halt'
});

/**
 * Haltbezogene Meldungstypen, die in der Via-Zeile der Anschlusstafel
 * angezeigt werden und die Vias vollständig ersetzen.
 */
export const ANSCHLUSSTAFEL_TEXT_TYPES = new Set(Object.values(AUTO_INFO_TEXT_TYPES));
