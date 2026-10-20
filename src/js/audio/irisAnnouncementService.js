import { ansagenGenerator } from './ansagenGenerator.js';
import { announcementQueueService, ANNOUNCEMENT_TYPE } from './announcementQueueService.svelte.js';
import { JourneyAnnouncementState } from '../features/journey/journey.svelte.js';
import { JourneyCouplingService } from '../features/journey/services/journeyCouplingService.js';
import { ansagenPlayer } from './ansagenPlayer.svelte.js';

class IrisAnnouncementService {
    upcomingAnnouncements = [];

    /**
     * Setzt den Ist-Zustand aller Züge beim initialen Laden oder Bahnhofswechsel,
     * ohne eine einzige Ansage abzuspielen (Baseline-Unterdrückung).
     * @param {Array} journeys - Liste der Züge
     * @param {number} simTimeMs - Aktuelle Simulationszeit in Millisekunden
     */
    initializeBaseline(journeys, simTimeMs) {
        if (!journeys) return;

        // Warteschlange bei Initialisierung oder Stationswechsel leeren und laufende Wiedergabe stoppen
        announcementQueueService.clearQueue();
        ansagenPlayer.stop();

        for (const j of journeys) {
            const roundedDelay = ansagenGenerator._calculateDelay(j);
            const currentPlatform = j.ezGleis || j.platform || '';
            const countdownTime = j.countdownTimeMs || j._effectiveTimeMs || 0;
            const stopsHash = typeof j.getStopsHash === 'function' ? j.getStopsHash() : '';

            // War die Planzeit oder Einfahrt bereits in der Vergangenheit?
            const isPastPlan = (j._effectiveTimeMs || countdownTime || 0) <= simTimeMs;
            const isPastEinfahrt = countdownTime <= (simTimeMs + 60000);

            j.announcementState = new JourneyAnnouncementState({
                delay: roundedDelay,
                lastAnnouncedDelay: roundedDelay >= 5 ? roundedDelay : 0,
                platform: currentPlatform,
                cancelled: Boolean(j.ausfall),
                hasPlayedAtScheduledTime: isPastPlan,
                hasPlayedEinfahrt: isPastEinfahrt,
                deviationsHash: stopsHash,
                lastAnnouncedSimTimeMs: simTimeMs
            });
        }
    }

    /**
     * Erkennt Änderungen (Ausfall, Gleiswechsel, Verspätung, Haltabweichung) nach einem IRIS-Poll.
     * @param {Array} journeys - Liste aller Züge
     * @param {number} simTimeMs - Aktuelle Simulationszeit in Millisekunden
     * @param {boolean} [autoAnnouncementsEnabled=true] - Ist Autoplay aktiv?
     */
    checkChanges(journeys, simTimeMs, autoAnnouncementsEnabled = true) {
        if (!journeys) return;

        const maxFutureMs = 60 * 60 * 1000; // 60-Minuten-Horizont
        const maxPastMs = 3 * 60 * 1000;
        const handledGleiswechselGroups = new Set();
        const handledInfoGroups = new Set();

        for (const j of journeys) {
            // Ankünfte, die zu einer Durchfahrt oder einem verknüpften Zug gehören, werden NIE separat angesagt (nur die Abfahrt kündigt an)
            if (j.ankunft && (
                j.isThroughTrain || 
                journeys.some(d => !d.ankunft && (
                    (d.journeyId && j.journeyId && d.journeyId === j.journeyId) ||
                    (d.linkedArrivalJourneyId === j.id)
                ))
            )) {
                continue;
            }

            const trainTime = j.countdownTimeMs || j._effectiveTimeMs || 0;
            if (!trainTime) continue;

            const diffMs = trainTime - simTimeMs;
            // Nur Züge innerhalb des 60-Minuten-Horizonts prüfen
            if (diffMs > maxFutureMs || diffMs < -maxPastMs) continue;

            if (!j.announcementState) {
                j.announcementState = new JourneyAnnouncementState();
            }
            const state = j.announcementState;

            // Züge, deren Einfahrt bereits erfolgt ist, für Änderungen ignorieren
            if (state.hasPlayedEinfahrt) continue;

            // Verhindert doppelte generateInformation-Ansagen desselben Zuges im selben Poll-Zyklus (z.B. Gleiswechsel + Verspätung)
            let infoAnnouncementEnqueued = false;

            // 1. Erst-Ausfall (Priorität 80)
            if (j.ausfall && !state.cancelled) {
                state.cancelled = true;
                state.lastAnnouncedSimTimeMs = simTimeMs;
                if (autoAnnouncementsEnabled) {
                    const playlist = ansagenGenerator.generateInformation(j);
                    if (playlist.length > 0) {
                        announcementQueueService.enqueue({
                            journeyId: j.journeyId,
                            trainName: j.name,
                            type: ANNOUNCEMENT_TYPE.AUSFALL,
                            playlist: playlist,
                            label: `${j.name} Ausfall`,
                            trainCountdownTimeMs: trainTime
                        });
                        infoAnnouncementEnqueued = true;
                    }
                }
                continue; // Keine weiteren Folgeänderungen bei Ausfall
            }

            // 2. Gleiswechsel (Priorität 75)
            const currentPlatform = j.ezGleis || j.platform || '';
            if (state.platform && currentPlatform && currentPlatform !== state.platform) {
                const couplingGroup = this._getCouplingGroup(j, journeys);
                const groupKey = j.couplingGroupId || j.id;
                const groupPlatformJourney = JourneyCouplingService.getGroupPlatformJourney(couplingGroup);
                const isCoupledPlatformChange = couplingGroup.length > 1 &&
                    groupPlatformJourney &&
                    couplingGroup.some(member => ansagenGenerator.hasGleiswechsel(member));

                if (isCoupledPlatformChange) {
                    this._syncGroupPlatformState(couplingGroup);
                    state.lastAnnouncedSimTimeMs = simTimeMs;

                    if (!handledGleiswechselGroups.has(groupKey)) {
                        handledGleiswechselGroups.add(groupKey);
                        handledInfoGroups.add(groupKey);

                        if (autoAnnouncementsEnabled) {
                            const linkedPartner = this._getLinkedArrival(j, journeys);
                            const playlist = ansagenGenerator.generateGleiswechsel(j, linkedPartner);
                            if (playlist.length > 0) {
                                announcementQueueService.enqueue({
                                    journeyId: j.journeyId,
                                    trainName: this._getGroupAnnouncementName(couplingGroup),
                                    type: ANNOUNCEMENT_TYPE.GLEISWECHSEL,
                                    playlist: playlist,
                                    label: `${this._getGroupAnnouncementName(couplingGroup)} Gleiswechsel (Gl. ${currentPlatform})`,
                                    trainCountdownTimeMs: trainTime
                                });
                                infoAnnouncementEnqueued = true;
                            }
                        }
                    }
                } else {
                    state.platform = currentPlatform;
                    state.lastAnnouncedSimTimeMs = simTimeMs;
                    if (autoAnnouncementsEnabled) {
                        const linkedPartner = this._getLinkedArrival(j, journeys);
                        const playlist = ansagenGenerator.generateGleiswechsel(j, linkedPartner);
                        if (playlist.length > 0) {
                            announcementQueueService.enqueue({
                                journeyId: j.journeyId,
                                trainName: j.name,
                                type: ANNOUNCEMENT_TYPE.GLEISWECHSEL,
                                playlist: playlist,
                                label: `${j.name} Gleiswechsel (Gl. ${currentPlatform})`,
                                trainCountdownTimeMs: trainTime
                            });
                            infoAnnouncementEnqueued = true;
                        }
                    }
                }
            } else if (!state.platform && currentPlatform) {
                state.platform = currentPlatform;
            }

            // 3. Verspätungsänderung (Priorität 50)
            const roundedDelay = ansagenGenerator._calculateDelay(j);
            state.delay = roundedDelay; // aktuellen Zustand immer tracken

            if (roundedDelay >= 5) {
                // Änderung gegenüber der ZULETZT ANGESAGTEN Verspätung prüfen:
                // Nur ansagen wenn sich der angesagte Wert um mind. 5 Minuten unterscheidet (z.B. 0 -> 5, 5 -> 10, 10 -> 5)
                const delayDiff = Math.abs(roundedDelay - state.lastAnnouncedDelay);
                const cooldownPassed = (simTimeMs - state.lastAnnouncedSimTimeMs) >= 2.5 * 60 * 1000; // 2.5 Min Cooldown
                
                if (delayDiff >= 5 && (state.lastAnnouncedDelay === 0 || cooldownPassed)) {
                    const couplingGroup = this._getCouplingGroup(j, journeys);
                    const groupKey = j.couplingGroupId || j.id;
                    state.lastAnnouncedDelay = roundedDelay;
                    state.lastAnnouncedSimTimeMs = simTimeMs;
                    // Nur einreihen, wenn nicht bereits Gleiswechsel in diesem Zyklus die Information abgedeckt hat
                    if (autoAnnouncementsEnabled && !infoAnnouncementEnqueued && !handledInfoGroups.has(groupKey)) {
                        this._syncGroupInfoState(couplingGroup, simTimeMs);
                        const playlist = ansagenGenerator.generateInformation(j);
                        if (playlist.length > 0) {
                            handledInfoGroups.add(groupKey);
                            announcementQueueService.enqueue({
                                journeyId: j.journeyId,
                                trainName: this._getGroupAnnouncementName(couplingGroup),
                                type: ANNOUNCEMENT_TYPE.VERSPAETUNG,
                                playlist: playlist,
                                label: `${this._getGroupAnnouncementName(couplingGroup)} Verspätung (+${roundedDelay}m)`,
                                trainCountdownTimeMs: trainTime
                            });
                            infoAnnouncementEnqueued = true;
                        }
                    }
                }
            } else {
                // Pünktlich / unter 5 Min:
                // Stiller Rückfall, aber lastAnnouncedDelay erst nach 5 Min anhaltender Pünktlichkeit zurücksetzen,
                // um Flattern zwischen 4 und 5 Min vollständig zu unterbinden.
                if (state.lastAnnouncedDelay > 0 && (simTimeMs - state.lastAnnouncedSimTimeMs >= 5 * 60 * 1000)) {
                    state.lastAnnouncedDelay = 0;
                }
            }

            // 4. Fahrtänderung / Haltausfall / Zusatzhalt (Priorität 70)
            // Gilt NUR für Abfahrten (!j.ankunft), da Ankünfte am Endbahnhof keine zukünftigen Zwischenhalte mehr haben
            if (!j.ankunft) {
                const deviationsHash = typeof j.getStopsHash === 'function' ? j.getStopsHash() : '';
                
                if (state.deviationsHash === undefined || state.deviationsHash === '') {
                    state.deviationsHash = deviationsHash;
                } else if (state.deviationsHash !== deviationsHash) {
                    state.deviationsHash = deviationsHash;
                    
                    // Nur ansagen wenn tatsächlich Abweichungen vorhanden sind (nicht beim stillen Entfallen aller Abweichungen)
                    if (deviationsHash !== '') {
                        const cooldownPassed = (simTimeMs - state.lastAnnouncedSimTimeMs) >= 2 * 60 * 1000;
                        if (cooldownPassed) {
                            const couplingGroup = this._getCouplingGroup(j, journeys);
                            const groupKey = j.couplingGroupId || j.id;
                            state.lastAnnouncedSimTimeMs = simTimeMs;
                            if (autoAnnouncementsEnabled && !infoAnnouncementEnqueued && !handledInfoGroups.has(groupKey)) {
                                this._syncGroupInfoState(couplingGroup, simTimeMs);
                                const playlist = ansagenGenerator.generateInformation(j);
                                if (playlist.length > 0) {
                                    handledInfoGroups.add(groupKey);
                                    announcementQueueService.enqueue({
                                        journeyId: j.journeyId,
                                        trainName: this._getGroupAnnouncementName(couplingGroup),
                                        type: ANNOUNCEMENT_TYPE.FAHRTAENDERUNG,
                                        playlist: playlist,
                                        label: `${this._getGroupAnnouncementName(couplingGroup)} Fahrplanänderung`,
                                        trainCountdownTimeMs: trainTime
                                    });
                                    infoAnnouncementEnqueued = true;
                                }
                            }
                        }
                    }
                }
            }

            // Falls verknüpfter Zug vorhanden und j eine Abfahrt ist, Zustand der Ankunft synchronisieren
            if (!j.ankunft) {
                const linkedArr = j.linkedArrivalJourneyId 
                    ? journeys.find(a => a.id === j.linkedArrivalJourneyId)
                    : (j.journeyId ? journeys.find(a => a.ankunft && a.journeyId === j.journeyId) : null);
                if (linkedArr && linkedArr.id !== j.id) {
                    if (!linkedArr.announcementState) {
                        linkedArr.announcementState = new JourneyAnnouncementState();
                    }
                    linkedArr.announcementState.delay = state.delay;
                    linkedArr.announcementState.lastAnnouncedDelay = state.lastAnnouncedDelay;
                    linkedArr.announcementState.platform = state.platform;
                    linkedArr.announcementState.cancelled = state.cancelled;
                    linkedArr.announcementState.lastAnnouncedSimTimeMs = state.lastAnnouncedSimTimeMs;
                }
            }
        }
    }

    /**
     * Wird im Sekundentakt aufgerufen (aus irisPollingService.tick).
     * Steuert Einfahrten (T-60s), Ausfall zur Planzeit (T=0s) und periodische Reminder.
     * @param {Array} journeys - Liste aller Züge
     * @param {Date} simTimeDate - Aktuelle Simulationsuhrzeit
     * @param {boolean} autoAnnouncementsEnabled - Ist Autoplay aktiv?
     */
    tick(journeys, simTimeDate, autoAnnouncementsEnabled) {
        if (!journeys) return;
        const simTimeMs = simTimeDate.getTime();

        // 1. Vorschau der nächsten 4 Einfahrten für das Status-Overlay
        const upcoming = [];
        const seenUpcomingGroups = new Set();
        for (const j of journeys) {
            if (j.ausfall) continue;
            // Durchfahrt-Ankünfte überspringen (die Abfahrt kündigt an)
            if (j.ankunft && (
                j.isThroughTrain || 
                journeys.some(d => !d.ankunft && (
                    (d.journeyId && j.journeyId && d.journeyId === j.journeyId) ||
                    (d.isThroughTrain && d.linkedArrivalJourneyId === j.id)
                ))
            )) continue;

            const effectiveMs = j.countdownTimeMs;
            if (!effectiveMs) continue;

            const previewGroup = this._getCouplingGroup(j, journeys);
            if (previewGroup.length > 1 && j.couplingGroupId) {
                if (seenUpcomingGroups.has(j.couplingGroupId)) continue;
                seenUpcomingGroups.add(j.couplingGroupId);
            }

            const diffSecs = Math.floor((effectiveMs - simTimeMs) / 1000);
            if (diffSecs > 0 && diffSecs <= 3600 && !j.announcementState?.hasPlayedEinfahrt) {
                upcoming.push({
                    journeyId: j.journeyId,
                    name: previewGroup.length > 1 ? this._getGroupAnnouncementName(previewGroup) : j.name,
                    dest: j.destinationKurz || j.destination,
                    countdown: diffSecs,
                    type: 'Einfahrt'
                });
            }
        }
        upcoming.sort((a, b) => a.countdown - b.countdown);
        this.upcomingAnnouncements = upcoming.slice(0, 4);

        // 2. Ansagen evaluieren
        for (const j of journeys) {
            // Durchfahrt-Ankünfte werden NIE separat angesagt (weder Einfahrt, Ausfall zur Planzeit noch Reminder)
            if (j.ankunft && (
                j.isThroughTrain || 
                journeys.some(d => !d.ankunft && (
                    (d.journeyId && j.journeyId && d.journeyId === j.journeyId) ||
                    (d.isThroughTrain && d.linkedArrivalJourneyId === j.id)
                ))
            )) {
                continue;
            }

            const effectiveMs = j.countdownTimeMs || j._effectiveTimeMs || 0;
            if (!effectiveMs) continue;

            if (!j.announcementState) {
                j.announcementState = new JourneyAnnouncementState();
            }
            const state = j.announcementState;

            // --- A) EINFAHRT (Priorität 100) ---
            // Wendezug-Ankunft: Wenn mit einer Abfahrt verknüpft, kündigt die Abfahrt als Wendezug an
            const isLinkedArrival = j.ankunft && journeys.some(d => !d.ankunft && d.linkedArrivalJourneyId === j.id);

            if (!isLinkedArrival) {
                const diffSecs = Math.floor((effectiveMs - simTimeMs) / 1000);

                if (diffSecs <= 60 && diffSecs >= -45 && !state.hasPlayedEinfahrt && !j.ausfall) {
                    const couplingGroup = this._getCouplingGroup(j, journeys);
                    this._markGroupEinfahrtPlayed(couplingGroup);

                    // Bei verknüpftem Zug Partner ermitteln und ebenfalls markieren
                    const linkedPartner = this._getLinkedArrival(j, journeys);
                    if (linkedPartner && linkedPartner.announcementState) {
                        linkedPartner.announcementState.hasPlayedEinfahrt = true;
                    }

                    if (autoAnnouncementsEnabled) {
                        const playlist = ansagenGenerator.generateEinfahrt(j, linkedPartner);
                        announcementQueueService.enqueue({
                            journeyId: j.journeyId,
                            trainName: this._getGroupAnnouncementName(couplingGroup),
                            type: ANNOUNCEMENT_TYPE.EINFAHRT,
                            playlist: playlist,
                            label: `${this._getGroupAnnouncementName(couplingGroup)} Einfahrt`,
                            trainCountdownTimeMs: effectiveMs
                        });
                    }
                }
            }

            // --- B) AUSFALL ZUR PLANZEIT (Priorität 90) ---
            if (j.ausfall && !state.hasPlayedAtScheduledTime) {
                const scheduledMs = this._getScheduledTimeMs(j, simTimeDate);
                const diffScheduledSecs = Math.floor((scheduledMs - simTimeMs) / 1000);

                if (diffScheduledSecs <= 0 && diffScheduledSecs >= -60) {
                    state.hasPlayedAtScheduledTime = true;

                    if (autoAnnouncementsEnabled) {
                        const playlist = ansagenGenerator.generateInformation(j);
                        announcementQueueService.enqueue({
                            journeyId: j.journeyId,
                            trainName: j.name,
                            type: ANNOUNCEMENT_TYPE.AUSFALL_PLANZEIT,
                            playlist: playlist,
                            label: `${j.name} Ausfall (Planzeit)`,
                            trainCountdownTimeMs: scheduledMs
                        });
                    }
                }
            }

            // --- C) PERIODISCHER REMINDER (Priorität 30) ---
            if (autoAnnouncementsEnabled && !state.hasPlayedEinfahrt) {
                this._checkReminder(j, simTimeMs, journeys);
            }
        }
    }

    /**
     * Prüft, ob ein periodischer Reminder fällig ist.
     * Mindestabstand (Cooldown): 5 Minuten zwischen zwei Ansagen desselben Zuges.
     * > 30 Min vor Fahrt: alle 15 Minuten.
     * 10 bis 30 Min vor Fahrt: alle 10 Minuten.
     * 1 bis 10 Min vor Fahrt: alle 5 Minuten.
     */
    _checkReminder(journey, simTimeMs, journeys = []) {
        const group = this._getCouplingGroup(journey, journeys);
        if (group.length > 1) {
            const representative = group.find(member => !member.ausfall) || group[0];
            if (representative.id !== journey.id) return;
            if (!group.some(member => ansagenGenerator.hasInformationalContent(member))) return;

            const state = representative.announcementState;
            if (simTimeMs - state.lastAnnouncedSimTimeMs < 5 * 60 * 1000) return;

            const targetTimeMs = representative.countdownTimeMs || representative._effectiveTimeMs || 0;
            const diffMins = Math.floor((targetTimeMs - simTimeMs) / 60000);
            if (diffMins <= 0 || diffMins > 60) return;

            let intervalMins = 15;
            if (diffMins <= 10) {
                intervalMins = 5;
            } else if (diffMins <= 30) {
                intervalMins = 10;
            }

            if (simTimeMs - state.lastAnnouncedSimTimeMs >= intervalMins * 60 * 1000) {
                for (const member of group) {
                    if (!member.announcementState) member.announcementState = new JourneyAnnouncementState();
                    member.announcementState.lastAnnouncedSimTimeMs = simTimeMs;
                }

                const isPlatformChange = group.some(member => ansagenGenerator.hasGleiswechsel(member));
                const playlist = isPlatformChange
                    ? ansagenGenerator.generateGleiswechsel(representative)
                    : ansagenGenerator.generateInformation(representative);
                announcementQueueService.enqueue({
                    journeyId: representative.journeyId,
                    trainName: this._getGroupAnnouncementName(group),
                    type: ANNOUNCEMENT_TYPE.REMINDER,
                    playlist: playlist,
                    label: `${this._getGroupAnnouncementName(group)} Erinnerung`,
                    trainCountdownTimeMs: targetTimeMs
                });
            }
            return;
        }

        if (!ansagenGenerator.hasInformationalContent(journey)) return;

        const state = journey.announcementState;
        // 5-Minuten-Cooldown
        if (simTimeMs - state.lastAnnouncedSimTimeMs < 5 * 60 * 1000) return;

        const targetTimeMs = journey.countdownTimeMs || journey._effectiveTimeMs || 0;
        const diffMins = Math.floor((targetTimeMs - simTimeMs) / 60000);

        if (diffMins <= 0 || diffMins > 60) return;

        let intervalMins = 15;
        if (diffMins <= 10) {
            intervalMins = 5;
        } else if (diffMins <= 30) {
            intervalMins = 10;
        }

        if (simTimeMs - state.lastAnnouncedSimTimeMs >= intervalMins * 60 * 1000) {
            state.lastAnnouncedSimTimeMs = simTimeMs;
            const isPlatformChange = ansagenGenerator.hasGleiswechsel(journey);
            const playlist = isPlatformChange
                ? ansagenGenerator.generateGleiswechsel(journey)
                : ansagenGenerator.generateInformation(journey);
            announcementQueueService.enqueue({
                journeyId: journey.journeyId,
                trainName: journey.name,
                type: ANNOUNCEMENT_TYPE.REMINDER,
                playlist: playlist,
                label: `${journey.name} Erinnerung`,
                trainCountdownTimeMs: targetTimeMs
            });
        }
    }

    /**
     * Ermittelt den Zeitstempel der planmäßigen Uhrzeit.
     */
    _getScheduledTimeMs(journey, simTimeDate) {
        if (!journey.scheduledTime) return simTimeDate.getTime();
        const [sh, sm] = journey.scheduledTime.split(':').map(Number);
        const d = new Date(simTimeDate.getTime());
        d.setHours(sh, sm, 0, 0);
        return d.getTime();
    }

    /**
     * Ermittelt die verknüpfte Ankunft für eine Abfahrt.
     * @param {object} journey - Die Abfahrts-Journey
     * @param {Array} journeys - Liste aller Züge
     * @returns {object|null} Verknüpfte Ankunft oder null
     */
    _getLinkedArrival(journey, journeys) {
        if (!journey || journey.ankunft || !journeys) return null;
        if (journey.linkedArrivalJourneyId) {
            return journeys.find(a => a.id === journey.linkedArrivalJourneyId) || null;
        }
        if (journey.journeyId) {
            return journeys.find(a => a.ankunft && a.journeyId === journey.journeyId) || null;
        }
        return null;
    }

    /**
     * Liefert die Coupling-Gruppe einer Fahrt.
     * @param {object} journey - Die Bezugsfahrt
     * @param {Array} journeys - Liste aller Züge
     * @returns {Array<object>} Gruppe oder Einzelfahrt
     */
    _getCouplingGroup(journey, journeys = []) {
        if (!journey) return [];
        if (!journey.couplingGroupId) return [journey];

        const group = journeys.filter(j => j.couplingGroupId === journey.couplingGroupId);
        return group.length > 0 ? group : [journey];
    }

    /**
     * Erzeugt einen kombinierten Namen für eine Coupling-Gruppe.
     * @param {Array<object>} group - Coupling-Gruppe
     * @returns {string} Kombinierter Name
     */
    _getGroupAnnouncementName(group) {
        const names = [...new Set((group || []).map(j => j?.name).filter(Boolean))];
        return names.length > 1 ? names.join(' + ') : (names[0] || '');
    }

    /**
     * Markiert die Einfahrtsansage für alle Mitglieder einer Coupling-Gruppe als gespielt.
     * @param {Array<object>} group - Coupling-Gruppe
     */
    _markGroupEinfahrtPlayed(group) {
        for (const member of group || []) {
            if (!member.announcementState) {
                member.announcementState = new JourneyAnnouncementState();
            }
            member.announcementState.hasPlayedEinfahrt = true;
        }
    }

    /**
     * Synchronisiert den Gleiszustand aller Gruppenmitglieder.
     * @param {Array<object>} group - Coupling-Gruppe
     */
    _syncGroupPlatformState(group) {
        for (const member of group || []) {
            if (!member.announcementState) {
                member.announcementState = new JourneyAnnouncementState();
            }
            member.announcementState.platform = member.ezGleis || member.platform || '';
        }
    }

    /**
     * Synchronisiert Verspätungs- und Abweichungszustand aller Gruppenmitglieder,
     * nachdem eine gemeinsame Informationsansage eingereiht wurde.
     * @param {Array<object>} group - Coupling-Gruppe
     * @param {number} simTimeMs - Aktuelle Simulationszeit in Millisekunden
     */
    _syncGroupInfoState(group, simTimeMs) {
        for (const member of group || []) {
            if (!member.announcementState) {
                member.announcementState = new JourneyAnnouncementState();
            }
            const delay = ansagenGenerator._calculateDelay(member);
            member.announcementState.delay = delay;
            member.announcementState.lastAnnouncedDelay = delay >= 5 ? delay : 0;
            member.announcementState.deviationsHash = typeof member.getStopsHash === 'function'
                ? member.getStopsHash()
                : '';
            member.announcementState.lastAnnouncedSimTimeMs = simTimeMs;
        }
    }
}

export const irisAnnouncementService = new IrisAnnouncementService();
