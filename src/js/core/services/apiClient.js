// js/core/services/apiClient.js
/**
 * @fileoverview Plattform- und CORS-sicherer API-Client.
 * Unterscheidet strikt zwischen Web (GitHub Pages / Localhost) und nativer Desktop-App (Tauri).
 * Ermoeglicht im Web die Nutzung eines lokalen Python-Proxys (ZIMSim Bridge) fuer Nicht-CORS-APIs,
 * waehrend in Tauri der native HTTP-Socket-Client (@tauri-apps/plugin-http) genutzt wird.
 */

/**
 * Gibt an, ob die Anwendung aktuell innerhalb der nativen Tauri-Desktop-App ausgeführt wird.
 * @type {boolean}
 */
export const isTauri = typeof window !== 'undefined' && 
    Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__);

/**
 * Gibt an, ob die Anwendung auf GitHub Pages gehostet ist.
 * @type {boolean}
 */
export const isGitHubPages = typeof window !== 'undefined' && 
    window.location.hostname.endsWith('github.io');

/**
 * Konfiguration fuer den optionalen lokalen Python-Proxy (ZIMSim Bridge).
 */
export const proxyConfig = {
    get enabled() {
        return typeof localStorage !== 'undefined' && localStorage.getItem('zimsim_proxy_enabled') === 'true';
    },
    set enabled(val) {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('zimsim_proxy_enabled', String(val));
        }
    },
    get url() {
        return (typeof localStorage !== 'undefined' && localStorage.getItem('zimsim_proxy_url')) || 'http://127.0.0.1:8765';
    },
    set url(val) {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('zimsim_proxy_url', val);
        }
    }
};

/**
 * Prüft, ob der lokale Python-Proxy (ZIMSim Bridge) erreichbar ist.
 * @param {string} [customUrl=null]
 * @returns {Promise<{ connected: boolean, info?: object }>}
 */
export async function checkProxyHealth(customUrl = null) {
    const base = (customUrl || proxyConfig.url).replace(/\/+$/, '');
    try {
        const res = await window.fetch(`${base}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(1500)
        });
        if (res.ok) {
            const info = await res.json();
            return { connected: true, info };
        }
        return { connected: false };
    } catch {
        return { connected: false };
    }
}

/**
 * Führt einen Netzwerk-Request unter Berücksichtigung der Plattform- und CORS-Restriktionen aus.
 * 
 * @param {string} url - Die Ziel-URL
 * @param {RequestInit} [options={}] - Standard Fetch-Optionen
 * @param {boolean} [isNonCorsApi=false] - Kennzeichnet, ob die Ziel-API keine CORS-Header sendet (z. B. DB Navigator)
 * @returns {Promise<Response|null>} Response-Objekt oder null, wenn die Anfrage im Web gesperrt ist
 */
export async function safeApiFetch(url, options = {}, isNonCorsApi = false) {
    if (isNonCorsApi) {
        if (isTauri) {
            try {
                const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
                return await tauriFetch(url, options);
            } catch (err) {
                console.error('[ApiClient] Fehler beim nativen Tauri-Fetch:', err);
                throw err;
            }
        }

        // Web-Modus: Wenn lokaler Python-Proxy aktiv ist, Anfrage darueber leiten
        if (proxyConfig.enabled) {
            const proxyBase = proxyConfig.url.replace(/\/+$/, '');
            const proxiedUrl = url.replace('https://app.services-bahn.de', proxyBase);
            return window.fetch(proxiedUrl, options);
        }

        // Web-Modus ohne Proxy: Nicht-CORS-Requests verhindern
        console.warn(
            `[ApiClient] Aufruf von '${url}' blockiert: Nicht-CORS-APIs (wie DB Navigator) ` +
            `sind im Browser auf GitHub Pages ohne lokalen Proxy nicht verfügbar und erfordern die Tauri-Desktop-App ` +
            `oder die lokale Python-Bridge (scripts/zimsim_bridge.py).`
        );
        return null;
    }

    // Standard-CORS-fähige Endpunkte (z.B. IRIS-API iris.noncd.db.de oder lokale Assets)
    return window.fetch(url, options);
}
