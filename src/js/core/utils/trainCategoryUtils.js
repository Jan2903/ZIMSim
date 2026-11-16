// src/js/core/utils/trainCategoryUtils.js

import {
    CATEGORY_MATCH_ORDER,
    DB_ONLY_FERNVERKEHR_PATTERN,
    OPERATOR_ALIASES,
    OPERATOR_PREFIX_ORDER,
    TRANSPORT_CATEGORY
} from '../constants/trainColorPalette.js';

/**
 * Zuggattungen, die IRIS bei fehlendem EVU-Code als Betreiber liefert
 * (irisDataMapper nutzt `raw.operator || raw.type`). Sie sind kein Betreiberhinweis.
 * @type {Set<string>}
 */
const GENERIC_OPERATOR_CODES = new Set([
    'ICE', 'IC', 'EC', 'ECE', 'RE', 'RB', 'MEX', 'IRE', 'IR', 'FEX',
    'S', 'U', 'STR', 'TRAM', 'BUS', 'SEV', 'EV', 'X', 'M', 'N', 'H', 'SB'
]);

/**
 * Schneidet den Linien-/Gattungsteil aus einem Anzeigenamen heraus.
 * Beispiele: `"S 5 / 34533"` → `"S 5"`, `"RE 1 / 10123"` → `"RE 1"`, `"ICE 543"` → `"ICE 543"`.
 *
 * @param {string} trainName - Anzeigename des Zuges
 * @returns {string} Linienteil ohne Zugnummer
 */
export function extractLinePart(trainName) {
    return String(trainName || '').split('/')[0].trim();
}

/**
 * Normalisiert einen EVU-/IRIS-Code für den Alias-Vergleich.
 * Umlaute werden aufgelöst, Sonderzeichen und Leerzeichen entfernt.
 *
 * @param {string} code - Rohcode aus IRIS bzw. Import (z. B. `"DB FV"`, `"ÖBB"`, `"W3"`)
 * @returns {string} Normalisierter Code (z. B. `"DBFV"`, `"OBB"`, `"W3"`)
 */
export function normalizeOperatorCode(code) {
    return String(code || '')
        .trim()
        .toUpperCase()
        .replace(/Ä/g, 'A')
        .replace(/Ö/g, 'O')
        .replace(/Ü/g, 'U')
        .replace(/[^A-Z0-9]/g, '');
}

/**
 * Ordnet einen Linienteil einer Verkehrsart zu (First-Match, siehe CATEGORY_MATCH_ORDER).
 *
 * @param {string} linePart - Linien-/Gattungsteil (z. B. `"RE 1"`, `"S 5"`, `"DZ 10"`)
 * @returns {string | null} Verkehrsart oder null, wenn kein Muster passt
 */
export function matchTransportCategory(linePart) {
    if (!linePart) return null;
    for (const [category, pattern] of CATEGORY_MATCH_ORDER) {
        if (pattern.test(linePart)) return category;
    }
    return null;
}

/**
 * Ermittelt den Betreiber-Schlüssel aus EVU-Code und Gattungspräfix.
 * Der EVU-Code hat Vorrang; das Präfix greift nur, wenn der Code unbekannt ist
 * (Traewelling führt Flix, WESTbahn, SNCF und ÖBB nicht als Betreiber).
 *
 * @param {string} linePart - Linien-/Gattungsteil
 * @param {string} [operator=''] - EVU-/IRIS-Code der Fahrt
 * @returns {string | null} Betreiber-Schlüssel der Palette oder null
 */
export function resolveOperatorKey(linePart, operator = '') {
    const normalized = normalizeOperatorCode(operator);
    if (normalized && OPERATOR_ALIASES[normalized]) {
        return OPERATOR_ALIASES[normalized];
    }

    // IRIS-Fallback `operator = raw.type` liefert reine Gattungskürzel ohne Betreiberaussage
    if (normalized && GENERIC_OPERATOR_CODES.has(normalized)) {
        return null;
    }

    for (const [operatorKey, pattern] of OPERATOR_PREFIX_ORDER) {
        if (pattern.test(linePart)) return operatorKey;
    }

    return null;
}

/**
 * Klassifiziert einen Zug für das DB-InfraGO-Farbsystem.
 *
 * @param {string} trainName - Anzeigename (z. B. `"TGV 9583"`, `"RE 1 / 10123"`, `"S 5"`)
 * @param {object} [context={}] - Zusatzkontext
 * @param {string} [context.operator] - EVU-/IRIS-Code der Fahrt
 * @returns {{ category: string | null, operatorKey: string | null, source: 'prefix' | 'operator' | 'fallback' }}
 *   Verkehrsart, Betreiber-Schlüssel und Herkunft der Zuordnung
 */
export function classifyTransportCategory(trainName, context = {}) {
    const linePart = extractLinePart(trainName);
    const operatorKey = resolveOperatorKey(linePart, context.operator);

    if (!linePart) {
        return { category: null, operatorKey, source: 'fallback' };
    }

    const category = matchTransportCategory(linePart);
    if (category) {
        if (
            category === TRANSPORT_CATEGORY.FERNVERKEHR &&
            !operatorKey &&
            DB_ONLY_FERNVERKEHR_PATTERN.test(linePart)
        ) {
            // ICE/IC/EC/ECE sind EVU-reine DB-Gattungen: ohne EVU-Code bleibt DB Fernverkehr
            return { category, operatorKey: 'db-fernverkehr', source: 'prefix' };
        }
        return { category, operatorKey, source: 'prefix' };
    }

    if (operatorKey) {
        // Bekannter Fernverkehrs-Betreiber, aber unbekannte Gattung (z. B. Sonderzugnummer)
        return { category: TRANSPORT_CATEGORY.FERNVERKEHR, operatorKey, source: 'operator' };
    }

    return { category: null, operatorKey: null, source: 'fallback' };
}
