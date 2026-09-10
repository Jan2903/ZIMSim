import { getMotForCategory } from '../../station/motManager.js';
import { JourneyCouplingService } from './journeyCouplingService.js';

/**
 * Service für Filterung, Sichtbarkeitsprüfung und Display-Slot-Zuweisung.
 */
export class JourneyFilterService {
    /**
     * Prüft, ob eine Journey in der Listenansicht ausgeblendet werden soll.
     * Konsolidiert die Logik aus JourneyItem.svelte und JourneyStore.
     *
     * @param {object} journey - Die zu prüfende Journey
     * @param {string[]} activeMots - Aktive Verkehrsmittel-Filter
     * @param {string[]} activeTracks - Aktive Gleis-Filter
     * @param {Array} journeys - Gesamte Journey-Liste (für verknüpfte Züge)
     * @param {boolean} [hideLinkedArrivals=false] - Ob verknüpfte Ankünfte ausgeblendet werden sollen
     * @param {boolean} [isExpanded=false] - Ob die Fahrt in der UI aktuell ausgeklappt ist
     * @returns {boolean} true wenn ausgeblendet
     */
    static isJourneyHidden(journey, activeMots, activeTracks, journeys, hideLinkedArrivals = false, isExpanded = false) {
        // 1. Check Verkehrsmittel Filter
        const mot = getMotForCategory(journey.produktGattung || journey.name || journey.category);
        if (mot && !activeMots.includes(mot)) return true;

        // 2. Check Gleis Filter
        if (activeTracks.length > 0) {
            const hasPlatform = journey.platform && activeTracks.includes(journey.platform.toString());
            const hasEzGleis = journey.ezGleis && activeTracks.includes(journey.ezGleis.toString());
            const hasNoTrackCondition = (!journey.platform && !journey.ezGleis && activeTracks.includes('Ohne Gleis'));
            
            if (!hasPlatform && !hasEzGleis && !hasNoTrackCondition) return true;
        }

        // 3. Check verknüpfte Ankünfte bei eingeklappter Ansicht
        if (hideLinkedArrivals && journey.ankunft && !isExpanded) {
            const linkedDep = journeys.find(j => !j.ankunft && j.linkedArrivalJourneyId === journey.id);
            if (linkedDep && linkedDep.name === journey.name) {
                return true;
            }
        }

        return false;
    }

    /**
     * Gibt alle sichtbaren Journeys zurück (visible === true und passendes Verkehrsmittel/Gleis).
     * @param {Array} journeys - Liste aller Journeys
     * @param {string[]} activeMots - Aktive MOTs
     * @param {string[]} activeTracks - Aktive Gleise
     * @param {object} [options={ boardType: 'default' }] - Layout/BoardType Optionen
     * @returns {Array}
     */
    static getVisible(journeys, activeMots, activeTracks, options = { boardType: 'default' }) {
        return journeys.filter(j => {
            if (!j.visible) return false;
            
            // Check Verkehrsmittel Filter
            const mot = getMotForCategory(j.produktGattung || j.name || j.category);
            if (mot && !activeMots.includes(mot)) {
                return false;
            }

            // Check Gleis Filter
            if (activeTracks.length > 0) {
                const hasPlatform = j.platform && activeTracks.includes(j.platform.toString());
                const hasEzGleis = j.ezGleis && activeTracks.includes(j.ezGleis.toString());
                const hasNoTrackCondition = (!j.platform && !j.ezGleis && activeTracks.includes('Ohne Gleis'));
                
                if (!hasPlatform && !hasEzGleis && !hasNoTrackCondition) {
                    return false;
                }
            }

            // Layout-spezifische Filterung (Ankunft vs. Abfahrt)
            const boardType = options.boardType;

            if (boardType === 'departuresOnly') {
                if (j.ankunft) return false;
            } else if (boardType === 'arrivalsOnly') {
                if (!j.ankunft) return false;
            } else if (boardType === 'mixed') {
                // Zeigt alles an (kein Filter nötig)
            } else {
                // 'default': Zeige Abfahrten + ungebundene Ankünfte. 
                // Ankünfte, die mit einer Abfahrt verknüpft sind, sollen nicht separat auf dem Monitor erscheinen.
                if (j.ankunft) {
                    const isLinkedToDeparture = journeys.some(
                        dep => !dep.ankunft && dep.linkedArrivalJourneyId === j.id
                    );
                    if (isLinkedToDeparture) {
                        return false;
                    }
                }
            }
            
            return true;
        });
    }

    /**
     * Gibt alle sichtbaren Journey-Gruppen zurück.
     * Gekoppelte Journeys werden als eine Gruppe zusammengefasst.
     * @param {Array} journeys - Liste aller Journeys
     * @param {string[]} activeMots - Aktive MOTs
     * @param {string[]} activeTracks - Aktive Gleise
     * @param {object} [options={ boardType: 'default' }] - Layout/BoardType Optionen
     * @returns {Array<Array>} Array von Journey-Gruppen
     */
    static getVisibleGroups(journeys, activeMots, activeTracks, options = { boardType: 'default' }) {
        const visible = this.getVisible(journeys, activeMots, activeTracks, options);
        const groups = [];
        const seenCouplings = new Set();

        for (const j of visible) {
            if (j.couplingGroupId) {
                if (seenCouplings.has(j.couplingGroupId)) continue;
                seenCouplings.add(j.couplingGroupId);
                groups.push(JourneyCouplingService.expandCoupling(journeys, j));
            } else {
                groups.push([j]);
            }
        }

        return groups;
    }

    /**
     * Gibt die Journey(s) für einen bestimmten Screen-Slot zurück.
     * Bei gekoppelten Journeys werden alle Journeys der Coupling-Gruppe zurückgegeben.
     *
     * @param {Array} journeys - Liste aller Journeys
     * @param {string[]} activeMots - Aktive MOTs
     * @param {string[]} activeTracks - Aktive Gleise
     * @param {number} slot - 1=Hauptmonitor, 2=Neben1, 3=Neben2
     * @param {object} [options={ boardType: 'default' }] - Filter-Optionen
     * @returns {Array} Array von Journeys (1 oder mehrere bei Coupling)
     */
    static getForSlot(journeys, activeMots, activeTracks, slot, options = { boardType: 'default' }) {
        // 1. Zuerst: Manuell zugewiesene Journeys für diesen Slot
        const manuallyAssigned = journeys.find(
            j => j.visible && j.displaySlot === slot
        );

        if (manuallyAssigned) {
            return JourneyCouplingService.expandCoupling(journeys, manuallyAssigned);
        }

        // 2. Fallback: Auto-Zuweisung
        // Gekoppelte Journeys werden als eine Einheit gezählt
        const visible = this.getVisible(journeys, activeMots, activeTracks, options);
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
                groups.push(JourneyCouplingService.expandCoupling(journeys, j));
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
     * Gibt die Journeys zurück, die für den rotierenden Monitor verfügbar sind.
     * Das sind sichtbare Journeys, die nicht auf Slot 1 oder 2 liegen.
     * @param {Array} journeys - Liste aller Journeys
     * @param {string[]} activeMots - Aktive MOTs
     * @param {string[]} activeTracks - Aktive Gleise
     * @param {object} [options={ boardType: 'default' }] - Filter-Optionen
     * @returns {Array}
     */
    static getRotating(journeys, activeMots, activeTracks, options = { boardType: 'default' }) {
        const slot1 = this.getForSlot(journeys, activeMots, activeTracks, 1, options).map(j => j.id);
        const slot2 = this.getForSlot(journeys, activeMots, activeTracks, 2, options).map(j => j.id);
        const fixed = new Set([...slot1, ...slot2]);
        return this.getVisible(journeys, activeMots, activeTracks, options).filter(j => !fixed.has(j.id));
    }

    /**
     * Sammelt alle einzigartigen Gleise (Plan- und Echtzeit-Gleis) aus allen Journeys.
     * @param {Array} journeys - Liste aller Journeys
     * @returns {string[]} Sortierte Liste der Gleise
     */
    static getAllTracks(journeys) {
        const tracks = new Set();
        let hasNoTrack = false;

        for (const j of journeys) {
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
}
