import { StationService } from './stationService.js';
import { audioModules } from './audioModules.js';

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
        // Exact match or find in aliases
        const match = StationService.stations.find(s => 
            s.name.toLowerCase() === stationName.toLowerCase() || 
            s.aliases.some(a => a.toLowerCase() === stationName.toLowerCase())
        );
        return match ? match.ibnr : '8000105'; // Fallback to Frankfurt(Main)Hbf as dummy
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
        
        // Remove non-digits for simplicity, or handle letters if needed
        const cleanNum = String(numStr).replace(/\D/g, '');
        if (!cleanNum) return;

        // Leading zeros
        if (cleanNum.startsWith('0')) {
            for (let i = 0; i < cleanNum.length; i++) {
                playlist.push({
                    file: `${this.lang}/gleise_zahlen/${defaultPitch}/${cleanNum[i]}.opus`,
                    text: cleanNum[i]
                });
            }
            return;
        }

        const len = cleanNum.length;
        if (len <= 2) {
            playlist.push({
                file: `${this.lang}/gleise_zahlen/${defaultPitch}/${cleanNum}.opus`,
                text: cleanNum
            });
        } else if (len === 3) {
            if (cleanNum.endsWith('00')) {
                playlist.push({
                    file: `${this.lang}/gleise_zahlen/${defaultPitch}/${cleanNum}.opus`,
                    text: cleanNum
                });
            } else {
                const hundreds = cleanNum[0] + '00';
                const remainder = parseInt(cleanNum.substring(1), 10).toString();
                
                playlist.push({
                    file: `${this.lang}/gleise_zahlen/${defaultPitch}/${hundreds}_.opus`,
                    text: hundreds
                });
                
                // Remainder is 1-99 without leading zero
                playlist.push({
                    file: `${this.lang}/gleise_zahlen/${defaultPitch}/${remainder}.opus`,
                    text: remainder
                });
            }
        } else if (len === 4) {
            const p1 = cleanNum.substring(0, 2);
            const p2 = cleanNum.substring(2, 4);
            
            this._number(playlist, p1, 'tief');
            this._number(playlist, p2, defaultPitch);
        } else if (len === 5) {
            const p1 = cleanNum.substring(0, 2);
            const p2 = cleanNum.substring(2, 3);
            const p3 = cleanNum.substring(3, 5);
            
            this._number(playlist, p1, defaultPitch);
            this._number(playlist, p2, defaultPitch);
            this._number(playlist, p3, defaultPitch);
        }
    }

    /**
     * Pitch logic for destinations / vias
     */
    _targetWithVia(playlist, targetStr, vias = []) {
        if (!targetStr) return;
        
        const targetIbnr = this._getIbnr(targetStr);
        if (!targetIbnr) return;

        if (vias && vias.length > 0) {
            // Target is in the middle -> hoch
            playlist.push({
                file: `${this.lang}/ziele/variante2/hoch/${targetIbnr}.opus`,
                text: targetStr
            });
            
            this._module(playlist, 'UEBER');
            
            // Just take the first via for now
            const viaIbnr = this._getIbnr(vias[0]);
            playlist.push({
                file: `${this.lang}/ziele/variante2/tief/${viaIbnr}.opus`,
                text: vias[0]
            });
        } else {
            // Target is at the end -> tief
            playlist.push({
                file: `${this.lang}/ziele/variante2/tief/${targetIbnr}.opus`,
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
                file: `${this.lang}/zuggattungen/hoch/${gattung.toLowerCase()}.opus`,
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

        if (mm === '0' || mm === '00') {
            playlist.push({
                file: `${this.lang}/zeiten/stunden/tief/${parseInt(hh, 10)}.opus`,
                text: `${hh} Uhr`
            });
        } else {
            playlist.push({
                file: `${this.lang}/zeiten/stunden/hoch/${parseInt(hh, 10)}.opus`,
                text: `${hh} Uhr`
            });
            playlist.push({
                file: `${this.lang}/zeiten/minuten/tief/${parseInt(mm, 10)}.opus`,
                text: mm
            });
        }
    }

    /**
     * Gong
     */
    _gong(playlist) {
        playlist.push({
            file: `gong/513/513_2.opus`, // Standard DB Gong (without lang prefix)
            text: "Gong"
        });
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
        } else {
            this._module(p, 'NACH');
        }
        this._targetWithVia(p, journey.destination, journey.vias);
        
        // Delay Check
        let delay = 0;
        if (journey.expectedTime && journey.scheduledTime) {
            const [sh, sm] = journey.scheduledTime.split(':').map(Number);
            const [eh, em] = journey.expectedTime.split(':').map(Number);
            const diff = (eh * 60 + em) - (sh * 60 + sm);
            if (diff > 0) delay = Math.floor(diff / 5) * 5;
        }

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
        } else {
            this._module(p, 'NACH');
        }
        this._targetWithVia(p, journey.destination, journey.vias);
        
        if (journey.isArrival) {
            this._module(p, 'ANKUNFT');
        } else {
            this._module(p, 'ABFAHRT');
        }
        this._time(p, journey.scheduledTime);

        return p;
    }

    generateInformation(journey) {
        const p = [];
        this._gong(p);
        this._module(p, 'INFORMATION_ZU');
        this._train(p, journey.name);
        
        if (journey.isArrival) {
            this._module(p, 'VON');
        } else {
            this._module(p, 'NACH');
        }
        this._targetWithVia(p, journey.destination, journey.vias);
        
        if (journey.isArrival) {
            this._module(p, 'ANKUNFT');
        } else {
            this._module(p, 'ABFAHRT');
        }
        this._time(p, journey.scheduledTime);

        if (journey.isCancelled) {
            this._module(p, 'ZUGAUSFALL');
            this._module(p, 'ENTSCHULDIGUNG');
            return p;
        }

        let delay = 0;
        if (journey.expectedTime && journey.scheduledTime) {
            const [sh, sm] = journey.scheduledTime.split(':').map(Number);
            const [eh, em] = journey.expectedTime.split(':').map(Number);
            const diff = (eh * 60 + em) - (sh * 60 + sm);
            if (diff > 0) delay = Math.floor(diff / 5) * 5;
        }

        if (delay >= 5) {
            const delayStr = String(delay).padStart(3, '0');
            p.push({
                file: `${this.lang}/zeiten/verspaetung_heute/ca_${delayStr}_Minuten_spaeter.opus`,
                text: `ca. ${delay} Minuten später`
            });
        }

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
