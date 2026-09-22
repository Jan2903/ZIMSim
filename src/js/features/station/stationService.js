import { journeyStore } from '../../core/state/stores.js';
import { ansagenStore } from '../../audio/ansagenStore.svelte.js';

export class StationService {
    static stations = [];
    static isLoaded = false;

    /**
     * Lädt die stations.csv asynchron und parst sie in den Speicher.
     */
    static async loadStations() {
        if (this.isLoaded) return;
        try {
            const [baseRes, extRes] = await Promise.all([
                fetch(import.meta.env.BASE_URL + 'stations/stations.csv'),
                fetch(import.meta.env.BASE_URL + 'stations/stations_ext.csv').catch(() => null)
            ]);

            if (baseRes && baseRes.ok) {
                const csvText = await baseRes.text();
                this.parseCSV(csvText);
            }

            if (extRes && extRes.ok) {
                const extCsvText = await extRes.text();
                this.parseCSV(extCsvText);
            }

            this.isLoaded = true;
            console.log(`[StationService] Erfolgreich ${this.stations.length} Stationen geladen (DB & Extended).`);

            // Nachträgliches Anreichern bereits existierender Züge (z.B. Demo-Daten oder Preset)
            if (journeyStore && journeyStore.journeys) {
                for (const j of journeyStore.journeys) {
                    if (j.stops) {
                        j.stops.forEach(s => s.enrichWithStationData());
                    }
                    if (!j.ankunft && j.stops && j.stops.length > 0) {
                        if (!j.stops.some(s => s.audioVia)) {
                            j.autoGenerateAudioVias(ansagenStore.maxVias, ansagenStore.viaSortMode);
                        }
                        if (!j.stops.some(s => s.showAsVia)) {
                            j.autoGenerateVias();
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[StationService] Fehler beim Laden der Stationsdaten:', error);
        }
    }

    /**
     * Parst die einfache CSV-Struktur.
     * Header: INBR,Name,Name kurz,DS100,Kategorie
     */
    static parseCSV(csvText) {
        // Split nach Zeilenumbrüchen (unterstützt \n und \r\n)
        const lines = csvText.split(/\r?\n/);
        
        // Überspringe den Header (i = 1)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(',');
            // Erwartetes Format: INBR, Name, Name kurz, DS100, Kategorie
            if (cols.length >= 5) {
                const nameField = cols[1].trim();
                // Unterstütze "<>" Syntax für API-Name <> Anzeige-Langname
                const names = nameField.split('<>').map(n => n.trim());
                const primaryName = names.length > 1 ? names[1] : names[0]; // Rechte Seite als Anzeige-Name (oder Original wenn kein <>)
                const aliases = names;

                this.stations.push({
                    ibnr: cols[0].trim(),
                    name: primaryName,
                    aliases: aliases,
                    nameKurz: cols[2].trim(),
                    ds100: cols[3].trim(),
                    kategorie: parseInt(cols[4].trim()) || 7 // Standard Kategorie falls fehlerhaft
                });
            }
        }
    }

    /**
     * Sucht nach Stationen, die den Suchbegriff enthalten.
     * @param {string} query - Suchbegriff
     * @param {number} limit - Maximale Anzahl an Ergebnissen
     * @returns {Array} Gefilterte Stationen
     */
    static searchStations(query, limit = 50) {
        if (!query || query.length < 2) return [];
        
        const lowerQuery = query.toLowerCase();
        
        // Kombiniere statische und custom Stationen
        const allStations = [...this.stations, ...journeyStore.customStations];
        
        // Filtere die Stationen
        const results = [];
        for (const station of allStations) {
            
            // Suche in Name, Aliasen, Name kurz, DS100 und IBNR
            const matchesAlias = (station.aliases || []).some(alias => alias.toLowerCase().includes(lowerQuery));
            if (matchesAlias ||
                (station.nameKurz && station.nameKurz.toLowerCase().includes(lowerQuery)) ||
                (station.ds100 && station.ds100.toLowerCase().includes(lowerQuery)) ||
                (station.ibnr && station.ibnr.includes(lowerQuery)) ||
                (station.name && station.name.toLowerCase().includes(lowerQuery))) {
                
                results.push(station);
            }
        }

        // Sortiere nach Kategorie (aufsteigend = wichtiger zuerst)
        results.sort((a, b) => a.kategorie - b.kategorie);

        return results.slice(0, limit);
    }

    /**
     * Normalisiert einen String für den flexiblen Vergleich (entfernt Leerzeichen, Sonderzeichen und vereinheitlicht Begriffe).
     */
    static normalizeName(name) {
        if (!name) return '';
        return name.toLowerCase()
            .replace(/straße|strasse/gi, 'str')
            .replace(/hauptbahnhof/gi, 'hbf')
            .replace(/fernbahnhof|fernbhf|fernbf/gi, 'fernbhf')
            .replace(/regionalbahnhof|regiobhf|regiobf/gi, 'regiobf')
            .replace(/\(m\)/gi, 'm')
            .replace(/\(main\)/gi, 'm')
            .replace(/am\s*main/gi, 'm')
            .replace(/\(oder\)/gi, 'oder')
            .replace(/am\s*oder/gi, 'oder')
            .replace(/[\s\(\)\-\.,]/g, '');
    }

    /**
     * Sucht nach einer Station anhand von extId (IBNR) oder Namen (ignoriert Leerzeichen und Sonderzeichen).
     * Bevorzugt bei Mehrfachtreffern automatisch wichtigere Stationen (niedrigste DB-Kategorie).
     * @param {string} extId 
     * @param {string} name 
     * @returns {object|null}
     */
    static getStationByIdOrName(extId, name) {
        const allStations = [...this.stations, ...journeyStore.customStations];
        if (!allStations || allStations.length === 0) return null;
        
        let found = null;
        if (extId) {
            found = allStations.find(s => s.ibnr === extId);
        }
        if (!found && name) {
            const normName = this.normalizeName(name);
            
            // 1. Exakter Match auf normalisierten Namen oder Aliase (niedrigste Kategorie zuerst)
            const exactMatches = allStations.filter(s => {
                const matchesAlias = (s.aliases || []).some(alias => this.normalizeName(alias) === normName);
                return matchesAlias || this.normalizeName(s.name) === normName;
            });
            if (exactMatches.length > 0) {
                exactMatches.sort((a, b) => a.kategorie - b.kategorie);
                found = exactMatches[0];
            }

            // 2. Match auf nameKurz
            if (!found) {
                const kurzMatches = allStations.filter(s => this.normalizeName(s.nameKurz) === normName);
                if (kurzMatches.length > 0) {
                    kurzMatches.sort((a, b) => a.kategorie - b.kategorie);
                    found = kurzMatches[0];
                }
            }

            // 3. Fallback: Substring Match (z.B. für "Berlin Hbf (tief)" oder ähnliches)
            if (!found && normName.length > 3) {
                const subMatches = allStations.filter(s => {
                    const normCsvName = this.normalizeName(s.name);
                    const normCsvKurz = this.normalizeName(s.nameKurz);
                    return (normName.includes(normCsvName) || normCsvName.includes(normName)) ||
                           (normCsvKurz && (normName.includes(normCsvKurz) || normCsvKurz.includes(normName)));
                });
                if (subMatches.length > 0) {
                    subMatches.sort((a, b) => a.kategorie - b.kategorie);
                    found = subMatches[0];
                }
            }
        }
        return found;
    }
}
