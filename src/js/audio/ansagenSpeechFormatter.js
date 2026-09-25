// src/js/audio/ansagenSpeechFormatter.js
import { StationService } from '../features/station/stationService.js';
import { audioModules } from './audioModules.js';
import { ansagenStore } from './ansagenStore.svelte.js';
import { parseTrack } from '../core/utils/trackUtils.js';

/**
 * Formatiert Fahrplandaten und Audiobausteine in das Dateisystem- und Sprachformat
 * der DB-Sprachausgabe (Zahlenzerlegung, Tonhöhen, Uhrzeiten, Gleise, Ziel/Vias).
 */
export class AnsagenSpeechFormatter {
    /**
     * @param {string} [lang='dt'] - Sprachkürzel für den Audio-ZIP-Ordner
     */
    constructor(lang = 'dt') {
        this.lang = lang; // Zwingender Name für den ZIP-Ordner
    }

    /**
     * Ermittelt die IBNR einer Station anhand von Name oder ID.
     * @param {string|object} station
     * @returns {string|null}
     */
    getIbnr(station) {
        if (!station) return null;
        if (typeof station === 'object') {
            if (station.extId) {
                const match = StationService.getStationByIdOrName(station.extId, station.name);
                if (match && match.ibnr) return match.ibnr;
                if (/^\d+$/.test(String(station.extId).trim())) {
                    return String(station.extId).trim();
                }
            }
            return this.getIbnr(station.name || station.nameKurz);
        }
        const match = StationService.getStationByIdOrName(null, station);
        return match ? match.ibnr : null;
    }

    /**
     * Fügt einen Audiobaustein zur Playlist hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {string} filePath - Pfad zur Audiodatei
     * @param {string} text - Untertitel-/Anzeigetext
     */
    pushAudio(playlist, filePath, text) {
        if (!text || text.trim() === "") return;
        playlist.push({
            file: filePath,
            text: text
        });
    }

    /**
     * Fügt ein Standard-Modul aus audioModules.js zur Playlist hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {string} modKey - Modul-Schlüssel (z.B. 'EINFAHRT', 'ABFAHRT')
     */
    module(playlist, modKey) {
        const mod = audioModules[modKey];
        if (mod && mod.de && mod.de.text && mod.de.text.trim() !== "") {
            const filename = mod.de.file;
            const basename = filename.split('.')[0];
            const folder = basename.length === 3 ? 'module_3_1' : 'module';
            
            this.pushAudio(playlist, `${this.lang}/${folder}/${filename}`, mod.de.text);
        }
    }

    /**
     * Zerlegt eine Zahl (1- bis 5-stellig) in DB-Aussprache-Segmente mit Tonhöhe.
     * @param {Array} playlist - Die Playlist
     * @param {string|number} numStr - Die auszusprechende Zahl
     * @param {string} [defaultPitch='hoch'] - Tonhöhe ('hoch' oder 'tief')
     */
    number(playlist, numStr, defaultPitch = 'hoch') {
        if (!numStr) return;
        
        const cleanNum = String(numStr).replace(/\D/g, '');
        if (!cleanNum) return;

        // Leading zeros: spell out digits
        if (cleanNum.startsWith('0')) {
            for (const digit of cleanNum) {
                this.pushNumberAudio(playlist, digit, defaultPitch);
            }
            return;
        }

        const len = cleanNum.length;

        if (len <= 2) {
            this.pushNumberAudio(playlist, cleanNum, defaultPitch);
            return;
        }
        
        if (len === 3) {
            if (cleanNum.endsWith('00')) {
                this.pushNumberAudio(playlist, cleanNum, defaultPitch);
            } else {
                const hundreds = cleanNum[0] + '00';
                const remainder = parseInt(cleanNum.substring(1), 10).toString();
                
                playlist.push({
                    file: `${this.lang}/gleise_zahlen/${defaultPitch}/${hundreds}_`,
                    text: hundreds
                });
                this.pushNumberAudio(playlist, remainder, defaultPitch);
            }
            return;
        }

        if (len === 4) {
            this.number(playlist, cleanNum.substring(0, 2), 'tief');
            this.number(playlist, cleanNum.substring(2, 4), defaultPitch);
            return;
        }

        if (len >= 5) {
            this.number(playlist, cleanNum.substring(0, 2), defaultPitch);
            this.number(playlist, cleanNum.substring(2, 3), defaultPitch);
            this.number(playlist, cleanNum.substring(3, 5), defaultPitch);
            return;
        }
    }

    /**
     * Fügt ein Zahlen-Audioobjekt mit Tonhöhe hinzu.
     * @param {Array} playlist
     * @param {string} number
     * @param {string} pitch
     */
    pushNumberAudio(playlist, number, pitch) {
        this.pushAudio(playlist, `${this.lang}/gleise_zahlen/${pitch}/${number}`, number);
    }

    /**
     * Fügt das Ziel oder die Herkunft mit Zwischenhalten (Vias) hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {string|object} target - Stationsname des Hauptziels oder { name, extId }
     * @param {Array} [vias=[]] - Liste der Vias (Array von Strings oder { name, nameKurz, extId })
     * @param {boolean} [isArrival=false] - true = Herkunft, false = Abfahrtsziel
     */
    targetWithVia(playlist, target, vias = [], isArrival = false) {
        if (!target) return;
        
        const targetStr = typeof target === 'object' ? (target.name || '') : target;
        if (!targetStr) return;

        const targetIbnr = typeof target === 'object'
            ? (target.extId || this.getIbnr(target))
            : this.getIbnr(target);
        if (!targetIbnr) return;

        const mainVariant = isArrival ? ansagenStore.variantHerkunft : ansagenStore.variantZiel;
        const viaVariant = ansagenStore.variantVias;

        // Nur Vias mit gültiger IBNR übernehmen (verhindert /null und leere Über-Ansagen)
        const validVias = [];
        for (const v of vias) {
            if (!v) continue;
            const viaName = typeof v === 'object' ? (v.nameKurz || v.name) : v;
            const viaIbnr = typeof v === 'object' && v.extId ? v.extId : this.getIbnr(v);
            if (viaIbnr) {
                validVias.push({ name: viaName, ibnr: viaIbnr });
            }
        }

        // Maximal 6 Zwischenhalte für die Ansage zulassen (jetzt bis zu 128 für alle Halte bzw. Testzwecke)
        const activeVias = validVias.slice(0, 128);

        if (activeVias.length > 0) {
            playlist.push({
                file: `${this.lang}/ziele/variante${mainVariant}/hoch/${targetIbnr}`,
                text: targetStr
            });
            
            this.module(playlist, 'UEBER');
            
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
    train(playlist, trainName) {
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
            this.number(playlist, nummer, numberPitch);
        }
    }

    /**
     * Fügt eine Uhrzeitansage ("HH Uhr MM") zur Playlist hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {string} timeStr - Uhrzeitstring (HH:MM)
     */
    time(playlist, timeStr) {
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

    /**
     * Generiert Ansagen für Haltabweichungen (Haltausfälle, Zusatzhalte, "heute nur bis").
     * @param {Array} playlist - Die Playlist
     * @param {object} journey - Das Journey-Objekt
     */
    deviations(playlist, journey) {
        if (journey.ankunft || !journey.stops || journey.stops.length === 0) return;

        const startIndex = journey._currentStopIndex >= 0 ? journey._currentStopIndex + 1 : 0;
        const futureStops = journey.stops.slice(startIndex);

        if (futureStops.length === 0) return;

        let nurBisStation = null;

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
            const ibnr = this.getIbnr(nurBisStation);
            if (ibnr) {
                this.module(playlist, 'HEUTE_NUR_BIS');
                const mainVariant = ansagenStore.variantZiel;
                playlist.push({
                    file: `${this.lang}/ziele/variante${mainVariant}/tief/${ibnr}`,
                    text: nurBisStation.name
                });
            }
        }

        if (additionalStops.length > 0) {
            this.module(playlist, 'ZUSATZHALT_IN');
            this.addStationList(playlist, additionalStops);
        }

        if (cancelledStops.length > 0) {
            this.module(playlist, 'HALTAUSFALL_IN');
            this.addStationList(playlist, cancelledStops);
        }
    }

    /**
     * Fügt eine Liste von Haltestellen mit Tonhöhen und Bindewort "und" hinzu.
     * @param {Array} playlist
     * @param {Array} stationList
     */
    addStationList(playlist, stationList) {
        const validStations = stationList.map(s => ({
            name: typeof s === 'object' ? (s.nameKurz || s.name) : s,
            ibnr: typeof s === 'object' && s.extId ? s.extId : this.getIbnr(s)
        })).filter(s => s.ibnr !== null);

        const viaVariant = ansagenStore.variantVias;

        for (let i = 0; i < validStations.length; i++) {
            const { name, ibnr } = validStations[i];
            
            if (i === validStations.length - 1) {
                if (i > 0) {
                    this.module(playlist, 'UND');
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

    /**
     * Fügt den Einleitungs-Gong hinzu.
     * @param {Array} playlist - Die Playlist
     */
    gong(playlist) {
        playlist.push({
            file: `gong/513/513_2`, 
            text: "Gong"
        });
    }

    /**
     * Fügt die Gleis- und Abschnittsansage zur Playlist hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {object} journey - Das Journey-Objekt
     * @param {string} [prefixModule='GLEIS'] - Das einzuleitende Audio-Modul ('GLEIS', 'HEUTE_VON_GLEIS', 'HEUTE_AUF_GLEIS')
     * @param {string|null} [pitch=null] - Optionale Tonhöhe ('hoch' oder 'tief'). Wenn null, wird sie kontextabhängig ermittelt.
     */
    platform(playlist, journey, prefixModule = 'GLEIS', pitch = null) {
        const gleis = journey.ezGleis || journey.platform;
        if (!gleis) return;
        
        const parsed = parseTrack(gleis);
        this.module(playlist, prefixModule);

        const sections = parsed.sections;
        const hasSections = sections && sections.length > 0 && sections[0] !== '*';

        const isNotGleis = !prefixModule || prefixModule.toUpperCase() !== 'GLEIS';
        const numberPitch = pitch || ((hasSections || isNotGleis) ? 'tief' : 'hoch');
        this.number(playlist, parsed.base, numberPitch);

        if (!hasSections) {
            return;
        }

        if (sections.length === 1) {
            const sec = sections[0].toLowerCase();
            this.pushAudio(playlist, `${this.lang}/abschnitte/hoch/${sec}`, sections[0]);
        } else {
            const first = sections[0].toLowerCase();
            const last = sections[sections.length - 1].toLowerCase();
            
            this.pushAudio(playlist, `${this.lang}/abschnitte/tief/${first}`, sections[0]);
            this.module(playlist, 'BIS');
            this.pushAudio(playlist, `${this.lang}/abschnitte/tief/${last}`, sections[sections.length - 1]);
        }
    }

    /**
     * Fügt Zugname und Ziel/Herkunft (mit Zwischenhalten) zur Playlist hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {object} journey - Das Journey-Objekt
     */
    route(playlist, journey) {
        this.train(playlist, journey.name);
        
        const targetObj = {
            name: journey.destination,
            extId: journey.destinationIbnr
        };

        if (journey.ankunft) {
            this.module(playlist, 'VON');
            this.targetWithVia(playlist, targetObj, [], true);
        } else {
            this.module(playlist, 'NACH');
            this.targetWithVia(playlist, targetObj, journey.audioVias, false);
        }
    }

    /**
     * Fügt Zeitangaben (Planzeit bzw. "ursprünglich") zur Playlist hinzu.
     * @param {Array} playlist - Die Playlist
     * @param {object} journey - Das Journey-Objekt
     * @param {string} delayActionStr - 'ABFAHRT' oder 'ANKUNFT'
     * @param {number} [delay=0] - Verspätung in Minuten
     */
    timeInfo(playlist, journey, delayActionStr, delay = 0) {
        if (delay >= 5) {
            this.module(playlist, delayActionStr + '_URSPRUENGLICH');
        } else {
            this.module(playlist, delayActionStr);
        }
        
        this.time(playlist, journey.scheduledTime);
    }

    /**
     * Fügt eine Verspätungsangabe ("heute ca. X Minuten später") zur Playlist hinzu (ab 5 Min.).
     * @param {Array} playlist - Die Playlist
     * @param {number} delay - Verspätung in Minuten
     */
    delay(playlist, delay) {
        if (!delay || delay < 5) return;
        const delayStr = String(delay).padStart(3, '0');
        playlist.push({
            file: `${this.lang}/zeiten/verspaetung_heute/${delayStr}`,
            text: `heute ca. ${delay} Minuten später`
        });
    }
}
