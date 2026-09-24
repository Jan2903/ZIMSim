// js/core/services/dbNavApiService.js
import { safeApiFetch } from './apiClient.js';
import { getSimulatedTime } from '../utils/config.js';

/**
 * @fileoverview Plattform- und rate-limit-sicherer Service für die DB Navigator / DB Vendo APIs.
 * Beinhaltet Device-Spoofing, rotierende Tracking-UUIDs, sequenzielle Time-Lock-Queue
 * und Caching gegen Akamai-Blocking.
 */

// Device-Profile für konsistentes Spoofing innerhalb einer Session
const DEVICE_MODELS = [
    'Google Pixel 6', 'Google Pixel 7 Pro', 'Google Pixel 8',
    'Samsung Galaxy S21', 'Samsung Galaxy S22', 'Samsung Galaxy S23', 'OnePlus 9'
];
const OS_VERSIONS = ['33', '34', '35'];

const SELECTED_DEVICE = DEVICE_MODELS[Math.floor(Math.random() * DEVICE_MODELS.length)];
const SELECTED_OS = OS_VERSIONS[Math.floor(Math.random() * OS_VERSIONS.length)];
const APP_VERSION = '26.13.0';

/**
 * Service für Anfragen an die DB Navigator (Vendo) API.
 */
export class DbNavApiService {
    static BASE_URL = 'https://app.services-bahn.de/mob';

    // --- Time-Lock & Anti-Blocking Queue ---
    static _lastRequestTime = 0;
    static _queuePromise = Promise.resolve();
    static _minIntervalMs = 1200; // 1,2 Sekunden Basispause
    static _pendingRequests = 0;

    // --- In-Memory Caches ---
    static _formationCache = new Map(); // key -> { data, timestamp }
    static _boardCache = new Map();     // key -> { data, timestamp }
    static FORMATION_CACHE_TTL_MS = 20 * 60 * 1000; // 20 Minuten
    static BOARD_CACHE_TTL_MS = 3 * 60 * 1000;       // 3 Minuten

    /**
     * Erzeugt DB Navigator konforme Header mit frischen Correlation-IDs.
     * @param {string} acceptContentType
     * @returns {Record<string, string>}
     */
    static getHeaders(acceptContentType) {
        const u1 = crypto.randomUUID();
        const u2 = crypto.randomUUID();
        const instanaId = crypto.randomUUID();

        return {
            'Accept': acceptContentType,
            'Content-Type': acceptContentType,
            'User-Agent': `DBNavigator/Android/${APP_VERSION}`,
            'X-App-Version': APP_VERSION,
            'X-Device-Os-Name': 'Android',
            'X-Device-Os-Version': SELECTED_OS,
            'X-Device-Model': SELECTED_DEVICE,
            'X-Correlation-ID': `${u1}_${u2}`,
            'X-INSTANA-ANDROID': instanaId,
            'Accept-Language': 'de'
        };
    }

    /**
     * Erzwingt sequenzielle Ausführung mit 1,0 bis 2,0 Sekunden Mindestabstand (Jitter).
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
            // Zufälliger Jitter zwischen 1000ms und 2000ms
            const requiredDelay = this._minIntervalMs + (Math.random() * 800 - 200);

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
     * Sucht Haltestellen über die Vendo Location Search API (z.B. für ÖPNV, Bus, Tram, Ausland).
     * @param {string} term
     * @returns {Promise<Array<object>>}
     */
    static async searchLocation(term) {
        if (!term || term.trim().length < 2) return [];

        const url = `${this.BASE_URL}/location/search`;
        const contentType = 'application/x.db.vendo.mob.location.v3+json';
        const headers = this.getHeaders(contentType);
        const payload = JSON.stringify({
            locationTypes: ['ALL'],
            searchTerm: term.trim()
        });

        return this._throttledRequest(async () => {
            const res = await safeApiFetch(url, {
                method: 'POST',
                headers,
                body: payload
            }, true);

            if (!res) return [];
            if (!res.ok) {
                console.error(`[DbNavApiService] location/search Fehler: HTTP ${res.status}`);
                return [];
            }
            return await res.json();
        });
    }

    /**
     * Lädt die Abfahrts- oder Ankunftstafel für einen Bahnhof (1-Stunden-Fenster ab Startzeit).
     * @param {string} locationId - Die 7-stellige EVA-Nummer (z.B. '8000152')
     * @param {boolean} [isDeparture=true] - true für Abfahrt, false für Ankunft
     * @param {string} [dateStr=null] - Datum im Format 'YYYY-MM-DD' (Standard: simulierte Zeit)
     * @param {string} [timeStr=null] - Anfragezeit im Format 'HH:MM' (Standard: simulierte Zeit)
     * @param {Array<string>} [verkehrsmittelFilter=null]
     * @returns {Promise<object|null>}
     */
    static async getStationBoard(locationId, isDeparture = true, dateStr = null, timeStr = null, verkehrsmittelFilter = null) {
        if (!locationId) return null;

        const endpoint = isDeparture ? 'abfahrt' : 'ankunft';
        const simDate = getSimulatedTime();
        
        let finalDate = dateStr;
        if (!finalDate) {
            const y = simDate.getFullYear();
            const m = String(simDate.getMonth() + 1).padStart(2, '0');
            const d = String(simDate.getDate()).padStart(2, '0');
            finalDate = `${y}-${m}-${d}`;
        }

        let finalTime = timeStr;
        if (!finalTime) {
            const hh = String(simDate.getHours()).padStart(2, '0');
            const mm = String(simDate.getMinutes()).padStart(2, '0');
            finalTime = `${hh}:${mm}`;
        }

        const cacheKey = `${locationId}_${endpoint}_${finalDate}_${finalTime}`;

        // Cache prüfen
        const cached = this._boardCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.BOARD_CACHE_TTL_MS)) {
            return cached.data;
        }

        const url = `${this.BASE_URL}/bahnhofstafel/${endpoint}`;
        const contentType = 'application/x.db.vendo.mob.bahnhofstafeln.v2+json';
        const headers = this.getHeaders(contentType);

        const filters = verkehrsmittelFilter || [
            'HOCHGESCHWINDIGKEITSZUEGE',
            'INTERCITYUNDEUROCITYZUEGE',
            'INTERREGIOUNDSCHNELLZUEGE',
            'NAHVERKEHRSONSTIGEZUEGE',
            'SBAHNEN',
            'BUSSE',
            'SCHIFFE',
            'UBAHN',
            'STRASSENBAHN',
            'ANRUFPFLICHTIGEVERKEHRE'
        ];

        const payload = JSON.stringify({
            anfragezeit: finalTime,
            datum: finalDate,
            ursprungsBahnhofId: String(locationId),
            verkehrsmittel: filters
        });

        return this._throttledRequest(async () => {
            const res = await safeApiFetch(url, {
                method: 'POST',
                headers,
                body: payload
            }, true);

            if (!res) return null;
            if (!res.ok) {
                console.error(`[DbNavApiService] bahnhofstafel/${endpoint} Fehler: HTTP ${res.status}`);
                return null;
            }

            const data = await res.json();
            this._boardCache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        });
    }

    /**
     * Ruft die V4-Wagenreihungsdaten für einen konkreten Zug an einer Station ab.
     * @param {string|number} evaNr - 7-stellige EVA-Nummer (z.B. '8000036')
     * @param {string} abgangsDatum - ISO-Timestamp mit Zeitzone (z.B. '2026-07-29T20:00:00+02:00')
     * @param {string} gattung - Produktgattung (z.B. 'ICE', 'IC', 'NX', 'RE')
     * @param {string|number} zugnummer - Fahrt-/Zugnummer (z.B. '89731', '1545')
     * @returns {Promise<object|null>} Rohdaten im App-Format für FormationParser
     */
    static async getFormation(evaNr, abgangsDatum, gattung, zugnummer) {
        if (!evaNr || !abgangsDatum || !gattung || !zugnummer) {
            console.warn('[DbNavApiService] getFormation: Unvollständige Parameter:', { evaNr, abgangsDatum, gattung, zugnummer });
            return null;
        }

        const cacheKey = `${evaNr}_${abgangsDatum}_${gattung}_${zugnummer}`;
        const cached = this._formationCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.FORMATION_CACHE_TTL_MS)) {
            return cached.data;
        }

        const url = `${this.BASE_URL}/zuglaeufe/halte/by-abfahrt/wagenreihung`;
        const contentType = 'application/x.db.vendo.mob.wagenreihung.v4+json';
        const headers = this.getHeaders(contentType);

        const payload = JSON.stringify({
            risAbfahrtEvaNummer: String(evaNr),
            risAbfahrtZeitpunkt: String(abgangsDatum),
            risZuglaufProduktGattung: String(gattung).trim(),
            risZuglaufVerkehrsmittelNummer: String(zugnummer).trim()
        });

        return this._throttledRequest(async () => {
            const res = await safeApiFetch(url, {
                method: 'POST',
                headers,
                body: payload
            }, true);

            if (!res) return null;
            if (!res.ok) {
                if (res.status === 404) {
                    console.log(`[DbNavApiService] Keine Wagenreihung für ${gattung} ${zugnummer} an EVA ${evaNr} gefunden (HTTP 404).`);
                } else {
                    console.error(`[DbNavApiService] wagenreihung Fehler für ${gattung} ${zugnummer}: HTTP ${res.status}`);
                }
                return null;
            }

            const data = await res.json();
            this._formationCache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        });
    }

    /**
     * Ruft den vollständigen Zuglauf für eine Reise-ID ab.
     * @param {string} zuglaufId
     * @returns {Promise<object|null>}
     */
    static async getTripDetails(zuglaufId) {
        if (!zuglaufId) return null;

        const encodedId = encodeURIComponent(zuglaufId);
        const url = `${this.BASE_URL}/zuglauf/${encodedId}`;
        const contentType = 'application/x.db.vendo.mob.zuglauf.v2+json';
        const headers = this.getHeaders(contentType);

        return this._throttledRequest(async () => {
            const res = await safeApiFetch(url, {
                method: 'GET',
                headers
            }, true);

            if (!res) return null;
            if (!res.ok) {
                console.error(`[DbNavApiService] zuglauf Fehler: HTTP ${res.status}`);
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
