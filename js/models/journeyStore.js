// js/models/journeyStore.js
import { Journey } from './journey.js';
import { Formation } from './formation.js';
import { Platform } from './platform.js';
import { getMotForCategory, MOT_ALL_KEYS } from '../utils/motManager.js';

/**
 * Zentrale Datenverwaltung — ersetzt das alte TrainData.
 * Verwaltet die dynamische Journey-Liste, Station-Kontext,
 * Display-Zuweisungen und Coupling.
 */
export class JourneyStore {
    constructor() {
        // Station-Kontext
        this.stationContext = {
            stationName: '',
            stationId: '',
            platform: new Platform()
        };

        // Dynamische Journey-Liste (keine feste Anzahl)
        this.journeys = [];

        // NRW-Modus (global)
        this.nrwMode = false;

        // Verkehrsmittel Filter
        this.activeMots = [...MOT_ALL_KEYS];

        // Gleis Filter
        this.activeTracks = [];
    }

    // ==========================================
    // Journey CRUD
    // ==========================================

    /**
     * Fügt eine neue Journey hinzu.
     * @param {object} [data] - Optionale Initialisierungsdaten
     * @returns {Journey} Die erstellte Journey
     */
    addJourney(data = {}) {
        const journey = new Journey(data);
        this.journeys.push(journey);
        return journey;
    }

    /**
     * Entfernt eine Journey anhand ihrer ID.
     * @param {string} id
     * @returns {boolean} true wenn gefunden und entfernt
     */
    removeJourney(id) {
        const idx = this.journeys.findIndex(j => j.id === id);
        if (idx < 0) return false;

        // Coupling aufräumen
        const journey = this.journeys[idx];
        if (journey.couplingGroupId) {
            this.uncoupleJourney(id);
        }

        this.journeys.splice(idx, 1);
        return true;
    }

    /**
     * Findet eine Journey anhand ihrer ID.
     * @param {string} id
     * @returns {Journey|undefined}
     */
    getJourney(id) {
        return this.journeys.find(j => j.id === id);
    }

    /**
     * Ermittelt Start- und Endindex eines Journey-Blocks (inklusive Kupplung).
     * @param {string} id - Journey-ID
     * @returns {{startIndex: number, endIndex: number}|null}
     */
    getJourneyBlockBounds(id) {
        const journeyIdx = this.journeys.findIndex(j => j.id === id);
        if (journeyIdx < 0) return null;

        const journey = this.journeys[journeyIdx];
        if (!journey.couplingGroupId) {
            return { startIndex: journeyIdx, endIndex: journeyIdx };
        }

        const groupId = journey.couplingGroupId;
        const startIndex = this.journeys.findIndex(j => j.couplingGroupId === groupId);
        let endIndex = startIndex;
        while (endIndex + 1 < this.journeys.length && this.journeys[endIndex + 1].couplingGroupId === groupId) {
            endIndex++;
        }
        
        return { startIndex, endIndex };
    }

    /**
     * Verschiebt einen Block (einzeln oder gekuppelt) um eine Position nach oben.
     * @param {string} id - Journey-ID aus dem Block
     */
    moveJourneyGroupUp(id) {
        const bounds = this.getJourneyBlockBounds(id);
        if (!bounds || bounds.startIndex === 0) return; // Schon ganz oben

        const prevJourney = this.journeys[bounds.startIndex - 1];
        const prevBounds = this.getJourneyBlockBounds(prevJourney.id);
        
        const blockLength = bounds.endIndex - bounds.startIndex + 1;
        const block = this.journeys.splice(bounds.startIndex, blockLength);
        this.journeys.splice(prevBounds.startIndex, 0, ...block);
    }

    /**
     * Verschiebt einen Block (einzeln oder gekuppelt) um eine Position nach unten.
     * @param {string} id - Journey-ID aus dem Block
     */
    moveJourneyGroupDown(id) {
        const bounds = this.getJourneyBlockBounds(id);
        if (!bounds || bounds.endIndex === this.journeys.length - 1) return; // Schon ganz unten

        const nextJourney = this.journeys[bounds.endIndex + 1];
        const nextBounds = this.getJourneyBlockBounds(nextJourney.id);

        const blockLength = bounds.endIndex - bounds.startIndex + 1;
        const block = this.journeys.splice(bounds.startIndex, blockLength);
        
        const newIndex = nextBounds.endIndex - blockLength + 1;
        this.journeys.splice(newIndex, 0, ...block);
    }

    /**
     * Verschiebt einen Block an einen Ziel-Index (Drag & Drop).
     * @param {string} id - Journey-ID aus dem gezogenen Block
     * @param {number} targetIndex - Wo der Block eingefügt werden soll (vor der Entnahme berechnet!)
     */
    moveJourneyGroupToIndex(id, targetIndex) {
        const bounds = this.getJourneyBlockBounds(id);
        if (!bounds) return;

        // Wenn der Target-Index innerhalb des eigenen Blocks liegt, tun wir nichts
        if (targetIndex >= bounds.startIndex && targetIndex <= bounds.endIndex + 1) return;

        const blockLength = bounds.endIndex - bounds.startIndex + 1;
        
        let adjustedTarget = targetIndex;
        if (targetIndex > bounds.endIndex) {
            adjustedTarget -= blockLength;
        }

        const block = this.journeys.splice(bounds.startIndex, blockLength);
        this.journeys.splice(adjustedTarget, 0, ...block);
    }

    // ==========================================
    // Display-Zuweisung
    // ==========================================

    /**
     * Gibt alle sichtbaren Journeys zurück (visible === true und passendes Verkehrsmittel).
     * @returns {Journey[]}
     */
    getVisibleJourneys() {
        return this.journeys.filter(j => {
            if (!j.visible) return false;
            
            // Check Verkehrsmittel Filter
            const mot = getMotForCategory(j.category);
            // Wenn kein MOT gefunden wird (z.B. Testdaten ohne Kategorie), 
            // zeigen wir ihn trotzdem an, oder falls der MOT aktiv ist.
            if (mot && !this.activeMots.includes(mot)) {
                return false;
            }

            // Check Gleis Filter
            if (this.activeTracks.length > 0) {
                const hasPlatform = j.platform && this.activeTracks.includes(j.platform.toString());
                const hasEzGleis = j.ezGleis && this.activeTracks.includes(j.ezGleis.toString());
                const hasNoTrackCondition = (!j.platform && !j.ezGleis && this.activeTracks.includes('Ohne Gleis'));
                
                if (!hasPlatform && !hasEzGleis && !hasNoTrackCondition) {
                    return false;
                }
            }

            // Ankünfte, die mit einer Abfahrt verknüpft sind, sollen nicht separat auf dem Monitor erscheinen
            if (j.ankunft) {
                const isLinkedToDeparture = this.journeys.some(
                    dep => !dep.ankunft && dep.linkedArrivalJourneyId === j.id
                );
                if (isLinkedToDeparture) {
                    return false;
                }
            }
            
            return true;
        });
    }

    /**
     * Gibt die Journey(s) für einen bestimmten Screen-Slot zurück.
     * Bei gekoppelten Journeys werden alle Journeys der Coupling-Gruppe zurückgegeben.
     *
     * @param {number} slot - 1=Hauptmonitor, 2=Neben1, 3=Neben2
     * @returns {Journey[]} Array von Journeys (1 oder mehrere bei Coupling)
     */
    getJourneysForSlot(slot) {
        // 1. Zuerst: Manuell zugewiesene Journeys für diesen Slot
        const manuallyAssigned = this.journeys.find(
            j => j.visible && j.displaySlot === slot
        );

        if (manuallyAssigned) {
            return this._expandCoupling(manuallyAssigned);
        }

        // 2. Fallback: Auto-Zuweisung
        // Gekoppelte Journeys werden als eine Einheit gezählt
        const visible = this.getVisibleJourneys();
        const usedSlots = new Set(
            visible.filter(j => j.displaySlot !== null).map(j => j.displaySlot)
        );

        // Sichtbare Journeys in Gruppen aufteilen (gekoppelte = eine Gruppe)
        const groups = [];
        const seenCouplings = new Set();
        for (const j of visible) {
            if (j.displaySlot !== null) continue; // Manuell zugewiesene überspringen
            if (j.couplingGroupId) {
                if (seenCouplings.has(j.couplingGroupId)) continue; // Bereits gezählt
                seenCouplings.add(j.couplingGroupId);
                groups.push(this._expandCoupling(j));
            } else {
                groups.push([j]);
            }
        }

        // Zähle, welcher Auto-Index dieser Slot bekommt
        let autoIndex = 0;
        for (let s = 1; s <= slot; s++) {
            if (!usedSlots.has(s)) autoIndex++;
        }
        autoIndex--; // 0-basiert

        if (autoIndex >= 0 && autoIndex < groups.length) {
            return groups[autoIndex];
        }

        return [];
    }

    /**
     * Expandiert eine Journey zu ihrer Coupling-Gruppe.
     * @private
     */
    _expandCoupling(journey) {
        if (!journey.couplingGroupId) return [journey];
        return this.journeys.filter(
            j => j.couplingGroupId === journey.couplingGroupId
        );
    }

    /**
     * Gibt die Journeys zurück, die für den rotierenden Monitor verfügbar sind.
     * Das sind sichtbare Journeys, die nicht auf Slot 1 oder 2 liegen.
     * @returns {Journey[]}
     */
    getRotatingJourneys() {
        const slot1 = this.getJourneysForSlot(1).map(j => j.id);
        const slot2 = this.getJourneysForSlot(2).map(j => j.id);
        const fixed = new Set([...slot1, ...slot2]);
        return this.getVisibleJourneys().filter(j => !fixed.has(j.id));
    }

    // ==========================================
    // Coupling
    // ==========================================

    /**
     * Koppelt zwei Journeys zu einem Zugverband.
     * @param {string} id1 - ID der ersten Journey
     * @param {string} id2 - ID der zweiten Journey
     */
    coupleJourneys(id1, id2) {
        const j1 = this.getJourney(id1);
        const j2 = this.getJourney(id2);
        if (!j1 || !j2) return;

        // Bestehende Gruppen-ID übernehmen oder neue erstellen
        const groupId = j1.couplingGroupId || j2.couplingGroupId || crypto.randomUUID();
        j1.couplingGroupId = groupId;
        j2.couplingGroupId = groupId;
    }

    /**
     * Entkoppelt eine Journey aus ihrem Zugverband.
     * @param {string} id
     */
    uncoupleJourney(id) {
        const journey = this.getJourney(id);
        if (!journey || !journey.couplingGroupId) return;

        const groupId = journey.couplingGroupId;
        journey.couplingGroupId = null;

        // Wenn nur noch eine Journey in der Gruppe, Gruppe auflösen
        const remaining = this.journeys.filter(j => j.couplingGroupId === groupId);
        if (remaining.length === 1) {
            remaining[0].couplingGroupId = null;
        }
    }

    /**
     * Gibt alle Journeys einer Coupling-Gruppe zurück.
     * @param {string} groupId
     * @returns {Journey[]}
     */
    getCouplingGroup(groupId) {
        if (!groupId) return [];
        return this.journeys.filter(j => j.couplingGroupId === groupId);
    }

    // ==========================================
    // Ankunft & Abfahrt Verknüpfung (Fahrzeugtausch / Wende)
    // ==========================================

    /**
     * Holt die verknüpfte Ankunfts-Journey einer Abfahrt, 
     * oder die verknüpfte Abfahrts-Journey einer Ankunft.
     * @param {string} id - Die ID der Journey
     * @returns {Journey|null} Die verknüpfte Journey oder null
     */
    getLinkedJourney(id) {
        const journey = this.getJourney(id);
        if (!journey) return null;

        if (journey.ankunft) {
            // Finde die Abfahrt, die auf diese Ankunft zeigt
            return this.journeys.find(j => j.linkedArrivalJourneyId === id) || null;
        } else {
            // Finde die Ankunft, auf die diese Abfahrt zeigt
            if (!journey.linkedArrivalJourneyId) return null;
            return this.getJourney(journey.linkedArrivalJourneyId) || null;
        }
    }

    /**
     * Verknüpft eine Ankunft mit einer Abfahrt.
     * @param {string|null} arrivalId 
     * @param {string} departureId 
     */
    linkJourneys(arrivalId, departureId) {
        const departure = this.getJourney(departureId);
        if (departure) {
            departure.linkedArrivalJourneyId = arrivalId;
        }
    }

    /**
     * Erkennt automatisch Wenden / Fahrzeugtausche am selben Gleis
     * und verknüpft sie. Wird nach dem Import aufgerufen.
     */
    autoLinkJourneys() {
        // Trenne in Ankünfte und Abfahrten
        const arrivals = this.journeys.filter(j => j.ankunft);
        const departures = this.journeys.filter(j => !j.ankunft);

        // Für jede Abfahrt ohne Verknüpfung...
        for (const dep of departures) {
            if (dep.linkedArrivalJourneyId) continue; // Bereits verknüpft

            // 1. Suche nach exakter journeyId (Durchfahrt)
            if (dep.journeyId) {
                const exactMatch = arrivals.find(a => a.journeyId === dep.journeyId);
                if (exactMatch) {
                    dep.linkedArrivalJourneyId = exactMatch.id;
                    continue; // Erledigt für diese Abfahrt
                }
            }

            // 2. Mögliche Ankünfte: Gleiches Gleis, Zeit vor Abfahrt (max 60 Min)
            const depTime = this._timeToMinutes(dep.scheduledTime);
            if (depTime === null) continue;

            let bestMatch = null;
            let minDiff = 61; // Max 60 Minuten

            for (const arr of arrivals) {
                // Gleis Check (Platform oder ezGleis)
                const depGleis = dep.ezGleis || dep.platform;
                const arrGleis = arr.ezGleis || arr.platform;

                if (!depGleis || !arrGleis || depGleis !== arrGleis) continue;

                // Ist die Ankunft bereits verknüpft?
                const isLinked = departures.some(d => d.linkedArrivalJourneyId === arr.id);
                if (isLinked) continue;

                const arrTime = this._timeToMinutes(arr.scheduledTime);
                if (arrTime === null) continue;

                let diff = depTime - arrTime;
                if (diff < 0) diff += 24 * 60; // Tageswechsel

                if (diff >= 0 && diff <= 60) {
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestMatch = arr;
                    }
                }
            }

            if (bestMatch) {
                dep.linkedArrivalJourneyId = bestMatch.id;
            }
        }
    }

    /** Helper: HH:MM zu Minuten seit Mitternacht */
    _timeToMinutes(timeStr) {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    }

    // ==========================================
    // Import
    // ==========================================

    /**
     * Importiert Journeys aus einem DB-API Abfahrtstafel-JSON.
     * @param {object} data - { entries: [...] }
     * @returns {Journey[]} Die erstellten Journeys
     */
    importFromDepartureList(data) {
        return this._importList(data, false);
    }

    /**
     * Importiert Journeys aus einem DB-API Ankunftstafel-JSON.
     * @param {object} data - { entries: [...] }
     * @returns {Journey[]} Die erstellten Journeys
     */
    importFromArrivalList(data) {
        return this._importList(data, true);
    }

    _importList(data, isArrival) {
        const entries = data.entries || [];
        const created = [];

        for (const entry of entries) {
            const journey = Journey.fromDepartureEntry(entry);
            journey.ankunft = isArrival;

            // Duplikate vermeiden: Selbe HAFAS journeyId + selbe Ankunft/Abfahrt-Rolle
            if (journey.journeyId) {
                const isDuplicate = this.journeys.some(j => 
                    j.journeyId === journey.journeyId && j.ankunft === isArrival
                );
                if (isDuplicate) continue;
            }

            this.journeys.push(journey);
            created.push(journey);
        }

        // Auto-Coupling erkennen: Gleiche Zeit + Gleiches Gleis = Flügelzug
        this._detectCouplings(created);
        
        // Auto-Link für mögliche Wenden & Durchfahrten
        this.autoLinkJourneys();

        return created;
    }

    /**
     * Importiert eine Journey aus einem DB-API Journey/Zuglauf-JSON.
     * Erkennt automatisch unterschiedliche Ankunfts/Abfahrtsgleise (Fahrzeugtausch) 
     * und spaltet die Journey dann auf.
     * @param {object} data - Das Zuglauf-Objekt
     * @returns {Journey|Journey[]} Die erstellte(n) Journey(s)
     */
    importFromJourney(data) {
        // Initial als eine Journey parsen, um zu prüfen
        const journey = Journey.fromJourneyData(data, this.stationContext.stationId);
        
        let splitNeeded = false;
        let aPlan, aEz, dPlan, dEz;

        const idx = journey._currentStopIndex;
        if (idx >= 0 && data.halte && data.halte[idx]) {
            const haltData = data.halte[idx];
            if (haltData.ankunft && haltData.abfahrt) {
                aPlan = haltData.ankunft.gleis || '';
                aEz = haltData.ankunft.ezGleis || '';
                dPlan = haltData.abfahrt.gleis || '';
                dEz = haltData.abfahrt.ezGleis || '';
                
                const arrGleis = aEz || aPlan;
                const depGleis = dEz || dPlan;
                
                if (arrGleis && depGleis && arrGleis !== depGleis) {
                    splitNeeded = true;
                }
            }
        }

        if (splitNeeded) {
            // Wir splitten die Journey!
            const arrJourney = Journey.fromJourneyData(data, this.stationContext.stationId);
            const depJourney = Journey.fromJourneyData(data, this.stationContext.stationId);
            
            // 1. Reine Ankunft
            arrJourney.id = crypto.randomUUID();
            arrJourney.ankunft = true;
            arrJourney.platform = aPlan;
            arrJourney.ezGleis = aEz;
            arrJourney.stops = arrJourney.stops.slice(0, idx + 1);
            if (arrJourney.stops.length > 0) {
                arrJourney.stops[arrJourney.stops.length - 1].departure = null;
                arrJourney.destination = arrJourney.stops[0]?.name || '';
            }

            // 2. Reine Abfahrt
            depJourney.id = crypto.randomUUID();
            depJourney.ankunft = false;
            depJourney.platform = dPlan;
            depJourney.ezGleis = dEz;
            depJourney.stops = depJourney.stops.slice(idx);
            depJourney._currentStopIndex = 0;
            if (depJourney.stops.length > 0) {
                depJourney.stops[0].arrival = null;
                depJourney.destination = depJourney.stops[depJourney.stops.length - 1]?.name || '';
            }

            this.journeys.push(arrJourney);
            this.journeys.push(depJourney);
            this.autoLinkJourneys();
            return [arrJourney, depJourney];
        }

        this.journeys.push(journey);
        this.autoLinkJourneys();
        return journey;
    }

    /**
     * Importiert eine Formation und weist sie einer Journey zu.
     * @param {string} journeyId - Die Journey-ID
     * @param {object} data - Das Formation-JSON (DB API Format)
     */
    importFormation(journeyId, data) {
        const journey = this.getJourney(journeyId);
        if (!journey) return;
        journey.formation = new Formation(data);
    }

    /**
     * Erkennt automatisch Flügelzüge: Gleiche Abfahrtszeit + gleiches Gleis.
     * @private
     */
    _detectCouplings(journeys) {
        const groups = {};
        for (const j of journeys) {
            const key = `${j.scheduledTime}_${j.platform}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(j);
        }

        for (const group of Object.values(groups)) {
            if (group.length > 1) {
                const groupId = crypto.randomUUID();
                group.forEach(j => { j.couplingGroupId = groupId; });
            }
        }
    }

    // ==========================================
    // Tracks / Gleise
    // ==========================================

    /**
     * Sammelt alle einzigartigen Gleise (Plan- und Echtzeit-Gleis) aus allen Journeys.
     * @returns {string[]} Sortierte Liste der Gleise
     */
    getAllTracks() {
        const tracks = new Set();
        let hasNoTrack = false;

        for (const j of this.journeys) {
            if (j.platform) tracks.add(j.platform.toString());
            if (j.ezGleis) tracks.add(j.ezGleis.toString());
            
            if (!j.platform && !j.ezGleis) {
                hasNoTrack = true;
            }
        }

        const sortedTracks = Array.from(tracks).sort((a, b) => {
            // Natürliche Sortierung (z.B. '2' vor '10')
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        if (hasNoTrack) {
            sortedTracks.push('Ohne Gleis');
        }

        return sortedTracks;
    }

    // ==========================================
    // Export
    // ==========================================

    /**
     * Exportiert den gesamten Store als JSON-kompatibles Objekt.
     * @returns {object}
     */
    exportAll() {
        return {
            stationContext: {
                stationName: this.stationContext.stationName,
                stationId: this.stationContext.stationId,
                platform: this.stationContext.platform
            },
            journeys: this.journeys,
            nrwMode: this.nrwMode,
            activeTracks: this.activeTracks
        };
    }

    /**
     * Importiert einen komplett exportierten Store.
     * @param {object} data
     */
    importAll(data) {
        if (data.stationContext) {
            this.stationContext.stationName = data.stationContext.stationName || '';
            this.stationContext.stationId = data.stationContext.stationId || '';
            if (data.stationContext.platform) {
                this.stationContext.platform = new Platform(data.stationContext.platform);
            }
        }

        this.nrwMode = data.nrwMode || false;
        this.activeTracks = data.activeTracks || [];

        this.journeys = (data.journeys || []).map(j => new Journey(j));
    }

    // ==========================================
    // Rückwärtskompatibilitäts-Helfer für Renderer
    // ==========================================

    /**
     * Gibt das Platform-Objekt zurück (für formationRenderer).
     * Behält die alte trainData.platform-Schnittstelle bei.
     */
    get platform() {
        return this.stationContext.platform;
    }
}
