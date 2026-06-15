// js/models/journey.js
import { Stop } from './stop.js';
import { Formation } from './formation.js';
import { formatTrainNumber } from '../utils/trainNumberFormatter.js';

/**
 * Repräsentiert eine einzelne Fahrt (Abfahrt oder Ankunft).
 * Ersetzt das alte Departure-Modell und unterstützt:
 * - Manuelle Erstellung (direkte Felder)
 * - API-Import (Stops-Liste mit automatischer Ableitung)
 * - Flügelzüge (via couplingGroupId)
 */
export class Journey {
    constructor(data = {}) {
        // === Identifikation ===
        this.id = data.id || crypto.randomUUID();
        this.journeyId = data.journeyId || '';     // DB API Journey-ID

        // === Zug-Identifikation ===
        this.category = data.category || '';        // "ICE", "IC", "RE", "S", "FLX"
        this.line = data.line || '';                 // Liniennummer ("20", "1", "S1")
        this.number = data.number || '';             // Zugnummer ("71", "7922")
        this.displayNameOverride = data.displayNameOverride || ''; // Manuell überschrieben

        // === Display-Daten (primär — werden von Renderern gelesen) ===
        this.destination = data.destination || '';
        this.scheduledTime = data.scheduledTime || '';
        this.expectedTime = data.expectedTime || '';
        this.platform = data.platform || '';
        this.vias = data.vias || [];
        this.scrollText = data.scrollText || '';

        // === Formation / Wagenreihung ===
        this.direction = data.direction !== undefined ? data.direction : 1; // 0=Links, 1=Rechts
        this.startMeter = data.startMeter || 0;
        this.skalieren = data.skalieren || false;
        this.formation = data.formation ? new Formation(data.formation) : new Formation();

        // === Störungen / Flags ===
        this.gleiswechsel = data.gleiswechsel || '0';
        this.verkehrtAb = data.verkehrtAb || '0';
        this.infoscreen = data.infoscreen || false;
        this.ausfall = data.ausfall || false;
        this.ankunft = data.ankunft || false;

        // === Display-Steuerung ===
        this.visible = data.visible !== undefined ? data.visible : true;
        this.displaySlot = data.displaySlot !== undefined ? data.displaySlot : null;
        // null = automatisch, 1 = Hauptmonitor, 2 = Neben 1, 3 = Neben 2

        // === Coupling (Flügelzüge) ===
        this.couplingGroupId = data.couplingGroupId || null;

        // === Meldungen ===
        this.messages = (data.messages || []).map(m => ({
            priority: m.priority || m.prioritaet || 'NIEDRIG',
            text: m.text || '',
            type: m.type || ''
        }));

        // === Halteliste (optional, für Details-Ansicht & API-Import) ===
        this.stops = (data.stops || []).map(s => s instanceof Stop ? s : new Stop(s));
        this._currentStopIndex = data._currentStopIndex !== undefined ? data._currentStopIndex : -1;

        // === Erweiterte Metadaten ===
        this.zugattribute = data.zugattribute || [];   // Zug-Attribute aus DB API
    }

    // ==========================================
    // Berechnete Properties
    // ==========================================

    /** Auto-generierter Display-Name basierend auf Kategorie/Linie/Nummer */
    get displayName() {
        return formatTrainNumber(this.category, this.line, this.number);
    }

    /** Effektiver Display-Name: Override oder auto-generiert */
    get effectiveDisplayName() {
        return this.displayNameOverride || this.displayName;
    }

    /** Ist die Fahrt komplett ausgefallen? */
    get isCancelled() {
        return this.ausfall;
    }

    /**
     * Hat die Fahrt eine Störung, die eine Sonderanzeige erfordert?
     * (Ausfall, Gleiswechsel, VerkehrtAb oder Infoscreen)
     */
    get isDisrupted() {
        return this.ausfall
            || (this.gleiswechsel !== '0' && this.gleiswechsel !== 0)
            || (this.verkehrtAb !== '0' && this.verkehrtAb !== 0)
            || this.infoscreen;
    }

    /** Ist die Fahrt eine Ankunft? */
    get isArrival() {
        return this.ankunft;
    }

    /** Ist die Fahrt eine Abfahrt? */
    get isDeparture() {
        return !this.ankunft;
    }

    /** Hat die Fahrt eine nicht-leere Formation? */
    get hasFormation() {
        return this.formation && !this.formation.isEmpty;
    }

    /** Der aktuelle Halt (basierend auf _currentStopIndex) */
    get currentStop() {
        if (this._currentStopIndex >= 0 && this._currentStopIndex < this.stops.length) {
            return this.stops[this._currentStopIndex];
        }
        return null;
    }

    // ==========================================
    // Methoden
    // ==========================================

    /**
     * Findet den aktuellen Halt anhand der Station-ID und synchronisiert die Display-Felder.
     * @param {string} stationId - EVA-Nr der aktuellen Station (z.B. "8000152")
     * @returns {boolean} true wenn ein passender Halt gefunden wurde
     */
    syncFromCurrentStop(stationId) {
        if (!stationId || this.stops.length === 0) return false;

        const idx = this.stops.findIndex(s => s.extId === stationId);
        if (idx < 0) return false;

        this._currentStopIndex = idx;
        const stop = this.stops[idx];

        // Ankunft/Abfahrt auto-erkennen
        const isLastStop = idx === this.stops.length - 1;
        const hasOnlyArrival = stop.hasArrival && !stop.hasDeparture;
        if (isLastStop || hasOnlyArrival) {
            this.ankunft = true;
        }

        // Zeiten setzen
        if (this.ankunft && stop.arrival) {
            this.scheduledTime = Stop.formatTime(stop.arrival.scheduled);
            this.expectedTime = Stop.formatTime(stop.arrival.expected);
        } else if (stop.departure) {
            this.scheduledTime = Stop.formatTime(stop.departure.scheduled);
            this.expectedTime = Stop.formatTime(stop.departure.expected);
        }

        // Gleis
        this.platform = stop.platform || '';

        // Ziel / Herkunft
        if (this.ankunft) {
            this.destination = this.stops[0]?.name || '';
        } else {
            this.destination = this.stops[this.stops.length - 1]?.name || '';
        }

        // Vias (Halte zwischen aktuellem Halt und Endstation, max 3)
        const endIdx = this.stops.length - 1;
        if (idx < endIdx && !this.ankunft) {
            this.vias = this.stops
                .slice(idx + 1, endIdx)
                .filter(s => !s.cancelled)
                .map(s => s.name)
                .slice(0, 3);
        }

        // Halt-basierte Zugnummer übernehmen
        if (stop.category) this.category = stop.category;
        if (stop.number) this.number = stop.number;
        if (stop.line) this.line = stop.line;

        // Halt-Ausfall
        if (stop.cancelled) this.ausfall = true;

        return true;
    }

    /**
     * Erstellt eine Journey aus einem DB-API Abfahrtstafel-Eintrag.
     * @param {object} entry - Ein Eintrag aus dem entries[]-Array
     * @returns {Journey}
     */
    static fromDepartureEntry(entry) {
        const vm = entry.verkehrmittel || {};
        const cat = vm.kurzText || '';
        const name = vm.name || '';
        const nameParts = name.split(' ');
        const num = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

        return new Journey({
            journeyId: entry.journeyId || '',
            category: cat,
            line: vm.linienNummer || '',
            number: num,
            destination: entry.terminus || '',
            scheduledTime: Stop.formatTime(entry.zeit),
            expectedTime: Stop.formatTime(entry.ezZeit),
            platform: entry.gleis || '',
            messages: (entry.meldungen || []).map(m => ({
                priority: m.prioritaet,
                text: m.text
            })),
            scrollText: (entry.meldungen || []).map(m => m.text).join(' +++ ')
        });
    }

    /**
     * Erstellt eine Journey aus einem DB-API Journey/Zuglauf-Objekt.
     * @param {object} data - Das Zuglauf-Objekt
     * @param {string} [stationId] - Optionale Station-ID für Auto-Sync
     * @returns {Journey}
     */
    static fromJourneyData(data, stationId) {
        const zugName = data.zugName || '';
        // Kategorie und Nummer aus zugName extrahieren (z.B. "S21" → "S", "21")
        const match = zugName.match(/^([A-Za-z]+)\s*(\d*)$/);
        const cat = match ? match[1] : '';
        const num = match ? match[2] : '';

        const journey = new Journey({
            category: cat,
            number: num,
            ausfall: data.cancelled || false,
            zugattribute: data.zugattribute || [],
            messages: (data.priorisierteMeldungen || []).map(m => ({
                priority: m.prioritaet,
                text: m.text
            })),
            scrollText: (data.priorisierteMeldungen || []).map(m => m.text).join(' +++ '),
            stops: (data.halte || []).map(halt => new Stop({
                name: halt.name,
                extId: halt.extId,
                departure: halt.abfahrt || null,
                arrival: halt.ankunft || null,
                platform: halt.gleis || '',
                cancelled: halt.priorisierteMeldungen?.some(m => m.type === 'HALT_AUSFALL') || false,
                category: halt.kategorie || '',
                number: halt.nummer || '',
                routeIndex: halt.routeIdx,
                messages: halt.priorisierteMeldungen || []
            }))
        });

        // Auto-sync wenn Station-ID bekannt
        if (stationId) {
            journey.syncFromCurrentStop(stationId);
        }

        return journey;
    }
}
