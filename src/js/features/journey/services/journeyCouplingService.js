import { sectionsOverlap } from '../../../core/utils/trackUtils.js';
import { combineTrainNames } from '../trainNumberFormatter.js';

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
        // Manuelle Kopplung vor Auto-Erkennung schützen
        j1.couplingManual = true;
        j2.couplingManual = true;
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
        // Manuelle Entkopplung vor Auto-Erkennung schützen
        journey.couplingManual = true;

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
     * Liefert die Coupling-Gruppe einer Fahrt für Ansagen.
     * Ist die Fahrt nicht gekoppelt, wird ein Array mit der Fahrt selbst zurückgegeben.
     *
     * @param {Array<object>} journeys - Alle Fahrten des Stores
     * @param {object} journey - Die Bezugsfahrt
     * @returns {Array<object>} Gruppe in Store-Reihenfolge
     */
    static getAnnouncementGroup(journeys, journey) {
        if (!journey) return [];
        const group = this.expandCoupling(journeys || [], journey);
        return group.length > 0 ? group : [journey];
    }

    /**
     * Filtert ausgefallene Mitglieder aus einer Coupling-Gruppe für die Ansage.
     *
     * @param {Array<object>} group - Coupling-Gruppe
     * @returns {Array<object>} Aktive Gruppenmitglieder
     */
    static getActiveAnnouncementGroup(group) {
        if (!group) return [];
        return group.filter(j => j && !j.ausfall);
    }

    /**
     * Ermittelt das für die gesamte Coupling-Gruppe gültige Gleis.
     * Bevorzugt ein gemeinsames Echtzeitgleis; sonst ein gemeinsames Plangleis.
     * Bei widersprüchlichen Gleisen wird null zurückgegeben.
     *
     * @param {Array<object>} group - Coupling-Gruppe
     * @returns {object|null} Journey mit dem gültigen Gleis oder null
     */
    static getGroupPlatformJourney(group) {
        if (!group || group.length === 0) return null;

        const realtimePlatforms = [...new Set(
            group.map(j => (j.ezGleis || '').trim()).filter(Boolean)
        )];
        if (realtimePlatforms.length === 1) {
            return group.find(j => (j.ezGleis || '').trim() === realtimePlatforms[0]) || null;
        }
        if (realtimePlatforms.length > 1) return null;

        const plannedPlatforms = [...new Set(
            group.map(j => (j.platform || '').trim()).filter(Boolean)
        )];
        if (plannedPlatforms.length === 1) {
            return group.find(j => (j.platform || '').trim() === plannedPlatforms[0]) || null;
        }
        return null;
    }

    /**
     * Liefert die zukünftigen Teilungsbahnhöfe als Stationsobjekte für die Ansage.
     *
     * @param {Array<object>} group - Coupling-Gruppe
     * @param {string|null} [currentStation=null] - Name des aktuellen Bahnhofs
     * @returns {Array<{name: string, extId: string}>} Teilungsbahnhöfe
     */
    static getUpcomingSplitStations(group, currentStation = null) {
        const names = this.detectUpcomingSplitStations(group, currentStation);
        if (names.length === 0) return [];

        const allStops = (group || []).flatMap(j => j.stops || []);
        const seen = new Set();

        return names.map(name => {
            const normalized = String(name || '').trim().toLowerCase();
            if (!normalized || seen.has(normalized)) return null;
            seen.add(normalized);

            const stop = allStops.find(s => String(s?.name || '').trim().toLowerCase() === normalized);
            return {
                name: stop?.name || name,
                extId: stop?.extId || ''
            };
        }).filter(Boolean);
    }

    /**
     * Ermittelt, ob eine Coupling-Gruppe sich am aktuellen Bahnhof vereinigt.
     * Route-basiert: Der aktuelle Bahnhof ist der erste gemeinsame Halt der
     * bisherigen Routen. Ohne Haltdaten dient ein gesetztes IRIS-Wings-Feld
     * als Fallback.
     *
     * @param {Array<object>} group - Coupling-Gruppe
     * @param {string|null} [currentStation=null] - Name des aktuellen Bahnhofs
     * @returns {boolean}
     */
    static isJoiningAtCurrentStation(group, currentStation = null) {
        if (!group || group.length < 2) return false;

        const hasWings = group.some(j => Boolean(j.wingsRaw));
        const target = String(currentStation || '').trim().toLowerCase();
        if (!target) return hasWings;

        const routes = group.map(j => {
            const stops = (j.stops || []).map(s => String(s?.name || '').trim().toLowerCase());
            const idx = stops.lastIndexOf(target);
            return idx >= 0 ? stops.slice(0, idx + 1) : null;
        });

        if (routes.some(r => r === null)) return hasWings;

        const previousStops = routes.map(r => r.length >= 2 ? r[r.length - 2] : null);
        const nonEmptyPrevious = previousStops.filter(Boolean);

        // Mindestens ein Zug beginnt am aktuellen Bahnhof oder die Vorgängerhalte
        // unterscheiden sich -> die Vereinigung erfolgt hier.
        if (previousStops.some(p => p === null)) return true;
        if (new Set(nonEmptyPrevious).size > 1) return true;

        return false;
    }

    /**
     * Prüft, ob alle Journeys in einer Gruppe identisches Ziel, Vias und Planzeit haben.
     * Wenn ja, können sie zu einer gemeinsamen Anzeige zusammengefasst werden.
     * @param {Array<object>} journeys
     * @returns {boolean}
     */
    static areJourneysMerged(journeys) {
        if (!journeys || journeys.length <= 1) return true;
        const firstDest = (journeys[0].destination || "").trim();
        const firstVias = (journeys[0].vias || []).join('|').trim();
        const firstTime = (journeys[0].scheduledTime || "").trim();
        for (let i = 1; i < journeys.length; i++) {
            if ((journeys[i].destination || "").trim() !== firstDest) return false;
            if ((journeys[i].vias || []).join('|').trim() !== firstVias) return false;
            if ((journeys[i].scheduledTime || "").trim() !== firstTime) return false;
        }
        return true;
    }

    /**
     * Ermittelt die zukünftigen Bahnhöfe im Fahrtverlauf, an denen sich gekoppelte Züge trennen.
     * Berücksichtigt auch Züge, die früher auf der Strecke enden.
     *
     * @param {Array<object>} journeys - Die gekoppelten Journeys
     * @param {string|null} [currentStation=null] - Optionaler aktueller Bahnhof (um vergangene Halte zu ignorieren)
     * @returns {string[]} Array von Stationsnamen in chronologischer Reihenfolge der Zugteilung
     */
    static detectUpcomingSplitStations(journeys, currentStation = null) {
        if (!journeys || journeys.length < 2) return [];

        // Wenn alle Fahrten dasselbe Ziel und Vias haben, gibt es keine Zugteilung
        if (this.areJourneysMerged(journeys)) return [];

        // 1. Zukünftige Routen der einzelnen Fahrten aufbereiten
        const routes = journeys.map(j => {
            let list = [];
            if (j.stops && j.stops.length > 0) {
                const startIdx = j._currentStopIndex >= 0 ? j._currentStopIndex + 1 : 0;
                list = j.stops.slice(startIdx).filter(s => !s.cancelled && !s.isCancelled).map(s => (s.name || '').trim());
            } else {
                list = [...(j.vias || []).map(v => (v || '').trim())];
            }
            const dest = (j.destination || '').trim();
            if (dest && (list.length === 0 || list[list.length - 1] !== dest)) {
                list.push(dest);
            }
            // Falls ein aktueller Bahnhof angegeben ist, Stationen bis dorthin abschneiden
            if (currentStation) {
                const normCurrent = currentStation.trim().toLowerCase();
                const currIdx = list.findIndex(name => name.toLowerCase() === normCurrent);
                if (currIdx !== -1) {
                    list = list.slice(currIdx + 1);
                }
            }
            return list;
        });

        const splitStationsSet = new Set();
        const splitStationsOrder = [];

        // 2. Paarweiser Vergleich der Routen
        for (let a = 0; a < routes.length; a++) {
            for (let b = a + 1; b < routes.length; b++) {
                const rA = routes[a];
                const rB = routes[b];

                // Wenn beide Routen leer sind oder identisch sind, trennen sie sich hier nicht
                if (rA.join('|') === rB.join('|')) continue;

                // Finde den letzten gemeinsamen Halt vor der ersten Verzweigung
                let lastCommonStop = null;
                const minLen = Math.min(rA.length, rB.length);
                for (let k = 0; k < minLen; k++) {
                    if (rA[k].toLowerCase() === rB[k].toLowerCase()) {
                        lastCommonStop = rA[k];
                    } else {
                        break; // Erste Divergenz gefunden!
                    }
                }

                // Sonderfall: Eine Fahrt endet früher auf derselben Strecke (z.B. rB ist Präfix von rA)
                if (!lastCommonStop && minLen > 0 && rA[0].toLowerCase() === rB[0].toLowerCase()) {
                    lastCommonStop = rA[minLen - 1];
                }

                if (lastCommonStop && !splitStationsSet.has(lastCommonStop.toLowerCase())) {
                    splitStationsSet.add(lastCommonStop.toLowerCase());
                    splitStationsOrder.push(lastCommonStop);
                }
            }
        }

        return splitStationsOrder;
    }

    /**
     * Generiert den Informationstext für Zugteilungen (rein Deutsch, z.B. "Zugteilung in Hamm (Westf) Hbf").
     * Bei mehreren Teilungsbahnhöfen: "Zugteilung in A und B" bzw. "Zugteilung in A, B und C".
     *
     * @param {Array<object>} journeys
     * @param {string|null} [currentStation=null]
     * @returns {string} Der generierte Infotext oder leer
     */
    static generateSplitText(journeys, currentStation = null) {
        const splitStations = this.detectUpcomingSplitStations(journeys, currentStation);
        if (splitStations.length === 0) return '';

        let stationText = '';
        if (splitStations.length === 1) {
            stationText = splitStations[0];
        } else if (splitStations.length === 2) {
            stationText = `${splitStations[0]} und ${splitStations[1]}`;
        } else {
            stationText = `${splitStations.slice(0, -1).join(', ')} und ${splitStations[splitStations.length - 1]}`;
        }

        return `Zugteilung in ${stationText}`;
    }

    /**
     * Erkennt automatisch Flügelzüge über Gleis, Abfahrtszeit, IRIS-Wings und Fahrtverlauf.
     * Gruppiert gekoppelte Züge konsistent und bereinigt Einzelverknüpfungen.
     * Manuell gekoppelte oder entkoppelte Fahrten (couplingManual) werden nicht verändert.
     * @param {Array} journeys - Zu überprüfende Journeys
     * @returns {boolean} true, wenn sich Kopplungen geändert haben
     */
    static detectCouplings(journeys) {
        if (!journeys || journeys.length === 0) return false;

        const n = journeys.length;
        let changed = false;

        // Verwaiste manuelle Einzelgruppen auflösen (z. B. Partner wurde gelöscht)
        const groupCounts = new Map();
        for (const j of journeys) {
            if (j.couplingGroupId) {
                groupCounts.set(j.couplingGroupId, (groupCounts.get(j.couplingGroupId) || 0) + 1);
            }
        }
        for (const j of journeys) {
            if (j.couplingManual && j.couplingGroupId && groupCounts.get(j.couplingGroupId) === 1) {
                j.couplingGroupId = null;
                changed = true;
            }
        }

        const parent = Array.from({ length: n }, (_, i) => i);
        function find(i) {
            if (parent[i] === i) return i;
            parent[i] = find(parent[i]);
            return parent[i];
        }
        function union(i, j) {
            const rootI = find(i);
            const rootJ = find(j);
            if (rootI !== rootJ) parent[rootI] = rootJ;
        }

        // Helper für Plausibilität: Teilen sich die Fahrten mindestens 1 gemeinsamen Halt oder gleiches Ziel?
        function sharesRoute(jA, jB) {
            if (jA.destination && jB.destination && jA.destination.trim().toLowerCase() === jB.destination.trim().toLowerCase()) {
                return true;
            }
            const stopsA = (jA.stops && jA.stops.length > 0)
                ? jA.stops.map(s => (s.name || '').trim().toLowerCase())
                : (jA.vias || []).map(v => (v || '').trim().toLowerCase());
            const stopsB = (jB.stops && jB.stops.length > 0)
                ? jB.stops.map(s => (s.name || '').trim().toLowerCase())
                : (jB.vias || []).map(v => (v || '').trim().toLowerCase());
            return stopsA.some(s => s && stopsB.includes(s));
        }

        // Helper für IRIS-Wings-Referenzierung
        // IRIS liefert in "wings" die Zugnummer(n) des Flügelzug-Partners (z. B. "855" oder "847, 855")
        function matchesWings(jA, jB) {
            if (!jA.wingsRaw && !jB.wingsRaw) return false;
            const check = (wings, target) => {
                if (!wings || !target) return false;
                const w = String(wings).trim().toLowerCase();
                if (!w) return false;
                const tokens = w.split(/[,\s;/|+&]+/).filter(Boolean);
                const tNum = String(target.number || '').trim().toLowerCase();
                if (tNum && tokens.includes(tNum)) return true;
                const tId = String(target.journeyId || '').trim().toLowerCase();
                if (tId && w.includes(tId)) return true;
                const tName = String(target.name || '').trim().toLowerCase();
                if (tName && w.includes(tName)) return true;
                return false;
            };
            return check(jA.wingsRaw, jB) || check(jB.wingsRaw, jA);
        }

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const jA = journeys[i];
                const jB = journeys[j];

                // 0. Manuell gepflegte Fahrten nicht automatisch (um-)koppeln
                if (jA.couplingManual || jB.couplingManual) continue;

                // 1. Rollen-Identität: Beide Abfahrt oder beide Ankunft
                if (Boolean(jA.ankunft) !== Boolean(jB.ankunft)) continue;

                // 2. Zeitkriterium
                if (!jA.scheduledTime || jA.scheduledTime !== jB.scheduledTime) continue;

                // 3. Gleiskriterium
                if (!jA.platform || !jB.platform || jA.platform === 'Ohne Gleis' || jB.platform === 'Ohne Gleis') continue;
                if (!sectionsOverlap(jA.platform, jB.platform)) continue;

                // 4. Plausibilität
                const wingsMatched = matchesWings(jA, jB);
                const routeMatched = sharesRoute(jA, jB);

                if (wingsMatched || routeMatched) {
                    union(i, j);
                }
            }
        }

        // Gruppen nach zusammenhängenden Komponenten bilden
        const components = new Map();
        for (let i = 0; i < n; i++) {
            // Manuelle Fahrten behalten ihre bestehende Gruppierung
            if (journeys[i].couplingManual) continue;
            const root = find(i);
            if (!components.has(root)) components.set(root, []);
            components.get(root).push(journeys[i]);
        }

        for (const group of components.values()) {
            if (group.length > 1) {
                // Bestehende couplingGroupId bevorzugen, um unnötige Neuzuweisungen zu vermeiden
                const existingId = group.find(j => j.couplingGroupId)?.couplingGroupId;
                const groupId = existingId || crypto.randomUUID();
                group.forEach(j => {
                    if (j.couplingGroupId !== groupId) {
                        j.couplingGroupId = groupId;
                        changed = true;
                    }
                });
            } else if (group[0].couplingGroupId) {
                // Einzelne Fahrt darf kein couplingGroupId mehr haben
                group[0].couplingGroupId = null;
                changed = true;
            }
        }

        return changed;
    }

    /**
     * Konsolidiert gekoppelte Züge mit identischem Ziel, Vias und Planzeit
     * für Listenanzeigen (wie Anschlusstafel / Abfahrtstafel) zu einer einzigen Zeile.
     * Züge mit unterschiedlichen Zielen bleiben als getrennte Zeilen für die Flügelzug-Klammer erhalten.
     *
     * @param {Array<object>} trains - Die ungefilterte Liste sichtbarer Züge
     * @param {boolean} [isNrwMode=false] - Ob der NRW-Modus aktiv ist
     * @returns {Array<object>} Die konsolidierte Liste
     */
    static consolidateMergedTrains(trains, isNrwMode = false) {
        if (!trains || trains.length <= 1) return trains || [];

        const consolidated = [];
        const seenCoupledGroups = new Set();

        for (let i = 0; i < trains.length; i++) {
            const train = trains[i];
            if (train.couplingGroupId) {
                if (seenCoupledGroups.has(train.couplingGroupId)) continue;

                // Alle Fahrten dieser Gruppe in der aktuellen Liste suchen
                const group = trains.filter(t => t.couplingGroupId === train.couplingGroupId);
                if (group.length > 1 && this.areJourneysMerged(group)) {
                    seenCoupledGroups.add(train.couplingGroupId);
                    const combinedName = combineTrainNames(group, isNrwMode);
                    const allCancelled = group.every(t => t.ausfall || t.isCancelled);
                    const anyTrackChange = group.some(t => t.hasTrackChange);
                    const ezGleis = group.find(t => t.ezGleis)?.ezGleis || train.ezGleis || '';

                    let maxExpected = '';
                    for (const t of group) {
                        if (t.expectedTime && (!maxExpected || t.expectedTime > maxExpected)) {
                            maxExpected = t.expectedTime;
                        }
                    }

                    // Svelte-5-$state-Felder und Klassen-Getter sind nicht enumerable und
                    // würden bei einem Spread verloren gehen – daher explizit übernehmen.
                    const virtualTrain = {
                        id: train.id,
                        journeyId: train.journeyId,
                        name: combinedName,
                        number: train.number || '',
                        effectiveDisplayName: combinedName,
                        displayTitle: combinedName,
                        displayDestination: train.displayDestination,
                        destination: train.destination,
                        destinationLang: train.destinationLang,
                        destinationKurz: train.destinationKurz,
                        scheduledTime: train.scheduledTime,
                        expectedTime: maxExpected,
                        platform: train.platform,
                        ezGleis: ezGleis,
                        hasTrackChange: anyTrackChange,
                        ausfall: allCancelled,
                        isCancelled: allCancelled,
                        ankunft: train.ankunft,
                        verkehrtAb: train.verkehrtAb,
                        operator: train.operator,
                        delayReason: train.delayReason,
                        infoTexts: train.infoTexts,
                        vias: [...(train.vias || [])],
                        scrollText: train.scrollText,
                        sectors: train.sectors,
                        formation: train.formation,
                        direction: train.direction,
                        isThroughTrain: train.isThroughTrain,
                        couplingGroupId: null, // Als Einzelfahrt rendern (keine Klammer)
                        _mergedJourneys: group
                    };
                    consolidated.push(virtualTrain);
                } else {
                    // Unterschiedliche Ziele oder Einzelfahrt: Bleibt separate Zeile
                    consolidated.push(train);
                }
            } else {
                consolidated.push(train);
            }
        }

        return consolidated;
    }
}
