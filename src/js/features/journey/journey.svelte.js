import { Stop } from '../station/stop.svelte.js';
import { Formation } from '../formation/formationModel.js';
import { JourneyViaService } from './services/journeyViaService.js';
import { DynamicTextService } from './services/dynamicTextService.js';
import { JourneyImportService } from './services/journeyImportService.js';
import { measureTextLines } from '../../displays/core/textUtils.js';

/**
 * Hilfsfunktion zur Migration alter Vias-Arrays in Dummy-Stop-Objekte (DRY).
 * @private
 */
function createDummyStopsFromVias(viaList, isDestinationStopFn) {
    const stops = viaList.filter(Boolean).map((v, i) => new Stop({
        name: typeof v === 'string' ? v : v.name || '',
        nameKurz: typeof v === 'string' ? v : v.nameKurz || v.name || '',
        showAsVia: true,
        routeIndex: i
    }));
    stops.forEach(s => {
        if (isDestinationStopFn(s)) s.showAsVia = false;
    });
    return stops;
}

/**
 * Repräsentiert eine einzelne Fahrt (Abfahrt oder Ankunft).
 * Hält den reaktiven Zustand (Svelte 5 $state) und domänenspezifische Eigenschaften.
 * Fachlogik für Import, Zwischenhalte und Texte wird an spezialisierte Services delegiert.
 */
export class Journey {
    id = '';
    journeyId = '';
    name = $state('');
    produktGattung = $state('');
    operator = $state('');
    displayNameOverride = $state('');
    destination = $state('');
    destinationOverride = $state('');
    destinationLang = $state('');
    destinationKurz = $state('');
    destinationIbnr = $state('');
    destinationCategory = $state(7);
    scheduledTime = $state('');
    expectedTime = $state('');
    platform = $state('');
    sectors = $state('');
    infoTexts = $state([]);
    delayReason = $state('');
    direction = $state(1);
    startMeter = $state(0);
    skalieren = $state(false);
    scaleFactor = $state(1.0);
    formation = $state(null);
    ezGleis = $state('');
    verkehrtAb = $state('0');
    infoscreen = $state(false);
    ausfall = $state(false);
    ankunft = $state(false);
    visible = $state(true);
    displaySlot = $state(null);
    couplingGroupId = $state(null);
    linkedArrivalJourneyId = $state(null);
    messages = $state([]);
    stops = $state([]);
    _currentStopIndex = $state(-1);
    zugattribute = $state([]);

    constructor(data = {}) {
        // === Identifikation ===
        this.id = data.id || crypto.randomUUID();
        this.journeyId = data.journeyId || '';     // DB API Journey-ID

        // === Zug-Identifikation ===
        this.name = data.name || '';                 // Der formatierte Name des Zuges (z.B. "RE 70 / 95835")
        this.produktGattung = data.produktGattung || ''; // DB API Gattung (z.B. "REGIONAL")
        this.operator = data.operator || '';             // EVU / Operator (z.B. "ERB", "WFB", "DB")
        this.displayNameOverride = data.displayNameOverride || ''; // Manuell überschrieben oder durch NRW-Modus berechnet

        // === Ziel ===
        this.destination = data.destination || '';
        this.destinationOverride = data.destinationOverride || '';
        this.destinationLang = data.destinationLang || this.destination;
        this.destinationKurz = data.destinationKurz || this.destination;
        this.destinationIbnr = data.destinationIbnr || '';
        this.destinationCategory = data.destinationCategory || 7;

        // === Zeiten ===
        this.scheduledTime = data.scheduledTime || '';
        this.expectedTime = data.expectedTime || '';
        this.platform = data.platform || '';
        this.sectors = data.sectors || '';
        
        // === Infotexte / Lauftext ===
        this.infoTexts = [];
        if (data.infoTexts && Array.isArray(data.infoTexts)) {
            this.infoTexts = data.infoTexts;
        } else if (data.scrollText) {
            // Migration von alten Speicherständen
            this.infoTexts.push({
                id: crypto.randomUUID(),
                text: data.scrollText,
                visible: true,
                type: 'custom'
            });
        }
        
        // === Verspätungsgrund ===
        this.delayReason = data.delayReason || '';

        // === Formation / Wagenreihung ===
        this.direction = data.direction !== undefined ? data.direction : 1; // 0=Links, 1=Rechts
        this.startMeter = data.startMeter || 0;
        this.skalieren = data.skalieren || false;
        this.scaleFactor = data.scaleFactor !== undefined ? parseFloat(data.scaleFactor) : 1.0;
        this.formation = data.formation ? new Formation(data.formation) : new Formation();

        // === Störungen / Flags ===
        this.ezGleis = data.ezGleis || '';
        this.verkehrtAb = data.verkehrtAb || '0';
        this.infoscreen = data.infoscreen || false;
        this.ausfall = data.ausfall || false;
        this.ankunft = data.ankunft || false;

        // === Display-Steuerung ===
        this.visible = data.visible !== undefined ? data.visible : true;
        this.displaySlot = data.displaySlot !== undefined ? data.displaySlot : null;

        // === Coupling (Flügelzüge) ===
        this.couplingGroupId = data.couplingGroupId || null;

        // === Linked Arrival Journey (Ankunft/Weiter als) ===
        this.linkedArrivalJourneyId = data.linkedArrivalJourneyId || null;

        // === Meldungen ===
        this.messages = (data.messages || []).map(m => ({
            priority: m.priority || m.prioritaet || 'NIEDRIG',
            text: m.text || '',
            type: m.type || ''
        }));

        // === Halteliste (für Details-Ansicht & API-Import) ===
        this.stops = (data.stops || []).map(s => {
            const stop = s instanceof Stop ? s : new Stop(s);
            if (!(s instanceof Stop)) stop.enrichWithStationData();
            return stop;
        });
        this._currentStopIndex = data._currentStopIndex !== undefined ? data._currentStopIndex : -1;

        // Migration: Falls alte Vias existieren, aber keine Stops, Dummy-Stops generieren
        if (this.stops.length === 0) {
            const legacyVias = data._vias || data.vias;
            if (legacyVias && legacyVias.length > 0) {
                this.stops = createDummyStopsFromVias(legacyVias, (s) => this._isDestinationStop(s));
            }
        }

        // === Erweiterte Metadaten ===
        this.zugattribute = data.zugattribute || [];
    }

    /**
     * Svelte 5 $state Eigenschaften werden als Getter/Setter implementiert
     * und von JSON.stringify standardmäßig ignoriert.
     * Diese toJSON-Methode stellt sicher, dass alle Daten korrekt exportiert werden.
     */
    toJSON() {
        return {
            id: this.id,
            journeyId: this.journeyId,
            name: this.name,
            produktGattung: this.produktGattung,
            operator: this.operator,
            displayNameOverride: this.displayNameOverride,
            destination: this.destination,
            destinationOverride: this.destinationOverride,
            destinationLang: this.destinationLang,
            destinationKurz: this.destinationKurz,
            destinationIbnr: this.destinationIbnr,
            destinationCategory: this.destinationCategory,
            scheduledTime: this.scheduledTime,
            expectedTime: this.expectedTime,
            platform: this.platform,
            sectors: this.sectors,
            infoTexts: this.infoTexts,
            delayReason: this.delayReason,
            direction: this.direction,
            startMeter: this.startMeter,
            skalieren: this.skalieren,
            scaleFactor: this.scaleFactor,
            formation: this.formation,
            ezGleis: this.ezGleis,
            verkehrtAb: this.verkehrtAb,
            infoscreen: this.infoscreen,
            ausfall: this.ausfall,
            ankunft: this.ankunft,
            visible: this.visible,
            displaySlot: this.displaySlot,
            couplingGroupId: this.couplingGroupId,
            linkedArrivalJourneyId: this.linkedArrivalJourneyId,
            messages: this.messages,
            stops: this.stops,
            _currentStopIndex: this._currentStopIndex,
            zugattribute: this.zugattribute
        };
    }

    // ==========================================
    // Berechnete Properties
    // ==========================================

    /** Dynamisch zusammengesetzter Lauftext aus sichtbaren Info-Bausteinen */
    get scrollText() {
        return this.infoTexts
            .filter(t => t.visible)
            .map(t => t.text)
            .join(' +++ ');
    }

    /**
     * Generiert den Text "Ankunft [Zeit] (heute ca. [Zeit]) als [Linie] von [Start]".
     * Delegiert an den DynamicTextService.
     * @param {Journey} arrivalJourney - Die verknüpfte Ankunfts-Fahrt
     * @returns {string}
     */
    generateArrivalContextText(arrivalJourney) {
        return DynamicTextService.generateArrivalContextText(this, arrivalJourney);
    }

    /** Effektiver Display-Name: Override oder auto-generiert */
    get effectiveDisplayName() {
        return this.displayNameOverride || this.name;
    }

    /** Effektives Ziel: Override oder auto-generiert */
    get effectiveDestination() {
        return this.destinationOverride || this.destinationLang || this.destination;
    }

    /** Effektives Kurz-Ziel (für Lauftext / Platzmangel): Override oder auto-generiert */
    get effectiveDestinationKurz() {
        return this.destinationOverride || this.destinationKurz || this.destination;
    }

    /** Ist die Fahrt komplett ausgefallen? */
    get isCancelled() {
        return this.ausfall;
    }

    /** Gibt es einen Gleiswechsel? */
    get hasTrackChange() {
        return this.ezGleis !== '' && this.ezGleis !== this.platform;
    }

    /** Hat die Fahrt eine Störung, die eine Sonderanzeige erfordert? */
    get isDisrupted() {
        return this.ausfall
            || this.hasTrackChange
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

    /** Dynamisch berechnete Vias anhand der Halteliste (für Anzeige) */
    get vias() {
        return this.stops
            .filter(s => s.showAsVia && (!s.cancelled || this.isCancelled) && s.boardingType !== 'ein')
            .map(s => s.nameKurz || s.name);
    }

    /** Dynamisch berechnete Vias für die Ansagen */
    get audioVias() {
        return this.stops
            .filter(s => s.audioVia && (!s.cancelled || this.isCancelled) && s.boardingType !== 'ein')
            .map(s => s.nameKurz || s.name);
    }

    /** Der aktuelle Halt (basierend auf _currentStopIndex) */
    get currentStop() {
        if (this._currentStopIndex >= 0 && this._currentStopIndex < this.stops.length) {
            return this.stops[this._currentStopIndex];
        }
        return null;
    }

    // ==========================================
    // Methoden & Delegation
    // ==========================================

    /**
     * Findet den aktuellen Halt anhand der Station-ID und synchronisiert die Display-Felder.
     * @param {string} stationId - EVA-Nr der aktuellen Station (z.B. "8000152")
     * @param {object} [viaOptions={}] - Optionale Optionen für Vias (maxVias, sortMode)
     * @returns {boolean} true wenn ein passender Halt gefunden wurde
     */
    syncFromCurrentStop(stationId, viaOptions = {}) {
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
        this.ezGleis = stop.ezGleis || '';

        // Ziel / Herkunft
        if (this.ankunft) {
            this.destination = this.stops[0]?.name || '';
        } else {
            this.destination = this.stops[this.stops.length - 1]?.name || '';
        }

        // Vias werden dynamisch über die Stops-Liste gesteuert
        const hasVias = this.stops.some(s => s.showAsVia);
        const hasAudioVias = this.stops.some(s => s.audioVia);
        if (!hasVias && !this.ankunft) {
            this.autoGenerateVias();
        }
        if (!hasAudioVias && !this.ankunft) {
            this.autoGenerateAudioVias(viaOptions.maxVias ?? 6, viaOptions.sortMode ?? 2);
        }

        // Halt-basierte Zugnummer übernehmen
        if (stop.name) this.name = stop.name;

        // Halt-Ausfall
        if (stop.cancelled) this.ausfall = true;

        return true;
    }

    /**
     * Prüft ob ein Halt inhaltlich dem Zielbahnhof entspricht.
     * Delegiert an JourneyViaService.
     */
    _isDestinationStop(stop) {
        return JourneyViaService.isDestinationStop(this, stop);
    }

    /**
     * Setzt die "showAsVia" Flags der Halte dynamisch basierend auf Priorität und Monitorplatz.
     * Delegiert an JourneyViaService.
     * @param {object} [options={}]
     */
    autoGenerateVias(options = {}) {
        JourneyViaService.autoGenerateVias(this, options);
    }

    /**
     * Setzt die "audioVia" Flags der Halte automatisch.
     * Delegiert an JourneyViaService.
     * @param {number} [maxCount=6]
     * @param {number} [sortMode=2]
     */
    autoGenerateAudioVias(maxCount = 6, sortMode = 2) {
        JourneyViaService.autoGenerateAudioVias(this, maxCount, sortMode);
    }

    /**
     * Berechnet Zeilenanzahl eines Textes.
     * Delegiert für Abwärtskompatibilität an measureTextLines.
     */
    static calculateTextLines(text, maxWidth, font) {
        return measureTextLines(text, maxWidth, font);
    }

    /**
     * Erstellt eine Journey aus einem DB-API Abfahrtstafel-Eintrag.
     * Delegiert an den JourneyImportService.
     * @param {object} entry
     * @param {boolean} [isArrival=false]
     * @returns {Journey}
     */
    static fromDepartureEntry(entry, isArrival = false) {
        return JourneyImportService.fromDepartureEntry(entry, isArrival);
    }

    /**
     * Erstellt eine Journey aus einem DB-API Journey/Zuglauf-Objekt.
     * Delegiert an den JourneyImportService.
     * @param {object} data
     * @param {string} [stationId]
     * @returns {Journey}
     */
    static fromJourneyData(data, stationId) {
        return JourneyImportService.fromJourneyData(data, stationId);
    }
}
