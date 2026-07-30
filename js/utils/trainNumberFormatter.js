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
 * Generiert den endgültigen Anzeigenamen unter Berücksichtigung des NRW-Modus.
 * 
 * @param {string} parsedName 
 * @param {boolean} isNrwMode 
 * @returns {string}
 */
export function formatDisplayName(parsedName, isNrwMode) {
    if (!parsedName) return '';
    if (isNrwMode && parsedName.includes('/')) {
        return parsedName.split('/')[0].trim();
    }
    return parsedName;
}
