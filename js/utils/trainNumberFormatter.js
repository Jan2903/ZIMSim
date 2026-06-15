// js/utils/trainNumberFormatter.js

/**
 * Generiert den Display-Namen einer Fahrt basierend auf Kategorie, Linie und Nummer.
 *
 * Regeln:
 * - ICE/EC:  "ICE 71", "EC 5"       → Kategorie + Nummer, keine Linie
 * - IC:      "IC 2443"              → Kategorie + Nummer
 * - RE/RB:   "RE 1" oder "RE 1 12345" → Kategorie + Linie (+ opt. Nummer)
 * - S-Bahn:  "S1", "S21"            → "S" + Linie, Nummer nur in Details
 * - FLX:     "FLX 1322"             → Kategorie + Nummer
 * - FEX:     "FEX"                  → Nur Kategorie
 *
 * @param {string} category - Zugkategorie ("ICE", "IC", "RE", "S", "FLX", "FEX", ...)
 * @param {string} line - Liniennummer ("20", "1", "S1", "")
 * @param {string|number} number - Zugnummer (71, 7922, 1322)
 * @param {object} [options={}]
 * @param {boolean} [options.nrwMode=false] - NRW-Modus: RE/RB zeigen nur die Linie
 * @param {boolean} [options.includeTrainNumber=true] - Zugnummer bei RE/RB anzeigen
 * @returns {string} z.B. "ICE 71", "S1", "RE 1"
 */
export function formatTrainNumber(category, line, number, options = {}) {
    const { nrwMode = false, includeTrainNumber = true } = options;

    const cat = (category || '').toUpperCase().trim();
    const num = number ? String(number).trim() : '';
    const lin = (line || '').trim();

    if (!cat && !num && !lin) return '';

    // Sonderfälle
    if (cat === 'FEX') return 'FEX';

    // S-Bahn: "S" + Linie (z.B. "S1", "S21")
    if (cat === 'S' || cat === 'SBH') {
        if (lin) return `S${lin}`;
        if (num) return `S ${num}`;
        return 'S';
    }

    // ICE / EC / ECE: Kategorie + Nummer, keine Linie
    if (['ICE', 'EC', 'ECE'].includes(cat)) {
        return num ? `${cat} ${num}` : cat;
    }

    // IC: Kategorie + Nummer
    if (cat === 'IC') {
        return num ? `IC ${num}` : 'IC';
    }

    // FLX (Flixtrain): Kategorie + Nummer
    if (cat === 'FLX' || cat === 'DRF') {
        return num ? `FLX ${num}` : 'FLX';
    }

    // RE / RB / Regional
    if (['RE', 'RB', 'IRE', 'MEX'].includes(cat)) {
        if (nrwMode) {
            // NRW-Modus: nur Linie
            return lin ? `${cat} ${lin}` : (num ? `${cat} ${num}` : cat);
        }
        // Normaler Modus: Linie + optional Nummer
        if (lin && num && includeTrainNumber) {
            return `${cat} ${lin}`;  // Nummer nur in Details
        }
        if (lin) return `${cat} ${lin}`;
        if (num) return `${cat} ${num}`;
        return cat;
    }

    // Fallback: Kategorie + Nummer
    if (num) return `${cat} ${num}`.trim();
    if (lin) return `${cat} ${lin}`.trim();
    return cat;
}

/**
 * Erstellt den Display-Namen aus einem DB-API verkehrmittel-Objekt.
 *
 * @param {object} verkehrmittel - DB API verkehrmittel
 * @param {object} [options={}]
 * @returns {string}
 */
export function formatFromVerkehrmittel(verkehrmittel, options = {}) {
    if (!verkehrmittel) return '';

    const cat = verkehrmittel.kurzText || verkehrmittel.produktGattung || '';
    const lin = verkehrmittel.linienNummer || '';
    // Zugnummer aus dem name-Feld extrahieren (z.B. "ICE 71" → "71")
    const name = verkehrmittel.name || '';
    const nameParts = name.split(' ');
    const num = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

    return formatTrainNumber(cat, lin, num, options);
}
