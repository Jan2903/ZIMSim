import { FONTS } from '../../../core/constants/theme.js';
import { measureTextLines } from '../../../core/utils/textMeasure.js';

/**
 * Service für Zwischenhalte-Auswahl (Vias) für Monitore und Audioansagen.
 */
export class JourneyViaService {
    /**
     * Normalisiert einen Stationsnamen für den exakten Vergleich.
     * Entfernt Klammerzusätze, vereinheitlicht Hbf/Straße und ignoriert
     * Leerzeichen sowie gängige Trennzeichen.
     * @param {string} name - Stationsname
     * @returns {string} Normalisierter Name
     */
    static _normalizeStationName(name) {
        if (!name) return '';
        return String(name).toLowerCase()
            .replace(/\([^)]*\)/g, ' ')
            .replace(/hauptbahnhof/g, 'hbf')
            .replace(/straße|strasse/g, 'str')
            .replace(/[\s\-.,]/g, '');
    }

    /**
     * Prüft, ob ein gegebener Halt inhaltlich dem Zielbahnhof entspricht.
     * Bevorzugt den IBNR-Vergleich; fällt sonst auf exakte normalisierte
     * Namensgleichheit zurück (kein Substring-Match mehr).
     * @param {object} journey - Die Journey
     * @param {object} stop - Der zu prüfende Halt
     * @returns {boolean}
     */
    static isDestinationStop(journey, stop) {
        if (!stop || !journey) return false;

        // IBNR ist die zuverlässigste Identität, sofern auf beiden Seiten vorhanden.
        const stopIbnr = String(stop.extId || '').trim();
        const destIbnr = String(journey.destinationIbnr || '').trim();
        if (stopIbnr && destIbnr && stopIbnr === destIbnr) {
            return true;
        }

        const stopNames = [stop.name, stop.nameKurz]
            .filter(Boolean)
            .map(n => this._normalizeStationName(n))
            .filter(Boolean);
        if (stopNames.length === 0) return false;

        const destNames = [journey.destination, journey.destinationLang, journey.destinationKurz]
            .filter(Boolean)
            .map(n => this._normalizeStationName(n))
            .filter(Boolean);

        return stopNames.some(sName => destNames.includes(sName));
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

        const lastStop = journey.stops[journey.stops.length - 1];

        return journey.stops.slice(startIdx).filter(s => {
            if (s.cancelled && !journey.isCancelled) return false;
            if (s.boardingType === 'ein') return false;
            // Der letzte Halt einer Abfahrt ist immer der Zielbahnhof.
            if (s === lastStop) return false;
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

        // Zurücksetzen (auto-generierte Auswahl hebt eine manuelle Markierung auf)
        journey.stops.forEach(s => {
            s.showAsVia = false;
            s.viaManual = false;
        });

        const candidateStops = this.filterCandidateStops(journey);
        if (candidateStops.length === 0) return;

        const mainWidth = options.mainWidth || 1800;
        const sideWidth = options.sideWidth || 880;
        const maxLinesMain = options.maxLinesMain || 2;
        const maxLinesSide = options.maxLinesSide || 3;
        const font = options.font || FONTS.regular(75);

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
     * Wählt Vias für einen konkreten Anzeigebereich aus, ohne den Store zu verändern.
     * So kann jeder Renderer seine tatsächlich verfügbare Breite, Zeilenanzahl und
     * Schriftart übergeben. Es wird nur ausgewählt, nie zurückgeschrieben.
     *
     * @param {object} journey - Die Journey
     * @param {object} [options={}] - Platz- und Darstellungsoptionen
     * @param {number} [options.maxWidth=0] - Verfügbare Textbreite in Pixeln
     * @param {number} [options.maxLines=1] - Maximale Anzahl Textzeilen
     * @param {string} [options.font=FONTS.regular(75)] - Verwendete Schrift
     * @param {string} [options.separator=' - '] - Trenner zwischen den Via-Namen
     * @param {string} [options.prefix=''] - Präfix, das bei der Breitenmessung berücksichtigt wird (z. B. "über ")
     * @param {number} [options.maxCount=Infinity] - Optionale Obergrenze der Via-Anzahl
     * @returns {Array<object>} Ausgewählte Stops in chronologischer Reihenfolge
     */
    static getDisplayVias(journey, options = {}) {
        if (!journey) return [];

        const maxWidth = Number(options.maxWidth) || 0;
        const maxLines = Number(options.maxLines) || 0;
        if (maxWidth <= 0 || maxLines <= 0) return [];

        const font = options.font || FONTS.regular(75);
        const separator = options.separator !== undefined ? options.separator : ' - ';
        const prefix = options.prefix || '';

        const requestedMax = Number(options.maxCount);
        const maxCount = Number.isFinite(requestedMax) && requestedMax >= 0 ? requestedMax : Infinity;
        if (maxCount === 0) return [];

        // Fallback für Journey-Attrappen ohne `stops`-Array (z. B. das
        // `virtualTrain`-Objekt aus `consolidateMergedTrains()`). Deren `vias`
        // sind bereits ausgewählte Stationsnamen und werden nur noch anhand
        // der verfügbaren Breite/Zeilenanzahl begrenzt.
        if (!journey.stops || journey.stops.length === 0) {
            return this._selectViasFromNames(journey.vias, {
                maxWidth, maxLines, font, separator, prefix, maxCount
            });
        }

        // Manuelle Auswahl: exakt die gesetzten showAsVia-Flags respektieren.
        // Automatischer Modus: alle Kandidaten neu nach Kategorie und aktuellem Platz wählen.
        const hasManualSelection = journey.stops.some(s => s.viaManual);
        const candidates = hasManualSelection
            ? journey.stops.filter(s => s.showAsVia && (!s.cancelled || journey.isCancelled) && s.boardingType !== 'ein')
            : this.filterCandidateStops(journey);

        if (candidates.length === 0) return [];

        // Nach Kategorie sortieren (wichtigste zuerst); stabile Sortierung
        // erhält bei Gleichstand die chronologische Reihenfolge.
        const sortedCandidates = [...candidates].sort((a, b) => a.stationCategory - b.stationCategory);
        let selected = [];

        for (const candidate of sortedCandidates) {
            if (selected.length >= maxCount) break;

            selected.push(candidate);
            // Immer chronologisch für die Anzeige sortieren.
            selected.sort((a, b) => a.routeIndex - b.routeIndex);

            const viaText = prefix + selected.map(s => s.nameKurz || s.name).join(separator);
            if (measureTextLines(viaText, maxWidth, font) > maxLines) {
                // Passt nicht mehr! Strikt prioritätsbasiert: nicht durch einen
                // weniger wichtigen Halt ersetzen.
                selected = selected.filter(s => s !== candidate);
                break;
            }
        }

        return selected;
    }

    /**
     * Begrenzt bereits ausgewählte Via-Namen auf den verfügbaren Platz.
     * Wird für Journey-Attrappen ohne `stops`-Array benötigt (z. B. das
     * `virtualTrain`-Objekt aus `consolidateMergedTrains()`), die aber `vias`
     * als String-Array mitbringen. Eine Priorisierung ist hier nicht möglich,
     * daher werden die Namen in ihrer vorhandenen Reihenfolge übernommen.
     *
     * @param {Array<string>|undefined} vias - Bereits ausgewählte Via-Namen
     * @param {object} options - Platz- und Darstellungsoptionen
     * @param {number} options.maxWidth - Verfügbare Textbreite in Pixeln
     * @param {number} options.maxLines - Maximale Anzahl Textzeilen
     * @param {string} options.font - Verwendete Schrift
     * @param {string} options.separator - Trenner zwischen den Via-Namen
     * @param {string} options.prefix - Präfix, das bei der Breitenmessung berücksichtigt wird
     * @param {number} options.maxCount - Obergrenze der Via-Anzahl
     * @returns {Array<{name: string}>} Ausgewählte Via-Einträge in Originalreihenfolge
     */
    static _selectViasFromNames(vias, options) {
        if (!Array.isArray(vias) || vias.length === 0) return [];

        const { maxWidth, maxLines, font, separator, prefix, maxCount } = options;
        const selected = [];

        for (const name of vias) {
            if (!name) continue;
            if (selected.length >= maxCount) break;

            selected.push({ name });
            const viaText = prefix + selected.map(v => v.name).join(separator);
            if (measureTextLines(viaText, maxWidth, font) > maxLines) {
                selected.pop();
                break;
            }
        }

        return selected;
    }

    /**
     * Setzt die "audioVia" Flags der Halte automatisch basierend auf sortMode (1 = Priorisiert, 2 = Standard).
     * @param {object} journey - Die Journey
     * @param {number|string} maxCount - Maximale Anzahl (0-128, oder -1 / 'all' für alle Halte)
     * @param {number} sortMode - 1 = Nach Priorität (Kategorie), 2 = Chronologisch
     * @param {boolean} [allStops=false] - Wenn true, werden alle Halte als Audio-Vias markiert
     */
    static autoGenerateAudioVias(journey, maxCount, sortMode = 2, allStops = false) {
        if (!journey || !journey.stops || journey.stops.length === 0) return;

        // Zurücksetzen (auto-generierte Auswahl hebt eine manuelle Markierung auf)
        journey.stops.forEach(s => {
            s.audioVia = false;
            s.audioViaManual = false;
        });

        let candidateStops = this.filterCandidateStops(journey);
        if (candidateStops.length === 0) return;

        if (sortMode === 1) {
            // Priorisiert (Kategorie)
            candidateStops.sort((a, b) => a.stationCategory - b.stationCategory);
        }
        // bei Standard (2) bleibt es chronologisch

        const isAll = allStops === true || maxCount === -1 || maxCount === 'all' || maxCount === 'Alle';
        let limit = parseInt(maxCount, 10);
        if (isNaN(limit) || limit < 0) {
            limit = 0;
        }

        if (isAll) {
            limit = candidateStops.length;
        } else {
            limit = Math.min(limit, candidateStops.length);
        }

        const selected = candidateStops.slice(0, limit);
        // Halte auch bei priorisierter Auswahl in chronologischer Fahrt-Reihenfolge anordnen
        selected.sort((a, b) => a.routeIndex - b.routeIndex);
        selected.forEach(s => { s.audioVia = true; });
    }
}
