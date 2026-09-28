// js/utils/trainNumberFormatter.js

/**
 * Parst den Zugnamen anhand der neuen Logik aus den DB-Daten.
 * 
 * @param {string} name 
 * @param {string} linienNummer 
 * @param {string} langText 
 * @returns {string} 
 */
export function parseTrainName(name, linienNummer, langText) {
    name = (name || '').trim();
    linienNummer = (linienNummer || '').trim();
    langText = (langText || '').trim();

    const hasLetters = /[A-Za-z]/.test(name);
    const hasNumbers = /\d/.test(name);
    const isValidName = hasLetters && hasNumbers;

    if (isValidName) {
        // Wenn zwischen Buchstaben und der ersten Zahl kein Leerzeichen ist, einfügen
        return name.replace(/([A-Za-z])(\d)/, '$1 $2');
    }

    // Fallback auf linienNummer
    const isLinieOnlyNumbers = /^\d+$/.test(linienNummer);
    const isLinieOnlyLetters = /^[A-Za-z]+$/.test(linienNummer);
    
    // NEUE LOGIK FÜR DIE ZUGNUMMER:
    let trainNumber = '';
    if (/^\d+$/.test(name)) {
        trainNumber = name;
    } else {
        const match = langText.match(/\((\d+)\)/);
        if (match) {
            trainNumber = match[1];
        }
    }

    if (!linienNummer || isLinieOnlyNumbers) {
        return name; // Originäres Datenfeld "name" nutzen
    }

    if (isLinieOnlyLetters) {
        return trainNumber ? `${linienNummer} ${trainNumber}`.trim() : linienNummer;
    }

    // linienNummer besteht aus Buchstaben und Zahlen (z.B. "RE14a" -> "RE 14a")
    const spacedLinie = linienNummer.replace(/([A-Za-z])(\d)/, '$1 $2');
    
    if (trainNumber) {
        return `${spacedLinie} / ${trainNumber}`;
    }
    return spacedLinie;
}

/**
 * Reguläre Ausdrücke für gängige Linientypen im deutschen ÖPNV & Schienenverkehr.
 * Vollständig generisch ohne herstellerspezifische oder regionale Kürzel (kein SBH o.ä.).
 */
export const SBAHN_LINE_REGEX = /^S\s*\d+[A-Za-z]?$/i;
export const UBAHN_LINE_REGEX = /^U\s*\d+[A-Za-z]?$/i;
export const TRAM_LINE_REGEX = /^(?:STR|Tram|TRAM)\s*\d+[A-Za-z]?$/i;
export const BUS_LINE_REGEX = /^(?:Bus\s*\d+|X\s*\d+|M\s*\d+|SB\s*\d+|N\s*\d+|H\s*\d+)/i;
export const SEV_LINE_REGEX = /^(?:SEV|EV)(?:\s+[A-Za-z0-9]+)?$/i;
export const REGIONAL_LINE_REGEX = /^(?:RE|RB|MEX|IRE|FEX)\s*\d+[A-Za-z]?$/i;

/**
 * Prüft, ob ein Linienname eine S-Bahn ist (z.B. "S 1", "S 7", "S 28", "S 31X", "S1").
 * @param {string} line
 * @returns {boolean}
 */
export function isSbahnLine(line) {
    if (!line) return false;
    return SBAHN_LINE_REGEX.test(line.trim());
}

/**
 * Prüft, ob ein Linienname eine U-Bahn ist (z.B. "U 1", "U1", "U 55").
 * @param {string} line
 * @returns {boolean}
 */
export function isUbahnLine(line) {
    if (!line) return false;
    return UBAHN_LINE_REGEX.test(line.trim());
}

/**
 * Prüft, ob ein Linienname eine Straßenbahn / Tram ist (z.B. "STR 1", "Tram 12").
 * @param {string} line
 * @returns {boolean}
 */
export function isTramLine(line) {
    if (!line) return false;
    return TRAM_LINE_REGEX.test(line.trim());
}

/**
 * Prüft, ob ein Linienname ein Bus ist (z.B. "Bus 100", "X 10", "M 29", "SB 50", "N 7").
 * @param {string} line
 * @returns {boolean}
 */
export function isBusLine(line) {
    if (!line) return false;
    return BUS_LINE_REGEX.test(line.trim());
}

/**
 * Prüft, ob ein Linienname ein Regionalzug ist (z.B. "RE 1", "RB 26", "MEX 16", "IRE 1").
 * @param {string} line
 * @returns {boolean}
 */
export function isRegionalLine(line) {
    if (!line) return false;
    return REGIONAL_LINE_REGEX.test(line.trim());
}

/**
 * Prüft, ob es sich bei dem Namen um ein rein linienbasiertes Verkehrsmittel handelt,
 * das auf DB-Anzeigen standardmäßig nie eine Zugnummer führt (z.B. S-Bahn, U-Bahn, Tram).
 * 
 * @param {string} lineName - Der Linienteil (z.B. "S 7", "S7", "U 2")
 * @returns {boolean}
 */
export function isLineOnlyProduct(lineName) {
    if (!lineName) return false;
    const clean = lineName.trim();
    // 1. S-Bahnen (z.B. "S 1", "S 7", "S 28", "S 31", "S1")
    if (isSbahnLine(clean)) return true;
    // 2. Städtischer Nahverkehr (U-Bahn, Tram, Bus, SEV)
    if (isUbahnLine(clean) || isTramLine(clean) || isBusLine(clean) || SEV_LINE_REGEX.test(clean)) return true;
    return false;
}

let _formatOptionsProvider = null;

/**
 * Registriert einen Callback/Provider für globale Formatierungsoptionen (z.B. aus dem journeyStore).
 * Verhindert zirkuläre Modulabhängigkeiten.
 * @param {() => object} provider 
 */
export function setFormatOptionsProvider(provider) {
    _formatOptionsProvider = provider;
}

/**
 * Generiert den endgültigen Anzeigenamen unter Berücksichtigung des NRW-Modus,
 * konfigurierbarer Formatierungs-Optionen und der bundesweiten DB-Konvention für S-Bahnen.
 * 
 * @param {string} parsedName - Der Zug- oder Linienname (z.B. "S 7 / 34533", "RE1 / 10123", "Bus 100")
 * @param {boolean | object} [optionsOrNrwMode] - Entweder boolean (isNrwMode), options-Objekt oder undefined (nutzt globalen Store)
 * @returns {string} Der formatierte Name für das Board
 */
export function formatDisplayName(parsedName, optionsOrNrwMode = undefined) {
    if (!parsedName) return '';

    // Globale Store-Optionen abrufen (sofern registriert)
    const globalOpts = typeof _formatOptionsProvider === 'function' ? _formatOptionsProvider() : {};

    // Abwärtskompatible Parameter-Auflösung
    let opts;
    if (typeof optionsOrNrwMode === 'boolean') {
        opts = { ...globalOpts, nrwMode: optionsOrNrwMode };
    } else if (optionsOrNrwMode && typeof optionsOrNrwMode === 'object') {
        opts = { ...globalOpts, ...optionsOrNrwMode };
    } else {
        opts = globalOpts;
    }

    const isNrw = Boolean(opts.nrwMode);
    const hideSbahn = opts.hideSbahnTrainNumbers !== false; // Standard: true (bundesweiter DB-Standard)
    const hideRegional = Boolean(opts.hideRegionalTrainNumbers || isNrw);
    const stripBus = opts.stripBusPrefix !== false; // Standard: true
    const harmonizeSpacing = opts.harmonizeSpacing !== false; // Standard: true

    let cleanName = parsedName.trim();

    // 1. Redundantes Gattungswort "Bus" vor Ziffern oder Linienkennungen entfernen ("Bus 100" -> "100", "Bus X10" -> "X10")
    if (stripBus) {
        cleanName = cleanName.replace(/^(?:Bus|BUS)\s+(\d+|[XMSNH]\s*\d+)/i, '$1');
    }

    // 2. Ersatzverkehr standardisieren ("EV" -> "SEV", "Bus SEV" -> "SEV")
    cleanName = cleanName.replace(/^(?:Bus\s+)?(?:SEV|EV)\b/i, 'SEV');

    // 3. Spacing harmonisieren (z.B. "S7" -> "S 7", "RE1" -> "RE 1", "X10" -> "X 10", "U1" -> "U 1")
    if (harmonizeSpacing) {
        cleanName = cleanName.replace(/^(S|RE|RB|MEX|IRE|FEX|U|STR|Tram|X|M|SB|N|H)(\d+)/i, '$1 $2');
    }

    const parts = cleanName.split('/');
    const linePart = parts[0].trim();
    const trainNumberPart = parts.length > 1 ? parts.slice(1).join('/').trim() : '';

    // 4. NRW-Modus: Alle Nahverkehrszüge zeigen nur die Linie (z.B. "RE 1" statt "RE 1 / 10123")
    if (isNrw) {
        return linePart;
    }

    // 5. S-Bahnen: Bundesweit grundsätzlich ohne interne Zugnummer (sofern aktiviert)
    if (isSbahnLine(linePart)) {
        return hideSbahn ? linePart : cleanName;
    }

    // 6. Städtischer Nahverkehr & reine Liniennummern (U-Bahn, Tram, Bus, SEV, rein numerische Linien)
    if (isLineOnlyProduct(linePart) || /^\d+$/.test(linePart)) {
        return linePart;
    }

    // 7. Regionalverkehr: Nur Linie, falls Option aktiv
    if (isRegionalLine(linePart) && hideRegional) {
        return linePart;
    }

    // 8. Standard: Mit Zugnummer, falls vorhanden
    if (trainNumberPart) {
        return `${linePart} / ${trainNumberPart}`;
    }
    return cleanName;
}
