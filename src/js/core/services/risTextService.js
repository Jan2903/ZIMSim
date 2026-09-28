// js/utils/risTextService.js
import { RIS_PRESETS } from '../constants/risPresets.js';

export class RisTextService {
    static presets = RIS_PRESETS;
    static isLoaded = true;
    static _codeMap = new Map(RIS_PRESETS.map(p => [p.code, p]));

    /**
     * Lädt die RIS_Texte (synchron über vorkompilierte Konstanten verfügbar, rückwärtskompatible Signatur).
     */
    static async load() {
        return Promise.resolve();
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
                const preset = {
                    code: cols[0].trim(),
                    type: cols[1].trim(), // 'R' oder 'Q'
                    text: cols[2].trim()
                };
                this.presets.push(preset);
                if (!this._codeMap.has(preset.code)) {
                    this._codeMap.set(preset.code, preset);
                }
            }
        }
    }

    static _codeMap = new Map();

    /**
     * Sucht ein Preset anhand seines Codes ($O(1)$).
     * @param {string} code
     * @returns {object|null}
     */
    static getPresetByCode(code) {
        if (!code) return null;
        return this._codeMap.get(code) || null;
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
