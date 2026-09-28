// src/js/audio/audioReasonMapping.js

/**
 * Offizielle 42 Legacy-Audiobausteine für Verspätungsgründe (Soundpack 001.wav - 042.wav).
 * WICHTIG: Die Audiodateien enthalten das eingesprochene "Grund dafür ist..." bzw. "Grund dafür sind..." bereits nativ!
 * Jedes Element besitzt eine 900er-ID (900 + Dateinummer) für konfliktfreien Direktzugriff.
 */
export const LEGACY_AUDIO_REASONS = [
    { id: 901, file: "001.wav", grund: "Verzögerung Betriebsablauf", spokenText: "Grund dafür sind Verzögerungen im Betriebsablauf" },
    { id: 902, file: "002.wav", grund: "Bauarbeiten", spokenText: "Grund dafür sind Bauarbeiten" },
    { id: 903, file: "003.wav", grund: "Personen im Gleis", spokenText: "Grund dafür sind Personen im Gleis" },
    { id: 904, file: "004.wav", grund: "technische Störung am Zug", spokenText: "Grund dafür ist eine technische Störung am Zug" },
    { id: 905, file: "005.wav", grund: "Notarzteinsatz am Gleis", spokenText: "Grund dafür ist ein Notarzteinsatz am Gleis" },
    { id: 906, file: "006.wav", grund: "Oberleitungsstörung", spokenText: "Grund dafür ist eine Oberleitungsstörung" },
    { id: 907, file: "007.wav", grund: "Signalstörung", spokenText: "Grund dafür ist eine Signalstörung" },
    { id: 908, file: "008.wav", grund: "Stellwerksstörung /-ausfall", spokenText: "Grund dafür ist eine Stellwerksstörung" },
    { id: 909, file: "009.wav", grund: "Gegenstände im Gleis", spokenText: "Grund dafür sind Gegenstände im Gleis" },
    { id: 910, file: "010.wav", grund: "Warten auf Fahrgäste -anderer Zug", spokenText: "Grund dafür ist das Warten auf Fahrgäste aus einem anderen Zug" },
    { id: 911, file: "011.wav", grund: "Polizeiliche Ermittlung", spokenText: "Grund dafür sind polizeiliche Ermittlungen" },
    { id: 912, file: "012.wav", grund: "Feuerwehreinsatz an Strecke", spokenText: "Grund dafür ist ein Feuerwehreinsatz an der Strecke" },
    { id: 913, file: "013.wav", grund: "ärztliche Versorgung Fahrgast", spokenText: "Grund dafür ist die ärztliche Versorgung eines Fahrgastes" },
    { id: 914, file: "014.wav", grund: "Betätigen der Notbremse", spokenText: "Grund dafür ist das unbefugte Ziehen der Notbremse" },
    { id: 915, file: "015.wav", grund: "Streikauswirkungen", spokenText: "Grund dafür sind Streikauswirkungen" },
    { id: 916, file: "016.wav", grund: "ausgebrochene Tiere im Gleis", spokenText: "Grund dafür sind Tiere im Gleis" },
    { id: 917, file: "017.wav", grund: "Unwetter", spokenText: "Grund dafür ist ein Unwetter" },
    { id: 918, file: "018.wav", grund: "Pass- und Zollkontrolle", spokenText: "Grund dafür ist eine Pass- und Zollkontrolle" },
    { id: 919, file: "019.wav", grund: "Beeinträchtigung d. Vandalismus", spokenText: "Grund dafür sind Vandalismusschäden" },
    { id: 920, file: "020.wav", grund: "Entschärfung einer Fliegerbombe", spokenText: "Grund dafür ist die Entschärfung einer Fliegerbombe" },
    { id: 921, file: "021.wav", grund: "Beschädigung einer Brücke", spokenText: "Grund dafür ist die Beschädigung einer Brücke" },
    { id: 922, file: "022.wav", grund: "umgestürzter Baum im Gleis", spokenText: "Grund dafür ist ein umgestürzter Baum im Gleis" },
    { id: 923, file: "023.wav", grund: "Unfall an einem Bahnübergang", spokenText: "Grund dafür ist ein Unfall an einem Bahnübergang" },
    { id: 924, file: "024.wav", grund: "Tiere im Gleis", spokenText: "Grund dafür sind Tiere im Gleis" },
    { id: 925, file: "025.wav", grund: "Witterungsbedingte Störung", spokenText: "Grund dafür ist eine witterungsbedingte Störung" },
    { id: 926, file: "026.wav", grund: "Feuerwehreinsatz auf Bahngelände", spokenText: "Grund dafür ist ein Feuerwehreinsatz auf dem Bahngelände" },
    { id: 927, file: "027.wav", grund: "Verspätung im Ausland", spokenText: "Grund dafür ist eine Verspätung im Ausland" },
    { id: 928, file: "028.wav", grund: "Warten auf verspätete Zugteile", spokenText: "Grund dafür ist das Warten auf verspätete Zugteile" },
    { id: 929, file: "029.wav", grund: "Verzögerung beim Ein-/Ausstieg", spokenText: "Grund dafür sind Verzögerungen beim Ein- und Ausstieg" },
    { id: 930, file: "030.wav", grund: "Streckensperrung", spokenText: "Grund dafür ist eine Streckensperrung" },
    { id: 931, file: "031.wav", grund: "technische Störung an der Strecke", spokenText: "Grund dafür ist eine technische Störung an der Strecke" },
    { id: 932, file: "032.wav", grund: "Anhängen von zusätzlichen Wagen", spokenText: "Grund dafür ist das Bereitstellen zusätzlicher Wagen" },
    { id: 933, file: "033.wav", grund: "Störung an einem Bahnübergang", spokenText: "Grund dafür ist eine Störung an einem Bahnübergang" },
    { id: 934, file: "034.wav", grund: "apl. Geschwindigkeitsbeschränkung", spokenText: "Grund dafür ist eine vorübergehend verminderte Geschwindigkeit" },
    { id: 935, file: "035.wav", grund: "Verspätung vorausfahrender Zuges", spokenText: "Grund dafür ist die Verspätung eines vorausfahrenden Zuges" },
    { id: 936, file: "036.wav", grund: "Warten entgegenkommender Zug", spokenText: "Grund dafür ist das Warten auf einen entgegenkommenden Zug" },
    { id: 937, file: "037.wav", grund: "Überholung", spokenText: "Grund dafür ist die Überholung durch einen anderen Zug" },
    { id: 938, file: "038.wav", grund: "Warten auf freie Einfahrt", spokenText: "Grund dafür ist das Warten auf ein freies Gleis" },
    { id: 939, file: "039.wav", grund: "verspätete Bereitstellung", spokenText: "Grund dafür ist die verspätete Bereitstellung des Zuges" },
    { id: 940, file: "040.wav", grund: "Verspätung aus vorheriger Fahrt", spokenText: "Grund dafür ist eine Verspätung aus vorheriger Fahrt" },
    { id: 941, file: "041.wav", grund: "techn. Störung an anderem Zug", spokenText: "Grund dafür ist eine technische Störung an einem anderen Zug" },
    { id: 942, file: "042.wav", grund: "Umleitung", spokenText: "Grund dafür ist die Umleitung des Zuges" }
];

/**
 * Mapping von offiziellen modernen DB RIS-Codes (0-99, Typ R) auf Legacy-Audiodateien (001.wav - 042.wav).
 */
export const RIS_TO_LEGACY_REASON_MAP = {
    // 0: Keine Verspätungsbegründung -> kein Audio
    // 1: Nähere Informationen in Kürze -> kein Audio
    "2":  { file: "011.wav", legacyId: 911, text: "Grund dafür sind polizeiliche Ermittlungen" },                      // Polizeieinsatz
    "3":  { file: "012.wav", legacyId: 912, text: "Grund dafür ist ein Feuerwehreinsatz an der Strecke" },            // Feuerwehreinsatz auf der Strecke
    "5":  { file: "013.wav", legacyId: 913, text: "Grund dafür ist die ärztliche Versorgung eines Fahrgastes" },      // Ärztliche Versorgung eines Fahrgastes
    "6":  { file: "014.wav", legacyId: 914, text: "Grund dafür ist das unbefugte Ziehen der Notbremse" },             // Unbefugtes Ziehen der Notbremse
    "7":  { file: "003.wav", legacyId: 903, text: "Grund dafür sind Personen im Gleis" },                              // Unbefugte Personen auf der Strecke
    "8":  { file: "005.wav", legacyId: 905, text: "Grund dafür ist ein Notarzteinsatz am Gleis" },                    // Notarzteinsatz auf der Strecke
    "9":  { file: "015.wav", legacyId: 915, text: "Grund dafür sind Streikauswirkungen" },                             // Streikauswirkungen
    "10": { file: "024.wav", legacyId: 924, text: "Grund dafür sind Tiere im Gleis" },                                 // Tiere auf der Strecke
    "11": { file: "017.wav", legacyId: 917, text: "Grund dafür ist ein Unwetter" },                                   // Unwetter
    "13": { file: "018.wav", legacyId: 918, text: "Grund dafür ist eine Pass- und Zollkontrolle" },                   // Pass- und Zollkontrolle
    "15": { file: "019.wav", legacyId: 919, text: "Grund dafür sind Vandalismusschäden" },                             // Beeinträchtigung durch Vandalismus
    "16": { file: "020.wav", legacyId: 920, text: "Grund dafür ist die Entschärfung einer Fliegerbombe" },            // Entschärfung einer Fliegerbombe
    "17": { file: "021.wav", legacyId: 921, text: "Grund dafür ist die Beschädigung einer Brücke" },                  // Beschädigung einer Brücke
    "18": { file: "022.wav", legacyId: 922, text: "Grund dafür ist ein umgestürzter Baum im Gleis" },                 // Umgestürzter Baum auf der Strecke
    "19": { file: "023.wav", legacyId: 923, text: "Grund dafür ist ein Unfall an einem Bahnübergang" },               // Unfall an einem Bahnübergang
    "21": { file: "010.wav", legacyId: 910, text: "Grund dafür ist das Warten auf Fahrgäste aus einem anderen Zug" }, // Warten auf Anschlussreisende
    "22": { file: "025.wav", legacyId: 925, text: "Grund dafür ist eine witterungsbedingte Störung" },                 // Witterungsbedingte Beeinträchtigungen
    "24": { file: "027.wav", legacyId: 927, text: "Grund dafür ist eine Verspätung im Ausland" },                      // Verspätung im Ausland
    "25": { file: "032.wav", legacyId: 932, text: "Grund dafür ist das Bereitstellen zusätzlicher Wagen" },           // Bereitstellung weiterer Wagen
    "26": { file: "028.wav", legacyId: 928, text: "Grund dafür ist das Warten auf verspätete Zugteile" },             // Abhängen von Wagen
    "28": { file: "009.wav", legacyId: 909, text: "Grund dafür sind Gegenstände im Gleis" },                           // Gegenstände auf der Strecke
    "30": { file: "008.wav", legacyId: 908, text: "Grund dafür ist eine Stellwerksstörung" },                          // Personalausfall im Stellwerk
    "31": { file: "002.wav", legacyId: 902, text: "Grund dafür sind Bauarbeiten" },                                    // Bauarbeiten
    "32": { file: "029.wav", legacyId: 929, text: "Grund dafür sind Verzögerungen beim Ein- und Ausstieg" },           // Längere Haltezeit am Bahnhof
    "33": { file: "006.wav", legacyId: 906, text: "Grund dafür ist eine Oberleitungsstörung" },                       // Reparatur an der Oberleitung
    "34": { file: "007.wav", legacyId: 907, text: "Grund dafür ist eine Signalstörung" },                             // Reparatur an einem Signal
    "35": { file: "030.wav", legacyId: 930, text: "Grund dafür ist eine Streckensperrung" },                          // Streckensperrung
    "36": { file: "004.wav", legacyId: 904, text: "Grund dafür ist eine technische Störung am Zug" },                 // Technische Störung am Zug
    "37": { file: "004.wav", legacyId: 904, text: "Grund dafür ist eine technische Störung am Zug" },                 // Kurzfristiger Fahrzeugausfall
    "38": { file: "031.wav", legacyId: 931, text: "Grund dafür ist eine technische Störung an der Strecke" },         // Reparatur an der Strecke
    "39": { file: "001.wav", legacyId: 901, text: "Grund dafür sind Verzögerungen im Betriebsablauf" },                // Stau / Hohes Verkehrsaufkommen
    "40": { file: "008.wav", legacyId: 908, text: "Grund dafür ist eine Stellwerksstörung" },                         // Defektes Stellwerk
    "41": { file: "033.wav", legacyId: 933, text: "Grund dafür ist eine Störung an einem Bahnübergang" },             // Technischer Defekt an einem Bahnübergang
    "42": { file: "034.wav", legacyId: 934, text: "Grund dafür ist eine vorübergehend verminderte Geschwindigkeit" }, // Vorübergehend verminderte Geschwindigkeit
    "43": { file: "035.wav", legacyId: 935, text: "Grund dafür ist die Verspätung eines vorausfahrenden Zuges" },     // Verspätung eines vorausfahrenden Zuges
    "44": { file: "036.wav", legacyId: 936, text: "Grund dafür ist das Warten auf einen entgegenkommenden Zug" },     // Warten auf einen entgegenkommenden Zug
    "45": { file: "037.wav", legacyId: 937, text: "Grund dafür ist die Überholung durch einen anderen Zug" },         // Vorfahrt eines anderen Zuges
    "47": { file: "039.wav", legacyId: 939, text: "Grund dafür ist die verspätete Bereitstellung des Zuges" },        // Verspätete Bereitstellung des Zuges
    "48": { file: "040.wav", legacyId: 940, text: "Grund dafür ist eine Verspätung aus vorheriger Fahrt" },           // Verspätung aus vorheriger Fahrt
    "52": { file: "015.wav", legacyId: 915, text: "Grund dafür sind Streikauswirkungen" },                             // Streik
    "53": { file: "017.wav", legacyId: 917, text: "Grund dafür ist ein Unwetter" },                                   // Unwetterauswirkungen
    "55": { file: "041.wav", legacyId: 941, text: "Grund dafür ist eine technische Störung an einem anderen Zug" },   // Technischer Defekt an einem anderen Zug
    "58": { file: "042.wav", legacyId: 942, text: "Grund dafür ist die Umleitung des Zuges" },                        // Umleitung des Zuges
    "59": { file: "025.wav", legacyId: 925, text: "Grund dafür ist eine witterungsbedingte Störung" },                 // Schnee und Eis
    "60": { file: "025.wav", legacyId: 925, text: "Grund dafür ist eine witterungsbedingte Störung" },                 // Witterungsbedingt verminderte Geschwindigkeit
    "61": { file: "004.wav", legacyId: 904, text: "Grund dafür ist eine technische Störung am Zug" },                 // Defekte Tür
    "62": { file: "004.wav", legacyId: 904, text: "Grund dafür ist eine behobene technische Störung am Zug" },        // Behobener technischer Defekt am Zug
    "63": { file: "004.wav", legacyId: 904, text: "Grund dafür ist eine technische Untersuchung am Zug" },            // Technische Untersuchung am Zug
    "64": { file: "031.wav", legacyId: 931, text: "Grund dafür ist eine technische Störung an der Strecke" },         // Reparatur an einer Weiche
    "65": { file: "025.wav", legacyId: 925, text: "Grund dafür ist eine witterungsbedingte Störung" },                 // Erdrutsch
    "66": { file: "025.wav", legacyId: 925, text: "Grund dafür ist eine witterungsbedingte Störung" },                 // Hochwasser
    "67": { file: "011.wav", legacyId: 911, text: "Grund dafür sind polizeiliche Ermittlungen" },                      // Behördliche Maßnahme
    "68": { file: "029.wav", legacyId: 929, text: "Grund dafür sind Verzögerungen beim Ein- und Ausstieg" },           // Hohes Fahrgastaufkommen verlängert Ein-/Ausstieg
    "69": { file: "034.wav", legacyId: 934, text: "Grund dafür ist eine verminderte Geschwindigkeit" },               // Zug verkehrt mit verminderter Geschwindigkeit
    "99": { file: "001.wav", legacyId: 901, text: "Grund dafür sind Verzögerungen im Betriebsablauf" }                 // Verzögerungen im Betriebsablauf
};

const _legacyById = new Map(LEGACY_AUDIO_REASONS.map(r => [String(r.id), r]));
const _legacyByFile = new Map(LEGACY_AUDIO_REASONS.map(r => [r.file.toLowerCase(), r]));

/**
 * Löst einen Verspätungsgrund anhand von Code und/oder Text in ein passendes Audio-Objekt auf.
 * @param {string|number} [code] - RIS-Code (z.B. "34") oder 900er Legacy-ID (z.B. "907")
 * @param {string} [text] - Der textuelle Verspätungsgrund
 * @returns {{ file: string|null, text: string, legacyId: number|null }}
 */
export function resolveDelayReasonAudio(code, text = '') {
    const cleanCode = code !== undefined && code !== null ? String(code).trim() : '';
    const cleanText = (text || '').trim();

    // 1. Direkt per 900er Legacy-ID (z.B. 907 -> 007.wav)
    if (cleanCode && _legacyById.has(cleanCode)) {
        const item = _legacyById.get(cleanCode);
        return {
            file: item.file,
            text: item.spokenText || item.grund,
            legacyId: item.id
        };
    }

    // 2. Per offiziellem RIS-Code (z.B. "34" -> 007.wav)
    if (cleanCode && RIS_TO_LEGACY_REASON_MAP[cleanCode]) {
        const match = RIS_TO_LEGACY_REASON_MAP[cleanCode];
        return {
            file: match.file,
            text: match.text,
            legacyId: match.legacyId
        };
    }

    // 3. Fallback: Suche nach Textähnlichkeit in den Legacy-Gründen
    if (cleanText) {
        const lower = cleanText.toLowerCase();

        // 3a. Exakter Abgleich mit Grund oder gesprochenem Text
        for (const item of LEGACY_AUDIO_REASONS) {
            if (item.grund.toLowerCase() === lower || (item.spokenText && item.spokenText.toLowerCase() === lower)) {
                return {
                    file: item.file,
                    text: item.spokenText || item.grund,
                    legacyId: item.id
                };
            }
        }

        // 3b. Phrasen-Inklusion (eingegebener Text enthält den Grund, oder bei >= 5 Zeichen umgekehrt)
        for (const item of LEGACY_AUDIO_REASONS) {
            const legLower = item.grund.toLowerCase();
            if (lower.includes(legLower) || (lower.length >= 5 && legLower.includes(lower))) {
                return {
                    file: item.file,
                    text: item.spokenText || item.grund,
                    legacyId: item.id
                };
            }
        }

        // 3c. Suche in den RIS-Texten der Mapping-Tabelle
        for (const [rCode, rMatch] of Object.entries(RIS_TO_LEGACY_REASON_MAP)) {
            if (rMatch.text) {
                const matchLower = rMatch.text.toLowerCase();
                if (lower === matchLower || lower.includes(matchLower) || (lower.length >= 5 && matchLower.includes(lower))) {
                    return {
                        file: rMatch.file,
                        text: rMatch.text,
                        legacyId: rMatch.legacyId
                    };
                }
            }
        }
    }

    // 4. TTS-Fallback (Text-to-Speech) ohne feste Datei
    let ttsText = cleanText ? `Grund dafür ist ${cleanText}` : "Grund dafür sind Verzögerungen im Betriebsablauf";
    return {
        file: null,
        text: ttsText,
        legacyId: null
    };
}
