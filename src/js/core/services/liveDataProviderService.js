// src/js/core/services/liveDataProviderService.js
/**
 * @fileoverview Fassade über die Live-Daten-Provider.
 *
 * ZIMSim kann Bahnhofstafeln und Wagenreihungen aus zwei Quellen beziehen, die auf
 * derselben DB-Backend-Familie (Vendo) aufsetzen, sich aber in den Details unterscheiden:
 *
 *  - DB Navigator (app.services-bahn.de/mob): liefert einen verlässlichen Wagenreihungs-
 *    Indikator, die exakte Gleisabschnitts-Würfelposition und eine serverseitige
 *    Fahrtrichtung, aber keine Zwischenhalte und keine RIS-Gründe.
 *  - bahn.de Web API (www.bahn.de/web/api): liefert bis zu 8 Zwischenhalte, RIS-Gründe
 *    (R/Q) und eine HAFAS-Reise-ID, aber keinen Wagenreihungs-Indikator und keine
 *    exakte Würfelposition.
 *
 * Beide Quellen werden über diese Fassade auf ein einheitliches Format gebracht, damit
 * Oberfläche und Journey-Erzeugung provider-unabhängig arbeiten. Die verbleibenden
 * Unterschiede sind als Capability-Flags hinterlegt.
 */

/**
 * @typedef {Object} ProviderCapabilities
 * @property {boolean} vias - Liefert die Quelle Zwischenhalte (Vias) für die Anzeigetafeln?
 * @property {boolean} formationIndicator - Liefert die Quelle einen verlässlichen Wagenreihungs-Indikator ([W])?
 * @property {boolean} cubePosition - Liefert die Quelle die exakte Gleisabschnitts-Würfelposition?
 * @property {boolean} risReasons - Liefert die Quelle RIS-Gründe (R) und Qualitätsmeldungen (Q)?
 * @property {boolean} motFilter - Kann die Quelle nach Verkehrsmitteln gefiltert werden?
 * @property {boolean} extendedStations - Unterstützt die Quelle die erweiterte Haltestellensuche (ÖPNV, Ausland)?
 * @property {boolean} lookbehind - Unterstützt die Quelle ein Zeitfenster in die Vergangenheit?
 * @property {boolean} multiChunk - Lädt die Quelle die Tafel in mehreren Zeit-Chunks?
 */

/**
 * @typedef {Object} NormalizedEntry
 * @property {string} trainNumber - Zugnummer bzw. Fahrtnummer
 * @property {string} category - Produktgattung (ICE, IC, RE, ...)
 * @property {string} name - Anzeigename des Zuges
 * @property {string} operator - Betreiber-Kürzel
 * @property {string} destination - Ziel (Abfahrt) bzw. Herkunft (Ankunft)
 * @property {string} origin - Herkunft (Abfahrt) bzw. Ziel (Ankunft)
 * @property {string} scheduledTime - Geplante Zeit (HH:MM)
 * @property {string} expectedTime - Echtzeit (HH:MM, leer wenn identisch mit der Planzeit)
 * @property {string} platform - Geplantes Gleis
 * @property {string} expectedPlatform - Echtzeit-Gleis
 * @property {boolean} cancelled - Fällt die Fahrt aus?
 * @property {string[]} vias - Zwischenhalte in der Reihenfolge der Quelle (inkl. aktuellem Bahnhof)
 * @property {boolean|null} formationAvailable - Wagenreihung verfügbar (true/false), null = unbekannt
 * @property {Array<{priority: number, text: string, type?: string}>} messages - Rohmeldungen der Quelle
 * @property {string} journeyId - HAFAS-Reise-ID (nur bahn.de)
 * @property {object} providerMeta - Provider-spezifische Metadaten für spätere Abfragen
 */

/**
 * Verfügbare Provider-IDs.
 * @type {string[]}
 */
export const PROVIDER_IDS = ['db_navigator', 'dbweb'];

/**
 * Anzeigenamen der Provider.
 * @type {Record<string, string>}
 */
export const PROVIDER_LABELS = {
    db_navigator: 'DB Navigator (Vendo API)',
    dbweb: 'DBweb (bahn.de Web)'
};

/**
 * Fähigkeiten der Provider. Steuert, welche Optionen die Oberfläche anbietet
 * und welche Felder die Journey-Erzeugung belastet.
 * @type {Record<string, ProviderCapabilities>}
 */
export const PROVIDER_CAPABILITIES = {
    db_navigator: {
        vias: false,
        formationIndicator: true,
        cubePosition: true,
        risReasons: false,
        motFilter: true,
        extendedStations: true,
        lookbehind: true,
        multiChunk: true
    },
    dbweb: {
        vias: true,
        formationIndicator: false,
        cubePosition: false,
        risReasons: true,
        motFilter: true,
        extendedStations: true,
        lookbehind: false,
        multiChunk: false
    }
};

/**
 * Feld am Journey-Objekt, in dem die provider-spezifischen Metadaten abgelegt werden.
 * @type {Record<string, string>}
 */
export const PROVIDER_META_FIELDS = {
    db_navigator: 'dbNavMeta',
    dbweb: 'dbWebMeta'
};

/**
 * Zuordnung der neutralen Verkehrsmittel-IDs auf die API-spezifischen Codes.
 * Die Oberfläche bedient ausschließlich die neutralen IDs.
 * @type {Record<string, Record<string, string>>}
 */
export const PROVIDER_MOT_CODES = {
    db_navigator: {
        ICE: 'HOCHGESCHWINDIGKEITSZUEGE',
        EC_IC: 'INTERCITYUNDEUROCITYZUEGE',
        IR: 'INTERREGIOUNDSCHNELLZUEGE',
        REGIONAL: 'NAHVERKEHRSONSTIGEZUEGE',
        SBAHN: 'SBAHNEN',
        BUS: 'BUSSE',
        SCHIFF: 'SCHIFFE',
        UBAHN: 'UBAHN',
        TRAM: 'STRASSENBAHN',
        ANRUFPFLICHTIG: 'ANRUFPFLICHTIGEVERKEHRE'
    },
    dbweb: {
        ICE: 'ICE',
        EC_IC: 'EC_IC',
        IR: 'IR',
        REGIONAL: 'REGIONAL',
        SBAHN: 'SBAHN',
        BUS: 'BUS',
        SCHIFF: 'SCHIFF',
        UBAHN: 'UBAHN',
        TRAM: 'TRAM',
        ANRUFPFLICHTIG: 'ANRUFPFLICHTIG'
    }
};

/**
 * Liefert die Fähigkeiten eines Providers.
 * @param {string} providerId
 * @returns {ProviderCapabilities|null}
 */
export function getProviderCapabilities(providerId) {
    return PROVIDER_CAPABILITIES[providerId] || null;
}

/**
 * Liefert den Anzeigenamen eines Providers.
 * @param {string} providerId
 * @returns {string}
 */
export function getProviderLabel(providerId) {
    return PROVIDER_LABELS[providerId] || 'Unbekannte Quelle';
}

/**
 * Liefert das Journey-Feld für die provider-spezifischen Metadaten.
 * @param {string} providerId
 * @returns {string|null}
 */
export function getProviderMetaField(providerId) {
    return PROVIDER_META_FIELDS[providerId] || null;
}

/**
 * Übersetzt die neutralen Verkehrsmittel-IDs in die Codes der jeweiligen API.
 * Unbekannte IDs werden verworfen.
 * @param {string[]} neutralIds - Neutrale Verkehrsmittel-IDs
 * @param {string} providerId - Ziel-Provider
 * @returns {string[]} API-spezifische Verkehrsmittel-Codes
 */
export function mapVerkehrsmittel(neutralIds, providerId) {
    const codes = PROVIDER_MOT_CODES[providerId];
    if (!codes) {
        return Array.isArray(neutralIds) ? [...neutralIds] : [];
    }
    return (neutralIds || [])
        .map(id => codes[id])
        .filter(Boolean);
}
