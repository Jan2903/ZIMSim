import { RisTextService } from './risTextService.js';
import { StationService } from '../../features/station/stationService.js';

export class IrisApiService {
    static BASE_URL = 'https://iris.noncd.db.de/iris-tts/timetable';

    /**
     * Lade Fahrplandaten und Echtzeitdaten von DB-IRIS, kombiniere sie.
     */
    static async loadJourneys(eva, dateObj = new Date()) {
        const fetchPlanForHour = async (dateObjOffset) => {
            const { dateStr, hourStr } = this._formatIrisDate(dateObjOffset);
            return await this._fetchXml(`/plan/${eva}/${dateStr}/${hourStr}`);
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

        // Echtzeit laden
        const fchgXml = await this._fetchXml(`/fchg/${eva}`);
        if (fchgXml) {
            this._applyRealtime(journeys, fchgXml);
        }

        return this._mapToZimsimFormat(journeys, eva);
    }

    static async _fetchXml(path) {
        try {
            const res = await fetch(`${this.BASE_URL}${path}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            return new window.DOMParser().parseFromString(text, 'text/xml');
        } catch (e) {
            console.error(`[IrisApiService] Error fetching ${path}:`, e);
            return null;
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

    static _applyRealtime(journeys, xml) {
        const sNodes = xml.querySelectorAll('s');
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

    static _mapToZimsimFormat(journeysMap, eva) {
        const results = [];
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

            // Wenn es nie ein Plangleis gab, aber ein Gleis in Echtzeit bekannt gegeben wurde (Gleisbekanntgabe)
            if (!planGleis && echtzeitGleis) {
                planGleis = echtzeitGleis;
                echtzeitGleis = '';
            }
            
            // Wenn Echtzeitgleis identisch mit Plangleis ist, ist es kein Gleiswechsel
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
                couplingGroupId: primaryNode.wings || null
            });
        }
        return results;
    }

    static _formatIrisDate(date) {
        const pad = n => n.toString().padStart(2, '0');
        const yy = date.getFullYear().toString().slice(-2);
        const mm = pad(date.getMonth() + 1);
        const dd = pad(date.getDate());
        const HH = pad(date.getHours());
        return { dateStr: `${yy}${mm}${dd}`, hourStr: HH };
    }

    static _parseIrisTime(irisTimeStr) {
        if (!irisTimeStr || irisTimeStr.length !== 10) return '';
        // YYMMDDHHMM -> Format "HH:mm" für ZIMSim UI
        const hh = irisTimeStr.slice(6, 8);
        const min = irisTimeStr.slice(8, 10);
        return `${hh}:${min}`;
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
