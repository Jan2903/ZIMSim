// js/core/services/apiClient.js
/**
 * @fileoverview Plattform- und CORS-sicherer API-Client.
 * Unterscheidet strikt zwischen Web (GitHub Pages / Localhost) und nativer Desktop-App (Tauri).
 * Ermoeglicht im Web die Nutzung eines lokalen Python-Proxys (ZIMSim Bridge) fuer Nicht-CORS-APIs,
 * waehrend in Tauri der native HTTP-Socket-Client (@tauri-apps/plugin-http) genutzt wird.
 */
import { bridgeState, setBridgeEnabled, setBridgeUrl } from '../state/bridgeState.svelte.js';

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
 * Gibt an, ob die Anwendung auf einem mobilen Gerät läuft (Browser oder Tauri-WebView).
 * Die Erkennung erfolgt über den User-Agent, da im Projekt kein OS-Plugin
 * (tauri-plugin-os) eingebunden ist. Der Tauri-WebView liefert auf Android
 * (Android WebView) und iOS (WKWebView) die jeweiligen Mobile-User-Agents.
 * @type {boolean}
 */
export const isMobile = typeof navigator !== 'undefined' && (() => {
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
    // iPadOS 13+ tarnt sich als "Macintosh" - nur mit Touch-Unterstützung als Tablet erkennbar
    return (navigator.maxTouchPoints || 0) > 1 && /Macintosh/i.test(ua);
})();

/**
 * Gibt an, ob die Anwendung in der nativen Tauri-App auf einem Mobilgerät läuft (Android/iOS).
 * @type {boolean}
 */
export const isTauriMobile = isTauri && isMobile;

/**
 * Gibt an, ob die lokale Python-Bridge (ZIMSim Bridge) sinnvoll nutzbar ist.
 * Sie benötigt einen Desktop-Rechner, auf dem der Python-Prozess laufen kann -
 * auf Mobilgeräten ist sie daher nicht einsetzbar.
 * @type {boolean}
 */
export const canUseLocalBridge = !isTauri && !isMobile;

/**
 * Konfiguration fuer den optionalen lokalen Python-Proxy (ZIMSim Bridge).
 * Der Zustand liegt reaktiv in bridgeState.svelte.js, damit UI-Komponenten
 * auf Aenderungen reagieren; die Persistenz erfolgt im LocalStorage.
 */
export const proxyConfig = {
    get enabled() {
        return bridgeState.enabled;
    },
    set enabled(val) {
        setBridgeEnabled(val);
    },
    get url() {
        return bridgeState.url;
    },
    set url(val) {
        setBridgeUrl(val);
    }
};

/**
 * @typedef {Object} NonCorsAvailability
 * @property {boolean} blocked - true, wenn Nicht-CORS-APIs aktuell nicht nutzbar sind
 * @property {boolean} needsBridge - true, wenn die lokale Python-Bridge den Betrieb ermöglichen würde
 * @property {string|null} reason - Kurzbegründung als Satzanhang (z. B. "im Browser nur mit der lokalen Python-Bridge nutzbar")
 */

/**
 * Prüft, ob die aktuelle Plattform die Nicht-CORS-APIs (DB Navigator / bahn.de) nutzen kann.
 * @returns {NonCorsAvailability}
 */
export function getNonCorsAvailability() {
    if (isTauri) {
        return { blocked: false, needsBridge: false, reason: null };
    }

    if (isMobile) {
        return {
            blocked: true,
            needsBridge: false,
            reason: 'im mobilen Browser nicht nutzbar - die ZIMSim Bridge muss als Python-Prozess auf einem PC laufen.'
        };
    }

    if (proxyConfig.enabled) {
        return { blocked: false, needsBridge: false, reason: null };
    }

    return {
        blocked: true,
        needsBridge: true,
        reason: 'im Browser nur mit der lokalen Python-Bridge (ZIMSim Bridge) nutzbar.'
    };
}

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
        // (auf Mobilgeraeten ist die Bridge nicht einsetzbar - siehe canUseLocalBridge)
        if (proxyConfig.enabled && canUseLocalBridge) {
            const proxyBase = proxyConfig.url.replace(/\/+$/, '');
            let proxiedUrl = url;
            if (url.startsWith('https://app.services-bahn.de')) {
                proxiedUrl = url.replace('https://app.services-bahn.de', proxyBase);
            } else if (url.startsWith('https://www.bahn.de')) {
                proxiedUrl = url.replace('https://www.bahn.de', proxyBase);
            }

            // Im Browser sind 'User-Agent' und ähnliche Header verboten (Forbidden Header Name)
            // und führen bei Browser-Fetches zu CORS-Preflight-Fehlern.
            // Der Python-Proxy generiert diese Header ohnehin serverseitig selbst.
            let browserOptions = options;
            if (options && options.headers) {
                const cleanedHeaders = { ...options.headers };
                delete cleanedHeaders['User-Agent'];
                delete cleanedHeaders['user-agent'];
                browserOptions = { ...options, headers: cleanedHeaders };
            }

            return window.fetch(proxiedUrl, browserOptions);
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
