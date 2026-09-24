// src/js/features/journey/services/journeyConnectionService.js
import { isOppositeTrack } from '../../../core/utils/trackUtils.js';
import { JourneyLinkingService } from './journeyLinkingService.js';
import { JourneyCouplingService } from './journeyCouplingService.js';

/**
 * Service zur Ermittlung erreichbarer Anschlusszüge.
 * Berechnet Umsteigezeiten, erkennt gegenüberliegende Mittelbahnsteige und filtert
 * Ausfälle sowie verknüpfte Züge (Wende/Flügelung) heraus.
 */
export class JourneyConnectionService {
    /**
     * Ermittelt den Zeitstempel (ms) einer Fahrt für die gegebene Simulationszeit.
     * @param {object} journey - Das Journey-Objekt
     * @param {Date} simTimeDate - Die aktuelle Simulationszeit
     * @param {boolean} [useEffective=true] - Bevorzugt Echtzeit/Erwartete Zeit
     * @returns {number} Zeitstempel in Millisekunden
     */
    static getJourneyTimeMs(journey, simTimeDate, useEffective = true) {
        if (!journey) return simTimeDate.getTime();
        if (useEffective && journey._effectiveTimeMs) {
            return journey._effectiveTimeMs;
        }
        const timeStr = (useEffective && journey.expectedTime) ? journey.expectedTime : journey.scheduledTime;
        if (!timeStr) return simTimeDate.getTime();

        const [sh, sm] = timeStr.split(':').map(Number);
        if (isNaN(sh) || isNaN(sm)) return simTimeDate.getTime();

        const d = new Date(simTimeDate.getTime());
        d.setHours(sh, sm, 0, 0);

        // Behandle Tagesüberträge (z.B. kurz vor/nach Mitternacht)
        const diff = d.getTime() - simTimeDate.getTime();
        if (diff < -12 * 3600 * 1000) {
            d.setDate(d.getDate() + 1);
        } else if (diff > 12 * 3600 * 1000) {
            d.setDate(d.getDate() - 1);
        }
        return d.getTime();
    }

    /**
     * Ermittelt passende nächste Anschlusszüge für eine Referenzfahrt.
     * Filtert Ausfälle, die eigene Fahrt und verknüpfte Züge heraus und prüft Mindestumsteigezeiten.
     *
     * @param {Array<object>} journeys - Liste aller Journeys
     * @param {object|null} [referenceJourney=null] - Die Bezugsfahrt (Ankunft oder Abfahrt)
     * @param {object} [options={}] - Filter- und Zeitoptionen
     * @param {Date} [options.simulatedTime] - Aktuelle Simulationszeit
     * @param {number} [options.timeWindowMinutes=30] - Suchzeitfenster in Minuten
     * @param {number} [options.minTransferMinutes=4] - Mindestumsteigezeit normal (Minuten)
     * @param {number} [options.minTransferOppositeMinutes=2] - Mindestumsteigezeit direkt gegenüber (Minuten)
     * @param {number} [options.maxCount=3] - Maximale Anzahl Anschlüsse
     * @param {Array<[string, string]>} [options.oppositeTrackPairs=[]] - Konfigurierte Gleispaare
     * @returns {Array<object>} Liste passender Anschluss-Journeys
     */
    static findConnections(journeys, referenceJourney = null, options = {}) {
        if (!journeys || journeys.length === 0) return [];

        const simTimeDate = options.simulatedTime || new Date();
        const maxWindowMs = (options.timeWindowMinutes ?? 30) * 60 * 1000;
        const customTrackPairs = options.oppositeTrackPairs || [];

        // 1. Bezugszeit und Bezugsgleis ermitteln
        let refTimeMs;
        let refTrack = null;

        if (referenceJourney) {
            refTrack = referenceJourney.ezGleis || referenceJourney.platform;
            if (referenceJourney.ankunft) {
                refTimeMs = this.getJourneyTimeMs(referenceJourney, simTimeDate, true);
            } else {
                // Bei Abfahrt: Prüfen, ob eine verknüpfte Ankunft vorliegt
                const linkedArrival = JourneyLinkingService.getLinkedJourney(journeys, referenceJourney.id);
                if (linkedArrival && linkedArrival.ankunft) {
                    refTimeMs = this.getJourneyTimeMs(linkedArrival, simTimeDate, true);
                } else {
                    refTimeMs = this.getJourneyTimeMs(referenceJourney, simTimeDate, true);
                }
            }
        } else {
            refTimeMs = simTimeDate.getTime();
        }

        // 2. Auszuschließende IDs sammeln (eigene Fahrt, Wende-/Flügelpartner)
        const excludeIds = new Set();
        const excludeJourneyIds = new Set();

        if (referenceJourney) {
            excludeIds.add(referenceJourney.id);
            if (referenceJourney.journeyId) excludeJourneyIds.add(referenceJourney.journeyId);
            if (referenceJourney.linkedArrivalJourneyId) excludeIds.add(referenceJourney.linkedArrivalJourneyId);

            const linkedPartner = JourneyLinkingService.getLinkedJourney(journeys, referenceJourney.id);
            if (linkedPartner) {
                excludeIds.add(linkedPartner.id);
                if (linkedPartner.journeyId) excludeJourneyIds.add(linkedPartner.journeyId);
            }

            if (referenceJourney.couplingGroupId) {
                const coupled = JourneyCouplingService.getCouplingGroup(journeys, referenceJourney.couplingGroupId);
                coupled.forEach(c => {
                    excludeIds.add(c.id);
                    if (c.journeyId) excludeJourneyIds.add(c.journeyId);
                });
            }
        }

        // 3. Kandidaten filtern
        const candidates = [];

        for (const candidate of journeys) {
            if (excludeIds.has(candidate.id)) continue;
            if (candidate.journeyId && excludeJourneyIds.has(candidate.journeyId)) continue;
            if (candidate.ankunft) continue; // Nur Abfahrten sind Anschlüsse
            if (candidate.ausfall) continue; // Ausgefallene Züge werden nicht als Anschluss empfohlen
            if (!candidate.destination || !candidate.scheduledTime) continue;

            const connTrack = candidate.ezGleis || candidate.platform;
            const isOpposite = Boolean(refTrack && connTrack && isOppositeTrack(refTrack, connTrack, customTrackPairs));
            const minTransferMin = isOpposite 
                ? (options.minTransferOppositeMinutes ?? 2)
                : (options.minTransferMinutes ?? 4);
            const minTransferMs = minTransferMin * 60 * 1000;

            const candidateEffectiveMs = this.getJourneyTimeMs(candidate, simTimeDate, true);
            const candidateScheduledMs = this.getJourneyTimeMs(candidate, simTimeDate, false);

            const transferTimeMs = candidateEffectiveMs - refTimeMs;

            // Ist die Umsteigezeit ausreichend?
            if (transferTimeMs < minTransferMs) continue;

            // Liegt die Abfahrt im definierten Zeitfenster?
            if (transferTimeMs > maxWindowMs) continue;

            candidates.push({
                journey: candidate,
                effectiveMs: candidateEffectiveMs,
                scheduledMs: candidateScheduledMs,
                isOpposite: isOpposite
            });
        }

        // 4. Sortieren: nach effektiver Abfahrtszeit, dann nach Fahrplanzeit, dann Name
        candidates.sort((a, b) => {
            if (a.effectiveMs !== b.effectiveMs) return a.effectiveMs - b.effectiveMs;
            if (a.scheduledMs !== b.scheduledMs) return a.scheduledMs - b.scheduledMs;
            return (a.journey.name || '').localeCompare(b.journey.name || '');
        });

        const maxCount = options.maxCount ?? 3;
        return candidates.slice(0, maxCount).map(c => c.journey);
    }

    /**
     * Prüft, ob mindestens ein erreichbarer Anschluss für eine Referenzfahrt existiert.
     * @param {Array<object>} journeys - Liste aller Journeys
     * @param {object|null} [referenceJourney=null] - Die Bezugsfahrt
     * @param {object} [options={}] - Filter- und Zeitoptionen
     * @returns {boolean} true wenn mindestens ein Anschluss erreichbar ist
     */
    static hasReachableConnections(journeys, referenceJourney = null, options = {}) {
        const conns = this.findConnections(journeys, referenceJourney, options);
        return conns.length > 0;
    }
}
