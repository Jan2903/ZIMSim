// js/core/services/storageService.js
import { get, set, del } from 'idb-keyval';

/**
 * Resilienter hybrider Speicher-Service für ZIMSim.
 * 
 * Kombiniert synchrones Bootstrapping aus localStorage (für flackerfreies Canvas-Rendering)
 * mit asynchroner, unbegrenzter Persistenz in IndexedDB (Schutz vor 5-MB-Limit & Browser-Bereinigung).
 */
export class StorageService {
    /**
     * Liest ein Objekt synchron aus dem LocalStorage.
     * 
     * @template T
     * @param {string} key - Speicherschlüssel
     * @param {T} [fallback=null] - Rückgabewert bei Fehlen oder Parse-Fehler
     * @returns {T}
     */
    static getItem(key, fallback = null) {
        if (typeof window === 'undefined' || !window.localStorage) {
            return fallback;
        }
        try {
            const raw = localStorage.getItem(key);
            if (raw === null || raw === undefined) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            console.warn(`[StorageService] Fehler beim synchronen Lesen von '${key}':`, e);
            return fallback;
        }
    }

    /**
     * Schreibt ein Objekt synchron in den LocalStorage und spiegelt es asynchron in IndexedDB.
     * Fängt QuotaExceededError sauber ab, falls das 5-MB-Limit von localStorage erreicht wird.
     * 
     * @param {string} key - Speicherschlüssel
     * @param {any} value - Zu serialisierendes Objekt oder Primitiv
     * @returns {boolean} true bei erfolgreichem lokalem Schreiben
     */
    static setItem(key, value) {
        let isLocalSaved = false;
        let safeClone = null;
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(key, serialized);
            isLocalSaved = true;
            // De-proxied Plain-Objekt für structuredClone in IndexedDB
            safeClone = JSON.parse(serialized);
        } catch (e) {
            // LocalStorage voll (> 5MB) oder blockiert
            console.warn(`[StorageService] LocalStorage-Limit erreicht für '${key}'. Rückgriff auf IndexedDB:`, e);
            try {
                safeClone = JSON.parse(JSON.stringify(value));
            } catch {
                safeClone = value;
            }
        }

        // Asynchron und ausfallsicher in IndexedDB spiegeln (frei von Svelte 5 $state-Proxies)
        try {
            set(key, safeClone !== null ? safeClone : value).catch(idbErr => {
                console.error(`[StorageService] Fehler beim Schreiben in IndexedDB für '${key}':`, idbErr);
            });
        } catch (idbSyncErr) {
            console.warn(`[StorageService] IndexedDB nicht verfügbar:`, idbSyncErr);
        }

        return isLocalSaved;
    }

    /**
     * Entfernt einen Schlüssel aus LocalStorage und IndexedDB.
     * 
     * @param {string} key - Speicherschlüssel
     */
    static removeItem(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn(`[StorageService] Fehler beim Entfernen aus LocalStorage für '${key}':`, e);
        }
        try {
            del(key).catch(() => {});
        } catch {}
    }

    /**
     * Stellt Daten aus IndexedDB wieder her, falls der LocalStorage gelöscht wurde.
     * 
     * @template T
     * @param {string} key - Speicherschlüssel
     * @param {(data: T) => void} onRestored - Callback bei erfolgreicher Wiederherstellung
     */
    static async syncFromIndexedDB(key, onRestored) {
        try {
            const currentLocal = this.getItem(key, null);
            if (currentLocal === null || (Array.isArray(currentLocal) && currentLocal.length === 0)) {
                const idbData = await get(key);
                if (idbData !== undefined && idbData !== null) {
                    console.log(`[StorageService] Stelle '${key}' erfolgreich aus IndexedDB wieder her.`);
                    try {
                        localStorage.setItem(key, JSON.stringify(idbData));
                    } catch {}
                    if (typeof onRestored === 'function') {
                        onRestored(idbData);
                    }
                }
            }
        } catch (e) {
            console.warn(`[StorageService] Konnte IndexedDB-Sync für '${key}' nicht ausführen:`, e);
        }
    }
}
