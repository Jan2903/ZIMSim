// src/js/core/state/bridgeState.svelte.js
/**
 * @fileoverview Reaktiver Zustand der lokalen Python-Bridge (ZIMSim Bridge).
 *
 * Die ZIMSim Bridge ist ein lokaler Python-Proxy (127.0.0.1:8765), der die
 * Nicht-CORS-APIs von DB Navigator (app.services-bahn.de) und bahn.de (www.bahn.de)
 * im Browser erreichbar macht. Der Zustand wird hier zentral gehalten, damit
 * UI-Komponenten reaktiv auf Änderungen reagieren koennen; die Persistenz
 * erfolgt im LocalStorage.
 */

/** LocalStorage-Key fuer den Opt-in-Status der Bridge. */
const STORAGE_KEY_ENABLED = 'zimsim_proxy_enabled';
/** LocalStorage-Key fuer die URL der Bridge. */
const STORAGE_KEY_URL = 'zimsim_proxy_url';

/**
 * Standard-URL der lokalen Bridge.
 * @type {string}
 */
export const BRIDGE_DEFAULT_URL = 'http://127.0.0.1:8765';

/**
 * Liest den initialen Bridge-Status aus dem LocalStorage.
 * @returns {{ enabled: boolean, url: string }}
 */
function readInitialState() {
    if (typeof localStorage === 'undefined') {
        return { enabled: false, url: BRIDGE_DEFAULT_URL };
    }
    try {
        return {
            enabled: localStorage.getItem(STORAGE_KEY_ENABLED) === 'true',
            url: localStorage.getItem(STORAGE_KEY_URL) || BRIDGE_DEFAULT_URL
        };
    } catch {
        return { enabled: false, url: BRIDGE_DEFAULT_URL };
    }
}

const initialState = readInitialState();

/**
 * Reaktiver Zustand der lokalen Python-Bridge.
 * @type {{ enabled: boolean, url: string }}
 */
export const bridgeState = $state({
    enabled: initialState.enabled,
    url: initialState.url
});

/**
 * Aktiviert oder deaktiviert die lokale Bridge und persistiert den Zustand.
 * @param {boolean} val
 * @returns {void}
 */
export function setBridgeEnabled(val) {
    bridgeState.enabled = Boolean(val);
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem(STORAGE_KEY_ENABLED, String(bridgeState.enabled));
        } catch (e) {
            console.warn('[BridgeState] Fehler beim Speichern des Bridge-Status:', e);
        }
    }
}

/**
 * Setzt die URL der lokalen Bridge und persistiert sie.
 * @param {string} val
 * @returns {void}
 */
export function setBridgeUrl(val) {
    bridgeState.url = val;
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem(STORAGE_KEY_URL, val);
        } catch (e) {
            console.warn('[BridgeState] Fehler beim Speichern der Bridge-URL:', e);
        }
    }
}
