// js/core/services/dbWebApiService.js
import { safeApiFetch } from './apiClient.js';
import { getSimulatedTime } from '../utils/config.js';
import { formatHHMM, formatYYYYMMDD } from '../utils/dateUtils.js';

/**
 * @fileoverview Service für Anfragen an die bahn.de Web API (Reiselösung & Reisebegleitung).
 * Stellt Methoden für Haltestellensuche, Abfahrten/Ankünfte, Zugläufe und Wagenreihung bereit.
 * Nutzt In-Memory Caching und Throttling zum Schutz vor Akamai-Rate-Limits.
 */

export class DbWebApiService {
    static BASE_URL = 'https://www.bahn.de/web/api';

    // --- Time-Lock & Throttling Queue ---
    static _lastRequestTime = 0;
    static _queuePromise = Promise.resolve();
    static _minIntervalMs = 800; // 0,8 Sekunden Mindestabstand
    static _pendingRequests = 0;

    // --- In-Memory Caches ---
    static _boardCache = new Map();     // key -> { data, timestamp }
    static _formationCache = new Map(); // key -> { data, timestamp }
    static BOARD_CACHE_TTL_MS = 3 * 60 * 1000;       // 3 Minuten
    static FORMATION_CACHE_TTL_MS = 20 * 60 * 1000; // 20 Minuten

    /**
     * Führt eine Anfrage mit Mindestabstand sequenziell aus.
     * @private
     * @template T
     * @param {() => Promise<T>} requestFn
     * @returns {Promise<T>}
     */
    static async _throttledRequest(requestFn) {
        this._pendingRequests++;

        const chained = this._queuePromise.then(async () => {
            const now = Date.now();
            const elapsed = now - this._lastRequestTime;
            const requiredDelay = this._minIntervalMs + (Math.random() * 400 - 100);

            if (elapsed < requiredDelay) {
                const waitTime = requiredDelay - elapsed;
                await new Promise(r => setTimeout(r, waitTime));
            }

            try {
                return await requestFn();
            } finally {
                this._lastRequestTime = Date.now();
                this._pendingRequests = Math.max(0, this._pendingRequests - 1);
            }
        });

        this._queuePromise = chained.catch(() => {});
        return chained;
    }

    /**
     * Sucht Haltestellen über die bahn.de Ortsuche.
     * @param {string} term - Suchbegriff (z.B. "Berlin Hbf")
     * @param {number} [limit=10] - Maximale Trefferanzahl
     * @returns {Promise<Array<object>>} Liste von Orten mit extId
     */
    static async searchLocation(term, limit = 10) {
        if (!term || term.trim().length < 2) return [];

        const url = `${this.BASE_URL}/reiseloesung/orte?suchbegriff=${encodeURIComponent(term.trim())}&typ=ALL&limit=${limit}`;

        return this._throttledRequest(async () => {
            const res = await safeApiFetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            }, true);

            if (!res) return [];
            if (!res.ok) {
                console.error(`[DbWebApiService] searchLocation Fehler: HTTP ${res.status}`);
                return [];
            }
            return await res.json();
        });
    }

    /**
     * Lädt die Abfahrts- oder Ankunftstafel für einen Bahnhof von bahn.de.
     * @param {string|number} eva - 7-stellige IBNR/EVA-Nummer (z.B. '8000105')
     * @param {boolean} [isDeparture=true] - true für Abfahrten, false für Ankünfte
     * @param {string} [dateStr=null] - Datum im Format 'YYYY-MM-DD' (Standard: simulierte Zeit)
     * @param {string} [timeStr=null] - Uhrzeit im Format 'HH:MM:SS' (Standard: simulierte Zeit)
     * @param {number} [maxVias=8] - Maximale Anzahl Zwischenhalte (Standard: 8)
     * @param {Array<string>} [mots=null] - Array von Verkehrsmitteln (z.B. ['ICE', 'REGIONAL'])
     * @returns {Promise<object|null>} Rohdaten im Format { entries: [...] }
     */
    static async getStationBoard(eva, isDeparture = true, dateStr = null, timeStr = null, maxVias = 8, mots = null) {
        if (!eva) return null;

        const boardType = isDeparture ? 'abfahrten' : 'ankuenfte';
        const simDate = getSimulatedTime();

        const finalDate = dateStr || formatYYYYMMDD(simDate);
        let finalTime = timeStr;
        if (!finalTime) {
            const h = simDate.getHours().toString().padStart(2, '0');
            const m = simDate.getMinutes().toString().padStart(2, '0');
            const s = simDate.getSeconds().toString().padStart(2, '0');
            finalTime = `${h}:${m}:${s}`;
        }

        const defaultMots = [
            'ICE', 'EC_IC', 'IR', 'REGIONAL', 'SBAHN',
            'BUS', 'SCHIFF', 'UBAHN', 'TRAM', 'ANRUFPFLICHTIG'
        ];
        const activeMots = (mots && mots.length > 0) ? mots : defaultMots;

        const cacheKey = `${eva}_${boardType}_${finalDate}_${finalTime.slice(0, 5)}_${activeMots.join(',')}_${maxVias}`;
        const cached = this._boardCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.BOARD_CACHE_TTL_MS)) {
            return cached.data;
        }

        let url = `${this.BASE_URL}/reiseloesung/${boardType}?datum=${finalDate}&zeit=${encodeURIComponent(finalTime)}&ortExtId=${encodeURIComponent(eva)}`;
        if (maxVias > 0) {
            url += `&mitVias=true&maxVias=${maxVias}`;
        }
        activeMots.forEach(mot => {
            url += `&verkehrsmittel[]=${encodeURIComponent(mot)}`;
        });

        return this._throttledRequest(async () => {
            const res = await safeApiFetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            }, true);

            if (!res) return null;
            if (!res.ok) {
                console.error(`[DbWebApiService] ${boardType} Fehler: HTTP ${res.status}`);
                return null;
            }

            const data = await res.json();
            this._boardCache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        });
    }

    /**
     * Ruft die Wagenreihung (vehicle-sequence) für einen konkreten Zug an einer Station ab.
     * @param {string} category - Produktgattung (z.B. 'ICE', 'IC', 'RE')
     * @param {string|number} trainNumber - Zugnummer (z.B. '940')
     * @param {string} dateStr - Datum im Format 'YYYY-MM-DD'
     * @param {string} timeStr - Abfahrtszeit als ISO-String oder Z-Zeit (z.B. '2026-09-25T11:47:00Z')
     * @param {string|number} eva - EVA-Nummer des Bahnhofs (z.B. '8098160' oder '8000105')
     * @returns {Promise<object|null>} Rohdaten der Wagenreihung für FormationParser
     */
    static async getFormation(category, trainNumber, dateStr, timeStr, eva) {
        if (!category || !trainNumber || !dateStr || !timeStr || !eva) {
            console.warn('[DbWebApiService] getFormation: Unvollständige Parameter:', { category, trainNumber, dateStr, timeStr, eva });
            return null;
        }

        // Bereinige Zeit-Format: bahn.de erwartet z.B. 2026-09-25T11:47:00Z
        let formattedTime = timeStr;
        if (!formattedTime.endsWith('Z')) {
            formattedTime = `${formattedTime}Z`;
        }

        const cleanNumber = String(trainNumber).replace(/\D/g, '');
        const cleanCategory = String(category).trim().toUpperCase();
        const cleanEva = String(eva).trim();

        const cacheKey = `${cleanEva}_${dateStr}_${cleanCategory}_${cleanNumber}_${formattedTime}`;
        const cached = this._formationCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.FORMATION_CACHE_TTL_MS)) {
            return cached.data;
        }

        const url = `${this.BASE_URL}/reisebegleitung/wagenreihung/vehicle-sequence?administrationId=80&category=${encodeURIComponent(cleanCategory)}&date=${encodeURIComponent(dateStr)}&evaNumber=${encodeURIComponent(cleanEva)}&number=${encodeURIComponent(cleanNumber)}&time=${encodeURIComponent(formattedTime)}`;

        return this._throttledRequest(async () => {
            const res = await safeApiFetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            }, true);

            if (!res) return null;
            if (!res.ok) {
                if (res.status === 404) {
                    this._formationCache.set(cacheKey, { data: null, timestamp: Date.now() });
                } else {
                    console.error(`[DbWebApiService] wagenreihung Fehler für ${cleanCategory} ${cleanNumber}: HTTP ${res.status}`);
                }
                return null;
            }

            const data = await res.json();
            if (data && data.status === 'ERROR') {
                this._formationCache.set(cacheKey, { data: null, timestamp: Date.now() });
                return null;
            }

            this._formationCache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        });
    }

    /**
     * Ruft den vollständigen Zuglauf (Fahrtdetails) für eine Journey-ID ab.
     * @param {string} journeyId - HAFAS Journey-ID
     * @param {boolean} [poly=false] - Ob Polylinien geladen werden sollen
     * @returns {Promise<object|null>}
     */
    static async getTripDetails(journeyId, poly = false) {
        if (!journeyId) return null;

        const url = `${this.BASE_URL}/reiseloesung/fahrt?journeyId=${encodeURIComponent(journeyId)}&poly=${poly}`;

        return this._throttledRequest(async () => {
            const res = await safeApiFetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            }, true);

            if (!res) return null;
            if (!res.ok) {
                console.error(`[DbWebApiService] fahrt Fehler: HTTP ${res.status}`);
                return null;
            }
            return await res.json();
        });
    }

    /**
     * Gibt den aktuellen Status der Request-Queue zurück.
     * @returns {{ pending: number, isBusy: boolean }}
     */
    static getQueueStatus() {
        return {
            pending: this._pendingRequests,
            isBusy: this._pendingRequests > 0
        };
    }
}
