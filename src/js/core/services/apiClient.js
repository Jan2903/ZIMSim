// js/core/services/apiClient.js
/**
 * @fileoverview Plattform- und CORS-sicherer API-Client.
 * Unterscheidet strikt zwischen Web (GitHub Pages / Localhost) und nativer Desktop-App (Tauri).
 * Verhindert auf GitHub Pages jegliche Nicht-CORS-Requests an externe DB-APIs,
 * während in Tauri der native HTTP-Socket-Client (@tauri-apps/plugin-http) genutzt wird.
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

        // Web-Modus (GitHub Pages / Browser): Verhindere Nicht-CORS-Requests
        console.warn(
            `[ApiClient] Aufruf von '${url}' blockiert: Nicht-CORS-APIs (wie DB Navigator) ` +
            `sind im Browser auf GitHub Pages nicht verfügbar und erfordern die Tauri-Desktop-App.`
        );
        return null;
    }

    // Standard-CORS-fähige Endpunkte (z.B. IRIS-API iris.noncd.db.de oder lokale Assets)
    return window.fetch(url, options);
}
