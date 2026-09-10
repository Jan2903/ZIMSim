/**
 * Service für Reihenfolge, Block-Berechnungen und Sortierung von Fahrten.
 * Verwaltet das zusammenhängende Verschieben von gekoppelten Zügen (Flügelzügen).
 */
export class JourneyReorderService {
    /**
     * Ermittelt Start- und Endindex eines Journey-Blocks (inklusive Kupplung).
     * @param {Array} journeys
     * @param {string} id - Journey-ID
     * @returns {{startIndex: number, endIndex: number}|null}
     */
    static getBlockBounds(journeys, id) {
        const journeyIdx = journeys.findIndex(j => j.id === id);
        if (journeyIdx < 0) return null;

        const journey = journeys[journeyIdx];
        if (!journey.couplingGroupId) {
            return { startIndex: journeyIdx, endIndex: journeyIdx };
        }

        const groupId = journey.couplingGroupId;
        const startIndex = journeys.findIndex(j => j.couplingGroupId === groupId);
        let endIndex = startIndex;
        while (endIndex + 1 < journeys.length && journeys[endIndex + 1].couplingGroupId === groupId) {
            endIndex++;
        }
        
        return { startIndex, endIndex };
    }

    /**
     * Verschiebt einen Block (einzeln oder gekuppelt) um eine Position nach oben.
     * @param {Array} journeys
     * @param {string} id - Journey-ID aus dem Block
     * @returns {boolean} true wenn erfolgreich verschoben
     */
    static moveGroupUp(journeys, id) {
        const bounds = this.getBlockBounds(journeys, id);
        if (!bounds || bounds.startIndex === 0) return false;

        const prevJourney = journeys[bounds.startIndex - 1];
        const prevBounds = this.getBlockBounds(journeys, prevJourney.id);
        if (!prevBounds) return false;
        
        const blockLength = bounds.endIndex - bounds.startIndex + 1;
        const block = journeys.splice(bounds.startIndex, blockLength);
        journeys.splice(prevBounds.startIndex, 0, ...block);
        return true;
    }

    /**
     * Verschiebt einen Block (einzeln oder gekuppelt) um eine Position nach unten.
     * @param {Array} journeys
     * @param {string} id - Journey-ID aus dem Block
     * @returns {boolean} true wenn erfolgreich verschoben
     */
    static moveGroupDown(journeys, id) {
        const bounds = this.getBlockBounds(journeys, id);
        if (!bounds || bounds.endIndex === journeys.length - 1) return false;

        const nextJourney = journeys[bounds.endIndex + 1];
        const nextBounds = this.getBlockBounds(journeys, nextJourney.id);
        if (!nextBounds) return false;

        const blockLength = bounds.endIndex - bounds.startIndex + 1;
        const block = journeys.splice(bounds.startIndex, blockLength);
        
        const newIndex = nextBounds.endIndex - blockLength + 1;
        journeys.splice(newIndex, 0, ...block);
        return true;
    }

    /**
     * Verschiebt einen Block an einen Ziel-Index (Drag & Drop).
     * @param {Array} journeys
     * @param {string} id - Journey-ID aus dem gezogenen Block
     * @param {number} targetIndex - Wo der Block eingefügt werden soll (vor der Entnahme berechnet!)
     * @returns {boolean} true wenn erfolgreich verschoben
     */
    static moveGroupToIndex(journeys, id, targetIndex) {
        const bounds = this.getBlockBounds(journeys, id);
        if (!bounds) return false;

        // Wenn der Target-Index innerhalb des eigenen Blocks liegt, tun wir nichts
        if (targetIndex >= bounds.startIndex && targetIndex <= bounds.endIndex + 1) return false;

        const blockLength = bounds.endIndex - bounds.startIndex + 1;
        
        let adjustedTarget = targetIndex;
        if (targetIndex > bounds.endIndex) {
            adjustedTarget -= blockLength;
        }

        const block = journeys.splice(bounds.startIndex, blockLength);
        journeys.splice(adjustedTarget, 0, ...block);
        return true;
    }

    /**
     * Sortiert alle Fahrten aufsteigend nach ihrer Abfahrts-/Ankunftszeit.
     * Nutzt bevorzugt Echtzeitdaten (_effectiveTimeMs).
     * @param {Array} journeys
     */
    static sortJourneys(journeys) {
        journeys.sort((a, b) => {
            const timeA = a._effectiveTimeMs || Infinity;
            const timeB = b._effectiveTimeMs || Infinity;
            
            if (timeA === timeB) {
                // Bei exakt gleicher Zeit (z.B. Flügelzüge) nach ID/Name sortieren, 
                // um Flackern zu verhindern
                return a.name.localeCompare(b.name);
            }
            return timeA - timeB;
        });
    }
}
