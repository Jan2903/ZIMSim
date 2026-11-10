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

    // 5. Multi-Screen / Pop-Out Zielmonitor (z.B. '1', '2', '3' oder null für Hauptansicht)
    targetScreen = $state(null);

    // 6. 4K Ultra-HD Skalierungs-Flag
    is4k = $state(false);

    // 7. Skalierungsmodus ('fit' = an Bildschirmbreite anpassen, 'scroll' = 1:1 Detailansicht)
    scaleMode = $state(localStorage.getItem('zimsim_scale_mode') || 'fit');

    // 8. Paginierung für Anschlusstafeln / Voranzeiger
    departurePageIndex = $state(0);
    totalDeparturePages = $state(1);

    /**
     * Berechnet reaktiv das aktuelle Layout-Objekt basierend auf Monitor, Typ, Gehäuse und Pop-Out-Ziel.
     */
    currentLayout = $derived.by(() => {
        const withBezel = !this.targetScreen && this.showBezel && !this.isFullscreen && !this.isKiosk;
        return generateActiveLayout(this.monitorId, this.layoutType, withBezel, this.targetScreen, this.is4k);
    });

    /**
     * Ob das physische Gehäuse aktuell gezeichnet werden soll.
     * Bei Pop-Out-Einzelfenstern (targetScreen) ist das Gehäuse stets inaktiv.
     */
    isCasingActive = $derived.by(() => {
        return !this.targetScreen && this.showBezel && !this.isFullscreen && !this.isKiosk && Boolean(this.currentLayout?.casingWidth);
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
     * @param {string} type - 'zuganzeiger' | 'anschlusstafel' | 'ankunftstafel' | 'wagenreihungsplan' | 'wagenstand_gleis'
     */
    setLayoutType(type) {
        if (this.layoutType !== type) {
            this.setDeparturePage(0);
        }
        this.layoutType = type;
        localStorage.setItem('zimsim_layout_type', type);
    }

    /**
     * Konfiguriert den Zielmonitor für Multi-Monitor / Pop-Out Fenster.
     * @param {string|number|null} screenNumber - '1', '2', '3' oder null für Hauptansicht
     * @param {boolean} [use4k=false] - Ob 4K-Auflösung genutzt wird
     * @returns {void}
     */
    setTargetScreen(screenNumber, use4k = false) {
        this.targetScreen = screenNumber ? String(screenNumber) : null;
        this.is4k = Boolean(use4k);
    }

    /**
     * Schaltet das Gehäuse ein oder aus.
     */
    toggleBezel() {
        this.showBezel = !this.showBezel;
        localStorage.setItem('zimsim_show_bezel', String(this.showBezel));
    }

    /**
     * Setzt den Skalierungsmodus ('fit' oder 'scroll').
     * @param {'fit' | 'scroll'} mode
     */
    setScaleMode(mode) {
        this.scaleMode = mode === 'scroll' ? 'scroll' : 'fit';
        localStorage.setItem('zimsim_scale_mode', this.scaleMode);
    }

    /**
     * Schaltet zwischen Fit- und Scroll-Modus um.
     */
    toggleScaleMode() {
        this.setScaleMode(this.scaleMode === 'fit' ? 'scroll' : 'fit');
    }

    /**
     * Schaltet zur nächsten Seite der Anschlusstafel.
     */
    nextDeparturePage() {
        if (this.totalDeparturePages > 1) {
            this.departurePageIndex = (this.departurePageIndex + 1) % this.totalDeparturePages;
        }
    }

    /**
     * Schaltet zur vorherigen Seite der Anschlusstafel.
     */
    prevDeparturePage() {
        if (this.totalDeparturePages > 1) {
            this.departurePageIndex = (this.departurePageIndex - 1 + this.totalDeparturePages) % this.totalDeparturePages;
        }
    }

    /**
     * Setzt den aktuellen Seitenindex der Anschlusstafel direkt.
     * @param {number} index
     */
    setDeparturePage(index) {
        const target = Math.max(0, index || 0);
        if (this.departurePageIndex !== target) {
            this.departurePageIndex = target;
        }
    }

    /**
     * Aktualisiert die Gesamtseitenzahl der Anschlusstafel und passt den Index an, falls nötig.
     * @param {number} total
     */
    setTotalDeparturePages(total) {
        const safeTotal = Math.max(1, total || 1);
        if (this.totalDeparturePages !== safeTotal) {
            this.totalDeparturePages = safeTotal;
        }
        if (this.departurePageIndex >= safeTotal) {
            this.departurePageIndex = 0;
        }
    }
}

export const displayConfigStore = new DisplayConfigStore();
