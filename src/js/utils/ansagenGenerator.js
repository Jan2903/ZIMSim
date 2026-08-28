import { StationService } from './stationService.js';
import { audioModules } from './audioModules.js';
import { ansagenStore } from './ansagenStore.svelte.js';
import { parseTrack } from './trackUtils.js';

export class AnsagenGenerator {
    constructor() {
        this.lang = 'dt'; // Zwingender Name für den ZIP-Ordner
    }

    _getIbnr(stationName) {
        if (!stationName) return null;
        const match = StationService.getStationByIdOrName(null, stationName);
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

    _targetWithVia(playlist, targetStr, vias = []) {
        if (!targetStr) return;
        
        const targetIbnr = this._getIbnr(targetStr);
        if (!targetIbnr) return;

        let maxVias = ansagenStore.maxVias;
        let activeVias = [];
        if (maxVias === 6) {
            activeVias = [...vias];
        } else if (maxVias > 0) {
            activeVias = vias.slice(0, maxVias);
        }

        if (activeVias && activeVias.length > 0) {
            playlist.push({
                file: `${this.lang}/ziele/variante2/hoch/${targetIbnr}`,
                text: targetStr
            });
            
            this._module(playlist, 'UEBER');
            
            for (let i = 0; i < activeVias.length; i++) {
                const viaName = activeVias[i];
                const viaIbnr = this._getIbnr(viaName);
                if (i === activeVias.length - 1) {
                    playlist.push({
                        file: `${this.lang}/ziele/variante2/tief/${viaIbnr}`,
                        text: viaName
                    });
                } else {
                    playlist.push({
                        file: `${this.lang}/ziele/variante2/hoch/${viaIbnr}`,
                        text: viaName
                    });
                }
            }
        } else {
            playlist.push({
                file: `${this.lang}/ziele/variante2/tief/${targetIbnr}`,
                text: targetStr
            });
        }
    }

    _train(playlist, trainName) {
        if (!trainName) return;

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
            this._number(playlist, nummer, 'hoch');
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
        if (!journey.stops || journey.stops.length === 0) return;

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
                nurBisStation = futureStops[lastActiveIndex].name;
            }
        }

        let cancelledStops = futureStops.filter(s => s.cancelled).map(s => s.name);
        let additionalStops = futureStops.filter(s => s.additional).map(s => s.name);

        if (cancelledStops.length > 3) cancelledStops = cancelledStops.slice(0, 3);
        if (additionalStops.length > 3) additionalStops = additionalStops.slice(0, 3);

        if (nurBisStation) {
            const ibnr = this._getIbnr(nurBisStation);
            if (ibnr) {
                this._module(playlist, 'HEUTE_NUR_BIS');
                playlist.push({
                    file: `${this.lang}/ziele/variante2/tief/${ibnr}`,
                    text: nurBisStation
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

    _addStationList(playlist, stationNames) {
        const validStations = stationNames.map(name => ({
            name: name,
            ibnr: this._getIbnr(name)
        })).filter(s => s.ibnr !== null);

        for (let i = 0; i < validStations.length; i++) {
            const { name, ibnr } = validStations[i];
            
            if (i === validStations.length - 1) {
                if (i > 0) {
                    this._module(playlist, 'UND');
                }
                playlist.push({
                    file: `${this.lang}/ziele/variante2/tief/${ibnr}`,
                    text: name
                });
            } else {
                playlist.push({
                    file: `${this.lang}/ziele/variante2/hoch/${ibnr}`,
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
        if (!journey.expectedTime || !journey.scheduledTime) return 0;
        
        const [sh, sm] = journey.scheduledTime.split(':').map(Number);
        const [eh, em] = journey.expectedTime.split(':').map(Number);
        
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < -720) diff += 1440; 
        else if (diff > 720) diff -= 1440; 
        
        if (diff > 0) return Math.floor(diff / 5) * 5;
        return 0;
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
        
        if (journey.isArrival) {
            this._module(playlist, 'VON');
            this._targetWithVia(playlist, journey.destination, []);
        } else {
            this._module(playlist, 'NACH');
            this._targetWithVia(playlist, journey.destination, journey.vias);
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

    generateEinfahrt(journey) {
        const p = [];
        this._gong(p);
        this._appendPlatform(p, journey);
        
        this._module(p, 'EINFAHRT');
        this._appendRoute(p, journey);
        this._appendTimeInfo(p, journey, journey.isArrival ? 'ANKUNFT' : 'ABFAHRT');
        
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
        
        // Steht nutzt keine "_URSPRUENGLICH" Fallback Logik für die Zeit in der originalen Datei
        this._module(p, journey.isArrival ? 'ANKUNFT' : 'ABFAHRT');
        this._time(p, journey.scheduledTime);
        
        this._generateDeviations(p, journey);

        return p;
    }

    generateInformation(journey) {
        const p = [];
        this._gong(p);
        this._module(p, 'INFORMATION_ZU');
        
        this._appendRoute(p, journey);
        this._module(p, journey.isArrival ? 'ANKUNFT' : 'ABFAHRT');
        this._time(p, journey.scheduledTime);

        if (journey.isCancelled) {
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
