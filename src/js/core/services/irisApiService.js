import { RisTextService } from './risTextService.js';
import { StationService } from '../../features/station/stationService.js';
import { IrisCacheService } from './irisCacheService.js';

export class IrisApiService {
    static BASE_URL = 'https://iris.noncd.db.de/iris-tts/timetable';

    /**
     * Lade ausschließlich die Basis-Fahrplandaten für die vorherige, aktuelle und nächste Stunde.
     * Nutzt den IrisCacheService, um redundante Netzwerkanfragen zu vermeiden.
     * @param {string} eva 
     * @param {Date} dateObj 
     * @returns {Promise<Map>} Eine Map mit den geparsten Fahrplandaten (ohne Echtzeit).
     */
    static async loadBasePlan(eva, dateObj = new Date()) {
        const fetchPlanForHour = async (dateObjOffset) => {
            const { dateStr, hourStr } = this._formatIrisDate(dateObjOffset);
            const cacheKey = IrisCacheService.getPlanKey(eva, dateStr, hourStr);
            
            let xmlText = IrisCacheService.get(cacheKey);
            if (!xmlText) {
                const res = await fetch(`${this.BASE_URL}/plan/${eva}/${dateStr}/${hourStr}`);
                if (res.ok) {
                    xmlText = await res.text();
                    IrisCacheService.set(cacheKey, xmlText);
                } else {
                    console.error(`[IrisApiService] Error fetching plan for ${eva} at ${dateStr} ${hourStr}: HTTP ${res.status}`);
                    return null;
                }
            }
            
            return new window.DOMParser().parseFromString(xmlText, 'text/xml');
        };

        const prevHour = new Date(dateObj.getTime() - 60 * 60 * 1000);
        const nextHour = new Date(dateObj.getTime() + 60 * 60 * 1000);

        // Fahrplan für vorherige, aktuelle und nächste Stunde laden
        const [planPrev, planCurr, planNext] = await Promise.all([
            fetchPlanForHour(prevHour),
            fetchPlanForHour(dateObj),
            fetchPlanForHour(nextHour)
        ]);

        const journeys = new Map();
        if (planPrev) this._parsePlan(planPrev, journeys);
        if (planCurr) this._parsePlan(planCurr, journeys);
        if (planNext) this._parsePlan(planNext, journeys);

        return journeys;
    }

    /**
     * Sucht im Echtzeit-XML nach Zug-IDs, für die uns der Basis-Plan fehlt (z.B. wegen hoher Verspätung).
     * Lädt diese Pläne nach und ergänzt sie im übergebenen journeys Map.
     */
    static async loadMissingPlans(eva, realtimeXml, journeysMap) {
        if (!realtimeXml) return;
        const sNodes = realtimeXml.querySelectorAll('s');
        const missingHours = new Set();
        
        for (const s of sNodes) {
            const id = s.getAttribute('id');
            if (journeysMap.has(id)) continue;
            
            // Format der ID z.B.: ...-2401011530-... (YYMMDDHHMM)
            const match = id.match(/-(\d{10})-/);
            if (match) {
                const timestampStr = match[1];
                const dateStr = timestampStr.slice(0, 6);
                const hh = timestampStr.slice(6, 8);
                const cacheKey = IrisCacheService.getPlanKey(eva, dateStr, hh);
                
                if (!IrisCacheService.get(cacheKey)) {
                    missingHours.add(`${dateStr}|${hh}`);
                }
            }
        }
        
        for (const hourKey of missingHours) {
            const [dateStr, hh] = hourKey.split('|');
            const cacheKey = IrisCacheService.getPlanKey(eva, dateStr, hh);
            let xmlText = IrisCacheService.get(cacheKey);
            if (!xmlText) {
                try {
                    const res = await fetch(`${this.BASE_URL}/plan/${eva}/${dateStr}/${hh}`);
                    if (res.ok) {
                        xmlText = await res.text();
                        IrisCacheService.set(cacheKey, xmlText);
                    }
                } catch (e) {
                    console.error(`[IrisApiService] Error fetching missing plan ${dateStr} ${hh}`, e);
                }
            }
            if (xmlText) {
                const xml = new window.DOMParser().parseFromString(xmlText, 'text/xml');
                this._parsePlan(xml, journeysMap);
            }
        }
    }

    /**
     * Ruft separat die Echtzeitdaten ab (Standard: fchg).

     * @param {string} eva 
     * @param {string} type 'fchg' (Full Changes) oder 'rchg' (Recent Changes)
     * @returns {Promise<Document|null>} XML Document
     */
    static async fetchRealtime(eva, type = 'fchg') {
        try {
            const res = await fetch(`${this.BASE_URL}/${type}/${eva}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            return new window.DOMParser().parseFromString(text, 'text/xml');
        } catch (e) {
            console.error(`[IrisApiService] Error fetching realtime (${type}) for ${eva}:`, e);
            return null;
        }
    }

    /**
     * Wendet die abgerufenen Echtzeitdaten (XML) auf die bestehenden Fahrplandaten (Map) an.
     * @param {Map} journeys 
     * @param {Document} realtimeXml 
     */
    static mergeRealtime(journeys, realtimeXml) {
        if (!realtimeXml) return;
        
        const sNodes = realtimeXml.querySelectorAll('s');
        for (const s of sNodes) {
            const id = s.getAttribute('id');
            if (!journeys.has(id)) continue;
            
            const journey = journeys.get(id);
            const ar = s.querySelector('ar');
            const dp = s.querySelector('dp');
            const msgs = s.querySelectorAll('m');

            if (ar) {
                journey.rt.ar = {
                    ct: ar.getAttribute('ct'),
                    cp: ar.getAttribute('cp'),
                    pp: ar.getAttribute('pp'),
                    cs: ar.getAttribute('cs')
                };
            }
            if (dp) {
                journey.rt.dp = {
                    ct: dp.getAttribute('ct'),
                    cp: dp.getAttribute('cp'),
                    pp: dp.getAttribute('pp'),
                    cs: dp.getAttribute('cs')
                };
            }
            
            journey.rt.messages = Array.from(msgs).map(m => m.getAttribute('c')).filter(c => c);
        }
    }

    static _parsePlan(xml, journeys = new Map()) {
        const sNodes = xml.querySelectorAll('s');

        for (const s of sNodes) {
            const id = s.getAttribute('id');
            const tl = s.querySelector('tl');
            const ar = s.querySelector('ar');
            const dp = s.querySelector('dp');

            if (!tl) continue;

            journeys.set(id, {
                id,
                type: tl.getAttribute('c'),
                number: tl.getAttribute('n'),
                class: tl.getAttribute('f'),
                operator: tl.getAttribute('o'),
                ar: ar ? {
                    pt: ar.getAttribute('pt'),
                    pp: ar.getAttribute('pp'),
                    pde: ar.getAttribute('pde'),
                    ppth: ar.getAttribute('ppth'),
                    wings: ar.getAttribute('wings'),
                    l: ar.getAttribute('l')
                } : null,
                dp: dp ? {
                    pt: dp.getAttribute('pt'),
                    pp: dp.getAttribute('pp'),
                    pde: dp.getAttribute('pde'),
                    ppth: dp.getAttribute('ppth'),
                    wings: dp.getAttribute('wings'),
                    l: dp.getAttribute('l')
                } : null,
                rt: {}
            });
        }
        return journeys;
    }

    /**
     * Mappt das interne Map-Format in die Struktur für das ZIMSim-UI.
     * Filtert Züge heraus, deren Abfahrt/Ankunft zu weit in der Vergangenheit oder Zukunft liegt.
     */
    static mapToZimsimFormat(journeysMap, eva, simulatedTime, futureWindowHours = 2) {
        const results = [];
        const simTimeMs = simulatedTime ? simulatedTime.getTime() : Date.now();
        const pastThreshold = simTimeMs - (3 * 60 * 1000); // 3 Minuten in der Vergangenheit
        const futureThreshold = simTimeMs + (futureWindowHours * 60 * 60 * 1000); // X Stunden in der Zukunft

        for (const raw of journeysMap.values()) {
            const isArrivalOnly = raw.ar && !raw.dp;
            const primaryNode = raw.dp || raw.ar;
            
            if (!primaryNode) continue;
            
            let rtNode = isArrivalOnly ? raw.rt.ar : raw.rt.dp;
            
            // Fallback für Echtzeit-Daten: Wenn fchg nur <ar> aber kein <dp> schickt (oder <dp> unvollständig ist)
            if (!isArrivalOnly && raw.rt.ar) {
                if (!rtNode) {
                    rtNode = raw.rt.ar;
                } else {
                    if (!rtNode.cp && raw.rt.ar.cp) rtNode.cp = raw.rt.ar.cp;
                    if (!rtNode.ct && raw.rt.ar.ct) rtNode.ct = raw.rt.ar.ct;
                    if (!rtNode.pp && raw.rt.ar.pp) rtNode.pp = raw.rt.ar.pp;
                    if (!rtNode.cs && raw.rt.ar.cs) rtNode.cs = raw.rt.ar.cs;
                }
            }

            const scheduledTime = this._parseIrisTime(primaryNode.pt);
            const expectedTime = (rtNode && rtNode.ct) ? this._parseIrisTime(rtNode.ct) : '';
            
            // Sliding Window Check
            const effectiveTimeStr = (rtNode && rtNode.ct) ? rtNode.ct : primaryNode.pt;
            const effectiveTimeMs = this._parseIrisDateTime(effectiveTimeStr);
            if (effectiveTimeMs) {
                if (effectiveTimeMs < pastThreshold || effectiveTimeMs > futureThreshold) {
                    continue; // Außerhalb des Sichtbarkeitsfensters
                }
            }

            const delayReason = this._getDelayReason(raw.rt.messages);
            
            // Haltepunkte (Vias) anreichern
            const stops = primaryNode.ppth ? primaryNode.ppth.split('|').map((s, i) => {
                const stopData = { name: s, showAsVia: true, routeIndex: i, nameKurz: s };
                if (StationService.isLoaded) {
                    const st = StationService.getStationByIdOrName(null, s);
                    if (st) {
                        stopData.name = st.name;
                        stopData.nameKurz = st.nameKurz || st.name;
                    }
                }
                return stopData;
            }) : [];

            // Ziel (bzw. Herkunft bei Ankünften) ermitteln
            let destName = '';

            if (isArrivalOnly) {
                destName = raw.ar.pde || '';
                if (!destName && stops.length > 0) {
                    destName = stops[0].name;
                }
            } else {
                destName = primaryNode.pde || '';
                if (!destName && stops.length > 0) {
                    destName = stops[stops.length - 1].name;
                }
            }

            let destLang = destName;
            let destKurz = destName;
            if (destName && StationService.isLoaded) {
                const destSt = StationService.getStationByIdOrName(null, destName);
                if (destSt) {
                    destName = destSt.name;
                    destLang = destSt.name;
                    destKurz = destSt.nameKurz || destSt.name;
                }
            }

            // Zugnamen formatieren
            let formattedName = `${raw.type || ''} ${raw.number || ''}`.trim();
            if (primaryNode.l) {
                let lineStr = primaryNode.l;
                // Add space between letters and numbers (e.g. 'RE6' -> 'RE 6')
                lineStr = lineStr.replace(/^([A-Za-z]+)(\d+)$/, '$1 $2');
                
                if (!lineStr.toUpperCase().includes((raw.type || '').toUpperCase()) && /^\d+$/.test(lineStr)) {
                    lineStr = `${raw.type} ${lineStr}`.trim();
                }
                formattedName = `${lineStr} / ${raw.number}`;
            }

            // Gleislogik: Plan- und Echtzeitgleis ermitteln
            let planGleis = primaryNode.pp || (raw.ar ? raw.ar.pp : '') || '';
            if (!planGleis && rtNode && rtNode.pp) {
                planGleis = rtNode.pp; // Manchmal kommt das Plangleis erst im Echtzeit-Feed
            }

            let echtzeitGleis = (rtNode && rtNode.cp) ? rtNode.cp : '';

            if (!planGleis && echtzeitGleis) {
                planGleis = echtzeitGleis;
                echtzeitGleis = '';
            }
            
            if (planGleis === echtzeitGleis) {
                echtzeitGleis = '';
            }

            results.push({
                journeyId: raw.id,
                name: formattedName,
                produktGattung: raw.class,
                operator: raw.operator,
                destination: destName,
                destinationLang: destLang,
                destinationKurz: destKurz,
                scheduledTime: scheduledTime,
                expectedTime: expectedTime,
                platform: planGleis,
                ezGleis: echtzeitGleis,
                ausfall: (rtNode && rtNode.cs === 'c'),
                ankunft: isArrivalOnly,
                stops: stops,
                delayReason: delayReason,
                couplingGroupId: primaryNode.wings || null,
                _effectiveTimeMs: effectiveTimeMs // Für internen Gebrauch (Autoplay Ticker)
            });
        }
        return results;
    }

    static _formatIrisDate(date) {
        // Zwingend Europe/Berlin Zeitzone für DB IRIS
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Berlin',
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            hourCycle: 'h23'
        });
        const parts = formatter.formatToParts(date);
        let yy, mm, dd, HH;
        
        for (const part of parts) {
            if (part.type === 'year') yy = part.value;
            if (part.type === 'month') mm = part.value;
            if (part.type === 'day') dd = part.value;
            if (part.type === 'hour') HH = part.value.padStart(2, '0');
        }
        
        return { dateStr: `${yy}${mm}${dd}`, hourStr: HH };
    }

    static _parseIrisTime(irisTimeStr) {
        if (!irisTimeStr || irisTimeStr.length !== 10) return '';
        // YYMMDDHHMM -> Format "HH:mm" für ZIMSim UI
        const hh = irisTimeStr.slice(6, 8);
        const min = irisTimeStr.slice(8, 10);
        return `${hh}:${min}`;
    }

    static _parseIrisDateTime(irisTimeStr) {
        if (!irisTimeStr || irisTimeStr.length !== 10) return null;
        const yy = 2000 + parseInt(irisTimeStr.slice(0, 2), 10);
        const mm = parseInt(irisTimeStr.slice(2, 4), 10) - 1;
        const dd = parseInt(irisTimeStr.slice(4, 6), 10);
        const hh = parseInt(irisTimeStr.slice(6, 8), 10);
        const min = parseInt(irisTimeStr.slice(8, 10), 10);
        return new Date(yy, mm, dd, hh, min).getTime();
    }

    static _getDelayReason(messageCodes) {
        if (!messageCodes || messageCodes.length === 0) return '';
        if (!RisTextService.isLoaded) return '';
        
        for (const code of messageCodes) {
            const preset = RisTextService.presets.find(p => p.code === code);
            if (preset) return preset.text;
        }
        return '';
    }
}
