// js/displays/core/displayConfigStore.svelte.js
import { generateActiveLayout, getMonitorOrientation, LAYOUT_TYPES } from './displayLayoutService.js';
import { BOARD_VARIANTS, adaptVariantOrientation, getVariantId, isUhdVariant } from './boardTokenService.js';

/**
 * Prüft, ob ein fachlicher Anzeigetyp überhaupt existiert.
 * Entfernte oder unbekannte Typen (z. B. 'wagenreihungsplan') würden sonst
 * ein Layout ohne Screens erzeugen und die Anzeige leer lassen.
 *
 * @param {string|null} type - Zu prüfender Layout-Typ
 * @returns {boolean} true, wenn der Typ in LAYOUT_TYPES existiert
 */
function isValidLayoutType(type) {
    return LAYOUT_TYPES.some(entry => entry.id === type);
}

/**
 * Liest den gespeicherten Anzeigetyp aus dem localStorage und fällt bei
 * unbekannten/entfernten Typen auf 'zuganzeiger' zurück.
 *
 * @returns {string} Gültiger Layout-Typ
 */
function getInitialLayoutType() {
    const stored = localStorage.getItem('zimsim_layout_type');
    return isValidLayoutType(stored) ? stored : 'zuganzeiger';
}

/**
 * Prüft, ob eine Darstellungsvarianten-ID existiert.
 *
 * @param {string|null} variantId - Zu prüfende Varianten-ID
 * @returns {boolean} true, wenn die Variante in BOARD_VARIANTS existiert
 */
function isValidBoardVariant(variantId) {
    return Boolean(variantId && BOARD_VARIANTS[variantId]);
}

/**
 * Liest die gespeicherte Darstellungsvariante. Fehlt sie (oder ist sie
 * unbekannt), wird die FullHD-Variante der Monitor-Ausrichtung gewählt.
 *
 * @param {string} monitorId - Aktives Hardware-Profil
 * @returns {string} Gültige Varianten-ID
 */
function getInitialBoardVariant(monitorId) {
    const stored = localStorage.getItem('zimsim_board_variant');
    if (isValidBoardVariant(stored)) {
        // Ausrichtung folgt immer dem gespeicherten Monitor (Auflösungsklasse
        // bleibt erhalten), auch wenn beide Einstellungen getrennt persistiert
        // wurden und zwischenzeitlich auseinanderlaufen konnten.
        return adaptVariantOrientation(stored, getMonitorOrientation(monitorId));
    }
    return getVariantId(getMonitorOrientation(monitorId), false);
}

/**
 * Zentraler reaktiver Svelte 5 Store für die Anzeige-Konfiguration.
 * Verwaltet die vollständige Entkopplung von Hardware-Monitor und DB-Anzeigetyp.
 */
class DisplayConfigStore {
    // 1. Hardware-Monitor (z.B. 'zim2x32', 'zim3x32', 'zim32_single', 'zimvitrine32', 'zimvitrine65h', 'zimwide', 'zimultrawide')
    monitorId = $state(localStorage.getItem('zimsim_monitor_id') || 'zim2x32');

    // 2. Fachlicher Anzeigetyp (z.B. 'zuganzeiger', 'anschlusstafel', 'ankunftstafel', 'wagenstand_gleis')
    layoutType = $state(getInitialLayoutType());

    // 3. Gehäuse-Sichtbarkeit
    showBezel = $state(localStorage.getItem('zimsim_show_bezel') !== 'false');

    // 4. Vollbild / Kiosk Status
    isFullscreen = $state(false);
    isKiosk = $state(false);

    // 5. Multi-Screen / Pop-Out Zielmonitor (z.B. '1', '2', '3' oder null für Hauptansicht)
    targetScreen = $state(null);

    // 6. Darstellungsvariante der Hauptansicht ('fhd_landscape', 'uhd_landscape', 'fhd_portrait', 'uhd_portrait')
    boardVariant = $state(getInitialBoardVariant(this.monitorId));

    // 7. Darstellungsvariante eines Pop-Out-Fensters. Wird nur ausgewertet,
    // solange ein Zielschirm aktiv ist, und nie persistiert, damit ein
    // 4K-Pop-Out die Hauptansicht nicht umstellt.
    popOutVariant = $state(null);

    // 8. Skalierungsmodus ('fit' = an Bildschirmbreite anpassen, 'scroll' = 1:1 Detailansicht)
    scaleMode = $state(localStorage.getItem('zimsim_scale_mode') || 'fit');

    // 9. Paginierung für Anschlusstafeln / Voranzeiger
    departurePageIndex = $state(0);
    totalDeparturePages = $state(1);

    /**
     * Aktive Varianten-ID: Bei aktivem Pop-Out gilt dessen Variante,
     * ansonsten die in der Hauptansicht gewählte – stets an die Ausrichtung
     * des aktuellen Hardware-Monitors angepasst (Auflösungsklasse bleibt).
     */
    activeVariantId = $derived.by(() => {
        if (this.targetScreen && isValidBoardVariant(this.popOutVariant)) {
            return this.popOutVariant;
        }
        return adaptVariantOrientation(this.boardVariant, getMonitorOrientation(this.monitorId));
    });

    /**
     * Ob die aktive Darstellung in 4K gerendert wird.
     */
    is4k = $derived.by(() => isUhdVariant(this.activeVariantId));

    /**
     * Berechnet reaktiv das aktuelle Layout-Objekt basierend auf Monitor, Typ, Gehäuse und Pop-Out-Ziel.
     */
    currentLayout = $derived.by(() => {
        const withBezel = !this.targetScreen && this.showBezel && !this.isFullscreen && !this.isKiosk;
        return generateActiveLayout(this.monitorId, this.layoutType, withBezel, this.targetScreen, this.activeVariantId);
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
     * Wechselt den Hardware-Monitor. Die Auflösungsklasse (Full HD / 4K) der
     * Darstellungsvariante bleibt erhalten, die Ausrichtung folgt dem neuen
     * Monitor (Quer- ↔ Hochformat).
     * @param {string} id
     */
    setMonitorId(id) {
        this.monitorId = id;
        localStorage.setItem('zimsim_monitor_id', id);

        const adapted = adaptVariantOrientation(this.boardVariant, getMonitorOrientation(id));
        if (adapted !== this.boardVariant) {
            this.boardVariant = adapted;
            localStorage.setItem('zimsim_board_variant', adapted);
        }
    }

    /**
     * Wechselt die Darstellungsvariante der Hauptansicht.
     * Unbekannte IDs werden ignoriert; die Ausrichtung wird an den aktuellen
     * Monitor angepasst (Auflösungsklasse bleibt).
     *
     * @param {string} variantId - 'fhd_landscape' | 'uhd_landscape' | 'fhd_portrait' | 'uhd_portrait'
     * @returns {void}
     */
    setBoardVariant(variantId) {
        if (!isValidBoardVariant(variantId)) return;
        const adapted = adaptVariantOrientation(variantId, getMonitorOrientation(this.monitorId));
        if (adapted === this.boardVariant) return;
        this.boardVariant = adapted;
        localStorage.setItem('zimsim_board_variant', adapted);
    }

    /**
     * Wechselt den fachlichen DB-Anzeigetyp.
     * Unbekannte/entfernte Typen werden auf 'zuganzeiger' abgebildet.
     *
     * @param {string} type - 'zuganzeiger' | 'anschlusstafel' | 'ankunftstafel' | 'wagenstand_gleis'
     */
    setLayoutType(type) {
        const nextType = isValidLayoutType(type) ? type : 'zuganzeiger';
        if (this.layoutType !== nextType) {
            this.setDeparturePage(0);
        }
        this.layoutType = nextType;
        localStorage.setItem('zimsim_layout_type', nextType);
    }

    /**
     * Konfiguriert den Zielmonitor für Multi-Monitor / Pop-Out Fenster.
     * @param {string|number|null} screenNumber - '1', '2', '3' oder null für Hauptansicht
     * @param {string|null} [variantId=null] - Darstellungsvariante des Pop-Out-Fensters
     * @returns {void}
     */
    setTargetScreen(screenNumber, variantId = null) {
        this.targetScreen = screenNumber ? String(screenNumber) : null;
        this.popOutVariant = this.targetScreen && isValidBoardVariant(variantId) ? variantId : null;
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
