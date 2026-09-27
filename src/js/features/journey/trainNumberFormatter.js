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
 * Prüft, ob es sich bei dem Namen um ein rein linienbasiertes Verkehrsmittel handelt,
 * das auf DB-Anzeigen standardmäßig nie eine Zugnummer führt (z.B. S-Bahn, U-Bahn, Tram).
 * 
 * @param {string} lineName - Der Linienteil (z.B. "S 7", "S7", "U 2")
 * @returns {boolean}
 */
export function isLineOnlyProduct(lineName) {
    if (!lineName) return false;
    const clean = lineName.trim();
    // 1. S-Bahnen (z.B. "S 1", "S 7", "S 28", "S 31", "S1", "SBH 5")
    if (/^(?:S\s*\d+|S\d+|SBH\s*\d+|SBH\d+)/i.test(clean)) return true;
    // 2. Städtischer Nahverkehr (U-Bahn, Tram, Bus, SEV)
    if (/^(?:U\s*\d+|U\d+|STR\s*\d+|Tram\s*\d+|Bus\s*\d+|SEV)/i.test(clean)) return true;
    return false;
}

/**
 * Generiert den endgültigen Anzeigenamen unter Berücksichtigung des NRW-Modus
 * und der bundesweiten DB-Konvention für S-Bahnen und Nahverkehr.
 * 
 * @param {string} parsedName 
 * @param {boolean} [isNrwMode=false] 
 * @returns {string}
 */
export function formatDisplayName(parsedName, isNrwMode = false) {
    if (!parsedName) return '';

    // Falls S-Bahn ohne Leerzeichen übergeben wurde (z.B. "S7" oder "S7 / 12345"), Leerzeichen einfügen: "S 7"
    let cleanName = parsedName.replace(/^(S)(\d+)/i, '$1 $2');

    const parts = cleanName.split('/');
    const linePart = parts[0].trim();

    // 1. NRW-Modus: Alle Nahverkehrszüge zeigen nur die Linie (z.B. "RE 1" statt "RE 1 / 10123")
    if (isNrwMode) {
        return linePart;
    }

    // 2. S-Bahnen & städtischer Nahverkehr: Bundesweit grundsätzlich ohne interne Zugnummer
    if (isLineOnlyProduct(linePart)) {
        return linePart;
    }

    return cleanName;
}
