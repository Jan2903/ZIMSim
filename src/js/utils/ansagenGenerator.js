import { StationService } from './stationService.js';
import { audioModules } from './audioModules.js';
import { ansagenStore } from './ansagenStore.svelte.js';

export class AnsagenGenerator {
    constructor() {
        this.lang = 'dt'; // Default language
    }

    /**
     * Resolves the IBNR for a given station name using StationService.
     * Fallback to dummy if not found to avoid crash, or return null if strict.
     */
    _getIbnr(stationName) {
        if (!stationName) return null;
        const match = StationService.getStationByIdOrName(null, stationName);
        return match ? match.ibnr : null;
    }

    /**
     * Adds a static module to the playlist.
     */
    _module(playlist, modKey) {
        const mod = audioModules[modKey];
        if (mod && mod.de) {
            const filename = mod.de.file;
            const basename = filename.split('.')[0];
            const folder = basename.length === 3 ? 'module_3_1' : 'module';
            
            playlist.push({
                file: `${this.lang}/${folder}/${filename}`,
                text: mod.de.text
            });
        }
    }

    /**
     * Pitch logic for numbers (Train numbers, platform numbers)
     * e.g., "123" -> hoch, "2048" -> "20" (tief) + "48" (hoch)
     */
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
        playlist.push({
            file: `${this.lang}/gleise_zahlen/${pitch}/${number}`,
            text: number
        });
    }

    /**
     * Pitch logic for destinations / vias
     */
    _targetWithVia(playlist, targetStr, vias = []) {
        if (!targetStr) return;
        
        const targetIbnr = this._getIbnr(targetStr);
        if (!targetIbnr) return;

        // Apply maxVias setting
        let maxVias = ansagenStore.maxVias;
        let activeVias = [];
        if (maxVias === 6) {
            activeVias = [...vias]; // Alle
        } else if (maxVias > 0) {
            activeVias = vias.slice(0, maxVias);
        }

        if (activeVias && activeVias.length > 0) {
            // Target is in the middle -> hoch
            playlist.push({
                file: `${this.lang}/ziele/variante2/hoch/${targetIbnr}`,
                text: targetStr
            });
            
            this._module(playlist, 'UEBER');
            
            for (let i = 0; i < activeVias.length; i++) {
                const viaName = activeVias[i];
                const viaIbnr = this._getIbnr(viaName);
                if (i === activeVias.length - 1) {
                    // Last via -> tief
                    playlist.push({
                        file: `${this.lang}/ziele/variante2/tief/${viaIbnr}`,
                        text: viaName
                    });
                } else {
                    // Intermediate via -> hoch
                    playlist.push({
                        file: `${this.lang}/ziele/variante2/hoch/${viaIbnr}`,
                        text: viaName
                    });
                }
            }
        } else {
            // Target is at the end -> tief
            playlist.push({
                file: `${this.lang}/ziele/variante2/tief/${targetIbnr}`,
                text: targetStr
            });
        }
    }

    /**
     * Pitch logic for train identification
     */
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
                gattung = trainName; // Fallback
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

    /**
     * Pitch logic for time
     */
    _time(playlist, timeStr) {
        if (!timeStr) return;
        // timeStr usually "HH:MM"
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

        // Check for nurBis (if the last stop is cancelled)
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

        // Haltausfälle und Zusatzhalte über alle zukünftigen Halte
        let cancelledStops = futureStops.filter(s => s.cancelled).map(s => s.name);
        let additionalStops = futureStops.filter(s => s.additional).map(s => s.name);

        // Limit to max 3
        if (cancelledStops.length > 3) cancelledStops = cancelledStops.slice(0, 3);
        if (additionalStops.length > 3) additionalStops = additionalStops.slice(0, 3);

        // A. Nur Bis
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

        // B. Zusatzhalte
        if (additionalStops.length > 0) {
            this._module(playlist, 'ZUSATZHALT_IN');
            this._addStationList(playlist, additionalStops);
        }

        // C. Haltausfälle
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

    /**
     * Gong
     */
    _gong(playlist) {
        playlist.push({
            file: `gong/513/513_2`, // Standard DB Gong (without lang prefix)
            text: "Gong"
        });
    }

    _calculateDelay(journey) {
        if (!journey.expectedTime || !journey.scheduledTime) return 0;
        
        const [sh, sm] = journey.scheduledTime.split(':').map(Number);
        const [eh, em] = journey.expectedTime.split(':').map(Number);
        
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < -720) diff += 1440; // Crossed midnight forward
        else if (diff > 720) diff -= 1440; // Crossed midnight backward
        
        if (diff > 0) return Math.floor(diff / 5) * 5;
        return 0;
    }

    // --- MAIN MODES ---

    generateEinfahrt(journey) {
        const p = [];
        this._gong(p);
        
        const gleis = journey.ezGleis || journey.platform;
        
        if (gleis) {
            this._module(p, 'GLEIS');
            this._number(p, gleis, 'hoch');
        }

        this._module(p, 'EINFAHRT');
        this._train(p, journey.name);
        
        if (journey.isArrival) {
            this._module(p, 'VON');
            this._targetWithVia(p, journey.destination, []);
        } else {
            this._module(p, 'NACH');
            this._targetWithVia(p, journey.destination, journey.vias);
        }
        
        // Delay Check
        let delay = this._calculateDelay(journey);

        if (delay >= 5) {
            if (journey.isArrival) {
                this._module(p, 'ANKUNFT_URSPRUENGLICH');
            } else {
                this._module(p, 'ABFAHRT_URSPRUENGLICH');
            }
        } else {
            if (journey.isArrival) {
                this._module(p, 'ANKUNFT');
            } else {
                this._module(p, 'ABFAHRT');
            }
        }
        
        this._time(p, journey.scheduledTime);
        this._generateDeviations(p, journey);
        this._module(p, 'VORSICHT_BEI_DER_EINFAHRT');

        return p;
    }

    generateSteht(journey) {
        const p = [];
        this._gong(p);
        
        const gleis = journey.ezGleis || journey.platform;
        if (gleis) {
            this._module(p, 'GLEIS');
            this._number(p, gleis, 'hoch');
        }
        
        this._module(p, 'STEHT');
        this._train(p, journey.name);
        
        if (journey.isArrival) {
            this._module(p, 'VON');
            this._targetWithVia(p, journey.destination, []);
        } else {
            this._module(p, 'NACH');
            this._targetWithVia(p, journey.destination, journey.vias);
        }
        
        if (journey.isArrival) {
            this._module(p, 'ANKUNFT');
        } else {
            this._module(p, 'ABFAHRT');
        }
        this._time(p, journey.scheduledTime);
        this._generateDeviations(p, journey);

        return p;
    }

    generateInformation(journey) {
        const p = [];
        this._gong(p);
        this._module(p, 'INFORMATION_ZU');
        this._train(p, journey.name);
        
        if (journey.isArrival) {
            this._module(p, 'VON');
            this._targetWithVia(p, journey.destination, []);
        } else {
            this._module(p, 'NACH');
            this._targetWithVia(p, journey.destination, journey.vias);
        }
        
        if (journey.isArrival) {
            this._module(p, 'ANKUNFT');
        } else {
            this._module(p, 'ABFAHRT');
        }
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
                file: `${this.lang}/zeiten/verspaetung_heute/ca_${delayStr}_Minuten_spaeter`,
                text: `ca. ${delay} Minuten später`
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
        // Needs a list of connections. For now, just a stub or basic loop
        const p = [];
        this._gong(p);
        this._module(p, 'ANSCHLUESSE');
        
        // Dummy implementation since we don't have real connections in journey model yet
        // In real use, we would iterate over journey.connections
        
        return p;
    }
}

export const ansagenGenerator = new AnsagenGenerator();
