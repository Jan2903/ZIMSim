import { StationService } from '../features/station/stationService.js';
import { audioModules } from './audioModules.js';
import { ansagenStore } from './ansagenStore.svelte.js';
import { parseTrack } from '../core/utils/trackUtils.js';

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
     * Fügt Vias vor dem Ziel an (z.B. "über X, Y nach Z" für Wendezüge).
     * @param {Array} playlist - Die Playlist
     * @param {string|object} target - Stationsname des Hauptziels oder { name, extId }
     * @param {Array} vias - Liste der Vias (Array von Strings oder { name, nameKurz, extId })
     */
    _viaBeforeTarget(playlist, target, vias = []) {
        if (!target) return;

        const targetStr = typeof target === 'object' ? (target.name || '') : target;
        if (!targetStr) return;

        const targetIbnr = typeof target === 'object'
            ? (target.extId || this._getIbnr(target))
            : this._getIbnr(target);
        if (!targetIbnr) return;

        const mainVariant = ansagenStore.variantZiel;
        const viaVariant = ansagenStore.variantVias;

        const validVias = [];
        for (const v of vias) {
            if (!v) continue;
            const viaName = typeof v === 'object' ? (v.nameKurz || v.name) : v;
            const viaIbnr = typeof v === 'object' && v.extId ? v.extId : this._getIbnr(v);
            if (viaIbnr) {
                validVias.push({ name: viaName, ibnr: viaIbnr });
            }
        }

        const activeVias = validVias.slice(0, 6);

        if (activeVias.length > 0) {
            this._module(playlist, 'UEBER');
            for (let i = 0; i < activeVias.length; i++) {
                const { name: viaName, ibnr: viaIbnr } = activeVias[i];
                playlist.push({
                    file: `${this.lang}/ziele/variante${viaVariant}/hoch/${viaIbnr}`,
                    text: viaName
                });
            }
        }

        this._module(playlist, 'NACH');
        playlist.push({
            file: `${this.lang}/ziele/variante${mainVariant}/tief/${targetIbnr}`,
            text: targetStr
        });
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

    /**
     * Prüft, ob für eine Fahrt Informationsbedarf (Ausfall, Verspätung, Gleiswechsel, Haltänderung) besteht.
     */
    hasInformationalContent(journey) {
        if (!journey) return false;
        if (journey.ausfall) return true;
        if (this._calculateDelay(journey) >= 5) return true;
        if (journey.ezGleis && journey.ezGleis !== journey.platform) return true;

        if (!journey.ankunft && journey.stops && journey.stops.length > 0) {
            const startIndex = journey._currentStopIndex >= 0 ? journey._currentStopIndex + 1 : 0;
            const futureStops = journey.stops.slice(startIndex);
            if (futureStops.some(s => s.cancelled || s.isCancelled || s.additional || s.isAdditional)) {
                return true;
            }
        }
        return false;
    }

    // --- DRY Helpers ---
    
    _appendPlatform(playlist, journey) {
        const gleis = journey.ezGleis || journey.platform;
        if (!gleis) return;
        
        const parsed = parseTrack(gleis);
        this._module(playlist, 'GLEIS');
        this._number(playlist, parsed.base, 'hoch');

        const sections = parsed.sections;
        if (!sections || sections.length === 0 || sections[0] === '*') {
            return;
        }

        if (sections.length === 1) {
            const sec = sections[0].toLowerCase();
            this._pushAudio(playlist, `${this.lang}/abschnitte/hoch/${sec}`, sections[0]);
        } else {
            const first = sections[0].toLowerCase();
            const last = sections[sections.length - 1].toLowerCase();
            
            this._pushAudio(playlist, `${this.lang}/abschnitte/hoch/${first}`, sections[0]);
            this._module(playlist, 'BIS');
            this._pushAudio(playlist, `${this.lang}/abschnitte/hoch/${last}`, sections[sections.length - 1]);
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

        const isWende = Boolean(
            linkedJourney &&
            !journey.isThroughTrain &&
            !linkedJourney.isThroughTrain &&
            (journey.journeyId !== linkedJourney.journeyId || (!journey.journeyId && !linkedJourney.journeyId)) &&
            ((journey.ankunft && !linkedJourney.ankunft) || (!journey.ankunft && linkedJourney.ankunft))
        );

        if (isWende) {
            const arrival = journey.ankunft ? journey : linkedJourney;
            const departure = journey.ankunft ? linkedJourney : journey;

            // 1. Gleis
            this._appendPlatform(p, arrival);

            // 2. EINFAHRT
            this._module(p, 'EINFAHRT');

            // 3. Ankunftsteil: Zugname + VON + Herkunft (ohne Ankunftszeit)
            this._train(p, arrival.name);
            this._module(p, 'VON');
            this._targetWithVia(p, { name: arrival.destination, extId: arrival.destinationIbnr }, [], true);

            // 4. Modul WEITER_ALS
            this._module(p, 'WEITER_ALS');

            // 5. Abfahrtsteil: Zugname + [über Vias] + NACH + Ziel + Abfahrtszeit
            this._train(p, departure.name);
            this._viaBeforeTarget(p, { name: departure.destination, extId: departure.destinationIbnr }, departure.audioVias);
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

    generateInformation(journey) {
        if (!this.hasInformationalContent(journey)) {
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

        if (journey.ezGleis && journey.ezGleis !== journey.platform) {
            this._module(p, 'HEUTE_VON_GLEIS');
            this._number(p, journey.ezGleis, 'tief');
        }

        return p;
    }

    generateAnschluesse(journey) {
        const p = [];
        this._gong(p);
        this._module(p, 'ANSCHLUESSE');
        return p;
    }
}

export const ansagenGenerator = new AnsagenGenerator();
