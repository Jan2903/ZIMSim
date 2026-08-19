// js/models/journey.js
import { Stop } from './stop.js';
import { Formation } from './formation.js';
import { parseTrainName, formatDisplayName } from '../utils/trainNumberFormatter.js';
import { RisTextService } from '../utils/risTextService.js';
import { StationService } from '../utils/stationService.js';

/**
 * Repräsentiert eine einzelne Fahrt (Abfahrt oder Ankunft).
 * Ersetzt das alte Departure-Modell und unterstützt:
 * - Manuelle Erstellung (direkte Felder)
 * - API-Import (Stops-Liste mit automatischer Ableitung)
 * - Flügelzüge (via couplingGroupId)
 */
export class Journey {
    id = '';
    journeyId = '';
    name = $state('');
    produktGattung = $state('');
    operator = $state('');
    displayNameOverride = $state('');
    destination = $state('');
    destinationLang = $state('');
    destinationKurz = $state('');
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
        this.destinationLang = data.destinationLang || this.destination;
        this.destinationKurz = data.destinationKurz || this.destination;

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
        // null = automatisch, 1 = Hauptmonitor, 2 = Neben 1, 3 = Neben 2

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

        // === Halteliste (optional, für Details-Ansicht & API-Import) ===
        this.stops = (data.stops || []).map(s => s instanceof Stop ? s : new Stop(s));
        this._currentStopIndex = data._currentStopIndex !== undefined ? data._currentStopIndex : -1;

        // Migration: Falls alte _vias existieren, aber keine Stops, generiere Dummy-Stops
        if (this.stops.length === 0 && data._vias && data._vias.length > 0) {
            this.stops = data._vias.filter(v => v).map((v, i) => new Stop({
                name: typeof v === 'string' ? v : v.name || '',
                nameKurz: typeof v === 'string' ? v : v.nameKurz || v.name || '',
                showAsVia: true,
                routeIndex: i
            }));
        } else if (this.stops.length === 0 && data.vias && data.vias.length > 0) {
            this.stops = data.vias.filter(v => v).map((v, i) => new Stop({
                name: typeof v === 'string' ? v : v.name || '',
                nameKurz: typeof v === 'string' ? v : v.nameKurz || v.name || '',
                showAsVia: true,
                routeIndex: i
            }));
        }

        // === Erweiterte Metadaten ===
        this.zugattribute = data.zugattribute || [];   // Zug-Attribute aus DB API
    }

    // ==========================================
    // Berechnete Properties
    // ==========================================

    /** Dynamisch zusammengesetzter Lauftext aus sichtbaren Info-Bausteinen */
    get scrollText() {
        const customTexts = this.infoTexts
            .filter(t => t.visible)
            .map(t => t.text)
            .join(' +++ ');

        // Wenn dieser Getter aufgerufen wird, kümmert sich typischerweise der Renderer
        // um den Präfix. Falls er hier in `Journey` direkt generiert werden soll, 
        // benötigen wir Zugriff auf die verknüpfte Journey aus dem Store.
        // Da Journey den Store nicht kennt, fügt der Renderer den Präfix oft selbst ein,
        // oder wir übergeben die verknüpfte Journey in den getter, was in JS nicht geht.
        // Daher behalten wir hier den reinen infoTexts String und 
        // bieten eine Helfer-Methode an, um den Prefix zu generieren.
        
        return customTexts;
    }

    /**
     * Generiert den Text "Ankunft [Zeit] (heute ca. [Zeit]) als [Linie] von [Start]".
     * @param {Journey} arrivalJourney - Die verknüpfte Ankunfts-Fahrt
     * @returns {string} Der generierte Präfix
     */
    generateArrivalContextText(arrivalJourney) {
        if (!arrivalJourney) return '';

        // Bei echten Durchfahrten (gleiche HAFAS journeyId) generieren wir keinen "Kommt aus..." Text
        if (this.journeyId && arrivalJourney.journeyId && this.journeyId === arrivalJourney.journeyId) {
            return '';
        }

        let text = `Ankunft ${arrivalJourney.scheduledTime}`;

        // Verspätung berechnen & runden
        if (arrivalJourney.expectedTime && arrivalJourney.expectedTime !== arrivalJourney.scheduledTime) {
            const planTimeStr = arrivalJourney.scheduledTime;
            const expectedTimeStr = arrivalJourney.expectedTime;
            
            // Konvertiere HH:MM zu Minuten
            const [pHe, pMe] = planTimeStr.split(':').map(Number);
            const [eHe, eMe] = expectedTimeStr.split(':').map(Number);
            if (!isNaN(pHe) && !isNaN(eHe)) {
                let planMin = pHe * 60 + pMe;
                let expMin = eHe * 60 + eMe;
                // Tageswechsel-Handling
                if (expMin < planMin && planMin > 23 * 60) expMin += 24 * 60;
                
                let delay = expMin - planMin;
                if (delay >= 5) {
                    const roundedDelay = Math.floor(delay / 5) * 5;
                    // Berechne die gerundete erwartete Zeit
                    let newExpMin = planMin + roundedDelay;
                    let rH = Math.floor(newExpMin / 60) % 24;
                    let rM = newExpMin % 60;
                    const roundedExpectedTime = `${String(rH).padStart(2, '0')}:${String(rM).padStart(2, '0')}`;
                    text += ` (heute ca. ${roundedExpectedTime})`;
                }
            }
        }

        // Liniennummer vergleichen
        // Wir nehmen den displayName (z.B. "RB 72"), trennen nach "/" (wg. Zugnummer) und trimmen.
        const getLine = (j) => j.effectiveDisplayName.split('/')[0].trim();
        const arrivalLine = getLine(arrivalJourney);
        const myLine = getLine(this);

        if (arrivalLine && arrivalLine !== myLine) {
            text += ` als ${arrivalLine}`;
        }

        // Herkunft (destination bei Ankunft ist "von")
        if (arrivalJourney.destinationKurz) {
            text += ` von ${arrivalJourney.destinationKurz}`;
        } else if (arrivalJourney.destination) {
            text += ` von ${arrivalJourney.destination}`;
        }

        return text + ' +++ ';
    }

    /** Effektiver Display-Name: Override oder auto-generiert */
    get effectiveDisplayName() {
        return this.displayNameOverride || this.name;
    }

    /** Ist die Fahrt komplett ausgefallen? */
    get isCancelled() {
        return this.ausfall;
    }

    /** Gibt es einen Gleiswechsel? */
    get hasTrackChange() {
        return this.ezGleis !== '' && this.ezGleis !== this.platform;
    }

    /**
     * Hat die Fahrt eine Störung, die eine Sonderanzeige erfordert?
     * (Ausfall, Gleiswechsel, VerkehrtAb oder Infoscreen)
     */
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

    /** Dynamisch berechnete Vias anhand der Halteliste */
    get vias() {
        return this.stops
            .filter(s => s.showAsVia && !s.cancelled && s.boardingType !== 'ein')
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
        this.ezGleis = stop.ezGleis || '';

        // Ziel / Herkunft
        if (this.ankunft) {
            this.destination = this.stops[0]?.name || '';
        } else {
            this.destination = this.stops[this.stops.length - 1]?.name || '';
        }

        // Vias werden jetzt dynamisch über die Stops-Liste gesteuert
        // Wenn noch keine Vias markiert sind, können wir autoGenerateVias aufrufen
        const hasVias = this.stops.some(s => s.showAsVia);
        if (!hasVias && !this.ankunft) {
            this.autoGenerateVias(4);
        }

        // Halt-basierte Zugnummer übernehmen
        if (stop.name) this.name = stop.name;

        // Halt-Ausfall
        if (stop.cancelled) this.ausfall = true;

        return true;
    }

    /**
     * Setzt die "showAsVia" Flags der Halte automatisch basierend auf der Priorität
     * (Kategorie aus stations.csv), beschränkt auf maxCount.
     */
    autoGenerateVias(maxCount = 4) {
        if (!this.stops || this.stops.length === 0) return;

        // Zurücksetzen
        this.stops.forEach(s => s.showAsVia = false);

        // Bestimme den relevanten Bereich der Halte:
        // Nach dem aktuellen Halt bis (exklusiv) zur Endstation.
        const startIndex = this._currentStopIndex >= 0 ? this._currentStopIndex + 1 : 0;
        const endIndex = this.stops.length - 1; // Zielbahnhof ist nicht via
        
        if (startIndex >= endIndex) return; // Keine Zwischenhalte

        let candidateStops = this.stops.slice(startIndex, endIndex).filter(s => !s.cancelled && s.boardingType !== 'ein');

        // Sortieren nach Kategorie (1 ist am wichtigsten, 99 am wenigsten)
        candidateStops.sort((a, b) => a.stationCategory - b.stationCategory);

        // Top N auswählen
        const selected = candidateStops.slice(0, maxCount);

        // Flag setzen
        selected.forEach(s => s.showAsVia = true);
    }

    /**
     * Erstellt eine Journey aus einem DB-API Abfahrtstafel-Eintrag.
     * @param {object} entry - Ein Eintrag aus dem entries[]-Array
     * @param {boolean} isArrival - true, wenn der Eintrag von einer Ankunftstafel stammt
     * @returns {Journey}
     */
    static fromDepartureEntry(entry, isArrival = false) {
        const vm = entry.verkehrmittel || {};
        const parsedName = parseTrainName(vm.name, vm.linienNummer, vm.langText);

        const rawMeldungen = entry.meldungen || [];
        const infoTexts = [];
        let delayReason = '';
        let ausfall = false;
        const rPresets = RisTextService.getPresetsByType('R');

        rawMeldungen.forEach(m => {
            if (m.type === 'HALT_AUSFALL' || m.text === 'Halt entfällt') {
                ausfall = true;
                return; // Nicht als Lauftext oder Delay-Reason übernehmen
            }

            if (rPresets.some(p => p.text === m.text)) {
                if (!delayReason) delayReason = m.text;
            } else {
                infoTexts.push({
                    id: crypto.randomUUID(),
                    text: m.text.replace(/^Information:\s*/i, '').trim(),
                    visible: true,
                    type: 'Q'
                });
            }
        });

        let viasArray = entry.vias || entry.zuglauf || entry.route || entry.ueber || [];
        const fallbackDestination = viasArray.length > 0 ? viasArray[viasArray.length - 1] : '';
        const finalDest = entry.terminus || fallbackDestination;

        let destLang = finalDest;
        let destKurz = finalDest;

        if (StationService.isLoaded) {
            const destStation = StationService.getStationByIdOrName(null, finalDest);
            if (destStation) {
                destLang = destStation.name;
                destKurz = destStation.nameKurz;
            }
        }

        // WICHTIG: Die Fallback-Destination wird VOR dem Abschneiden aus dem Array ausgelesen (Zeile 367),
        // sodass sie durch diesen Eingriff nicht kaputt gehen kann!
        // Ansatz A: Bei Abfahrten steht der aktuelle Bahnhof als erstes Element und das Ziel als letztes Element in den Vias.
        // Beide müssen für die Via-Anzeige entfernt werden, um Redundanzen zu vermeiden.
        if (!isArrival && viasArray.length > 0) {
            viasArray = viasArray.slice(1, -1);
        }

        const journey = new Journey({
            journeyId: entry.journeyId || '',
            name: parsedName,
            produktGattung: vm.produktGattung || '',
            operator: vm.kurzText || '',
            destination: finalDest,
            destinationLang: destLang,
            destinationKurz: destKurz,
            scheduledTime: Stop.formatTime(entry.zeit),
            expectedTime: Stop.formatTime(entry.ezZeit),
            platform: entry.gleis || '',
            ezGleis: entry.ezGleis || '',
            ausfall: ausfall,
            vias: viasArray,
            messages: rawMeldungen.map(m => ({
                priority: m.prioritaet,
                text: m.text
            })),
            infoTexts: infoTexts,
            delayReason: delayReason
        });

        // Wenn durch Migration Dummy-Stops aus den Vias erzeugt wurden, reichern wir sie an
        journey.stops.forEach(s => s.enrichWithStationData());

        return journey;
    }

    /**
     * Erstellt eine Journey aus einem DB-API Journey/Zuglauf-Objekt.
     * @param {object} data - Das Zuglauf-Objekt
     * @param {string} [stationId] - Optionale Station-ID für Auto-Sync
     * @returns {Journey}
     */
    static fromJourneyData(data, stationId) {
        const vm = data.verkehrmittel || {};
        const parsedName = parseTrainName(vm.name, vm.linienNummer, vm.langText);

        const rawMeldungen = data.priorisierteMeldungen || [];
        const infoTexts = [];
        let delayReason = '';
        const rPresets = RisTextService.getPresetsByType('R');

        rawMeldungen.forEach(m => {
            if (rPresets.some(p => p.text === m.text)) {
                if (!delayReason) delayReason = m.text;
            } else {
                infoTexts.push({
                    id: crypto.randomUUID(),
                    text: m.text.replace(/^Information:\s*/i, '').trim(),
                    visible: true,
                    type: 'Q'
                });
            }
        });

        const journey = new Journey({
            name: parsedName,
            produktGattung: vm.produktGattung || '',
            operator: vm.kurzText || '',
            journeyId: data.journeyId || '',
            destination: data.ziel || '',
            scheduledTime: '', // Wird durch syncFromCurrentStop berechnet
            expectedTime: '',  // Wird durch syncFromCurrentStop berechnet
            platform: '',      // Wird durch syncFromCurrentStop berechnet
            ezGleis: '',       // Wird durch syncFromCurrentStop berechnet
            ausfall: data.cancelled || false,
            zugattribute: data.zugattribute || [],
            messages: rawMeldungen.map(m => ({
                priority: m.prioritaet,
                text: m.text
            })),
            infoTexts: infoTexts,
            delayReason: delayReason,
            stops: (data.halte || []).map(halt => new Stop({
                name: halt.name,
                extId: halt.extId,
                departure: halt.abfahrt || null,
                arrival: halt.ankunft || null,
                platform: halt.gleis || '',
                ezGleis: halt.ezGleis || '',
                cancelled: halt.priorisierteMeldungen?.some(m => m.type === 'HALT_AUSFALL') || false,
                category: halt.kategorie || '',
                number: halt.nummer || '',
                routeIndex: halt.routeIdx,
                messages: halt.priorisierteMeldungen || [],
                risNotizen: halt.risNotizen || []
            }))
        });

        // Stationen anreichern
        journey.stops.forEach(s => s.enrichWithStationData());

        // Auto-Generate Vias für den importierten Zuglauf
        journey.autoGenerateVias(4);

        // Auto-sync wenn Station-ID bekannt
        if (stationId) {
            journey.syncFromCurrentStop(stationId);
        }

        return journey;
    }
}
