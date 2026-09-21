// js/displays/core/displayConfigStore.svelte.js
import { generateActiveLayout } from './displayLayoutService.js';

/**
 * Zentraler reaktiver Svelte 5 Store für die Anzeige-Konfiguration.
 * Verwaltet die vollständige Entkopplung von Hardware-Monitor und DB-Anzeigetyp.
 */
class DisplayConfigStore {
    // 1. Hardware-Monitor (z.B. 'zim2x32', 'zim3x32', 'zim32_single', 'zimvitrine32', 'zimvitrine65h', 'zimwide', 'zimultrawide')
    monitorId = $state(localStorage.getItem('zimsim_monitor_id') || 'zim2x32');

    // 2. Fachlicher Anzeigetyp (z.B. 'zuganzeiger', 'anschlusstafel', 'ankunftstafel', 'wagenreihungsplan')
    layoutType = $state(localStorage.getItem('zimsim_layout_type') || 'zuganzeiger');

    // 3. Gehäuse-Sichtbarkeit
    showBezel = $state(localStorage.getItem('zimsim_show_bezel') !== 'false');

    // 4. Vollbild / Kiosk Status
    isFullscreen = $state(false);
    isKiosk = $state(false);

    /**
     * Berechnet reaktiv das aktuelle Layout-Objekt basierend auf Monitor, Typ und Gehäuse.
     */
    currentLayout = $derived.by(() => {
        return generateActiveLayout(this.monitorId, this.layoutType, this.showBezel && !this.isFullscreen && !this.isKiosk);
    });

    /**
     * Ob das physische Gehäuse aktuell gezeichnet werden soll.
     */
    isCasingActive = $derived.by(() => {
        return this.showBezel && !this.isFullscreen && !this.isKiosk && Boolean(this.currentLayout?.casingWidth);
    });

    /**
     * Breite des umhüllenden Skalierungs-Wrappers.
     */
    wrapperWidth = $derived.by(() => {
        return this.isCasingActive ? (this.currentLayout.casingWidth || this.currentLayout.width) : this.currentLayout.width;
    });

    /**
     * Höhe des umhüllenden Skalierungs-Wrappers.
     */
    wrapperHeight = $derived.by(() => {
        return this.isCasingActive ? (this.currentLayout.casingHeight || this.currentLayout.height) : this.currentLayout.height;
    });

    /**
     * X-Offset des Canvas innerhalb des Gehäuses.
     */
    canvasOffsetX = $derived.by(() => {
        return this.isCasingActive ? (this.currentLayout.casingOffsetX || 0) : 0;
    });

    /**
     * Y-Offset des Canvas innerhalb des Gehäuses.
     */
    canvasOffsetY = $derived.by(() => {
        return this.isCasingActive ? (this.currentLayout.casingOffsetY || 0) : 0;
    });

    /**
     * Wechselt den Hardware-Monitor.
     * @param {string} id
     */
    setMonitorId(id) {
        this.monitorId = id;
        localStorage.setItem('zimsim_monitor_id', id);
    }

    /**
     * Wechselt den fachlichen DB-Anzeigetyp.
     * @param {string} type - 'zuganzeiger' | 'anschlusstafel' | 'ankunftstafel' | 'wagenreihungsplan'
     */
    setLayoutType(type) {
        this.layoutType = type;
        localStorage.setItem('zimsim_layout_type', type);
    }

    /**
     * Schaltet das Gehäuse ein oder aus.
     */
    toggleBezel() {
        this.showBezel = !this.showBezel;
        localStorage.setItem('zimsim_show_bezel', String(this.showBezel));
    }
}

export const displayConfigStore = new DisplayConfigStore();
