import { journeyStore } from '../../core/state/stores.js';
import { ansagenStore } from '../../audio/ansagenStore.svelte.js';

export class StationService {
    static stations = [];
    static isLoaded = false;
    
    // Performance-Indexierung & Lookup-Cache ($O(1)$)
    static _ibnrMap = new Map();
    static _nameMap = new Map();
    static _kurzNameMap = new Map();
    static _lookupCache = new Map();

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
            this.clearCache();
            console.log(`[StationService] Erfolgreich ${this.stations.length} Stationen geladen (DB & Extended).`);

            // Nachträgliches Anreichern bereits existierender Züge (z.B. Demo-Daten oder Preset)
            if (journeyStore && journeyStore.journeys) {
                for (const j of journeyStore.journeys) {
                    if (j.stops) {
                        j.stops.forEach(s => s.enrichWithStationData());
                    }
                    if (!j.ankunft && j.stops && j.stops.length > 0) {
                        if (!j.stops.some(s => s.audioVia)) {
                            j.autoGenerateAudioVias(ansagenStore.effectiveMaxVias, ansagenStore.viaSortMode, ansagenStore.allVias);
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

                const stationObj = {
                    ibnr: cols[0].trim(),
                    name: primaryName,
                    aliases: aliases,
                    nameKurz: cols[2].trim(),
                    ds100: cols[3].trim(),
                    kategorie: parseInt(cols[4].trim()) || 7 // Standard Kategorie falls fehlerhaft
                };
                this.stations.push(stationObj);
                this._indexStation(stationObj);
            }
        }
    }

    /**
     * Fügt eine Station zu den internen Lookup-Maps hinzu.
     * Bevorzugt Stationen mit niedrigerer (wichtigerer) Kategorie bei Namenskonflikten.
     * Speichert pre-normalisierte Namen am Objekt, um teure Laufzeit-Regexes zu vermeiden.
     * @private
     * @param {object} station
     */
    static _indexStation(station) {
        if (!station) return;

        // Pre-Normalisierung am Objekt für O(1)- und schnelle Teilstring-Vergleiche
        station.normName = this.normalizeName(station.name);
        station.normKurz = station.nameKurz ? this.normalizeName(station.nameKurz) : '';

        if (station.ibnr) {
            this._ibnrMap.set(station.ibnr, station);
        }

        const normName = station.normName;
        if (normName) {
            const existing = this._nameMap.get(normName);
            if (!existing || station.kategorie < existing.kategorie) {
                this._nameMap.set(normName, station);
            }
        }

        if (station.aliases && station.aliases.length > 0) {
            for (const alias of station.aliases) {
                const normAlias = this.normalizeName(alias);
                if (normAlias) {
                    const existing = this._nameMap.get(normAlias);
                    if (!existing || station.kategorie < existing.kategorie) {
                        this._nameMap.set(normAlias, station);
                    }
                }
            }
        }

        if (station.normKurz) {
            const existing = this._kurzNameMap.get(station.normKurz);
            if (!existing || station.kategorie < existing.kategorie) {
                this._kurzNameMap.set(station.normKurz, station);
            }
        }
    }

    /**
     * Leert den dynamischen Lookup-Cache.
     */
    static clearCache() {
        this._lookupCache.clear();
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
        if (!this.stations || (this.stations.length === 0 && (!journeyStore?.customStations || journeyStore.customStations.length === 0))) {
            return null;
        }

        // 1. Direktzugriff über Lookup-Cache ($O(1)$) - sofort ohne teure Array-Allokationen
        const cacheKey = extId ? `ibnr:${extId}` : `name:${name}`;
        if (this._lookupCache.has(cacheKey)) {
            return this._lookupCache.get(cacheKey);
        }
        
        let found = null;
        if (extId) {
            found = this._ibnrMap.get(extId) || (journeyStore?.customStations ? journeyStore.customStations.find(s => s.ibnr === extId) : null) || null;
        }
        if (!found && name) {
            const normName = this.normalizeName(name);
            
            // 1. Exakter Match auf vor-normalisierten Namen oder Aliase ($O(1)$)
            found = this._nameMap.get(normName) || null;

            // 2. Match auf vor-normalisierten nameKurz ($O(1)$)
            if (!found) {
                found = this._kurzNameMap.get(normName) || null;
            }

            // 2b. Prüfe Custom Stations (falls neu angelegt und noch nicht indiziert)
            if (!found && journeyStore?.customStations && journeyStore.customStations.length > 0) {
                const customMatch = journeyStore.customStations.find(s => {
                    const matchesAlias = (s.aliases || []).some(alias => this.normalizeName(alias) === normName);
                    return matchesAlias || this.normalizeName(s.name) === normName || this.normalizeName(s.nameKurz) === normName;
                });
                if (customMatch) found = customMatch;
            }

            // 3. Fallback: Schneller Substring-Match über pre-normalisierte Eigenschaften (ohne Laufzeit-Regexes!)
            if (!found && normName.length > 3) {
                const subMatches = [];
                for (let i = 0; i < this.stations.length; i++) {
                    const s = this.stations[i];
                    const normCsvName = s.normName || '';
                    const normCsvKurz = s.normKurz || '';
                    if ((normCsvName && (normName.includes(normCsvName) || normCsvName.includes(normName))) ||
                        (normCsvKurz && (normName.includes(normCsvKurz) || normCsvKurz.includes(normName)))) {
                        subMatches.push(s);
                    }
                }
                if (subMatches.length > 0) {
                    subMatches.sort((a, b) => a.kategorie - b.kategorie);
                    found = subMatches[0];
                }
            }
        }

        // Im Cache ablegen (auch null-Treffer, um wiederholte teure Misses zu verhindern)
        this._lookupCache.set(cacheKey, found);
        return found;
    }
}
