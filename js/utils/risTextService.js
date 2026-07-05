// js/utils/risTextService.js

export class RisTextService {
    static presets = [];
    static isLoaded = false;

    /**
     * Lädt die RIS_Texte.csv asynchron und parst sie in den Speicher.
     */
    static async load() {
        if (this.isLoaded) return;
        try {
            const response = await fetch('stations/RIS_Texte.csv');
            const arrayBuffer = await response.arrayBuffer();
            // Windows-1252 / ISO-8859-1 decoding for ANSI
            const decoder = new TextDecoder('windows-1252');
            const csvText = decoder.decode(arrayBuffer);
            
            this.parseCSV(csvText);
            this.isLoaded = true;
            console.log(`[RisTextService] Erfolgreich ${this.presets.length} Presets geladen.`);
        } catch (error) {
            console.error('[RisTextService] Fehler beim Laden der RIS_Texte.csv:', error);
        }
    }

    /**
     * Parst die einfache CSV-Struktur.
     * Header: Code;Typ;Grund
     */
    static parseCSV(csvText) {
        const lines = csvText.split(/\r?\n/);
        
        // Überspringe den Header (i = 1)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // CSV verwendet Semikolon als Trennzeichen
            const cols = line.split(';');
            if (cols.length >= 3) {
                this.presets.push({
                    code: cols[0].trim(),
                    type: cols[1].trim(), // 'R' oder 'Q'
                    text: cols[2].trim()
                });
            }
        }
    }

    /**
     * Gibt alle Presets eines bestimmten Typs zurück.
     * @param {string} type 'R' (Verspätungsgrund) oder 'Q' (Qualitätsabweichung/Lauftext)
     * @returns {Array} Liste von Presets
     */
    static getPresetsByType(type) {
        if (!this.presets || this.presets.length === 0) return [];
        return this.presets.filter(p => p.type === type);
    }
}
