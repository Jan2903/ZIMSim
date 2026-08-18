export class StationService {
    static stations = [];
    static isLoaded = false;

    /**
     * Lädt die stations.csv asynchron und parst sie in den Speicher.
     */
    static async loadStations() {
        if (this.isLoaded) return;
        try {
            const response = await fetch('/stations/stations.csv');
            const csvText = await response.text();
            this.parseCSV(csvText);
            this.isLoaded = true;
            console.log(`[StationService] Erfolgreich ${this.stations.length} Stationen geladen.`);
        } catch (error) {
            console.error('[StationService] Fehler beim Laden der stations.csv:', error);
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
                    kategorie: parseInt(cols[4].trim()) || 99 // Standard Kategorie falls fehlerhaft
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
        
        // Filtere die Stationen
        const results = [];
        for (const station of this.stations) {
            
            // Suche in Name, Aliasen, Name kurz, DS100 und IBNR
            const matchesAlias = station.aliases.some(alias => alias.toLowerCase().includes(lowerQuery));
            if (matchesAlias ||
                station.nameKurz.toLowerCase().includes(lowerQuery) ||
                station.ds100.toLowerCase().includes(lowerQuery) ||
                station.ibnr.includes(lowerQuery)) {
                
                results.push(station);
            }
        }

        // Sortiere nach Kategorie (aufsteigend = wichtiger zuerst)
        results.sort((a, b) => a.kategorie - b.kategorie);

        return results.slice(0, limit);
    }

    /**
     * Normalisiert einen String für den flexiblen Vergleich (entfernt Leerzeichen und wandelt in Kleinbuchstaben um).
     */
    static normalizeName(name) {
        if (!name) return '';
        return name.toLowerCase().replace(/\s+/g, '');
    }

    /**
     * Sucht nach einer Station anhand von extId (IBNR) oder exaktem Namen (ignoriert Leerzeichen).
     * @param {string} extId 
     * @param {string} name 
     * @returns {object|null}
     */
    static getStationByIdOrName(extId, name) {
        if (!this.stations || this.stations.length === 0) return null;
        
        let found = null;
        if (extId) {
            found = this.stations.find(s => s.ibnr === extId);
        }
        if (!found && name) {
            const normName = this.normalizeName(name);
            found = this.stations.find(s => {
                const matchesAlias = s.aliases.some(alias => this.normalizeName(alias) === normName);
                return matchesAlias || this.normalizeName(s.nameKurz) === normName;
            });
        }
        return found;
    }
}
