import { IrisCacheService } from './irisCacheService.js';

export class IrisApiService {
    static BASE_URL = 'https://iris.noncd.db.de/iris-tts/timetable';

    // --- Rate Limiting & Queue ---
    static _queuePromise = Promise.resolve();
    static _minRequestInterval = 250; // 250ms Mindestabstand zwischen API Calls

    /**
     * Führt einen Netzwerk-Fetch aus, reiht ihn aber in eine Queue ein,
     * um API-Limits der DB (z.B. max 60 pro Minute) nicht zu überschreiten.
     * @param {string} url 
     * @param {RequestInit} options (u.a. signal für AbortController)
     * @returns {Promise<Response>}
     */
    static _fetchWithLimit(url, options = {}) {
        const execute = async () => {
            if (options.signal && options.signal.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }
            return fetch(url, options);
        };

        const chained = this._queuePromise.then(async () => {
            try {
                return await execute();
            } finally {
                // Das Delay erzwingen, bevor der nächste Promise in der Chain ausgeführt wird
                await new Promise(r => setTimeout(r, this._minRequestInterval));
            }
        });

        // Verhindern, dass ein einzelner Netzwerkfehler die gesamte Queue lahmlegt
        this._queuePromise = chained.catch(() => {});
        return chained;
    }

    /**
     * Prüft, ob der angefragte Zeitpunkt im von der API unterstützten Fenster liegt.
     * Die API liefert ca. -12h bis +16h relativ zur echten Serverzeit.
     */
    static isWithinApiRange(dateStr, hourStr) {
        const yy = 2000 + parseInt(dateStr.slice(0, 2), 10);
        const mm = parseInt(dateStr.slice(2, 4), 10) - 1;
        const dd = parseInt(dateStr.slice(4, 6), 10);
        const hh = parseInt(hourStr, 10);
        const requestTime = new Date(yy, mm, dd, hh, 0, 0).getTime();
        const now = Date.now();
        const diffHours = (requestTime - now) / (1000 * 60 * 60);
        
        // Puffer: -12 Stunden bis +16 Stunden
        return diffHours >= -12 && diffHours <= 16;
    }

    /**
     * Lade ausschließlich die Basis-Fahrplandaten für die vorherige, aktuelle und nächste Stunde.
     * Nutzt den IrisCacheService, um redundante Netzwerkanfragen zu vermeiden.
     * @param {string} eva 
     * @param {Date} dateObj 
     * @param {AbortSignal} signal
     * @returns {Promise<Map>} Eine Map mit den geparsten Fahrplandaten (ohne Echtzeit).
     */
    static async loadBasePlan(eva, dateObj = new Date(), signal = null) {
        const fetchPlanForHour = async (dateObjOffset) => {
            const { dateStr, hourStr } = this._formatIrisDate(dateObjOffset);
            
            if (!this.isWithinApiRange(dateStr, hourStr)) {
                return null; // Zeit liegt außerhalb des erlaubten API-Fensters -> Vermeidet 404 XHR
            }

            const cacheKey = IrisCacheService.getPlanKey(eva, dateStr, hourStr);
            
            let xmlText = IrisCacheService.get(cacheKey);
            if (!xmlText) {
                const res = await this._fetchWithLimit(`${this.BASE_URL}/plan/${eva}/${dateStr}/${hourStr}`, { signal });
                if (res.ok) {
                    xmlText = await res.text();
                    IrisCacheService.set(cacheKey, xmlText);
                } else {
                    if (res.status !== 404) {
                        console.error(`[IrisApiService] Error fetching plan for ${eva} at ${dateStr} ${hourStr}: HTTP ${res.status}`);
                    }
                    return null;
                }
            }
            
            return new window.DOMParser().parseFromString(xmlText, 'text/xml');
        };

        const prevHour = new Date(dateObj.getTime() - 60 * 60 * 1000);
        const nextHour = new Date(dateObj.getTime() + 60 * 60 * 1000);

        // Fahrplan für vorherige, aktuelle und nächste Stunde laden
        // Dank _fetchWithLimit passiert das nun sauber nacheinander (mit Delay) auf dem Netzwerk!
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
    static async loadMissingPlans(eva, realtimeXml, journeysMap, currentSimTime, futureWindowHours, signal = null) {
        if (!realtimeXml) return;
        const sNodes = realtimeXml.querySelectorAll('s');
        const missingHours = new Set();
        const simTimeMs = currentSimTime.getTime();
        const pastThreshold = simTimeMs - (60 * 60 * 1000); // 1 hour past buffer
        const futureThreshold = simTimeMs + (futureWindowHours * 60 * 60 * 1000);
        
        for (const s of sNodes) {
            const id = s.getAttribute('id');
            if (journeysMap.has(id)) continue;
            
            let dateStr = null;
            let hh = null;

            // Suche nach ar oder dp Nodes um die LOKALE Zeit am Bahnhof zu finden
            const arNode = Array.from(s.childNodes).find(n => n.nodeName === 'ar');
            const dpNode = Array.from(s.childNodes).find(n => n.nodeName === 'dp');
            const primaryNode = arNode || dpNode;

            if (primaryNode) {
                const pt = primaryNode.getAttribute('pt');
                const ct = primaryNode.getAttribute('ct');
                const effectiveTimeStr = ct || pt;

                if (effectiveTimeStr && effectiveTimeStr.length >= 10) {
                    const yy = 2000 + parseInt(effectiveTimeStr.slice(0, 2), 10);
                    const mm = parseInt(effectiveTimeStr.slice(2, 4), 10) - 1;
                    const dd = parseInt(effectiveTimeStr.slice(4, 6), 10);
                    const h = parseInt(effectiveTimeStr.slice(6, 8), 10);
                    const m = parseInt(effectiveTimeStr.slice(8, 10), 10);
                    
                    const effectiveTimeMs = new Date(yy, mm, dd, h, m).getTime();
                    if (effectiveTimeMs < pastThreshold || effectiveTimeMs > futureThreshold) {
                        continue; // Zug ist zeitlich nicht mehr relevant, Basisplan wird nicht benötigt
                    }
                }

                if (pt && pt.length >= 8) {
                    dateStr = pt.slice(0, 6);
                    hh = pt.slice(6, 8);
                }
            }
            
            if (dateStr && hh) {
                const cacheKey = IrisCacheService.getPlanKey(eva, dateStr, hh);
                
                if (!IrisCacheService.get(cacheKey) && this.isWithinApiRange(dateStr, hh)) {
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
                    const res = await this._fetchWithLimit(`${this.BASE_URL}/plan/${eva}/${dateStr}/${hh}`, { signal });
                    if (res.ok) {
                        xmlText = await res.text();
                        IrisCacheService.set(cacheKey, xmlText);
                    } else if (res.status !== 404) {
                        console.error(`[IrisApiService] Error fetching missing plan ${dateStr} ${hh}: HTTP ${res.status}`);
                    }
                } catch (e) {
                    if (e.name === 'AbortError') throw e; // Bubbling the abort upward
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
     * @param {AbortSignal} signal
     * @returns {Promise<Document|null>} XML Document
     */
    static async fetchRealtime(eva, type = 'fchg', signal = null) {
        try {
            const res = await this._fetchWithLimit(`${this.BASE_URL}/${type}/${eva}`, { signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            return new window.DOMParser().parseFromString(text, 'text/xml');
        } catch (e) {
            if (e.name === 'AbortError') throw e;
            console.error(`[IrisApiService] Error fetching realtime (${type}) for ${eva}:`, e);
            return null;
        }
    }

    /**
     * Hilfsmethode zum Auslesen definierter Attribute aus einem XML-Knoten.
     * Verhindert Code-Duplizierung bei der XML-Verarbeitung.
     * @param {Element} node Der XML Knoten
     * @param {Array<string>} attrs Array von Attribut-Namen
     * @returns {Object|null} Objekt mit den extrahierten Werten oder null wenn node null ist
     */
    static _extractNodeAttributes(node, attrs) {
        if (!node) return null;
        const result = {};
        for (const attr of attrs) {
            const val = node.getAttribute(attr);
            if (val !== null) {
                result[attr] = val;
            }
        }
        return result;
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
                journey.rt.ar = this._extractNodeAttributes(ar, ['ct', 'cp', 'pp', 'cs', 'cpth']);
            }
            if (dp) {
                journey.rt.dp = this._extractNodeAttributes(dp, ['ct', 'cp', 'pp', 'cs', 'cpth']);
            }
            
            journey.rt.messages = Array.from(msgs).map(m => ({
                id: m.getAttribute('id'),
                c: m.getAttribute('c'),
                t: m.getAttribute('t'),
                ts: m.getAttribute('ts'),
                from: m.getAttribute('from'),
                to: m.getAttribute('to')
            })).filter(m => m.c);
        }
    }

    static _parsePlan(xml, journeys = new Map()) {
        const sNodes = xml.querySelectorAll('s');
        const planAttrs = ['pt', 'pp', 'pde', 'ppth', 'wings', 'l'];

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
                tripType: tl.getAttribute('t'),
                ar: this._extractNodeAttributes(ar, planAttrs),
                dp: this._extractNodeAttributes(dp, planAttrs),
                rt: {}
            });
        }
        return journeys;
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
}
