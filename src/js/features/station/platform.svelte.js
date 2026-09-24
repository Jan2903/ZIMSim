/**
 * Verfügbare Bahnsteigabschnitts-Bezeichner im deutschen Schienennetz (A bis K).
 * Typisch sind A–E bzw. A–G, lange Bahnsteige nutzen bis zu K.
 */
export const AVAILABLE_SECTOR_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

/**
 * Repräsentiert eine Bahnsteigkonfiguration inkl. Gesamtlänge, Standort und Abschnitten.
 */
export class Platform {
    name = $state('');
    length = $state(400);
    currentLocation = $state(100);
    sections = $state([]);

    /**
     * @param {object} [data={}] - Initialdaten für den Bahnsteig
     */
    constructor(data = {}) {
        this.name = data.name || '';
        this.length = typeof data.length === 'number' && data.length > 0 ? data.length : 400;
        this.currentLocation = typeof data.currentLocation === 'number' ? data.currentLocation : 100;
        
        // Standard-Sektoren, falls nichts übergeben wird
        if (Array.isArray(data.sections) && data.sections.length > 0) {
            this.sections = data.sections.map(s => ({
                name: s.name || 'A',
                startMeter: Number(s.startMeter) || 0,
                endMeter: Number(s.endMeter) || 100,
                cubePosition: (s.cubePosition !== undefined && s.cubePosition !== null && s.cubePosition !== '') 
                    ? Number(s.cubePosition) 
                    : null
            }));
        } else {
            this.sections = [
                // Standard-Sektoren, falls nichts übergeben wird
                { name: 'A', startMeter: 0, endMeter: 100, cubePosition: 50 },
                { name: 'B', startMeter: 100, endMeter: 180, cubePosition: 150 },
                { name: 'C', startMeter: 180, endMeter: 220, cubePosition: 200 },
                { name: 'D', startMeter: 220, endMeter: 300, cubePosition: 250 },
                { name: 'E', startMeter: 300, endMeter: 400, cubePosition: 350 }
            ];
        }
    }

    /**
     * Gibt den nächsten verfügbaren Buchstaben für einen neuen Abschnitt zurück (A bis K).
     * @returns {string|null} Der nächste Buchstabe oder null, falls K erreicht ist.
     */
    getNextAvailableLetter() {
        if (this.sections.length >= AVAILABLE_SECTOR_LETTERS.length) {
            return null;
        }
        return AVAILABLE_SECTOR_LETTERS[this.sections.length];
    }

    /**
     * Fügt den nächsten logischen Abschnitt hinzu (z. B. F nach E).
     * Setzt den Startmeter nahtlos an das Ende des vorherigen Abschnitts.
     * @returns {object|null} Der neu erstellte Abschnitt oder null, wenn Limit erreicht.
     */
    addSection() {
        const nextLetter = this.getNextAvailableLetter();
        if (!nextLetter) return null;

        let startMeter = 0;
        let endMeter = 100;

        if (this.sections.length > 0) {
            const lastSection = this.sections[this.sections.length - 1];
            startMeter = Number(lastSection.endMeter) || 0;
            // Standardmäßig 80m Abschnittslänge, maximal Bahnsteiglänge
            endMeter = Math.max(startMeter + 40, Math.min(startMeter + 80, this.length));
            if (endMeter <= startMeter) {
                endMeter = startMeter + 50;
            }
            if (endMeter > this.length) {
                this.length = endMeter;
            }
        }

        const newSec = {
            name: nextLetter,
            startMeter,
            endMeter,
            cubePosition: null // Fallback: (startMeter + endMeter) / 2
        };

        this.sections.push(newSec);
        return newSec;
    }

    /**
     * Entfernt einen Abschnitt am angegebenen Index und nummeriert die Buchstaben fortlaufend neu.
     * @param {number} index - Index des zu entfernenden Abschnitts
     * @returns {boolean} True wenn erfolgreich entfernt
     */
    removeSection(index) {
        if (this.sections.length <= 1) return false;
        if (index < 0 || index >= this.sections.length) return false;

        this.sections.splice(index, 1);

        // Buchstaben alphabetisch fortlaufend halten (A, B, C...)
        this.sections.forEach((sec, idx) => {
            sec.name = AVAILABLE_SECTOR_LETTERS[idx] || String.fromCharCode(65 + idx);
        });

        return true;
    }

    /**
     * Verteilt alle vorhandenen Abschnitte gleichmäßig über die gesamte Bahnsteiglänge.
     * @returns {void}
     */
    distributeEvenly() {
        const count = this.sections.length;
        if (count === 0) return;

        const totalLength = this.length || 400;
        const step = Math.round(totalLength / count);

        this.sections.forEach((sec, idx) => {
            sec.startMeter = idx * step;
            sec.endMeter = (idx === count - 1) ? totalLength : (idx + 1) * step;
            sec.cubePosition = null; // Auf berechnete Mitte zurücksetzen
        });
    }

    /**
     * Richtet alle Abschnitte nahtlos aneinander aus (Start[i] = Ende[i-1]).
     * @returns {void}
     */
    alignSeamlessly() {
        if (!this.sections || this.sections.length <= 1) return;
        for (let i = 1; i < this.sections.length; i++) {
            this.sections[i].startMeter = Number(this.sections[i - 1].endMeter) || 0;
            if (this.sections[i].endMeter <= this.sections[i].startMeter) {
                this.sections[i].endMeter = this.sections[i].startMeter + 50;
            }
        }
        const last = this.sections[this.sections.length - 1];
        if (last && last.endMeter > this.length) {
            this.length = last.endMeter;
        }
    }

    /**
     * Setzt die Abschnitte auf den klassischen DB-Standard A–E zurück.
     * @returns {void}
     */
    resetToDefault() {
        const len = this.length || 400;
        this.sections = [
            { name: 'A', startMeter: 0, endMeter: Math.round(len * 0.25), cubePosition: null },
            { name: 'B', startMeter: Math.round(len * 0.25), endMeter: Math.round(len * 0.45), cubePosition: null },
            { name: 'C', startMeter: Math.round(len * 0.45), endMeter: Math.round(len * 0.55), cubePosition: null },
            { name: 'D', startMeter: Math.round(len * 0.55), endMeter: Math.round(len * 0.75), cubePosition: null },
            { name: 'E', startMeter: Math.round(len * 0.75), endMeter: len, cubePosition: null }
        ];
    }

    /**
     * Erstellt eine tiefe Kopie dieser Bahnsteigkonfiguration.
     * @param {string} [newName] - Optionaler neuer Name
     * @returns {Platform}
     */
    clone(newName) {
        return new Platform({
            name: newName || this.name,
            length: this.length,
            currentLocation: this.currentLocation,
            sections: this.sections.map(s => ({ ...s }))
        });
    }
}