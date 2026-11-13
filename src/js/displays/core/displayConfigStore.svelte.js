// js/displays/core/displayConfigStore.svelte.js
import {
    CHASSIS_GAP_RANGE,
    CHASSIS_PROFILES,
    DISPLAY_PROFILES,
    createLayout,
    getChassisGapWidth,
    getDefaultChassisForDisplay,
    getDisplayOrientation,
    isChassisCompatible,
    LAYOUT_TYPES,
    MONITOR_PRESETS,
    resolvePresetProfile
} from './displayLayoutService.js';
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
 * Sucht das Preset zu einer Display-/Gehäuse-Kombination.
 * Solange die UI Preset-basiert ist, ist das die Rückabbildung von den zwei
 * Achsen auf den Eintrag im Hardware-Dropdown.
 *
 * @param {string|null} displayId - ID aus DISPLAY_PROFILES
 * @param {string|null} chassisId - ID aus CHASSIS_PROFILES
 * @returns {object|undefined} Passendes Preset oder undefined
 */
function findPreset(displayId, chassisId) {
    return MONITOR_PRESETS.find(p => p.displayId === displayId && p.chassisId === chassisId);
}

/**
 * Übersetzt die Legacy-Persistenz (`zimsim_monitor_id`) in die zwei Achsen.
 * Wird nur noch für die einmalige Migration alter Installationen benötigt.
 *
 * @param {string|null} monitorId - Gespeicherter Preset-Name
 * @returns {{displayId: string, chassisId: string}} Aufgelöste Hardware-Achsen
 */
function resolveLegacyHardware(monitorId) {
    const { display, chassis } = resolvePresetProfile(monitorId || 'zim2x32');
    return { displayId: display.id, chassisId: chassis.id };
}

/**
 * Prüft eine gespeicherte Display-/Gehäuse-Kombination auf Gültigkeit.
 * Unbekannte IDs und Gehäuse, die nicht zur Display-Ausrichtung passen
 * (z. B. Vitrine an einem Hochformat-Panel), gelten als nicht auflösbar.
 *
 * @param {string|null} displayId - Gespeicherte Display-ID
 * @param {string|null} chassisId - Gespeicherte Gehäuse-ID
 * @returns {{displayId: string, chassisId: string}|null} Gültige Achsen oder null
 */
function resolveHardware(displayId, chassisId) {
    if (!displayId || !DISPLAY_PROFILES[displayId]) return null;
    if (!chassisId || !CHASSIS_PROFILES[chassisId]) return null;
    if (!isChassisCompatible(chassisId, getDisplayOrientation(displayId))) return null;
    return { displayId, chassisId };
}

/**
 * Liest die persistierte Stegdicke (Übersteuerung der Gehäuse-Vorgabe).
 * Fehlt der Wert oder ist er unbrauchbar, gilt `null` = Profilwert.
 *
 * @returns {number|null} Stegdicke in logischen Pixeln oder null
 */
function getInitialChassisGap() {
    const raw = localStorage.getItem('zimsim_chassis_gap');
    if (raw === null || raw === '') return null;
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value)) return null;
    return Math.min(CHASSIS_GAP_RANGE.max, Math.max(CHASSIS_GAP_RANGE.min, value));
}

/**
 * Ermittelt die initiale Hardware aus dem localStorage.
 *
 * Migration (P2): Bestehende Installationen haben nur `zimsim_monitor_id`.
 * Dieser Wert wird einmalig in `zimsim_display_id` + `zimsim_chassis_id`
 * übersetzt; der Legacy-Key bleibt als Kompatibilitätswert erhalten.
 *
 * Migration (P4): Die frühere Checkbox „Gehäusesimulation" steuerte
 * `zimsim_show_bezel`. Diese Achse ist jetzt die Gehäuse-Auswahl: Ein
 * gespeichertes `false` wird zu `chassisId = 'none'`, der Schlüssel danach
 * nur noch als Spiegel gepflegt.
 *
 * @returns {{displayId: string, chassisId: string}} Aufgelöste Hardware-Achsen
 */
function getInitialHardware() {
    const stored = resolveHardware(
        localStorage.getItem('zimsim_display_id'),
        localStorage.getItem('zimsim_chassis_id')
    );
    const hardware = stored || resolveLegacyHardware(localStorage.getItem('zimsim_monitor_id'));

    // Gehäuse-Checkbox (alt) hat Vorrang vor dem gespeicherten Gehäuse: Wer
    // die Simulation abgeschaltet hatte, soll sie nach dem Update nicht
    // plötzlich wieder sehen.
    const chassisId = localStorage.getItem('zimsim_show_bezel') === 'false'
        ? 'none'
        : hardware.chassisId;

    // Beide Achsen beim Laden nachziehen, damit alte Tabs/Exports und die
    // Migration konsistent bleiben.
    localStorage.setItem('zimsim_display_id', hardware.displayId);
    localStorage.setItem('zimsim_chassis_id', chassisId);

    const preset = findPreset(hardware.displayId, chassisId);
    if (preset) {
        localStorage.setItem('zimsim_monitor_id', preset.id);
    }

    return { displayId: hardware.displayId, chassisId };
}

/**
 * Liest die gespeicherte Darstellungsvariante. Fehlt sie (oder ist sie
 * unbekannt), wird die FullHD-Variante der Display-Ausrichtung gewählt.
 *
 * @param {string} displayId - Aktives Display-Profil
 * @returns {string} Gültige Varianten-ID
 */
function getInitialBoardVariant(displayId) {
    const stored = localStorage.getItem('zimsim_board_variant');
    if (isValidBoardVariant(stored)) {
        // Ausrichtung folgt immer dem gespeicherten Display (Auflösungsklasse
        // bleibt erhalten), auch wenn beide Einstellungen getrennt persistiert
        // wurden und zwischenzeitlich auseinanderlaufen konnten.
        return adaptVariantOrientation(stored, getDisplayOrientation(displayId));
    }
    return getVariantId(getDisplayOrientation(displayId), false);
}

/**
 * Zentraler reaktiver Svelte 5 Store für die Anzeige-Konfiguration.
 * Verwaltet die vollständige Entkopplung von Hardware-Monitor und DB-Anzeigetyp.
 */
// Einmalig beim Modulstart auflösen (inkl. Migration des Legacy-Keys).
const initialHardware = getInitialHardware();

class DisplayConfigStore {
    // 1. Display-Achse (nur Glas): 'fhd_1x1_landscape', 'fhd_2x1_landscape', 'fhd_3x1_landscape',
    // 'fhd_1x1_portrait', 'wide_1x1_landscape', 'ultrawide_1x1_landscape'
    displayId = $state(initialHardware.displayId);

    // 2. Gehäuse-Achse (nur Rahmen): 'overhead', 'vitrine', 'stele', 'bar', 'none'
    chassisId = $state(initialHardware.chassisId);

    // 3. Abgeleiteter Preset-Name für ScreenSync und den Legacy-Key
    // `zimsim_monitor_id`. Kombinationen ohne eigenen Preset-Eintrag (z. B.
    // Stele + Überkopf) erhalten einen zusammengesetzten Namen; `createLayout`
    // bildet denselben Namen, damit die Layout-ID stabil bleibt.
    monitorId = $derived.by(() => {
        const preset = findPreset(this.displayId, this.chassisId);
        return preset ? preset.id : `${this.displayId}+${this.chassisId}`;
    });

    // 4. Fachlicher Anzeigetyp (z.B. 'zuganzeiger', 'anschlusstafel', 'ankunftstafel', 'wagenstand_gleis')
    layoutType = $state(getInitialLayoutType());

    // 5. Gehäuse-Sichtbarkeit: folgt seit P4 aus der Gehäuse-Achse. 'none'
    // ist ein echtes Gehäuseprofil (ohne Rahmen); Checkbox und Auswahl
    // steuern damit nicht mehr doppelt.
    showBezel = $derived(this.chassisId !== 'none');

    // 6. Stegdicke zwischen zwei Panels: null = Vorgabe des Gehäuseprofils,
    // sonst ein fester Wert in logischen Pixeln (chassisOverrides.gapWidth).
    chassisGap = $state(getInitialChassisGap());

    // 7. Vollbild / Kiosk Status
    isFullscreen = $state(false);
    isKiosk = $state(false);

    // 8. Multi-Screen / Pop-Out Zielmonitor (z.B. '1', '2', '3' oder null für Hauptansicht)
    targetScreen = $state(null);

    // 9. Darstellungsvariante der Hauptansicht ('fhd_landscape', 'uhd_landscape', 'fhd_portrait', 'uhd_portrait')
    boardVariant = $state(getInitialBoardVariant(this.displayId));

    // 10. Darstellungsvariante eines Pop-Out-Fensters. Wird nur ausgewertet,
    // solange ein Zielschirm aktiv ist, und nie persistiert, damit ein
    // 4K-Pop-Out die Hauptansicht nicht umstellt.
    popOutVariant = $state(null);

    // 11. Skalierungsmodus ('fit' = an Bildschirmbreite anpassen, 'scroll' = 1:1 Detailansicht)
    scaleMode = $state(localStorage.getItem('zimsim_scale_mode') || 'fit');

    // 12. Paginierung für Anschlusstafeln / Voranzeiger
    departurePageIndex = $state(0);
    totalDeparturePages = $state(1);

    // Zuletzt aktives Gehäuse (nicht `none`). Wird beim Umschalten der
    // Gehäusesimulation (Strg+B) benötigt, um den vorherigen Rahmen
    // wiederherzustellen; bewusst nicht persistiert.
    _lastChassisId = initialHardware.chassisId === 'none' ? null : initialHardware.chassisId;

    /**
     * Aktive Varianten-ID: Bei aktivem Pop-Out gilt dessen Variante,
     * ansonsten die in der Hauptansicht gewählte – stets an die Ausrichtung
     * des aktiven Display-Profils angepasst (Auflösungsklasse bleibt).
     */
    activeVariantId = $derived.by(() => {
        if (this.targetScreen && isValidBoardVariant(this.popOutVariant)) {
            return this.popOutVariant;
        }
        return adaptVariantOrientation(this.boardVariant, getDisplayOrientation(this.displayId));
    });

    /**
     * Ob die aktive Darstellung in 4K gerendert wird.
     */
    is4k = $derived.by(() => isUhdVariant(this.activeVariantId));

    /**
     * Effektive Stegdicke in logischen Pixeln: der eingestellte Wert oder –
     * solange nichts übersteuert wurde – die Vorgabe des Gehäuseprofils.
     */
    chassisGapWidth = $derived.by(() => {
        return this.chassisGap === null ? getChassisGapWidth(this.chassisId) : this.chassisGap;
    });

    /**
     * Berechnet reaktiv das aktuelle Layout-Objekt basierend auf Display,
     * Gehäuse, Typ und Pop-Out-Ziel. Der Aufruf geht direkt an `createLayout`;
     * `presetId` bleibt nur für die stabile Layout-ID erhalten.
     */
    currentLayout = $derived.by(() => {
        const withBezel = !this.targetScreen && this.showBezel && !this.isFullscreen && !this.isKiosk;
        return createLayout({
            presetId: this.monitorId,
            displayId: this.displayId,
            chassisId: this.chassisId,
            layoutType: this.layoutType,
            withBezel,
            variantId: this.activeVariantId,
            chassisOverrides: this.chassisGap === null ? null : { gapWidth: this.chassisGap },
            targetScreen: this.targetScreen
        });
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
     * Übernimmt eine Display-/Gehäuse-Kombination in den State und persistiert
     * beide Achsen. Der Legacy-Key `zimsim_monitor_id` wird weiter gepflegt,
     * damit ältere Tabs/Exports den passenden Preset-Namen sehen; der alte
     * Checkbox-Key `zimsim_show_bezel` bleibt ein Spiegel der Gehäuse-Achse.
     *
     * Ein Wechsel zwischen zwei Gehäusen setzt eine übersteuerte Stegdicke auf
     * den Profilwert zurück (die Stegdicke gehört zum Gehäuse); das Aus- und
     * Wiedereinschalten über `none` behält sie.
     *
     * @param {string} displayId - ID aus DISPLAY_PROFILES
     * @param {string} chassisId - ID aus CHASSIS_PROFILES
     * @returns {void}
     */
    applyHardware(displayId, chassisId) {
        // Ein Wechsel zwischen zwei echten Gehäusen setzt die Stegdicke auf
        // den Profilwert zurück; der Umweg über „ohne Gehäuse" (Strg+B)
        // behält den eingestellten Wert, damit er beim Wiedereinschalten
        // nicht verloren geht.
        if (chassisId !== this.chassisId && chassisId !== 'none' && this.chassisId !== 'none') {
            this.setChassisGap(null);
        }
        if (chassisId !== 'none') {
            this._lastChassisId = chassisId;
        }

        this.displayId = displayId;
        this.chassisId = chassisId;
        localStorage.setItem('zimsim_display_id', displayId);
        localStorage.setItem('zimsim_chassis_id', chassisId);
        localStorage.setItem('zimsim_show_bezel', String(chassisId !== 'none'));

        const preset = findPreset(displayId, chassisId);
        if (preset) {
            localStorage.setItem('zimsim_monitor_id', preset.id);
        }

        const adapted = adaptVariantOrientation(this.boardVariant, getDisplayOrientation(displayId));
        if (adapted !== this.boardVariant) {
            this.boardVariant = adapted;
            localStorage.setItem('zimsim_board_variant', adapted);
        }
    }

    /**
     * Wechselt den Hardware-Monitor über ein Preset (Legacy-Einstieg für
     * URLs/Kompatibilität). Intern werden beide Achsen gesetzt.
     * @param {string} id
     */
    setMonitorId(id) {
        const { display, chassis } = resolvePresetProfile(id);
        this.applyHardware(display.id, chassis.id);
    }

    /**
     * Setzt Display und Gehäuse unabhängig voneinander – der Einstieg der
     * Zwei-Achsen-UI. Die Kombination wird nicht mehr auf ein Preset
     * abgebildet; nur gültige IDs und zur Display-Ausrichtung passende
     * Gehäuse werden übernommen.
     *
     * @param {string} displayId - ID aus DISPLAY_PROFILES
     * @param {string} chassisId - ID aus CHASSIS_PROFILES ('none' = ohne Gehäuse)
     * @returns {boolean} true, wenn die Kombination übernommen wurde
     */
    setDisplayAndChassis(displayId, chassisId) {
        const hardware = resolveHardware(displayId, chassisId);
        if (!hardware) {
            console.warn(`[DisplayConfig] Ungültige Hardware: ${displayId} + ${chassisId}.`);
            return false;
        }

        this.applyHardware(hardware.displayId, hardware.chassisId);
        return true;
    }

    /**
     * Schaltet die Gehäusesimulation ein oder aus, ohne die Display-Achse zu
     * ändern. „Aus" entspricht dem Gehäuseprofil `none`, „ein" stellt das
     * zuletzt aktive (oder das natürliche) Gehäuse wieder her.
     *
     * @param {boolean} enabled - true = Rahmen/Steg zeichnen
     * @returns {void}
     */
    setBezelEnabled(enabled) {
        if (enabled === this.showBezel) return;
        if (!enabled) {
            this.setDisplayAndChassis(this.displayId, 'none');
            return;
        }

        const orientation = getDisplayOrientation(this.displayId);
        const chassisId = this._lastChassisId && isChassisCompatible(this._lastChassisId, orientation)
            ? this._lastChassisId
            : getDefaultChassisForDisplay(this.displayId);

        this.setDisplayAndChassis(this.displayId, chassisId);
    }

    /**
     * Setzt die Stegdicke als Übersteuerung des Gehäuseprofils.
     * `null` (oder ein unbrauchbarer Wert) stellt die Profilvorgabe wieder her.
     *
     * @param {number|string|null} value - Stegdicke in logischen Pixeln (0–100)
     * @returns {void}
     */
    setChassisGap(value) {
        const numeric = value === null || value === '' ? Number.NaN : Number(value);
        const next = Number.isFinite(numeric)
            ? Math.min(CHASSIS_GAP_RANGE.max, Math.max(CHASSIS_GAP_RANGE.min, Math.round(numeric)))
            : null;
        if (next === this.chassisGap) return;

        this.chassisGap = next;
        if (next === null) {
            localStorage.removeItem('zimsim_chassis_gap');
        } else {
            localStorage.setItem('zimsim_chassis_gap', String(next));
        }
    }

    /**
     * Wechselt die Darstellungsvariante der Hauptansicht.
     * Unbekannte IDs werden ignoriert; die Ausrichtung wird an das aktuelle
     * Display angepasst (Auflösungsklasse bleibt).
     *
     * @param {string} variantId - 'fhd_landscape' | 'uhd_landscape' | 'fhd_portrait' | 'uhd_portrait'
     * @returns {void}
     */
    setBoardVariant(variantId) {
        if (!isValidBoardVariant(variantId)) return;
        const adapted = adaptVariantOrientation(variantId, getDisplayOrientation(this.displayId));
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
     * Schaltet die Gehäusesimulation um (Tastenkürzel Strg+B).
     * Entspricht `setBezelEnabled(!showBezel)`.
     */
    toggleBezel() {
        this.setBezelEnabled(!this.showBezel);
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
