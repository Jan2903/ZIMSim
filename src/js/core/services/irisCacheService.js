export class IrisCacheService {
    static _cache = new Map();
    // Default TTL: 60 minutes in ms
    static _defaultTTL = 60 * 60 * 1000;

    /**
     * @param {string} eva 
     * @param {string} dateStr YYMMDD
     * @param {string} hourStr HH
     * @returns {string} The cache key
     */
    static getPlanKey(eva, dateStr, hourStr) {
        return `plan_${eva}_${dateStr}_${hourStr}`;
    }

    /**
     * Holt einen Eintrag aus dem Cache.
     * @param {string} key 
     * @returns {any|null} Die gecachten Daten oder null, falls nicht vorhanden oder abgelaufen.
     */
    static get(key) {
        const entry = this._cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this._cache.delete(key);
            return null;
        }

        return entry.data;
    }

    /**
     * Speichert einen Eintrag im Cache.
     * @param {string} key 
     * @param {any} data 
     * @param {number} ttlMs Time to live in milliseconds
     */
    static set(key, data, ttlMs = this._defaultTTL) {
        this._cache.set(key, {
            data: data,
            expiry: Date.now() + ttlMs
        });
    }

    static clear() {
        this._cache.clear();
    }
}
