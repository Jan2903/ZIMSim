// src/js/audio/ansagenGenerator.js
import { ansagenStore } from './ansagenStore.svelte.js';
import { isOppositeTrack } from '../core/utils/trackUtils.js';
import { journeyStore } from '../core/state/stores.js';
import { getSimulatedTime } from '../core/utils/config.js';
import { roundDelayForAnnouncement } from '../core/utils/dateUtils.js';
import { JourneyConnectionService } from '../features/journey/services/journeyConnectionService.js';
import { JourneyCouplingService } from '../features/journey/services/journeyCouplingService.js';
import { getPlatformSectors, getPlatformFirstClassSectors, getPlatformForJourney, resolveValidSectionLetters } from '../features/formation/formationUtils.js';
import { AnsagenSpeechFormatter } from './ansagenSpeechFormatter.js';

/**
 * Hauptgenerator für Bahnhofsansagen.
 * Orchestriert Ansagen-Playlists (Einfahrt, Steht, Gleiswechsel, Information, Anschlüsse)
 * und delegiert die Low-Level-Sprachformatierung an AnsagenSpeechFormatter.
 */
export class AnsagenGenerator {
    constructor() {
        this.lang = 'dt'; // Zwingender Name für den ZIP-Ordner
        this.formatter = new AnsagenSpeechFormatter(this.lang);
    }

    // --- Delegation an AnsagenSpeechFormatter (Rückwärtskompatibilität) ---

    _gong(playlist) {
        this.formatter.gong(playlist);
    }

    _module(playlist, modKey) {
        this.formatter.module(playlist, modKey);
    }

    _train(playlist, trainName) {
        this.formatter.train(playlist, trainName);
    }

    _time(playlist, timeStr) {
        this.formatter.time(playlist, timeStr);
    }

    _generateDeviations(playlist, journey) {
        this.formatter.deviations(playlist, journey);
    }

    _appendPlatform(playlist, journey, prefixModule = 'GLEIS', pitch = null) {
        this.formatter.platform(playlist, journey, prefixModule, pitch);
    }

    _appendRoute(playlist, journey) {
        this.formatter.route(playlist, journey);
    }

    _appendTimeInfo(playlist, journey, delayActionStr) {
        const delay = roundDelayForAnnouncement(journey);
        this.formatter.timeInfo(playlist, journey, delayActionStr, delay);
    }

    _appendDelay(playlist, delay) {
        this.formatter.delay(playlist, delay);
    }

    /**
     * Fügt den Verspätungsgrund zur Playlist hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {object} journey - Das Journey-Objekt
     */
    _appendDelayReason(playlist, journey) {
        if (!journey || !journey.delayReason) return;
        this.formatter.delayReason(playlist, journey.delayReason, journey.delayReasonCode);
    }

    /**
     * Fügt die Ansage der Bahnsteigabschnitte zur Playlist hinzu,
     * sofern Abschnitte für das Gleis und Wagenreihung/Override für die Fahrt existieren.
     * @param {Array} playlist - Die Playlist
     * @param {object} journey - Das Journey-Objekt
     * @param {Array<object>|null} [groupOverride=null] - Optionale Coupling-Gruppe für die Positionierung
     */
    _appendSectors(playlist, journey, groupOverride = null) {
        if (!ansagenStore.ansageAbschnitte) return;
        if (!journey) return;

        const platform = getPlatformForJourney(journey, journeyStore.platforms, journeyStore.stationContext);

        if (!platform || !platform.sections || platform.sections.length === 0) {
            return;
        }

        const coupledJourneys = groupOverride || JourneyCouplingService.expandCoupling(journeyStore.journeys, journey);
        const sectorsStr = getPlatformSectors(journey, coupledJourneys, platform);
        if (!sectorsStr) return;

        const validLetters = resolveValidSectionLetters(sectorsStr, platform);
        if (validLetters.length === 0) return;

        this.formatter.sections(playlist, validLetters);
    }

    /**
     * Fügt die Ansage der 1.-Klasse-Bahnsteigabschnitte zur Playlist hinzu,
     * sofern Abschnitte für das Gleis und 1.-Klasse-Wagen/Override für die Fahrt existieren.
     * @param {Array} playlist - Die Playlist
     * @param {object} journey - Das Journey-Objekt
     */
    _appendFirstClassSectors(playlist, journey) {
        if (!ansagenStore.ansageErsteKlasse) return;
        if (!journey) return;

        const platform = getPlatformForJourney(journey, journeyStore.platforms, journeyStore.stationContext);

        if (!platform || !platform.sections || platform.sections.length === 0) {
            return;
        }

        const coupledJourneys = JourneyCouplingService.expandCoupling(journeyStore.journeys, journey);
        const sectorsStr = getPlatformFirstClassSectors(journey, coupledJourneys, platform);
        if (!sectorsStr) return;

        const validLetters = resolveValidSectionLetters(sectorsStr, platform);
        if (validLetters.length === 0) return;

        this.formatter.firstClassSections(playlist, validLetters);
    }

    // --- Coupling / Flügelzüge ---

    /**
     * Liefert die Coupling-Gruppe einer Fahrt für Ansagen.
     * @param {object} journey - Das Journey-Objekt
     * @returns {Array<object>} Gruppe in Store-Reihenfolge
     */
    _getAnnouncementGroup(journey) {
        return JourneyCouplingService.getAnnouncementGroup(journeyStore.journeys, journey);
    }

    /**
     * Liefert die aktiven (nicht ausgefallenen) Mitglieder einer Coupling-Gruppe.
     * @param {Array<object>} group - Coupling-Gruppe
     * @returns {Array<object>} Aktive Mitglieder
     */
    _getActiveGroup(group) {
        return JourneyCouplingService.getActiveAnnouncementGroup(group);
    }

    /**
     * Ermittelt das gemeinsame Gleis einer Coupling-Gruppe.
     * @param {Array<object>} group - Coupling-Gruppe
     * @returns {object|null} Journey mit gültigem Gleis oder null
     */
    _getGroupPlatformJourney(group) {
        return JourneyCouplingService.getGroupPlatformJourney(group);
    }

    /**
     * Prüft, ob eine Coupling-Gruppe als gemeinsame Ansage gesprochen werden kann.
     * @param {Array<object>} group - Aktive Coupling-Gruppe
     * @returns {boolean}
     */
    _canAnnounceCoupledGroup(group) {
        if (!group || group.length === 0) return false;

        const roles = new Set(group.map(j => Boolean(j.ankunft)));
        if (roles.size > 1) return false;

        const times = new Set(group.map(j => (j.scheduledTime || '').trim()));
        if (times.size > 1) return false;

        return Boolean(this._getGroupPlatformJourney(group));
    }

    /**
     * Ermittelt den Namen des aktuellen Bahnhofs für Zugteilungs- und
     * Zugvereinigungsansagen.
     * @param {Array<object>} group - Coupling-Gruppe
     * @returns {string} Bahnhofsname oder leer
     */
    _getCurrentStationName(group = []) {
        const contextName = journeyStore.stationContext?.stationName || '';
        if (contextName) return contextName;

        for (const journey of group) {
            const stop = journey?.currentStop;
            if (stop?.name) return stop.name;
        }
        return '';
    }

    /**
     * Fügt die Routen aller Gruppenmitglieder mit "mit" verbunden hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {Array<object>} group - Coupling-Gruppe
     */
    _appendCoupledRoute(playlist, group) {
        group.forEach((member, index) => {
            if (index > 0) {
                this._module(playlist, 'MIT');
            }
            this._appendRoute(playlist, member);
        });
    }

    /**
     * Ermittelt eine für alle Gruppenmitglieder identische Verspätung.
     * Unterschiedliche Verspätungen werden separat angesagt.
     * @param {Array<object>} group - Coupling-Gruppe
     * @returns {number} Gemeinsame Verspätung oder 0
     */
    _getCommonDelay(group) {
        const delays = group.map(j => roundDelayForAnnouncement(j));
        if (delays.length === 0) return 0;
        return delays.every(d => d === delays[0]) ? delays[0] : 0;
    }

    /**
     * Fügt Verspätungen hinzu, die nur einzelne Gruppenmitglieder betreffen.
     * @param {Array} playlist - Die Playlist
     * @param {Array<object>} group - Coupling-Gruppe
     */
    _appendPerTrainDelays(playlist, group) {
        const delays = group.map(j => roundDelayForAnnouncement(j));
        if (new Set(delays).size <= 1) return;

        group.forEach((member, index) => {
            const delay = delays[index];
            if (delay < 5) return;
            this._train(playlist, member.name);
            this._appendDelay(playlist, delay);
        });
    }

    /**
     * Fügt die gemeinsame 1.-Klasse-Abschnittsansage für eine Coupling-Gruppe hinzu.
     * Die Abschnitte aller aktiven Mitglieder werden zu einer Union zusammengefasst.
     * @param {Array} playlist - Die Playlist
     * @param {Array<object>} group - Coupling-Gruppe
     */
    _appendCombinedFirstClassSectors(playlist, group) {
        if (!ansagenStore.ansageErsteKlasse) return;
        if (!group || group.length === 0) return;

        const platform = getPlatformForJourney(group[0], journeyStore.platforms, journeyStore.stationContext);
        if (!platform || !platform.sections || platform.sections.length === 0) return;

        const letters = new Set();

        for (const member of group) {
            const sectorsStr = getPlatformFirstClassSectors(member, group, platform);
            if (!sectorsStr) continue;

            for (const letter of resolveValidSectionLetters(sectorsStr, platform)) {
                letters.add(letter);
            }
        }

        const validLetters = [...letters].sort();
        if (validLetters.length > 0) {
            this.formatter.firstClassSections(playlist, validLetters);
        }
    }

    /**
     * Fügt die Zugteilungsansage für eine Coupling-Gruppe hinzu.
     * Nur Abfahrten erhalten einen Teilungshinweis.
     * @param {Array} playlist - Die Playlist
     * @param {Array<object>} group - Aktive Coupling-Gruppe
     * @returns {boolean} true, wenn ein Hinweis ergänzt wurde
     */
    _appendSplitAnnouncement(playlist, group) {
        if (!group || group.length < 2) return false;
        if (group.some(j => j.ankunft)) return false;

        const currentStation = this._getCurrentStationName(group);
        const splitStations = JourneyCouplingService.getUpcomingSplitStations(group, currentStation || null);
        if (splitStations.length === 0) return false;

        this._module(playlist, 'ZUG_WIRD_IN');
        this.formatter.stationList(playlist, splitStations, 'variantZugteilung');
        this._module(playlist, 'ZUGTEILUNG_2');
        return true;
    }

    /**
     * Fügt den Hinweis auf eine Zugvereinigung im aktuellen Bahnhof hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {Array<object>} group - Aktive Coupling-Gruppe
     * @returns {boolean} true, wenn ein Hinweis ergänzt wurde
     */
    _appendJoiningNotice(playlist, group) {
        if (!group || group.length < 2) return false;
        if (group.some(j => j.ankunft)) return false;

        const currentStation = this._getCurrentStationName(group);
        if (!JourneyCouplingService.isJoiningAtCurrentStation(group, currentStation || null)) {
            return false;
        }

        this._module(playlist, 'ZUGVEREINIGUNG_TUEREN_GESCHLOSSEN');
        return true;
    }

    /**
     * Fügt Hinweise für ausgefallene Mitglieder einer Coupling-Gruppe hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {Array<object>} cancelledGroup - Ausgefallene Mitglieder
     */
    _appendCancelledMembers(playlist, cancelledGroup) {
        if (!cancelledGroup || cancelledGroup.length === 0) return;

        for (const member of cancelledGroup) {
            this._train(playlist, member.name);
            this._module(playlist, 'FAELLT_HEUTE_AUS');
            this._module(playlist, 'ENTSCHULDIGUNG');
        }
    }

    // --- Fach- und Domainprüfungen ---

    /**
     * Prüft, ob ein Gleiswechsel vorliegt.
     * @param {object} journey
     * @returns {boolean}
     */
    hasGleiswechsel(journey) {
        return Boolean(journey && journey.ezGleis && journey.ezGleis !== journey.platform);
    }

    /**
     * Prüft, ob allgemeine Störungs- oder Verspätungsinformationen vorliegen.
     * @param {object} journey
     * @returns {boolean}
     */
    hasGeneralInformationalContent(journey) {
        if (!journey) return false;
        if (journey.ausfall) return true;
        if (roundDelayForAnnouncement(journey) >= 5) return true;
        if (this._hasRelevantDeviations(journey)) return true;
        return false;
    }

    /**
     * Prüft, ob für eine Fahrt Informationsbedarf (Ausfall, Verspätung, Gleiswechsel, Haltänderung) besteht.
     * @param {object} journey
     * @returns {boolean}
     */
    hasInformationalContent(journey) {
        return this.hasGleiswechsel(journey) || this.hasGeneralInformationalContent(journey);
    }

    /**
     * Prüft, ob es sich um eine Fahrzeugwende (Ankunft -> Abfahrt) handelt.
     * @param {object} journey
     * @param {object|null} linkedJourney
     * @returns {boolean}
     */
    _isWende(journey, linkedJourney) {
        return Boolean(
            linkedJourney &&
            !journey.isThroughTrain &&
            !linkedJourney.isThroughTrain &&
            (journey.journeyId !== linkedJourney.journeyId || (!journey.journeyId && !linkedJourney.journeyId)) &&
            ((journey.ankunft && !linkedJourney.ankunft) || (!journey.ankunft && linkedJourney.ankunft))
        );
    }

    /**
     * Prüft, ob es sich um eine reine Ankunft (ohne Weiterfahrt/Wende) handelt.
     * @param {object} journey - Das Journey-Objekt
     * @param {object|null} [linkedJourney=null] - Verknüpfter Partner-Zug
     * @returns {boolean}
     */
    _isPureArrival(journey, linkedJourney = null) {
        if (!journey || !journey.ankunft) return false;
        if (journey.isThroughTrain) return false;
        if (this._isWende(journey, linkedJourney)) return false;
        if (linkedJourney && !linkedJourney.ankunft) return false;
        if (journey.linkedArrivalJourneyId) return false;
        return true;
    }

    /**
     * Ermittelt den Zeitstempel (ms) einer Fahrt für die gegebene Simulationszeit.
     * Delegiert an den JourneyConnectionService.
     * @param {object} journey - Das Journey-Objekt
     * @param {Date} simTimeDate - Die aktuelle Simulationszeit
     * @param {boolean} [useEffective=true] - Bevorzugt Echtzeit/Erwartete Zeit
     * @returns {number} Zeitstempel in Millisekunden
     */
    _getJourneyTimeMs(journey, simTimeDate, useEffective = true) {
        return JourneyConnectionService.getJourneyTimeMs(journey, simTimeDate, useEffective);
    }

    /**
     * Prüft, ob zwei Gleise einander direkt gegenüberliegen (selber Mittelbahnsteig).
     * Delegiert an trackUtils.isOppositeTrack unter Berücksichtigung der Stationskonfiguration.
     *
     * @param {string} trackA - Erstes Gleis (z.B. "2" oder "2 A-C")
     * @param {string} trackB - Zweites Gleis (z.B. "3")
     * @param {string|null} [stationId=null] - Optionale Bahnhofs-ID
     * @returns {boolean}
     */
    isOppositeTrack(trackA, trackB, stationId = null) {
        const stId = stationId || journeyStore.stationContext.stationId || 'default';
        const customPairs = ansagenStore.getOppositeTrackPairs(stId);
        return isOppositeTrack(trackA, trackB, customPairs);
    }

    /**
     * Prüft, ob für eine Fahrt relevante Haltabweichungen vorliegen.
     * @param {object} journey
     * @returns {boolean}
     */
    _hasRelevantDeviations(journey) {
        if (!journey || journey.ankunft || !journey.stops || journey.stops.length === 0) return false;
        const startIndex = journey._currentStopIndex >= 0 ? journey._currentStopIndex + 1 : 0;
        const futureStops = journey.stops.slice(startIndex);
        if (futureStops.length === 0) return false;
        return futureStops.some(s => s.cancelled || s.isCancelled || s.additional || s.isAdditional);
    }

    /**
     * Ermittelt die nächsten erreichbaren Anschlusszüge für eine Fahrt oder den aktuellen Bahnhof.
     * Delegiert an den JourneyConnectionService.
     *
     * @param {object|null} [referenceJourney=null] - Die Bezugsfahrt (Ankunft oder Abfahrt)
     * @param {string|null} [stationId=null] - Optionale Stations-ID
     * @returns {Array<object>} Liste passender Anschluss-Journeys
     */
    _findConnections(referenceJourney = null, stationId = null) {
        const stId = stationId || referenceJourney?.stationId || journeyStore.stationContext.stationId || 'default';
        const customPairs = ansagenStore.getOppositeTrackPairs(stId);
        return JourneyConnectionService.findConnections(journeyStore.journeys, referenceJourney, {
            simulatedTime: getSimulatedTime(),
            stationId: stId,
            timeWindowMinutes: ansagenStore.anschluesseTimeWindow,
            minTransferMinutes: ansagenStore.anschluesseMinTransfer,
            minTransferOppositeMinutes: ansagenStore.anschluesseMinTransferOpposite,
            maxCount: ansagenStore.anschluesseMaxCount,
            oppositeTrackPairs: customPairs
        });
    }

    /**
     * Prüft, ob mindestens ein erreichbarer Anschluss existiert.
     * @param {object|null} [referenceJourney=null]
     * @returns {boolean}
     */
    hasReachableConnections(referenceJourney = null) {
        return this._findConnections(referenceJourney).length > 0;
    }

    // --- MAIN MODES ---

    /**
     * Generiert die Einfahrts-Ansage ("Gleis X: Einfahrt RE 1 nach...").
     * @param {object} journey - Das Journey-Objekt
     * @param {object|null} [linkedJourney=null] - Verknüpfter Partner-Zug (z.B. Abfahrt bei Wendezug)
     * @returns {Array} Playlist mit Audio-Objekten
     */
    generateEinfahrt(journey, linkedJourney = null) {
        const p = [];
        this._gong(p);

        const isWende = this._isWende(journey, linkedJourney);
        const fullGroup = this._getAnnouncementGroup(journey);
        const activeGroup = this._getActiveGroup(fullGroup);

        if (isWende) {
            const arrival = journey.ankunft ? journey : linkedJourney;
            const departure = journey.ankunft ? linkedJourney : journey;

            // 1. Gleis
            this._appendPlatform(p, arrival);

            // 2. EINFAHRT
            this._module(p, 'EINFAHRT');

            // 3. Ankunftsteil: Zugname + VON + Herkunft (ohne Ankunftszeit)
            this._appendRoute(p, arrival);

            // 4. Modul WEITER_ALS
            this._module(p, 'WEITER_ALS');

            // 5. Abfahrtsteil: Zugname + NACH + Ziel + [über Vias] + Abfahrtszeit
            this._appendRoute(p, departure);
            this._appendTimeInfo(p, departure, 'ABFAHRT');

            // 6. Abweichungen + VORSICHT_BEI_DER_EINFAHRT
            this._generateDeviations(p, departure);
            this._module(p, 'VORSICHT_BEI_DER_EINFAHRT');

            return p;
        }

        // Gekoppelte Fahrten: gemeinsame Basis, danach zugspezifische Blöcke.
        if (fullGroup.length > 1 && activeGroup.length > 0 && this._canAnnounceCoupledGroup(activeGroup)) {
            const platformJourney = this._getGroupPlatformJourney(activeGroup) || activeGroup[0];
            const action = activeGroup[0].ankunft ? 'ANKUNFT' : 'ABFAHRT';
            const commonDelay = this._getCommonDelay(activeGroup);

            this._appendPlatform(p, platformJourney);
            this._module(p, 'EINFAHRT');

            activeGroup.forEach((member, index) => {
                if (index > 0) {
                    this._module(p, 'MIT');
                }
                this._appendRoute(p, member);

                if (!member.ankunft) {
                    this._appendSectors(p, member, activeGroup);
                    this._generateDeviations(p, member);

                    // Zugspezifische Verspätung nur ansagen, wenn sie von der gemeinsamen abweicht.
                    const memberDelay = roundDelayForAnnouncement(member);
                    if (commonDelay < 5 && memberDelay >= 5) {
                        this._appendDelay(p, memberDelay);
                    }
                }
            });

            this.formatter.timeInfo(p, activeGroup[0], action, commonDelay);
            this._appendSplitAnnouncement(p, activeGroup);
            this._appendCombinedFirstClassSectors(p, activeGroup);
            this._appendCancelledMembers(p, fullGroup.filter(j => j.ausfall));
            this._appendJoiningNotice(p, activeGroup);
            this._module(p, 'VORSICHT_BEI_DER_EINFAHRT');

            if (activeGroup.every(member => this._isPureArrival(member, null)) && ansagenStore.einfahrtBitteNichtEinsteigen) {
                this._module(p, 'BITTE_NICHT_EINSTEIGEN');
            }

            return p;
        }

        // Reguläre Standardeinfahrt (Einzelfahrt oder Durchfahrt)
        this._appendPlatform(p, journey);
        this._module(p, 'EINFAHRT');
        this._appendRoute(p, journey);

        if (!journey.ankunft && !isWende) {
            this._appendSectors(p, journey);
        }

        this._appendTimeInfo(p, journey, journey.ankunft ? 'ANKUNFT' : 'ABFAHRT');
        this._appendFirstClassSectors(p, journey);
        this._generateDeviations(p, journey);
        this._module(p, 'VORSICHT_BEI_DER_EINFAHRT');

        if (this._isPureArrival(journey, linkedJourney) && ansagenStore.einfahrtBitteNichtEinsteigen) {
            this._module(p, 'BITTE_NICHT_EINSTEIGEN');
        }

        return p;
    }

    /**
     * Generiert die "Steht"-Ansage ("Gleis X steht: RE 1 nach...").
     * @param {object} journey - Das Journey-Objekt
     * @returns {Array} Playlist mit Audio-Objekten
     */
    generateSteht(journey) {
        const p = [];
        this._gong(p);

        const fullGroup = this._getAnnouncementGroup(journey);
        const activeGroup = this._getActiveGroup(fullGroup);

        if (fullGroup.length > 1 && activeGroup.length > 0 && this._canAnnounceCoupledGroup(activeGroup)) {
            const platformJourney = this._getGroupPlatformJourney(activeGroup) || activeGroup[0];

            this._appendPlatform(p, platformJourney);
            this._module(p, 'STEHT');

            activeGroup.forEach((member, index) => {
                if (index > 0) {
                    this._module(p, 'MIT');
                }
                this._appendRoute(p, member);

                if (!member.ankunft) {
                    this._appendSectors(p, member, activeGroup);
                    this._generateDeviations(p, member);
                }
            });

            this._module(p, activeGroup[0].ankunft ? 'ANKUNFT' : 'ABFAHRT');
            this._time(p, activeGroup[0].scheduledTime);
            this._appendSplitAnnouncement(p, activeGroup);
            this._appendCombinedFirstClassSectors(p, activeGroup);
            this._appendCancelledMembers(p, fullGroup.filter(j => j.ausfall));

            return p;
        }

        this._appendPlatform(p, journey);
        
        this._module(p, 'STEHT');
        this._appendRoute(p, journey);

        if (!journey.ankunft) {
            this._appendSectors(p, journey);
        }
        
        this._module(p, journey.ankunft ? 'ANKUNFT' : 'ABFAHRT');
        this._time(p, journey.scheduledTime);
        this._appendFirstClassSectors(p, journey);

        this._generateDeviations(p, journey);

        return p;
    }

    /**
     * Generiert eine gemeinsame Gleiswechsel-Ansage für eine Coupling-Gruppe.
     * Alle Zugteile werden mit "mit" verbunden, die Gleisangabe erfolgt einmal.
     *
     * @param {Array<object>} group - Aktive Coupling-Gruppe
     * @param {object} platformJourney - Journey mit dem gültigen Zielgleis
     * @returns {Array} Playlist mit Audio-Objekten
     */
    _generateCoupledGleiswechsel(group, platformJourney) {
        const p = [];
        this._gong(p);
        this._module(p, 'INFORMATION_ZU');

        const isArrival = Boolean(group[0].ankunft);
        const action = isArrival ? 'ANKUNFT' : 'ABFAHRT';
        const commonDelay = this._getCommonDelay(group);

        this._appendCoupledRoute(p, group);
        this.formatter.timeInfo(p, group[0], action, commonDelay);

        if (commonDelay >= 5) {
            this._appendDelay(p, commonDelay);
        } else {
            this._appendPerTrainDelays(p, group);
        }

        const prefixPart1 = isArrival
            ? 'HEUTE_AUF_GLEIS'
            : (commonDelay >= 5 ? 'UND_VON_GLEIS' : 'HEUTE_VON_GLEIS');
        this._appendPlatform(p, platformJourney, prefixPart1);

        this._module(p, 'ICH_WIEDERHOLE');
        this._appendCoupledRoute(p, group);
        this.formatter.timeInfo(p, group[0], action, commonDelay);

        const prefixPart2 = isArrival ? 'HEUTE_AUF_GLEIS' : 'HEUTE_VON_GLEIS';
        this._appendPlatform(p, platformJourney, prefixPart2);

        return p;
    }

    /**
     * Generiert eine Gleiswechsel-Ansage mit Wiederholung (ICH_WIEDERHOLE).
     * Bei Wendezügen wird die Herkunft nur in Teil 1 genannt, in Teil 2 nur die Weiterfahrt.
     * Bei Verspätung wird diese nur in Teil 1 genannt (mit UND_VON_GLEIS bzw. HEUTE_AUF_GLEIS).
     * Andere Abweichungen (Haltausfälle etc.) werden bei Gleiswechsel nicht angesagt.
     *
     * @param {object} journey - Das Journey-Objekt
     * @param {object|null} [linkedJourney=null] - Verknüpfter Partner-Zug (z.B. Ankunft bei Wendezug)
     * @returns {Array} Playlist mit Audio-Objekten
     */
    generateGleiswechsel(journey, linkedJourney = null) {
        if (!journey || journey.ausfall) {
            return [];
        }

        const isWende = this._isWende(journey, linkedJourney);
        const fullGroup = this._getAnnouncementGroup(journey);
        const activeGroup = this._getActiveGroup(fullGroup);

        // Gekoppelte Fahrten: gemeinsame Gleiswechselansage für den Zugverband.
        if (!isWende && fullGroup.length > 1 && activeGroup.length > 0 && this._canAnnounceCoupledGroup(activeGroup)) {
            const groupPlatformJourney = this._getGroupPlatformJourney(activeGroup);
            if (groupPlatformJourney && activeGroup.some(member => this.hasGleiswechsel(member))) {
                return this._generateCoupledGleiswechsel(activeGroup, groupPlatformJourney);
            }
        }

        const arrival = isWende ? (journey.ankunft ? journey : linkedJourney) : null;
        const departure = isWende ? (journey.ankunft ? linkedJourney : journey) : null;
        const mainJourney = isWende ? departure : journey;

        const effectivePlatformJourney = this.hasGleiswechsel(mainJourney)
            ? mainJourney
            : (arrival && this.hasGleiswechsel(arrival) ? arrival : mainJourney);

        if (!this.hasGleiswechsel(effectivePlatformJourney)) {
            return [];
        }

        const p = [];
        this._gong(p);
        this._module(p, 'INFORMATION_ZU');

        // --- TEIL 1: Vollständige Erstansage ---
        if (isWende) {
            // Ankunftsteil: Zugname + VON + Herkunft (ohne Ankunftszeit)
            this._appendRoute(p, arrival);
            this._module(p, 'WEITER_ALS');
            // Abfahrtsteil: Zugname + NACH + Ziel + [über Vias] + Abfahrtszeit
            this._appendRoute(p, departure);
            this._appendTimeInfo(p, departure, 'ABFAHRT');
        } else {
            this._appendRoute(p, mainJourney);
            this._appendTimeInfo(p, mainJourney, mainJourney.ankunft ? 'ANKUNFT' : 'ABFAHRT');
        }

        // Verspätung (nur in Teil 1)
        const delay = roundDelayForAnnouncement(mainJourney);
        this._appendDelay(p, delay);

        // Gleisangabe Teil 1:
        // Bei Abfahrt/Weiterfahrt mit Verspätung: UND_VON_GLEIS
        // Bei Ankunft: HEUTE_AUF_GLEIS
        // Sonst: HEUTE_VON_GLEIS
        let prefixPart1;
        if (mainJourney.ankunft) {
            prefixPart1 = 'HEUTE_AUF_GLEIS';
        } else if (delay >= 5) {
            prefixPart1 = 'UND_VON_GLEIS';
        } else {
            prefixPart1 = 'HEUTE_VON_GLEIS';
        }
        this._appendPlatform(p, effectivePlatformJourney, prefixPart1);

        // --- TEIL 2: Wiederholung (ICH_WIEDERHOLE) ---
        this._module(p, 'ICH_WIEDERHOLE');

        // In der Wiederholung bei Wendezügen NUR der Abfahrtsteil!
        this._appendRoute(p, mainJourney);
        this._appendTimeInfo(p, mainJourney, mainJourney.ankunft ? 'ANKUNFT' : 'ABFAHRT');

        // Gleisangabe Teil 2 (ohne "und", da Verspätung in Teil 2 entfällt):
        const prefixPart2 = mainJourney.ankunft ? 'HEUTE_AUF_GLEIS' : 'HEUTE_VON_GLEIS';
        this._appendPlatform(p, effectivePlatformJourney, prefixPart2);

        return p;
    }

    /**
     * Generiert eine allgemeine Informations-Ansage (Verspätung, Haltabweichungen, Ausfall).
     * Enthält keine Gleiswechselansage (siehe generateGleiswechsel) und kein ICH_WIEDERHOLE.
     *
     * @param {object} journey - Das Journey-Objekt
     * @returns {Array} Playlist mit Audio-Objekten
     */
    generateInformation(journey) {
        const fullGroup = this._getAnnouncementGroup(journey);
        const activeGroup = this._getActiveGroup(fullGroup);

        if (!journey?.ausfall && fullGroup.length > 1 && activeGroup.length > 0 && this._canAnnounceCoupledGroup(activeGroup)) {
            return this._generateCoupledInformation(activeGroup);
        }

        return this._generateSingleInformation(journey);
    }

    /**
     * Generiert eine Informations-Ansage für eine einzelne Fahrt.
     * @param {object} journey - Das Journey-Objekt
     * @returns {Array} Playlist mit Audio-Objekten
     */
    _generateSingleInformation(journey) {
        if (!this.hasGeneralInformationalContent(journey)) {
            return [];
        }

        const p = [];
        this._gong(p);
        this._module(p, 'INFORMATION_ZU');
        
        this._appendRoute(p, journey);
        this._module(p, journey.ankunft ? 'ANKUNFT' : 'ABFAHRT');
        this._time(p, journey.scheduledTime);

        if (journey.ausfall) {
            this._module(p, 'FAELLT_HEUTE_AUS');
            this._module(p, 'ENTSCHULDIGUNG');
            return p;
        }

        let delay = roundDelayForAnnouncement(journey);
        this._appendDelay(p, delay);

        if (delay >= 5 && journey.delayReason) {
            this._appendDelayReason(p, journey);
        }
        
        this._generateDeviations(p, journey);

        if (delay >= 30) {
            this._module(p, 'ENTSCHULDIGUNG');
        }

        return p;
    }

    /**
     * Generiert eine Informations-Ansage für eine Coupling-Gruppe.
     * Betrifft die Information nur einen Zug, wird die Einzelansage genutzt.
     *
     * @param {Array<object>} group - Aktive Coupling-Gruppe
     * @returns {Array} Playlist mit Audio-Objekten
     */
    _generateCoupledInformation(group) {
        const affected = group.filter(j => this.hasGeneralInformationalContent(j));
        if (affected.length === 0) return [];
        if (affected.length === 1) return this._generateSingleInformation(affected[0]);

        const p = [];
        this._gong(p);
        this._module(p, 'INFORMATION_ZU');

        this._appendCoupledRoute(p, group);
        this._module(p, group[0].ankunft ? 'ANKUNFT' : 'ABFAHRT');
        this._time(p, group[0].scheduledTime);

        for (const member of affected) {
            this._train(p, member.name);

            if (member.ausfall) {
                this._module(p, 'FAELLT_HEUTE_AUS');
                this._module(p, 'ENTSCHULDIGUNG');
                continue;
            }

            const delay = roundDelayForAnnouncement(member);
            this._appendDelay(p, delay);

            if (delay >= 5 && member.delayReason) {
                this._appendDelayReason(p, member);
            }

            this._generateDeviations(p, member);

            if (delay >= 30) {
                this._module(p, 'ENTSCHULDIGUNG');
            }
        }

        return p;
    }

    /**
     * Generiert die Anschlussansage ("Ihre nächsten Anschlüsse...").
     * @param {object|null} [journey=null] - Die Referenzfahrt oder null
     * @returns {Array} Audiowiedergabe-Playlist
     */
    generateAnschluesse(journey = null) {
        const connections = this._findConnections(journey);
        if (!connections || connections.length === 0) {
            return [];
        }

        const p = [];
        this._gong(p);
        this._module(p, 'ANSCHLUESSE');

        const total = connections.length;
        const stationId = journey?.stationId || journeyStore.stationContext.stationId || 'default';
        const refTrack = journey ? (journey.ezGleis || journey.platform) : null;

        for (let i = 0; i < total; i++) {
            const conn = connections[i];

            // "und" vor dem letzten Anschluss (bei mehr als 1 Anschluss)
            if (i === total - 1 && total > 1) {
                this._module(p, 'UND');
            }

            // 1. & 2. Zugname + NACH + Ziel + über Vias
            this._appendRoute(p, conn);

            // 3. Abfahrtszeit
            this._module(p, 'ABFAHRT');
            this._time(p, conn.scheduledTime);

            // 4. Gleis (VON_GLEIS oder HEUTE_VON_GLEIS)
            const hasTrackChange = this.hasGleiswechsel(conn);
            const prefixModule = hasTrackChange ? 'HEUTE_VON_GLEIS' : 'VON_GLEIS';
            const connTrack = conn.ezGleis || conn.platform;
            const isOpposite = Boolean(refTrack && connTrack && this.isOppositeTrack(refTrack, connTrack, stationId));

            const delay = ansagenStore.anschluesseIncludeDelays ? roundDelayForAnnouncement(conn) : 0;

            this._appendPlatform(p, conn, prefixModule);

            // 5. DIREKT_GEGENUEBER
            if (isOpposite) {
                this._module(p, 'DIREKT_GEGENUEBER');
            }

            // 6. Verspätung (falls konfiguriert & >= 5 Min)
            this._appendDelay(p, delay);

            // 7. Haltabweichungen (falls konfiguriert)
            if (ansagenStore.anschluesseIncludeDeviations) {
                this._generateDeviations(p, conn);
            }
        }

        return p;
    }
}

export const ansagenGenerator = new AnsagenGenerator();
