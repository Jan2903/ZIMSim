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
            const cacheKey = IrisCacheService.getPlanKey(eva, dateStr, hourStr);
            
            let xmlText = IrisCacheService.get(cacheKey);
            if (!xmlText) {
                const res = await this._fetchWithLimit(`${this.BASE_URL}/plan/${eva}/${dateStr}/${hourStr}`, { signal });
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
    static async loadMissingPlans(eva, realtimeXml, journeysMap, signal = null) {
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
                    const res = await this._fetchWithLimit(`${this.BASE_URL}/plan/${eva}/${dateStr}/${hh}`, { signal });
                    if (res.ok) {
                        xmlText = await res.text();
                        IrisCacheService.set(cacheKey, xmlText);
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
                journey.rt.ar = this._extractNodeAttributes(ar, ['ct', 'cp', 'pp', 'cs']);
            }
            if (dp) {
                journey.rt.dp = this._extractNodeAttributes(dp, ['ct', 'cp', 'pp', 'cs']);
            }
            
            journey.rt.messages = Array.from(msgs).map(m => m.getAttribute('c')).filter(c => c);
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
