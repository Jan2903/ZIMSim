/**
 * Service für Flügelzüge und Zugkopplungen.
 * Verwaltet Kopplungs-Gruppen und automatische Flügelzug-Erkennung.
 */
export class JourneyCouplingService {
    /**
     * Koppelt zwei Journeys zu einem Zugverband.
     * @param {Array} journeys - Liste aller Journeys
     * @param {string} id1 - ID der ersten Journey
     * @param {string} id2 - ID der zweiten Journey
     * @returns {boolean} true bei Erfolg
     */
    static couple(journeys, id1, id2) {
        const j1 = journeys.find(j => j.id === id1);
        const j2 = journeys.find(j => j.id === id2);
        if (!j1 || !j2) return false;

        // Bestehende Gruppen-ID übernehmen oder neue erstellen
        const groupId = j1.couplingGroupId || j2.couplingGroupId || crypto.randomUUID();
        j1.couplingGroupId = groupId;
        j2.couplingGroupId = groupId;
        return true;
    }

    /**
     * Entkoppelt eine Journey aus ihrem Zugverband.
     * @param {Array} journeys - Liste aller Journeys
     * @param {string} id - Journey-ID
     * @returns {boolean} true bei Erfolg
     */
    static uncouple(journeys, id) {
        const journey = journeys.find(j => j.id === id);
        if (!journey || !journey.couplingGroupId) return false;

        const groupId = journey.couplingGroupId;
        journey.couplingGroupId = null;

        // Wenn nur noch eine Journey in der Gruppe, Gruppe auflösen
        const remaining = journeys.filter(j => j.couplingGroupId === groupId);
        if (remaining.length === 1) {
            remaining[0].couplingGroupId = null;
        }
        return true;
    }

    /**
     * Gibt alle Journeys einer Coupling-Gruppe zurück.
     * @param {Array} journeys - Liste aller Journeys
     * @param {string} groupId - UUID der Gruppe
     * @returns {Array} Array der Gruppen-Journeys
     */
    static getCouplingGroup(journeys, groupId) {
        if (!groupId) return [];
        return journeys.filter(j => j.couplingGroupId === groupId);
    }

    /**
     * Expandiert eine Journey zu ihrer Coupling-Gruppe.
     * Wenn nicht gekoppelt, wird ein Array mit der einzelnen Journey zurückgegeben.
     * @param {Array} journeys - Liste aller Journeys
     * @param {object} journey - Die Journey
     * @returns {Array}
     */
    static expandCoupling(journeys, journey) {
        if (!journey) return [];
        if (!journey.couplingGroupId) return [journey];
        return journeys.filter(j => j.couplingGroupId === journey.couplingGroupId);
    }

    /**
     * Erkennt automatisch Flügelzüge: Gleiche Abfahrtszeit + gleiches Gleis.
     * @param {Array} journeys - Zu überprüfende Journeys
     */
    static detectCouplings(journeys) {
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
}
