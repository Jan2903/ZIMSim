// src/js/core/constants/trainColorPalette.js

/**
 * Farb- und Formvorgaben des DB-InfraGO-Konzepts „Farben in der Reisendeninformation"
 * (wirksam ab 26.11.2026). Diese Datei enthält ausschließlich Daten und Muster,
 * keine Logik und keinen State — die Auflösung übernimmt der LineColorService.
 *
 * Grundsatz des Konzepts: Farbe kennzeichnet entweder einen Betreiber (Fernverkehr)
 * oder eine Verkehrsart (Regional-/Gelegenheitsverkehr). S-Bahnen behalten Linienfarben.
 */

/** Verkehrsarten im Sinne des Farbkonzepts. */
export const TRANSPORT_CATEGORY = Object.freeze({
    FERNVERKEHR: 'fernverkehr',
    REGIONALVERKEHR: 'regionalverkehr',
    GELEGENHEITSVERKEHR: 'gelegenheitsverkehr',
    SBAHN: 'sbahn',
    STADTVERKEHR: 'stadtverkehr'
});

/** Anzeigenamen der Verkehrsarten (für Einstellungen und Vorschauen). */
export const TRANSPORT_CATEGORY_LABELS = Object.freeze({
    [TRANSPORT_CATEGORY.FERNVERKEHR]: 'Fernverkehr',
    [TRANSPORT_CATEGORY.REGIONALVERKEHR]: 'Regionalverkehr',
    [TRANSPORT_CATEGORY.GELEGENHEITSVERKEHR]: 'Gelegenheitsverkehr',
    [TRANSPORT_CATEGORY.SBAHN]: 'S-Bahn',
    [TRANSPORT_CATEGORY.STADTVERKEHR]: 'Stadtverkehr'
});

/**
 * Badge-Stile je Verkehrsart. Die Werte wurden pixelweise aus dem offiziellen
 * Schaubild entnommen. `inverted` beschreibt die Darstellung auf weißem Grund
 * (Ausfallzeile, Nebenmonitor).
 */
export const DB_2026_CATEGORY_STYLES = Object.freeze({
    [TRANSPORT_CATEGORY.FERNVERKEHR]: {
        backgroundColor: '#525761',
        textColor: '#ffffff',
        borderColor: 'transparent',
        borderWidth: 0,
        shape: 'rectangle',
        cornerRadius: 0
    },
    [TRANSPORT_CATEGORY.REGIONALVERKEHR]: {
        backgroundColor: '#525761',
        textColor: '#ffffff',
        borderColor: 'transparent',
        borderWidth: 0,
        shape: 'rectangle',
        cornerRadius: 0
    },
    [TRANSPORT_CATEGORY.GELEGENHEITSVERKEHR]: {
        backgroundColor: '#da6ba2',
        textColor: '#ffffff',
        borderColor: 'transparent',
        borderWidth: 0,
        shape: 'rectangle',
        cornerRadius: 0
    }
});

/** Fallback für S-Bahn-Linien ohne Linienfarbe (bisheriges DB-Grün). */
export const DB_2026_SBAHN_FALLBACK = Object.freeze({
    backgroundColor: '#15803d',
    textColor: '#ffffff',
    borderColor: 'transparent',
    borderWidth: 0,
    shape: 'pill',
    cornerRadius: 15
});

/**
 * Betreiberfarben im Fernverkehr.
 * Das weiße DB-Badge ist auf weißem Grund unsichtbar und erhält deshalb einen
 * schwarzen Rahmen statt einer transparenten Outline (Anschlusstafeln setzen
 * Ausfallzeilen zusätzlich auf Türkis, siehe anschlusstafelRenderer).
 */
export const DB_2026_OPERATOR_STYLES = Object.freeze({
    'db-fernverkehr': {
        label: 'DB Fernverkehr',
        backgroundColor: '#ffffff',
        textColor: '#000000',
        borderColor: 'transparent',
        borderWidth: 0,
        shape: 'rectangle',
        cornerRadius: 0,
        inverted: {
            backgroundColor: '#ffffff',
            textColor: '#000000',
            borderColor: '#000000',
            borderWidth: 3
        }
    },
    'flixtrain': {
        label: 'FlixTrain',
        backgroundColor: '#97d700',
        textColor: '#000000',
        borderColor: 'transparent',
        borderWidth: 0,
        shape: 'rectangle',
        cornerRadius: 0
    },
    'tgv': {
        label: 'TGV',
        backgroundColor: '#a10068',
        textColor: '#ffffff',
        borderColor: 'transparent',
        borderWidth: 0,
        shape: 'rectangle',
        cornerRadius: 0
    },
    'nightjet': {
        label: 'Nightjet (ÖBB)',
        backgroundColor: '#e2002a',
        textColor: '#ffffff',
        borderColor: 'transparent',
        borderWidth: 0,
        shape: 'rectangle',
        cornerRadius: 0
    },
    'oebb': {
        label: 'ÖBB Fernverkehr (Railjet)',
        backgroundColor: '#e2002a',
        textColor: '#ffffff',
        borderColor: 'transparent',
        borderWidth: 0,
        shape: 'rectangle',
        cornerRadius: 0
    },
    'westbahn': {
        label: 'WESTbahn',
        backgroundColor: '#005ca9',
        textColor: '#ffffff',
        borderColor: 'transparent',
        borderWidth: 0,
        shape: 'rectangle',
        cornerRadius: 0
    }
});

/**
 * Muster je Verkehrsart, in Prüfreihenfolge (First-Match).
 * Die Reihenfolge ist relevant: „S" vor „STR", „ICE" vor „IC", „IRE" vor „IR".
 * @type {Array<[string, RegExp]>}
 */
export const CATEGORY_MATCH_ORDER = Object.freeze([
    [TRANSPORT_CATEGORY.SBAHN, /^S\s*\d/i],
    [TRANSPORT_CATEGORY.FERNVERKEHR, /^(?:ECE|EC|ICE|IC|TGV|NJ|RJX|RJ|EN|WB|FLX)(?![A-Za-z])/i],
    [TRANSPORT_CATEGORY.REGIONALVERKEHR, /^(?:MEX|IRE|RE|RB|IR|FEX)(?![A-Za-z])/i],
    [TRANSPORT_CATEGORY.GELEGENHEITSVERKEHR, /^(?:SDZ|DZ|SONDERZUG|SONDERFAHRT)(?![A-Za-z])/i],
    [TRANSPORT_CATEGORY.STADTVERKEHR, /^(?:STR|TRAM|BUS|SEV|EV|AST|RUFBUS|U|X|M|SB|N|H)\s*\d/i]
]);

/**
 * Gattungspräfixe, die eindeutig zu einem Betreiber gehören.
 * Nötig, weil die Traewelling-Datenbank Flix, WESTbahn, SNCF und ÖBB nicht als
 * Betreiber-Schlüssel führt.
 * @type {Array<[string, RegExp]>}
 */
export const OPERATOR_PREFIX_ORDER = Object.freeze([
    ['flixtrain', /^FLX(?![A-Za-z])/i],
    ['tgv', /^TGV(?![A-Za-z])/i],
    ['nightjet', /^NJ(?![A-Za-z])/i],
    ['nightjet', /^EN(?![A-Za-z])/i],
    ['oebb', /^RJX(?![A-Za-z])/i],
    ['oebb', /^RJ(?![A-Za-z])/i],
    ['westbahn', /^WB(?![A-Za-z])/i]
]);

/**
 * EVU-/IRIS-Codes (normalisiert: Großbuchstaben, ohne Sonderzeichen) → Betreiber-Schlüssel.
 * @type {Record<string, string>}
 */
export const OPERATOR_ALIASES = Object.freeze({
    DB: 'db-fernverkehr',
    DBF: 'db-fernverkehr',
    DBFV: 'db-fernverkehr',
    DBFVAG: 'db-fernverkehr',
    FLX: 'flixtrain',
    FLIXTRAIN: 'flixtrain',
    FLIX: 'flixtrain',
    WB: 'westbahn',
    WESTBAHN: 'westbahn',
    SNCF: 'tgv',
    TGV: 'tgv',
    INOUI: 'tgv',
    OBB: 'oebb',
    OBBPV: 'oebb',
    RJ: 'oebb',
    RJX: 'oebb',
    NJ: 'nightjet',
    NIGHTJET: 'nightjet'
});

/**
 * Gattungen, die in Deutschland ausschließlich von DB Fernverkehr betrieben werden.
 * Sie werden nur dann als DB-Fernverkehr interpretiert, wenn kein EVU-Code vorliegt.
 */
export const DB_ONLY_FERNVERKEHR_PATTERN = /^(?:ECE|EC|ICE|IC)(?![A-Za-z])/i;
