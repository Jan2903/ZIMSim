import { measureTextLines } from '../../../displays/core/textUtils.js';

/**
 * Service für Zwischenhalte-Auswahl (Vias) für Monitore und Audioansagen.
 */
export class JourneyViaService {
    /**
     * Prüft, ob ein gegebener Halt inhaltlich dem Zielbahnhof entspricht.
     * @param {object} journey - Die Journey
     * @param {object} stop - Der zu prüfende Halt
     * @returns {boolean}
     */
    static isDestinationStop(journey, stop) {
        if (!stop || !stop.name) return false;
        if (!journey || !journey.destination) return false;

        const sName = stop.name.toLowerCase().trim();
        const dests = [
            (journey.destination || '').toLowerCase().trim(),
            (journey.destinationLang || '').toLowerCase().trim(),
            (journey.destinationKurz || '').toLowerCase().trim()
        ].filter(Boolean);

        for (const d of dests) {
            if (sName === d || sName.includes(d) || d.includes(sName)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Ermittelt alle potenziell als Zwischenhalt in Frage kommenden Halte ab dem Startindex.
     * Filtert Ausfälle, Nur-Ausstiegshalte und das Ziel aus (DRY für Display- und Audio-Vias).
     * @param {object} journey - Die Journey
     * @param {number|null} [startIndex=null] - Startindex in der Halteliste
     * @returns {Array} Liste der Kandidaten-Stops
     */
    static filterCandidateStops(journey, startIndex = null) {
        if (!journey || !journey.stops || journey.stops.length === 0) return [];

        const startIdx = startIndex !== null
            ? startIndex
            : (journey._currentStopIndex >= 0 ? journey._currentStopIndex + 1 : 0);

        if (startIdx >= journey.stops.length) return [];

        return journey.stops.slice(startIdx).filter(s => {
            if (s.cancelled && !journey.isCancelled) return false;
            if (s.boardingType === 'ein') return false;
            if (this.isDestinationStop(journey, s)) return false;
            return true;
        });
    }

    /**
     * Setzt die "showAsVia" Flags der Halte dynamisch basierend auf der Priorität
     * (Kategorie aus stations.csv) und dem verfügbaren Platz auf den Canvas-Monitoren.
     * @param {object} journey - Die Journey
     * @param {object} [options={}] - Optionale Konfiguration für Monitor-Breiten und Zeilenlimits
     */
    static autoGenerateVias(journey, options = {}) {
        if (!journey || !journey.stops || journey.stops.length === 0) return;

        // Zurücksetzen
        journey.stops.forEach(s => { s.showAsVia = false; });

        const candidateStops = this.filterCandidateStops(journey);
        if (candidateStops.length === 0) return;

        const mainWidth = options.mainWidth || 1800;
        const sideWidth = options.sideWidth || 880;
        const maxLinesMain = options.maxLinesMain || 2;
        const maxLinesSide = options.maxLinesSide || 3;
        const font = options.font || 'normal 75px "Open Sans Condensed", sans-serif';

        // Nach Kategorie sortieren (Wichtigste zuerst)
        const sortedCandidates = [...candidateStops].sort((a, b) => a.stationCategory - b.stationCategory);
        let selected = [];

        for (const candidate of sortedCandidates) {
            selected.push(candidate);

            // IMMER chronologisch sortieren für die Anzeige
            selected.sort((a, b) => a.routeIndex - b.routeIndex);

            const viaText = selected.map(s => s.nameKurz || s.name).join(' - ');

            const linesMain = measureTextLines(viaText, mainWidth, font);
            const linesSide = measureTextLines(viaText, sideWidth, font);

            if (linesMain > maxLinesMain || linesSide > maxLinesSide) {
                // Passt nicht mehr! Wieder entfernen und aufhören
                selected = selected.filter(s => s !== candidate);
                break;
            }
        }

        selected.forEach(s => { s.showAsVia = true; });
    }

    /**
     * Setzt die "audioVia" Flags der Halte automatisch basierend auf sortMode (1 = Priorisiert, 2 = Standard).
     * @param {object} journey - Die Journey
     * @param {number} maxCount - Maximale Anzahl (0-6, wobei 6 = alle bedeutet)
     * @param {number} sortMode - 1 = Nach Priorität (Kategorie), 2 = Chronologisch
     */
    static autoGenerateAudioVias(journey, maxCount, sortMode = 2) {
        if (!journey || !journey.stops || journey.stops.length === 0) return;

        // Zurücksetzen
        journey.stops.forEach(s => { s.audioVia = false; });

        let candidateStops = this.filterCandidateStops(journey);
        if (candidateStops.length === 0) return;

        if (sortMode === 1) {
            // Priorisiert (Kategorie)
            candidateStops.sort((a, b) => a.stationCategory - b.stationCategory);
        }
        // bei Standard (2) bleibt es chronologisch

        let limit = maxCount;
        if (limit === 6) {
            limit = candidateStops.length;
        } else if (limit < 0) {
            limit = 0;
        }

        const selected = candidateStops.slice(0, limit);
        selected.forEach(s => { s.audioVia = true; });
    }
}
