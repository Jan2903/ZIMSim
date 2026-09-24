// src/js/audio/ansagenGenerator.js
import { ansagenStore } from './ansagenStore.svelte.js';
import { isOppositeTrack } from '../core/utils/trackUtils.js';
import { journeyStore } from '../core/state/stores.js';
import { getSimulatedTime } from '../core/utils/config.js';
import { calculateDelayMinutes } from '../core/utils/dateUtils.js';
import { JourneyConnectionService } from '../features/journey/services/journeyConnectionService.js';
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

    _getIbnr(station) {
        return this.formatter.getIbnr(station);
    }

    _pushAudio(playlist, filePath, text) {
        this.formatter.pushAudio(playlist, filePath, text);
    }

    _module(playlist, modKey) {
        this.formatter.module(playlist, modKey);
    }

    _number(playlist, numStr, defaultPitch = 'hoch') {
        this.formatter.number(playlist, numStr, defaultPitch);
    }

    _pushNumberAudio(playlist, number, pitch) {
        this.formatter.pushNumberAudio(playlist, number, pitch);
    }

    _targetWithVia(playlist, target, vias = [], isArrival = false) {
        this.formatter.targetWithVia(playlist, target, vias, isArrival);
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

    _addStationList(playlist, stationList) {
        this.formatter.addStationList(playlist, stationList);
    }

    _gong(playlist) {
        this.formatter.gong(playlist);
    }

    _appendPlatform(playlist, journey, prefixModule = 'GLEIS', pitch = null) {
        this.formatter.platform(playlist, journey, prefixModule, pitch);
    }

    _appendRoute(playlist, journey) {
        this.formatter.route(playlist, journey);
    }

    _appendTimeInfo(playlist, journey, delayActionStr) {
        const delay = this._calculateDelay(journey);
        this.formatter.timeInfo(playlist, journey, delayActionStr, delay);
    }

    _appendDelay(playlist, delay) {
        this.formatter.delay(playlist, delay);
    }

    // --- Fach- und Domainprüfungen ---

    /**
     * Berechnet die gerundete Verspätung für Ansagen gemäß DB-Standard:
     * - 0-4 Min: 0 (unterdrückt/pünktlich)
     * - 5-60 Min: 5er-Schritte abgerundet
     * - 61-210 Min: 10er-Schritte abgerundet
     * - >210 Min: Obergrenze 210 Min
     *
     * @param {object} journey - Das Journey-Objekt
     * @returns {number} Verspätung in Minuten
     */
    _calculateDelay(journey) {
        if (!journey || !journey.expectedTime || !journey.scheduledTime) return 0;
        
        const diff = calculateDelayMinutes(journey.scheduledTime, journey.expectedTime);
        
        if (diff < 5) return 0;                             // 0-4 Min -> pünktlich / unterdrückt
        if (diff <= 60) return Math.floor(diff / 5) * 5;    // 5-60 Min -> 5er-Schritte nach unten
        if (diff <= 210) return Math.floor(diff / 10) * 10; // 61-210 Min -> 10er-Schritte nach unten
        return 210;                                         // Obergrenze 210 Min
    }

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
        if (this._calculateDelay(journey) >= 5) return true;

        if (!journey.ankunft && journey.stops && journey.stops.length > 0) {
            const startIndex = journey._currentStopIndex >= 0 ? journey._currentStopIndex + 1 : 0;
            const futureStops = journey.stops.slice(startIndex);
            if (futureStops.some(s => s.cancelled || s.isCancelled || s.additional || s.isAdditional)) {
                return true;
            }
        }
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

        // Reguläre Standardeinfahrt (Einzelfahrt oder Durchfahrt)
        this._appendPlatform(p, journey);
        this._module(p, 'EINFAHRT');
        this._appendRoute(p, journey);
        this._appendTimeInfo(p, journey, journey.ankunft ? 'ANKUNFT' : 'ABFAHRT');
        this._generateDeviations(p, journey);
        this._module(p, 'VORSICHT_BEI_DER_EINFAHRT');

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
        this._appendPlatform(p, journey);
        
        this._module(p, 'STEHT');
        this._appendRoute(p, journey);
        
        this._module(p, journey.ankunft ? 'ANKUNFT' : 'ABFAHRT');
        this._time(p, journey.scheduledTime);
        
        this._generateDeviations(p, journey);

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
        const arrival = isWende ? (journey.ankunft ? journey : linkedJourney) : null;
        const departure = isWende ? (journey.ankunft ? linkedJourney : journey) : null;
        const mainJourney = isWende ? departure : journey;

        const effectivePlatformJourney = (mainJourney.ezGleis && mainJourney.ezGleis !== mainJourney.platform)
            ? mainJourney
            : (arrival && arrival.ezGleis && arrival.ezGleis !== arrival.platform ? arrival : mainJourney);

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
        const delay = this._calculateDelay(mainJourney);
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

        let delay = this._calculateDelay(journey);
        this._appendDelay(p, delay);
        
        this._generateDeviations(p, journey);

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
            const hasTrackChange = Boolean(conn.ezGleis && conn.ezGleis !== conn.platform);
            const prefixModule = hasTrackChange ? 'HEUTE_VON_GLEIS' : 'VON_GLEIS';
            const connTrack = conn.ezGleis || conn.platform;
            const isOpposite = Boolean(refTrack && connTrack && this.isOppositeTrack(refTrack, connTrack, stationId));

            const delay = ansagenStore.anschluesseIncludeDelays ? this._calculateDelay(conn) : 0;

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
