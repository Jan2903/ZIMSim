import { StationService } from '../features/station/stationService.js';
import { audioModules } from './audioModules.js';
import { ansagenStore } from './ansagenStore.svelte.js';
import { parseTrack } from '../core/utils/trackUtils.js';
import { journeyStore } from '../core/state/stores.js';
import { getSimulatedTime } from '../core/utils/config.js';

export class AnsagenGenerator {
    constructor() {
        this.lang = 'dt'; // Zwingender Name für den ZIP-Ordner
    }

    _getIbnr(station) {
        if (!station) return null;
        if (typeof station === 'object') {
            if (station.extId) {
                const match = StationService.getStationByIdOrName(station.extId, station.name);
                if (match && match.ibnr) return match.ibnr;
                if (/^\d+$/.test(String(station.extId).trim())) {
                    return String(station.extId).trim();
                }
            }
            return this._getIbnr(station.name || station.nameKurz);
        }
        const match = StationService.getStationByIdOrName(null, station);
        return match ? match.ibnr : null;
    }

    _pushAudio(playlist, filePath, text) {
        if (!text || text.trim() === "") return;
        playlist.push({
            file: filePath,
            text: text
        });
    }

    _module(playlist, modKey) {
        const mod = audioModules[modKey];
        if (mod && mod.de && mod.de.text && mod.de.text.trim() !== "") {
            const filename = mod.de.file;
            const basename = filename.split('.')[0];
            const folder = basename.length === 3 ? 'module_3_1' : 'module';
            
            this._pushAudio(playlist, `${this.lang}/${folder}/${filename}`, mod.de.text);
        }
    }

    _number(playlist, numStr, defaultPitch = 'hoch') {
        if (!numStr) return;
        
        const cleanNum = String(numStr).replace(/\D/g, '');
        if (!cleanNum) return;

        // Leading zeros: spell out digits
        if (cleanNum.startsWith('0')) {
            for (const digit of cleanNum) {
                this._pushNumberAudio(playlist, digit, defaultPitch);
            }
            return;
        }

        const len = cleanNum.length;

        if (len <= 2) {
            this._pushNumberAudio(playlist, cleanNum, defaultPitch);
            return;
        }
        
        if (len === 3) {
            if (cleanNum.endsWith('00')) {
                this._pushNumberAudio(playlist, cleanNum, defaultPitch);
            } else {
                const hundreds = cleanNum[0] + '00';
                const remainder = parseInt(cleanNum.substring(1), 10).toString();
                
                playlist.push({
                    file: `${this.lang}/gleise_zahlen/${defaultPitch}/${hundreds}_`,
                    text: hundreds
                });
                this._pushNumberAudio(playlist, remainder, defaultPitch);
            }
            return;
        }

        if (len === 4) {
            this._number(playlist, cleanNum.substring(0, 2), 'tief');
            this._number(playlist, cleanNum.substring(2, 4), defaultPitch);
            return;
        }

        if (len >= 5) {
            this._number(playlist, cleanNum.substring(0, 2), defaultPitch);
            this._number(playlist, cleanNum.substring(2, 3), defaultPitch);
            this._number(playlist, cleanNum.substring(3, 5), defaultPitch);
            return;
        }
    }

    _pushNumberAudio(playlist, number, pitch) {
        this._pushAudio(playlist, `${this.lang}/gleise_zahlen/${pitch}/${number}`, number);
    }

    /**
     * Fügt das Ziel oder die Herkunft mit Zwischenhalten (Vias) hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {string|object} target - Stationsname des Hauptziels oder { name, extId }
     * @param {Array} vias - Liste der Vias (Array von Strings oder { name, nameKurz, extId })
     * @param {boolean} isArrival - true = Herkunft, false = Abfahrtsziel
     */
    _targetWithVia(playlist, target, vias = [], isArrival = false) {
        if (!target) return;
        
        const targetStr = typeof target === 'object' ? (target.name || '') : target;
        if (!targetStr) return;

        const targetIbnr = typeof target === 'object'
            ? (target.extId || this._getIbnr(target))
            : this._getIbnr(target);
        if (!targetIbnr) return;

        const mainVariant = isArrival ? ansagenStore.variantHerkunft : ansagenStore.variantZiel;
        const viaVariant = ansagenStore.variantVias;

        // Nur Vias mit gültiger IBNR übernehmen (verhindert /null und leere Über-Ansagen)
        const validVias = [];
        for (const v of vias) {
            if (!v) continue;
            const viaName = typeof v === 'object' ? (v.nameKurz || v.name) : v;
            const viaIbnr = typeof v === 'object' && v.extId ? v.extId : this._getIbnr(v);
            if (viaIbnr) {
                validVias.push({ name: viaName, ibnr: viaIbnr });
            }
        }

        // Maximal 6 Zwischenhalte für die Ansage zulassen
        const activeVias = validVias.slice(0, 6);

        if (activeVias.length > 0) {
            playlist.push({
                file: `${this.lang}/ziele/variante${mainVariant}/hoch/${targetIbnr}`,
                text: targetStr
            });
            
            this._module(playlist, 'UEBER');
            
            for (let i = 0; i < activeVias.length; i++) {
                const { name: viaName, ibnr: viaIbnr } = activeVias[i];
                if (i === activeVias.length - 1) {
                    playlist.push({
                        file: `${this.lang}/ziele/variante${viaVariant}/tief/${viaIbnr}`,
                        text: viaName
                    });
                } else {
                    playlist.push({
                        file: `${this.lang}/ziele/variante${viaVariant}/hoch/${viaIbnr}`,
                        text: viaName
                    });
                }
            }
        } else {
            playlist.push({
                file: `${this.lang}/ziele/variante${mainVariant}/tief/${targetIbnr}`,
                text: targetStr
            });
        }
    }

    /**
     * Generiert die Ansagenteile für den Zugnamen (Gattung und Nummer).
     * Zuggattungen werden immer "hoch" gesprochen. Bei einbuchstabigen Zuggattungen (z.B. S-Bahnen)
     * wird die Zugnummer "tief" gesprochen, ansonsten "hoch".
     *
     * @param {Array} playlist - Das Array, an das die Audio-Objekte angehängt werden.
     * @param {string} trainName - Der Name des Zuges (z.B. "S 1", "RE 5", "ICE 123").
     */
    _train(playlist, trainName) {
        if (!trainName) return;

        // "RE 6 / 12345" -> "RE 6"
        trainName = trainName.split('/')[0].trim();

        let gattung = '';
        let nummer = '';

        if (trainName.includes(' ')) {
            const parts = trainName.split(' ');
            gattung = parts[0];
            nummer = parts.slice(1).join('');
        } else {
            const match = trainName.match(/^([a-zA-Z]+)(\d+.*)$/);
            if (match) {
                gattung = match[1];
                nummer = match[2];
            } else {
                gattung = trainName; 
            }
        }

        if (gattung) {
            playlist.push({
                file: `${this.lang}/zuggattungen/hoch/${gattung.toLowerCase()}`,
                text: gattung
            });
        }
        if (nummer) {
            const numberPitch = gattung.length === 1 ? 'tief' : 'hoch';
            this._number(playlist, nummer, numberPitch);
        }
    }

    _time(playlist, timeStr) {
        if (!timeStr) return;
        const [hh, mm] = timeStr.split(':');
        if (!hh || !mm) return;

        const hourStr = String(parseInt(hh, 10)).padStart(2, '0');
        const minStr = String(parseInt(mm, 10)).padStart(2, '0');

        if (mm === '0' || mm === '00') {
            playlist.push({
                file: `${this.lang}/zeiten/stunden/tief/${hourStr}`,
                text: `${hh} Uhr`
            });
        } else {
            playlist.push({
                file: `${this.lang}/zeiten/stunden/hoch/${hourStr}`,
                text: `${hh} Uhr`
            });
            playlist.push({
                file: `${this.lang}/zeiten/minuten/tief/${minStr}`,
                text: mm
            });
        }
    }

    _generateDeviations(playlist, journey) {
        if (journey.ankunft || !journey.stops || journey.stops.length === 0) return;

        const startIndex = journey._currentStopIndex >= 0 ? journey._currentStopIndex + 1 : 0;
        const futureStops = journey.stops.slice(startIndex);

        if (futureStops.length === 0) return;

        let nurBisStation = null;
        let activeFutureStops = [];

        if (futureStops[futureStops.length - 1].cancelled) {
            let lastActiveIndex = -1;
            for (let i = futureStops.length - 1; i >= 0; i--) {
                if (!futureStops[i].cancelled) {
                    lastActiveIndex = i;
                    break;
                }
            }

            if (lastActiveIndex >= 0) {
                nurBisStation = {
                    name: futureStops[lastActiveIndex].name,
                    extId: futureStops[lastActiveIndex].extId
                };
            }
        }

        let cancelledStops = futureStops
            .filter(s => s.cancelled)
            .map(s => ({ name: s.name, extId: s.extId }));
        let additionalStops = futureStops
            .filter(s => s.additional)
            .map(s => ({ name: s.name, extId: s.extId }));

        if (cancelledStops.length > 3) cancelledStops = cancelledStops.slice(0, 3);
        if (additionalStops.length > 3) additionalStops = additionalStops.slice(0, 3);

        if (nurBisStation) {
            const ibnr = this._getIbnr(nurBisStation);
            if (ibnr) {
                this._module(playlist, 'HEUTE_NUR_BIS');
                const mainVariant = ansagenStore.variantZiel;
                playlist.push({
                    file: `${this.lang}/ziele/variante${mainVariant}/tief/${ibnr}`,
                    text: nurBisStation.name
                });
            }
        }

        if (additionalStops.length > 0) {
            this._module(playlist, 'ZUSATZHALT_IN');
            this._addStationList(playlist, additionalStops);
        }

        if (cancelledStops.length > 0) {
            this._module(playlist, 'HALTAUSFALL_IN');
            this._addStationList(playlist, cancelledStops);
        }
    }

    _addStationList(playlist, stationList) {
        const validStations = stationList.map(s => ({
            name: typeof s === 'object' ? (s.nameKurz || s.name) : s,
            ibnr: typeof s === 'object' && s.extId ? s.extId : this._getIbnr(s)
        })).filter(s => s.ibnr !== null);

        const viaVariant = ansagenStore.variantVias;

        for (let i = 0; i < validStations.length; i++) {
            const { name, ibnr } = validStations[i];
            
            if (i === validStations.length - 1) {
                if (i > 0) {
                    this._module(playlist, 'UND');
                }
                playlist.push({
                    file: `${this.lang}/ziele/variante${viaVariant}/tief/${ibnr}`,
                    text: name
                });
            } else {
                playlist.push({
                    file: `${this.lang}/ziele/variante${viaVariant}/hoch/${ibnr}`,
                    text: name
                });
            }
        }
    }

    _gong(playlist) {
        playlist.push({
            file: `gong/513/513_2`, 
            text: "Gong"
        });
    }

    _calculateDelay(journey) {
        if (!journey || !journey.expectedTime || !journey.scheduledTime) return 0;
        
        const [sh, sm] = journey.scheduledTime.split(':').map(Number);
        const [eh, em] = journey.expectedTime.split(':').map(Number);
        
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < -720) diff += 1440; 
        else if (diff > 720) diff -= 1440; 
        
        if (diff < 5) return 0;                             // 0-4 Min -> pünktlich / unterdrückt
        if (diff <= 60) return Math.floor(diff / 5) * 5;    // 5-60 Min -> 5er-Schritte nach unten
        if (diff <= 210) return Math.floor(diff / 10) * 10; // 61-210 Min -> 10er-Schritte nach unten
        return 210;                                         // Obergrenze 210 Min
    }

    hasGleiswechsel(journey) {
        return Boolean(journey && journey.ezGleis && journey.ezGleis !== journey.platform);
    }

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
     */
    hasInformationalContent(journey) {
        return this.hasGleiswechsel(journey) || this.hasGeneralInformationalContent(journey);
    }

    _isWende(journey, linkedJourney) {
        return Boolean(
            linkedJourney &&
            !journey.isThroughTrain &&
            !linkedJourney.isThroughTrain &&
            (journey.journeyId !== linkedJourney.journeyId || (!journey.journeyId && !linkedJourney.journeyId)) &&
            ((journey.ankunft && !linkedJourney.ankunft) || (!journey.ankunft && linkedJourney.ankunft))
        );
    }

    // --- DRY Helpers ---
    
    /**
     * Fügt die Gleis- und Abschnittsansage zur Playlist hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {object} journey - Das Journey-Objekt
     * @param {string} [prefixModule='GLEIS'] - Das einzuleitende Audio-Modul ('GLEIS', 'HEUTE_VON_GLEIS', 'HEUTE_AUF_GLEIS')
     * @param {string|null} [pitch=null] - Optionale Tonhöhe ('hoch' oder 'tief'). Wenn null, wird sie kontextabhängig ermittelt.
     */
    _appendPlatform(playlist, journey, prefixModule = 'GLEIS', pitch = null) {
        const gleis = journey.ezGleis || journey.platform;
        if (!gleis) return;
        
        const parsed = parseTrack(gleis);
        this._module(playlist, prefixModule);

        const sections = parsed.sections;
        const hasSections = sections && sections.length > 0 && sections[0] !== '*';

        const numberPitch = pitch || (hasSections  ? 'tief' : 'hoch');
        this._number(playlist, parsed.base, numberPitch);

        if (!hasSections) {
            return;
        }

        if (sections.length === 1) {
            const sec = sections[0].toLowerCase();
            this._pushAudio(playlist, `${this.lang}/abschnitte/hoch/${sec}`, sections[0]);
        } else {
            const first = sections[0].toLowerCase();
            const last = sections[sections.length - 1].toLowerCase();
            
            this._pushAudio(playlist, `${this.lang}/abschnitte/tief/${first}`, sections[0]);
            this._module(playlist, 'BIS');
            this._pushAudio(playlist, `${this.lang}/abschnitte/tief/${last}`, sections[sections.length - 1]);
        }
    }

    _appendRoute(playlist, journey) {
        this._train(playlist, journey.name);
        
        const targetObj = {
            name: journey.destination,
            extId: journey.destinationIbnr
        };

        if (journey.ankunft) {
            this._module(playlist, 'VON');
            this._targetWithVia(playlist, targetObj, [], true);
        } else {
            this._module(playlist, 'NACH');
            this._targetWithVia(playlist, targetObj, journey.audioVias, false);
        }
    }

    _appendTimeInfo(playlist, journey, delayActionStr) {
        let delay = this._calculateDelay(journey);

        if (delay >= 5) {
            this._module(playlist, delayActionStr + '_URSPRUENGLICH');
        } else {
            this._module(playlist, delayActionStr);
        }
        
        this._time(playlist, journey.scheduledTime);
    }

    // --- MAIN MODES ---

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
        if (delay >= 5) {
            const delayStr = String(delay).padStart(3, '0');
            p.push({
                file: `${this.lang}/zeiten/verspaetung_heute/${delayStr}`,
                text: `heute ca. ${delay} Minuten später`
            });
        }

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
        if (delay >= 5) {
            const delayStr = String(delay).padStart(3, '0');
            p.push({
                file: `${this.lang}/zeiten/verspaetung_heute/${delayStr}`,
                text: `heute ca. ${delay} Minuten später`
            });
        }
        
        this._generateDeviations(p, journey);

        return p;
    }

    /**
     * Ermittelt den Zeitstempel (ms) einer Fahrt für die gegebene Simulationszeit.
     * @param {object} journey - Das Journey-Objekt
     * @param {Date} simTimeDate - Die aktuelle Simulationszeit
     * @param {boolean} [useEffective=true] - Bevorzugt Echtzeit/Erwartete Zeit
     * @returns {number} Zeitstempel in Millisekunden
     */
    _getJourneyTimeMs(journey, simTimeDate, useEffective = true) {
        if (!journey) return simTimeDate.getTime();
        if (useEffective && journey._effectiveTimeMs) {
            return journey._effectiveTimeMs;
        }
        if (useEffective && journey.countdownTimeMs) {
            return journey.countdownTimeMs;
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
     * Prüft, ob zwei Gleise einander direkt gegenüberliegen (selber Mittelbahnsteig).
     * Nutzt zuerst benutzerspezifische Gleispaare aus dem ansagenStore,
     * und fällt sonst auf die DB-Standardheuristik für Mittelbahnsteige zurück (z.B. 2 ↔ 3, 4 ↔ 5).
     *
     * @param {string} trackA - Erstes Gleis (z.B. "2" oder "2 A-C")
     * @param {string} trackB - Zweites Gleis (z.B. "3")
     * @param {string|null} [stationId=null] - Optionale Bahnhofs-ID
     * @returns {boolean}
     */
    isOppositeTrack(trackA, trackB, stationId = null) {
        if (!trackA || !trackB) return false;
        const baseA = parseTrack(trackA).base;
        const baseB = parseTrack(trackB).base;
        if (!baseA || !baseB || baseA === baseB) return false;

        const stId = stationId || journeyStore.stationContext.stationId || 'default';
        const hasStationConfig = Boolean(
            (ansagenStore.oppositeTrackPairs && ansagenStore.oppositeTrackPairs[stId] && ansagenStore.oppositeTrackPairs[stId].length > 0) ||
            (ansagenStore.oppositeTrackPairs && ansagenStore.oppositeTrackPairs['default'] && ansagenStore.oppositeTrackPairs['default'].length > 0)
        );

        if (hasStationConfig) {
            const customPairs = ansagenStore.getOppositeTrackPairs(stId);
            return customPairs.some(([a, b]) => {
                const pA = parseTrack(a).base;
                const pB = parseTrack(b).base;
                return (pA === baseA && pB === baseB) || (pA === baseB && pB === baseA);
            });
        }

        // DB-Standardheuristik für Insel-/Mittelbahnsteige (z.B. 2/3, 4/5, 6/7, ...)
        const numA = parseInt(baseA, 10);
        const numB = parseInt(baseB, 10);
        if (!isNaN(numA) && !isNaN(numB) && String(numA) === baseA && String(numB) === baseB) {
            const min = Math.min(numA, numB);
            const max = Math.max(numA, numB);
            if (min % 2 === 0 && max === min + 1) {
                return true;
            }
        }

        return false;
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
     * Filtert Ausfälle, die eigene Fahrt und verknüpfte Züge heraus und prüft Mindestumsteigezeiten.
     *
     * @param {object|null} [referenceJourney=null] - Die Bezugsfahrt (Ankunft oder Abfahrt)
     * @param {string|null} [stationId=null] - Optionale Stations-ID
     * @returns {Array<object>} Liste passender Anschluss-Journeys
     */
    _findConnections(referenceJourney = null, stationId = null) {
        const journeys = journeyStore.journeys || [];
        if (journeys.length === 0) return [];

        const simTimeDate = getSimulatedTime();
        const stId = stationId || referenceJourney?.stationId || journeyStore.stationContext.stationId || 'default';

        // 1. Bezugszeit und Bezugsgleis ermitteln
        let refTimeMs;
        let refTrack = null;

        if (referenceJourney) {
            refTrack = referenceJourney.ezGleis || referenceJourney.platform;
            if (referenceJourney.ankunft) {
                refTimeMs = this._getJourneyTimeMs(referenceJourney, simTimeDate, true);
            } else {
                // Bei Abfahrt: Prüfen, ob verknüpfte Ankunft vorliegt
                const linkedArrival = referenceJourney.linkedArrivalJourneyId
                    ? (journeyStore.getLinkedJourney(referenceJourney.id) || journeys.find(j => j.id === referenceJourney.linkedArrivalJourneyId))
                    : null;
                if (linkedArrival) {
                    refTimeMs = this._getJourneyTimeMs(linkedArrival, simTimeDate, true);
                } else {
                    refTimeMs = this._getJourneyTimeMs(referenceJourney, simTimeDate, true);
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

            const linkedPartner = journeyStore.getLinkedJourney(referenceJourney.id);
            if (linkedPartner) {
                excludeIds.add(linkedPartner.id);
                if (linkedPartner.journeyId) excludeJourneyIds.add(linkedPartner.journeyId);
            }

            if (referenceJourney.couplingGroupId) {
                const coupled = journeyStore.getCouplingGroup(referenceJourney.couplingGroupId);
                coupled.forEach(c => {
                    excludeIds.add(c.id);
                    if (c.journeyId) excludeJourneyIds.add(c.journeyId);
                });
            }
        }

        // 3. Kandidaten filtern
        const maxWindowMs = (ansagenStore.anschluesseTimeWindow || 30) * 60 * 1000;
        const candidates = [];

        for (const candidate of journeys) {
            if (excludeIds.has(candidate.id)) continue;
            if (candidate.journeyId && excludeJourneyIds.has(candidate.journeyId)) continue;
            if (candidate.ankunft) continue; // Nur Abfahrten sind Anschlüsse
            if (candidate.ausfall) continue; // Ausgefallene Züge werden nicht als Anschluss empfohlen
            if (!candidate.destination || !candidate.scheduledTime) continue;

            const connTrack = candidate.ezGleis || candidate.platform;
            const isOpposite = Boolean(refTrack && connTrack && this.isOppositeTrack(refTrack, connTrack, stId));
            const minTransferMin = isOpposite 
                ? (ansagenStore.anschluesseMinTransferOpposite ?? 2)
                : (ansagenStore.anschluesseMinTransfer ?? 4);
            const minTransferMs = minTransferMin * 60 * 1000;

            const candidateEffectiveMs = this._getJourneyTimeMs(candidate, simTimeDate, true);
            const candidateScheduledMs = this._getJourneyTimeMs(candidate, simTimeDate, false);

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

        // 4. Sortieren: nach effektiver Abfahrtszeit, dann nach Fahrplanzzeit, dann Name
        candidates.sort((a, b) => {
            if (a.effectiveMs !== b.effectiveMs) return a.effectiveMs - b.effectiveMs;
            if (a.scheduledMs !== b.scheduledMs) return a.scheduledMs - b.scheduledMs;
            return (a.journey.name || '').localeCompare(b.journey.name || '');
        });

        const maxCount = ansagenStore.anschluesseMaxCount || 3;
        return candidates.slice(0, maxCount).map(c => c.journey);
    }

    /**
     * Prüft, ob mindestens ein erreichbarer Anschluss existiert.
     * @param {object|null} [referenceJourney=null]
     * @returns {boolean}
     */
    hasReachableConnections(referenceJourney = null) {
        const conns = this._findConnections(referenceJourney);
        return conns.length > 0;
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

            // 1. Zugname (z.B. "RE 6")
            this._train(p, conn.name);

            // 2. NACH + Ziel + über Vias
            this._module(p, 'NACH');
            const targetObj = {
                name: conn.destination,
                extId: conn.destinationIbnr
            };
            this._targetWithVia(p, targetObj, conn.audioVias, false);

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
            if (delay >= 5) {
                const delayStr = String(delay).padStart(3, '0');
                p.push({
                    file: `${this.lang}/zeiten/verspaetung_heute/${delayStr}`,
                    text: `heute ca. ${delay} Minuten später`
                });
            }

            // 7. Haltabweichungen (falls konfiguriert)
            if (ansagenStore.anschluesseIncludeDeviations) {
                this._generateDeviations(p, conn);
            }
        }

        return p;
    }
}

export const ansagenGenerator = new AnsagenGenerator();
