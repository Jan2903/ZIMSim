import { parseTrack, sectionsOverlap } from '../../../core/utils/trackUtils.js';

/**
 * Service für die Verknüpfung von Ankünften und Abfahrten
 * (Wenden, Durchfahrten, Fahrzeugtausch).
 */
export class JourneyLinkingService {
    /**
     * Holt die verknüpfte Ankunfts-Journey einer Abfahrt, 
     * oder die verknüpfte Abfahrts-Journey einer Ankunft.
     * @param {Array} journeys - Liste aller Journeys
     * @param {string} id - Die ID der Journey
     * @returns {object|null} Die verknüpfte Journey oder null
     */
    static getLinkedJourney(journeys, id) {
        const journey = journeys.find(j => j.id === id);
        if (!journey) return null;

        if (journey.ankunft) {
            // Finde die Abfahrt, die auf diese Ankunft zeigt
            return journeys.find(j => !j.ankunft && j.linkedArrivalJourneyId === id) || null;
        } else {
            // Finde die Ankunft, auf die diese Abfahrt zeigt
            if (!journey.linkedArrivalJourneyId) return null;
            return journeys.find(j => j.id === journey.linkedArrivalJourneyId) || null;
        }
    }

    /**
     * Verknüpft eine Ankunft mit einer Abfahrt (in beliebiger Reihenfolge).
     * Löst vorherige Verknüpfungen beider Partner automatisch und sauber auf.
     * @param {Array} journeys - Liste aller Journeys
     * @param {string} id1 - ID der ersten Journey
     * @param {string} id2 - ID der zweiten Journey
     * @returns {boolean} true bei Erfolg
     */
    static link(journeys, id1, id2) {
        const j1 = journeys.find(j => j.id === id1);
        const j2 = journeys.find(j => j.id === id2);
        if (!j1 || !j2) return false;

        let arrival = null;
        let departure = null;

        if (j1.ankunft && !j2.ankunft) {
            arrival = j1;
            departure = j2;
        } else if (!j1.ankunft && j2.ankunft) {
            departure = j1;
            arrival = j2;
        } else {
            console.warn("JourneyLinkingService.link: Es muss genau eine Ankunft und eine Abfahrt verknüpft werden.");
            return false;
        }

        // 1. Falls die Ankunft bereits mit einer anderen Abfahrt verknüpft war, diese auflösen
        journeys.forEach(j => {
            if (!j.ankunft && j.linkedArrivalJourneyId === arrival.id && j.id !== departure.id) {
                j.linkedArrivalJourneyId = null;
            }
        });

        // 2. Abfahrt mit der Ankunft verknüpfen
        departure.linkedArrivalJourneyId = arrival.id;

        // Sicherstellen, dass auf der Ankunft selbst kein verwaister linkedArrivalJourneyId liegt
        arrival.linkedArrivalJourneyId = null;

        return true;
    }

    /**
     * Löst die Verknüpfung einer Journey auf (egal ob Ankunft oder Abfahrt).
     * @param {Array} journeys - Liste aller Journeys
     * @param {string} id - Journey-ID
     * @returns {boolean} true wenn gefunden
     */
    static unlink(journeys, id) {
        const journey = journeys.find(j => j.id === id);
        if (!journey) return false;

        if (journey.ankunft) {
            // Alle Abfahrten finden, die auf diese Ankunft verweisen, und entkoppeln
            journeys.forEach(j => {
                if (j.linkedArrivalJourneyId === id) {
                    j.linkedArrivalJourneyId = null;
                }
            });
        } else {
            journey.linkedArrivalJourneyId = null;
        }
        return true;
    }

    /**
     * Schaltet den Modus einer Journey zwischen Ankunft und Abfahrt um
     * und bereinigt bestehende Verknüpfungen.
     * @param {Array} journeys - Liste aller Journeys
     * @param {string} id - Journey-ID
     * @returns {boolean} true wenn gefunden
     */
    static toggleMode(journeys, id) {
        const journey = journeys.find(j => j.id === id);
        if (!journey) return false;
        this.unlink(journeys, id);
        journey.ankunft = !journey.ankunft;
        return true;
    }

    /**
     * Verknüpft automatisch Ankünfte mit Abfahrten (Wenden / Fahrzeugtausch / Durchfahrten).
     * Basiert auf einem physikalischen Zeitstrahl (Gleisbelegungsplan), um Dritt-Belegungen
     * und Echtzeit-Szenarien fehlerfrei zu erkennen.
     * @param {Array} journeys - Liste aller Journeys
     */
    static autoLink(journeys) {
        // Phase 1: Reset aller heuristischen Verknüpfungen
        journeys.forEach(j => {
            if (!j.ankunft && j.linkedArrivalJourneyId) {
                const arr = journeys.find(a => a.id === j.linkedArrivalJourneyId);
                // Wenn es keine exakte Durchfahrt ist (journeyId identisch), Link entfernen
                if (!arr || !j.journeyId || !arr.journeyId || j.journeyId !== arr.journeyId) {
                    j.linkedArrivalJourneyId = null;
                }
            }
        });

        const arrivals = journeys.filter(j => j.ankunft && !j.ausfall);
        const departures = journeys.filter(j => !j.ankunft && !j.ausfall);
        
        // Echte Durchfahrten (gleiche journeyId) sicherstellen (falls neue Imports dazu kamen)
        for (const dep of departures) {
            if (dep.linkedArrivalJourneyId) continue;
            if (dep.journeyId) {
                const exactMatch = arrivals.find(a => a.journeyId === dep.journeyId);
                if (exactMatch) {
                    dep.linkedArrivalJourneyId = exactMatch.id;
                }
            }
        }

        const MAX_TURNAROUND = 180;

        // Phase 2 & 3: Chronologischer Scan in die Zukunft für jede Ankunft
        for (const A of arrivals) {
            // Bereits durch API oder Durchfahrt fix verknüpft? (Wird sie von einer Abfahrt referenziert?)
            const isAlreadyLinked = departures.some(d => d.linkedArrivalJourneyId === A.id);
            if (isAlreadyLinked) continue;

            const trackStrA = A.ezGleis || A.platform;
            const baseA = parseTrack(trackStrA);
            if (!baseA.base) continue;

            // Finde alle Events auf demselben Basis-Gleis in den nächsten MAX_TURNAROUND Minuten
            const futureEvents = [];
            for (const T of journeys) {
                if (T.id === A.id || T.ausfall) continue;
                
                const trackStrT = T.ezGleis || T.platform;

                // Überschneiden sich die Gleise? Wenn nicht, stören sie sich physisch nicht
                if (!sectionsOverlap(trackStrA, trackStrT)) continue;

                const diff = this.diffMinutes(
                    A.expectedTime || A.scheduledTime || '00:00', 
                    T.expectedTime || T.scheduledTime || '00:00'
                );
                
                if (diff >= 0 && diff <= MAX_TURNAROUND) {
                    futureEvents.push({ journey: T, diff: diff });
                }
            }

            // Sortiere chronologisch ausgehend von A
            futureEvents.sort((a, b) => a.diff - b.diff);

            // Scanne die Zukunft
            let linkedAny = false;
            let currentDiff = -1;

            for (const event of futureEvents) {
                const T = event.journey;
                
                // Wenn wir bereits Verknüpfungen gemacht haben (z.B. bei diff=63), 
                // und das nächste Event hat eine größere Diff (z.B. diff=65), 
                // dann war's das (wir lassen die Flügelzüge auf gleicher Minute zu).
                if (linkedAny && event.diff > currentDiff) {
                    break;
                }

                // Ist T eine passende, unverknüpfte Abfahrt?
                if (!T.ankunft && !T.linkedArrivalJourneyId) {
                    const operatorMatch = (!A.operator || !T.operator || A.operator === T.operator);
                    
                    const arrPlan = A.scheduledTime || '00:00';
                    const depPlan = T.scheduledTime || '00:00';
                    const diffPlan = this.diffMinutes(arrPlan, depPlan);
                    
                    // Wir akzeptieren die Wende, wenn Operator passt und die Plan-Wende <= 180 Min ist
                    if (operatorMatch && diffPlan <= MAX_TURNAROUND) {
                        // Treffer! Verknüpfen (strikte 1:1 Beziehung)
                        T.linkedArrivalJourneyId = A.id;
                        break;
                    }
                }

                // Wenn T keine passende Abfahrt ist, blockiert es das Gleis!
                // Z.B. ein Fremdzug, eine neue Ankunft, oder eine nicht-passende Abfahrt.
                // Da sich die Abschnitte überschneiden, muss A das Gleis physisch geräumt haben.
                break;
            }
        }
    }

    /**
     * Berechnet die Differenz in Minuten von A bis B (berücksichtigt Tageswechsel).
     * @param {string} timeA - Zeitformat HH:MM
     * @param {string} timeB - Zeitformat HH:MM
     * @returns {number}
     */
    static diffMinutes(timeA, timeB) {
        const minA = this.timeToMinutes(timeA);
        const minB = this.timeToMinutes(timeB);
        if (minA === null || minB === null) return 0;
        let diff = minB - minA;
        if (diff < 0) diff += 24 * 60;
        return diff;
    }

    /**
     * Wandelt HH:MM in Minuten seit Mitternacht um.
     * @param {string} timeStr - Zeitformat HH:MM
     * @returns {number|null}
     */
    static timeToMinutes(timeStr) {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    }
}
