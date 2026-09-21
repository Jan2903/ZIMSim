// js/core/services/screenSyncService.js
/**
 * @fileoverview Multi-Monitor-Synchronisation über HTML5 BroadcastChannel.
 * Ermöglicht latenzfreie Kommunikation zwischen Steuerungs-Dashboard (Master)
 * und sekundären Vollbild-/Kiosk-Monitoren (Slaves) ohne Netzwerkserver.
 * Funktioniert nahtlos auf GitHub Pages (gleiche Origin), in Tauri und auf Localhost.
 */

export class ScreenSyncService {
    /** @type {BroadcastChannel|null} */
    static channel = null;

    /** @type {boolean} */
    static isMaster = true;

    /** @type {boolean} */
    static isInitialized = false;

    /**
     * Initialisiert den BroadcastChannel.
     */
    static getChannel() {
        if (!this.channel && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            this.channel = new BroadcastChannel('zimsim_sync');
        }
        return this.channel;
    }

    /**
     * Startet den Master-Modus (Dashboard-Fenster).
     * Sendet Zustandsänderungen des JourneyStores an alle offenen Monitor-Fenster.
     * 
     * @param {import('../../features/journey/journeyStore.svelte.js').JourneyStore} store
     */
    static initMaster(store) {
        this.isMaster = true;
        const ch = this.getChannel();
        if (!ch) return;

        // Wenn ein neuer Slave-Monitor startet und um Initialdaten bittet
        ch.onmessage = (event) => {
            if (event.data && event.data.type === 'REQUEST_INITIAL_STATE') {
                this.broadcastState(store);
            }
        };
        this.isInitialized = true;
    }

    /**
     * Startet den Slave-Modus (Monitor-Fenster ?screen=1, ?screen=2, etc.).
     * Empfängt Zustandsaktualisierungen und wendet sie auf den lokalen Store an.
     * 
     * @param {import('../../features/journey/journeyStore.svelte.js').JourneyStore} store
     * @param {import('../../displays/trainDisplay.js').TrainDisplay} display
     */
    static initSlave(store, display) {
        this.isMaster = false;
        const ch = this.getChannel();
        if (!ch) return;

        ch.onmessage = (event) => {
            if (!event.data) return;
            if (event.data.type === 'SYNC_STATE' && event.data.payload) {
                try {
                    store.importAll(event.data.payload);
                    display.updateAll();
                } catch (err) {
                    console.error('[ScreenSyncService] Fehler beim Importieren des Slave-Zustands:', err);
                }
            } else if (event.data.type === 'UPDATE_ALL') {
                display.updateAll();
            }
        };

        // Sofort beim Öffnen des Slave-Fensters aktuellen Zustand vom Master anfordern
        ch.postMessage({ type: 'REQUEST_INITIAL_STATE' });
        this.isInitialized = true;
    }

    /**
     * Überträgt den aktuellen Store-Zustand an alle Slaves.
     * 
     * @param {import('../../features/journey/journeyStore.svelte.js').JourneyStore} store
     */
    static broadcastState(store) {
        const ch = this.getChannel();
        if (!ch || !this.isMaster) return;

        try {
            const payload = store.exportAll();
            ch.postMessage({
                type: 'SYNC_STATE',
                payload,
                timestamp: Date.now()
            });
        } catch (err) {
            console.error('[ScreenSyncService] Fehler beim Senden des Broadcasts:', err);
        }
    }

    /**
     * Triggert einen Re-Render auf allen Bildschirmen.
     */
    static broadcastRenderTrigger() {
        const ch = this.getChannel();
        if (!ch || !this.isMaster) return;
        ch.postMessage({ type: 'UPDATE_ALL', timestamp: Date.now() });
    }

    /**
     * Erzeugt eine relative URL für einen Zielbildschirm (100% kompatibel mit GitHub Pages Sub-Pfaden).
     * 
     * @param {number|string} screenIndex - 1, 2 oder 3
     * @param {boolean} [is4k=false] - Ob 4K-Auflösung genutzt werden soll
     * @param {boolean} [kiosk=true] - Ob Kiosk-Modus aktiv sein soll
     * @returns {string} Die absolute Ziel-URL
     */
    static getScreenUrl(screenIndex, is4k = false, kiosk = true) {
        const url = new URL(window.location.href);
        url.searchParams.set('screen', String(screenIndex));
        if (kiosk) url.searchParams.set('kiosk', '1');
        else url.searchParams.delete('kiosk');

        if (is4k) url.searchParams.set('res', '4k');
        else url.searchParams.delete('res');

        return url.href;
    }

    /**
     * Öffnet einen spezifischen Monitor in einem neuen Fenster / Pop-Out.
     * 
     * @param {number|string} screenIndex - 1 (Hauptmonitor), 2 (Nebenmonitore) oder 3 (Zusatzanzeiger)
     * @param {boolean} [is4k=false]
     * @param {boolean} [kiosk=true]
     * @returns {Window|null} Das geöffnete Fenster
     */
    static openScreenWindow(screenIndex, is4k = false, kiosk = true) {
        const targetUrl = this.getScreenUrl(screenIndex, is4k, kiosk);
        const windowName = `zim_display_screen_${screenIndex}`;
        const width = is4k ? 3840 : 1920;
        const height = is4k ? 2160 : 1080;

        return window.open(
            targetUrl,
            windowName,
            `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
        );
    }
}
