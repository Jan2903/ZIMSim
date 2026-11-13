// js/displays/core/displayLayoutService.js
import { BOARD_VARIANTS, adaptVariantOrientation, isUhdVariant } from './boardTokenService.js';

/**
 * Service zur dynamischen Generierung von Layout-Objekten
 * basierend auf der Kreuzung von Hardware-Monitor und DB-Anzeigetyp.
 *
 * Die Hardware ist seit der Trennung von Display und Gehäuse in zwei
 * unabhängige Achsen aufgeteilt:
 *
 *   DISPLAY_PROFILES – nur das Display: Segmente (physische Panels), die
 *                      Unterteilung in Slots (Zuganzeiger) und in Spalten
 *                      (Listen-Boards). Keine Rahmen- oder Gehäusewerte.
 *   CHASSIS_PROFILES – nur das Gehäuse: Stegdicke (gapWidth), Innenabstand
 *                      (padding), Sockel (extraBottom) und Optik (style).
 *   MONITOR_PRESETS  – Kombinationen beider Achsen. Das sind die Einträge im
 *                      Hardware-Dropdown und die Werte in localStorage.
 *
 * Damit ist die Vitrine kein eigenes Display mehr, sondern ein Gehäuse um ein
 * 1×-FullHD-Panel; die Stele ist dasselbe Panel im Hochformat mit Sockel.
 */

/**
 * Display-Profile (nur Glas/Geometrie).
 *
 * `segments` beschreibt die physischen Panels ohne Steg. Die absolute
 * X-Position ergibt sich erst mit der Stegdicke des Gehäuses. `slots` ist die
 * Zuganzeiger-Unterteilung (kann Panels halbieren); `null` bedeutet „ein
 * Screen pro Segment“. `listColumnsPerSegment` legt fest, in wie viele
 * Spalten ein Segment bei Listen-Boards (Anschluss-/Ankunftstafel) zerfällt.
 *
 * `legacyOverrides` dokumentiert bewusst das bisherige Verhalten einzelner
 * Displays, das noch nicht vereinheitlicht ist (siehe TODO in P3).
 */
export const DISPLAY_PROFILES = {
    fhd_1x1_landscape: {
        id: 'fhd_1x1_landscape',
        name: '1× Full HD (Quer)',
        orientation: 'landscape',
        panelH: 1080,
        segments: [{ w: 1920 }],
        slots: null,
        listColumnsPerSegment: 1
    },
    fhd_2x1_landscape: {
        id: 'fhd_2x1_landscape',
        name: '2× Full HD (Quer)',
        orientation: 'landscape',
        panelH: 1080,
        segments: [{ w: 1920 }, { w: 1920 }],
        // Klassische ZIM-Aufteilung: links Hauptmonitor, rechts zwei Hälften.
        slots: [
            { id: 'hauptmonitor', type: 'haupt', segment: 0, offset: 0, w: 1920, trainIndex: 0 },
            { id: 'nebenmonitor_1', type: 'neben', segment: 1, offset: 0, w: 960, trainIndex: 1 },
            { id: 'nebenmonitor_2', type: 'neben_rotierend', segment: 1, offset: 960, w: 960 }
        ],
        listColumnsPerSegment: 1
    },
    fhd_3x1_landscape: {
        id: 'fhd_3x1_landscape',
        name: '3× Full HD (Quer)',
        orientation: 'landscape',
        panelH: 1080,
        segments: [{ w: 1920 }, { w: 1920 }, { w: 1920 }],
        // Erstes Panel voll, danach zwei Panels mit je zwei Hälften.
        slots: [
            { id: 'hauptmonitor', type: 'haupt', segment: 0, offset: 0, w: 1920, trainIndex: 0 },
            { id: 'nebenmonitor_1', type: 'neben', segment: 1, offset: 0, w: 960, trainIndex: 1 },
            { id: 'nebenmonitor_2', type: 'neben_rotierend', segment: 1, offset: 960, w: 960 },
            { id: 'nebenmonitor_3', type: 'neben', segment: 2, offset: 0, w: 960, trainIndex: 2 },
            { id: 'nebenmonitor_4', type: 'neben_rotierend', segment: 2, offset: 960, w: 960 }
        ],
        listColumnsPerSegment: 1
        // P3: Die früheren `legacyGaps` ([1920, 3940]) sind entfernt. Der
        // zweite Steg saß 50 px zu weit rechts (im dritten Panel); `gaps`
        // wird jetzt aus `gapStarts` abgeleitet.
    },
    fhd_1x1_portrait: {
        id: 'fhd_1x1_portrait',
        name: '1× Full HD (Hoch)',
        orientation: 'portrait',
        panelH: 1920,
        segments: [{ w: 1080 }],
        slots: null,
        listColumnsPerSegment: 1,
        // Bewusste Hochformat-Abweichungen der Stele (P3-Entscheidung):
        // Der Zuganzeiger zeigt dort den Wagenstandsanzeiger, weil der
        // Zuganzeiger-Renderer feste Querformat-Positionen (1920×1080) nutzt.
        // Der Zoom fällt auf die normale Liste mit 8 Zeilen zurück, weil der
        // Zoom-Renderer feste Querformat-Spalten verwendet. Beides bleibt so,
        // bis es eigene Hochformat-Renderer gibt.
        legacyOverrides: {
            zuganzeiger: { id: 'stele_zuganzeiger', type: 'vitrine32' },
            anschlusstafel: { id: 'abfahrt_stele', omitColumnMeta: true },
            ankunftstafel: { id: 'ankunft_stele', omitColumnMeta: true },
            wagenstand_gleis: { id: 'stele_plan' },
            anschlusstafel_zoom: { id: 'abfahrt_zoom_stele', type: 'abfahrt_portrait', maxRows: 8, omitColumnMeta: true },
            anschlusstafel_zoom_icons: { id: 'abfahrt_zoom_stele', type: 'abfahrt_portrait', maxRows: 8, omitColumnMeta: true }
        }
    },
    wide_1x1_landscape: {
        id: 'wide_1x1_landscape',
        name: '1× 21:9 (Quer)',
        orientation: 'landscape',
        panelH: 1080,
        segments: [{ w: 2560 }],
        slots: null,
        listColumnsPerSegment: 2,
        // TODO(P6): echtes Gerät mit gestrecktem Panel. Bis dahin werden die
        // 1920er-Tokens unverändert auf 2560 px Breite gezeichnet.
        renderMode: 'stretch'
    },
    ultrawide_1x1_landscape: {
        id: 'ultrawide_1x1_landscape',
        name: '1× 32:9 (Quer, nahtlos)',
        orientation: 'landscape',
        panelH: 1080,
        segments: [{ w: 3840 }],
        // Nahtloses Panel: die Zuganzeiger-Hälften liegen im selben Segment.
        slots: [
            { id: 'hauptmonitor', type: 'haupt', segment: 0, offset: 0, w: 1920, trainIndex: 0 },
            { id: 'nebenmonitor_1', type: 'neben', segment: 0, offset: 1920, w: 960, trainIndex: 1 },
            { id: 'nebenmonitor_2', type: 'neben_rotierend', segment: 0, offset: 2880, w: 960 }
        ],
        listColumnsPerSegment: 2,
        // TODO(P6): siehe wide_1x1_landscape.
        renderMode: 'stretch'
    }
};

/**
 * Gehäuse-Profile (nur Rahmen/Optik).
 *
 * `gapWidth` ist die Dicke des Mittelstegs zwischen zwei Segmenten und der
 * einzige Punkt, an dem das Gehäuse die Display-Geometrie beeinflusst.
 * `padding` ist der Rahmenrand links/rechts bzw. oben/unten, `extraBottom`
 * zusätzlicher Platz für Sockel/Füße.
 */
export const CHASSIS_PROFILES = {
    overhead: {
        id: 'overhead',
        name: 'Überkopf-Gehäuse',
        style: 'standard',
        orientation: 'any',
        padding: { x: 270, y: 260 },
        gapWidth: 50,
        extraBottom: 0
    },
    vitrine: {
        id: 'vitrine',
        name: 'Vitrine (Stand)',
        style: 'vitrine',
        orientation: 'landscape',
        padding: { x: 100, y: 100 },
        gapWidth: 0,
        // Standfüße unterhalb des Rahmens (casingH 1380 = 1080 + 2×100 + 100).
        extraBottom: 100
    },
    stele: {
        id: 'stele',
        name: 'Stele (Sockel)',
        style: 'stele',
        orientation: 'portrait',
        padding: { x: 80, y: 100 },
        gapWidth: 0,
        extraBottom: 100
    },
    bar: {
        id: 'bar',
        name: 'Bar-Type',
        style: 'stretched',
        orientation: 'landscape',
        padding: { x: 100, y: 90 },
        gapWidth: 0,
        extraBottom: 0
    },
    none: {
        id: 'none',
        name: 'Ohne Gehäuse',
        style: 'none',
        orientation: 'any',
        padding: { x: 0, y: 0 },
        gapWidth: 0,
        extraBottom: 0
    }
};

/**
 * Erlaubter Bereich der Stegdicke in logischen Pixeln.
 * Der Regler in den Einstellungen übersetzt seinen Wert direkt in
 * `chassisOverrides.gapWidth`; die Unter-/Obergrenze wird hier zentral
 * gepflegt, damit Store und UI nicht auseinanderlaufen.
 */
export const CHASSIS_GAP_RANGE = { min: 0, max: 100 };

/**
 * Kombinationen aus Display und Gehäuse. Diese Liste ist die einzige Quelle
 * für das Legacy-Dropdown und für die persistierte `zimsim_monitor_id`.
 * Seit P4 wählt die UI Display und Gehäuse getrennt; die Presets bleiben als
 * kompatible Kurzformen (URLs, ältere Clients, ScreenSync) erhalten.
 */
export const MONITOR_PRESETS = [
    { id: 'zim2x32', name: '2x ZIM FHD', displayId: 'fhd_2x1_landscape', chassisId: 'overhead' },
    { id: 'zim3x32', name: '3x ZIM FHD', displayId: 'fhd_3x1_landscape', chassisId: 'overhead' },
    { id: 'zim32_single', name: '1x ZIM FHD', displayId: 'fhd_1x1_landscape', chassisId: 'overhead' },
    { id: 'zimvitrine32', name: 'ZIMvitrine 32" Stand', displayId: 'fhd_1x1_landscape', chassisId: 'vitrine' },
    { id: 'zimvitrine65h', name: 'ZIMvitrine 65h Stele (9:16)', displayId: 'fhd_1x1_portrait', chassisId: 'stele' },
    { id: 'zimwide', name: 'ZIMwide Bar-Type (21:9)', displayId: 'wide_1x1_landscape', chassisId: 'bar' },
    { id: 'zimultrawide', name: 'ZIMultrawide (32:9 nahtlos)', displayId: 'ultrawide_1x1_landscape', chassisId: 'bar' }
];

/**
 * Legacy-Alias für die bestehende UI (`SettingsDisplaySystem.svelte`).
 * Die Einträge enthalten weiterhin `id` und `name`.
 */
export const MONITOR_PROFILES = MONITOR_PRESETS;

export const LAYOUT_TYPES = [
    { id: 'zuganzeiger', name: 'Zuganzeiger (Bahnsteig / Gleis)' },
    { id: 'anschlusstafel', name: 'Anschlusstafel (Nur Abfahrten)' },
    { id: 'ankunftstafel', name: 'Ankunftstafel (Nur Ankünfte)' },
    { id: 'wagenstand_gleis', name: 'Wagenstandsanzeiger (Gleis)' },
    { id: 'anschlusstafel_zoom', name: 'Anschlusstafel Zoom 4× (Großes Gleis)' },
    { id: 'anschlusstafel_zoom_icons', name: 'Anschlusstafel Zoom 4× (mit Qualitätsmerkmalen)' }
];

/**
 * Liefert Preset, Display- und Gehäuseprofil zu einer Hardware-ID.
 * Unbekannte IDs fallen wie bisher auf das erste Preset zurück.
 *
 * @param {string} [presetId='zim2x32'] - ID aus MONITOR_PRESETS
 * @returns {{preset: object, display: object, chassis: object}} Aufgelöste Profile
 */
export function resolvePresetProfile(presetId = 'zim2x32') {
    const preset = MONITOR_PRESETS.find(p => p.id === presetId) || MONITOR_PRESETS[0];
    return {
        preset,
        display: DISPLAY_PROFILES[preset.displayId] || DISPLAY_PROFILES.fhd_2x1_landscape,
        chassis: CHASSIS_PROFILES[preset.chassisId] || CHASSIS_PROFILES.overhead
    };
}

/**
 * Liefert die physische Ausrichtung eines Display-Profils.
 * Unbekannte IDs fallen wie bei `resolvePresetProfile` auf das
 * Standard-Display zurück.
 *
 * @param {string} displayId - ID aus DISPLAY_PROFILES
 * @returns {'landscape'|'portrait'} Ausrichtung
 */
export function getDisplayOrientation(displayId) {
    const display = DISPLAY_PROFILES[displayId] || DISPLAY_PROFILES.fhd_2x1_landscape;
    return display.orientation;
}

/**
 * Liefert die physische Ausrichtung eines Monitor-Profils.
 * Kompatibilitäts-Helfer für die Preset-basierte UI; intern wird bereits
 * über `getDisplayOrientation` aufgelöst.
 *
 * @param {string} monitorId - ID aus MONITOR_PROFILES
 * @returns {'landscape'|'portrait'} Ausrichtung
 */
export function getMonitorOrientation(monitorId) {
    const { display } = resolvePresetProfile(monitorId);
    return getDisplayOrientation(display.id);
}

/**
 * Prüft, ob ein Gehäuse zu einer Display-Ausrichtung passt.
 * Gehäuse mit `orientation: 'any'` (Überkopf, ohne Gehäuse) passen immer.
 *
 * @param {string} chassisId - ID aus CHASSIS_PROFILES
 * @param {'landscape'|'portrait'} orientation - Ausrichtung des Displays
 * @returns {boolean} true, wenn das Gehäuse dort montiert werden kann
 */
export function isChassisCompatible(chassisId, orientation) {
    const chassis = CHASSIS_PROFILES[chassisId];
    if (!chassis) return false;
    return chassis.orientation === 'any' || chassis.orientation === orientation;
}

/**
 * Liefert die für eine Display-Ausrichtung wählbaren Gehäuse in
 * Profil-Reihenfolge. Das ist die Datenquelle für das Gehäuse-Dropdown;
 * `none` (ohne Gehäuse) ist immer enthalten.
 *
 * @param {'landscape'|'portrait'} orientation - Ausrichtung des Displays
 * @returns {Array<object>} Kompatible Gehäuse-Profile
 */
export function getChassisOptions(orientation) {
    return Object.values(CHASSIS_PROFILES).filter(chassis => isChassisCompatible(chassis.id, orientation));
}

/**
 * Liefert die im Gehäuseprofil hinterlegte Stegdicke in logischen Pixeln.
 * Unbekannte IDs liefern 0 (kein Steg).
 *
 * @param {string} chassisId - ID aus CHASSIS_PROFILES
 * @returns {number} Stegdicke in logischen Pixeln
 */
export function getChassisGapWidth(chassisId) {
    return CHASSIS_PROFILES[chassisId]?.gapWidth || 0;
}

/**
 * Natürliches Gehäuse eines Displays: das Gehäuse seines Presets, sonst das
 * erste kompatible Gehäuse mit Rahmen. Wird benötigt, wenn die Ausrichtung
 * wechselt (z. B. Quer → Hoch) und das bisherige Gehäuse dort nicht passt,
 * oder wenn die Gehäusesimulation wieder eingeschaltet wird.
 *
 * @param {string} displayId - ID aus DISPLAY_PROFILES
 * @returns {string} ID aus CHASSIS_PROFILES (im Zweifel 'none')
 */
export function getDefaultChassisForDisplay(displayId) {
    const orientation = getDisplayOrientation(displayId);
    const presetChassisId = MONITOR_PRESETS.find(preset => preset.displayId === displayId)?.chassisId;
    if (presetChassisId && isChassisCompatible(presetChassisId, orientation)) {
        return presetChassisId;
    }
    return getChassisOptions(orientation).find(chassis => chassis.id !== 'none')?.id || 'none';
}

/**
 * Berechnet die X-Positionen der Segmente inklusive Steg sowie die
 * Gesamtbreite des Displayinhalts.
 *
 * Ohne Steg (gapWidth = 0) liegen die Segmente direkt aneinander; das ist
 * exakt das bisherige rahmenlose Verhalten.
 *
 * @param {object} display - Display-Profil
 * @param {number} gapWidth - Stegdicke zwischen zwei Segmenten
 * @returns {{starts: number[], contentW: number, gapStarts: number[]}} Geometrie
 */
function buildGeometry(display, gapWidth) {
    const starts = [];
    let x = 0;
    display.segments.forEach((segment, index) => {
        if (index > 0) x += gapWidth;
        starts.push(x);
        x += segment.w;
    });
    return {
        starts,
        contentW: x,
        // Position des Stegbeginns (entspricht dem bisherigen gapX/gaps).
        gapStarts: starts.slice(1).map(start => start - gapWidth)
    };
}

/**
 * Erzeugt die Screens der aktiven Anzeigeart in logischen FullHD-Pixeln.
 *
 * Die Regeln sind bewusst generisch und ersetzen die frühere
 * Profil-für-Profil-Matrix:
 *   - Zuganzeiger: Slots des Displays (oder ein Screen pro Segment)
 *   - Listen-Boards: ein Screen je Spalte (`listColumnsPerSegment`)
 *   - Zoom: ein Screen je Segment (kein Aufteilen)
 *   - Wagenstand: Slots übernehmen, das letzte Segment wird zur Vitrine
 *
 * @param {object} display - Display-Profil
 * @param {string} layoutType - Aktiver DB-Anzeigetyp
 * @param {{starts: number[], contentW: number, gapStarts: number[]}} geo - Geometrie
 * @returns {Array<object>} Screen-Definitionen
 */
function buildScreens(display, layoutType, geo) {
    const portrait = display.orientation === 'portrait';
    const lastSegment = display.segments.length - 1;
    const screens = [];

    const toScreen = (slot) => ({
        id: slot.id,
        type: slot.type,
        x: geo.starts[slot.segment] + slot.offset,
        y: 0,
        w: slot.w,
        h: display.panelH,
        ...(slot.trainIndex !== undefined ? { trainIndex: slot.trainIndex } : {})
    });

    if (layoutType === 'zuganzeiger') {
        if (display.slots) {
            display.slots.forEach(slot => screens.push(toScreen(slot)));
        } else {
            // Einzelscreen: das Segment ist der ganze Monitor.
            display.segments.forEach((segment, index) => {
                screens.push({
                    id: index === 0 ? 'hauptmonitor' : `hauptmonitor_${index + 1}`,
                    type: 'haupt',
                    x: geo.starts[index],
                    y: 0,
                    w: segment.w,
                    h: display.panelH,
                    trainIndex: 0
                });
            });
        }
    } else if (layoutType === 'wagenstand_gleis') {
        // Alle Slots des letzten Segments weichen dem Wagenstandsanzeiger.
        (display.slots || [])
            .filter(slot => slot.segment !== lastSegment)
            .forEach(slot => screens.push(toScreen(slot)));

        screens.push({
            id: display.segments.length > 1 ? 'vitrine_right' : 'vitrine_main',
            type: 'vitrine32',
            x: geo.starts[lastSegment],
            y: 0,
            w: display.segments[lastSegment].w,
            h: display.panelH,
            trainIndex: 0
        });
    } else if (layoutType === 'anschlusstafel' || layoutType === 'ankunftstafel') {
        const perSegment = display.listColumnsPerSegment;
        const totalCols = display.segments.length * perSegment;
        const baseType = layoutType === 'anschlusstafel'
            ? (portrait ? 'abfahrt_portrait' : 'abfahrt')
            : (portrait ? 'ankunft_portrait' : 'ankunft');
        const idPrefix = layoutType === 'anschlusstafel' ? 'abfahrt' : 'ankunft';

        display.segments.forEach((segment, segmentIndex) => {
            const colW = segment.w / perSegment;
            for (let col = 0; col < perSegment; col++) {
                const colIndex = segmentIndex * perSegment + col;
                screens.push({
                    id: totalCols > 1 ? `${idPrefix}_col${colIndex + 1}` : `${idPrefix}_single`,
                    type: baseType,
                    x: geo.starts[segmentIndex] + col * colW,
                    y: 0,
                    w: colW,
                    h: display.panelH,
                    colIndex,
                    maxCols: totalCols
                });
            }
        });
    } else if (layoutType === 'anschlusstafel_zoom' || layoutType === 'anschlusstafel_zoom_icons') {
        // Zoom bleibt bewusst bei einem Screen pro Segment (kein Aufteilen),
        // damit der bisherige Aufbau von wide/ultrawide erhalten bleibt.
        const showQualityIcons = layoutType === 'anschlusstafel_zoom_icons';
        const totalCols = display.segments.length;

        display.segments.forEach((segment, segmentIndex) => {
            screens.push({
                id: totalCols > 1 ? `abfahrt_zoom_col${segmentIndex + 1}` : 'abfahrt_zoom_single',
                type: 'abfahrt_zoom',
                x: geo.starts[segmentIndex],
                y: 0,
                w: segment.w,
                h: display.panelH,
                colIndex: segmentIndex,
                maxCols: totalCols,
                maxRows: 4,
                showQualityIcons
            });
        });
    }

    return screens;
}

/**
 * Wendet die dokumentierten Alt-Overrides eines Displays an.
 * Die Overrides betreffen nur Ein-Screen-Aufbauten (aktuell die Stele).
 *
 * @param {object} display - Display-Profil
 * @param {string} layoutType - Aktiver DB-Anzeigetyp
 * @param {Array<object>} screens - Generierte Screens
 * @returns {Array<object>} Angepasste Screens
 */
function applyLegacyOverrides(display, layoutType, screens) {
    const override = display.legacyOverrides?.[layoutType];
    if (!override) return screens;

    return screens.map(screen => {
        const next = { ...screen };
        if (override.id) next.id = override.id;
        if (override.type) next.type = override.type;
        if (override.maxRows !== undefined) next.maxRows = override.maxRows;
        if (override.omitColumnMeta) {
            delete next.colIndex;
            delete next.maxCols;
        }
        return next;
    });
}

/**
 * Erzeugt das vollständige Layout-Objekt aus Display- und Gehäuseprofil.
 *
 * @param {object} [options={}] - Layout-Optionen
 * @param {string|null} [options.presetId=null] - Preset-ID (setzt Display + Gehäuse)
 * @param {string|null} [options.displayId=null] - Display-Profil (überschreibt Preset)
 * @param {string|null} [options.chassisId=null] - Gehäuse-Profil (überschreibt Preset)
 * @param {string} [options.layoutType='zuganzeiger'] - DB-Anzeigetyp
 * @param {boolean} [options.withBezel=true] - Ob das Gehäuse aktiv ist
 * @param {string|null} [options.variantId=null] - 'fhd_landscape' | 'uhd_landscape' | 'fhd_portrait' | 'uhd_portrait'
 * @param {object|null} [options.chassisOverrides=null] - Spätere UI-Overrides (z. B. Stegdicke)
 * @param {string|number|null} [options.targetScreen=null] - Pop-Out-Zielschirm
 * @returns {object} Das konfigurierte Layout-Objekt
 */
export function createLayout({
    presetId = null,
    displayId = null,
    chassisId = null,
    layoutType = 'zuganzeiger',
    withBezel = true,
    variantId = null,
    chassisOverrides = null,
    targetScreen = null
} = {}) {
    // ----------------------------------------------------
    // Multi-Monitor Pop-Outs (?screen=1, ?screen=2, ?screen=3)
    // Rendern exakt einen Einzelschirm in nativer Auflösung ohne Gehäuseränder
    // ----------------------------------------------------
    if (targetScreen) {
        return generateTargetScreenLayout(layoutType, targetScreen, variantId);
    }

    const preset = presetId
        ? (MONITOR_PRESETS.find(p => p.id === presetId) || MONITOR_PRESETS[0])
        : null;
    const display = DISPLAY_PROFILES[displayId || preset?.displayId] || DISPLAY_PROFILES.fhd_2x1_landscape;
    const baseChassis = CHASSIS_PROFILES[chassisId || preset?.chassisId] || CHASSIS_PROFILES.overhead;

    // Overrides werden kopiert, damit die Profil-Tabellen unveränderlich bleiben.
    const chassis = chassisOverrides
        ? {
            ...baseChassis,
            ...chassisOverrides,
            padding: { ...baseChassis.padding, ...(chassisOverrides.padding || {}) }
        }
        : baseChassis;

    // Die Ausrichtung folgt dem Display-Profil; die Auflösungsklasse kommt
    // aus der gewählten Variante.
    const variant = adaptVariantOrientation(variantId, display.orientation);
    const is4k = isUhdVariant(variant);
    const scaleFactor = BOARD_VARIANTS[variant].scale;
    const scale = (value) => value * scaleFactor;

    const gapWidth = withBezel ? chassis.gapWidth : 0;
    const geo = buildGeometry(display, gapWidth);
    const hasGap = withBezel && gapWidth > 0 && display.segments.length > 1;

    const monitorId = preset ? preset.id : `${display.id}+${baseChassis.id}`;
    const layout = {
        id: `${monitorId}_${variant}_${layoutType}`,
        family: baseChassis.style,
        width: scale(geo.contentW),
        height: scale(display.panelH),
        scaleFactor,
        boardVariant: variant,
        // Gehäuse-Geometrie nur bei aktivem Gehäuse. Die Werte werden nicht
        // mehr pro Profil gepflegt, sondern aus Rand + Innenabstand abgeleitet.
        casingWidth: withBezel ? scale(geo.contentW + 2 * chassis.padding.x) : 0,
        casingHeight: withBezel ? scale(display.panelH + 2 * chassis.padding.y + chassis.extraBottom) : 0,
        casingOffsetX: withBezel ? scale(chassis.padding.x) : 0,
        casingOffsetY: withBezel ? scale(chassis.padding.y) : 0,
        hasBezelGap: hasGap,
        gapWidth: hasGap ? scale(gapWidth) : 0,
        // `gapX` ist der Legacy-Einzelsteg und nur bei Zweifach-Gehäusen
        // aussagekräftig; bei Dreifach-Gehäusen gewinnt `gaps`. Der Wert wird
        // daher nur dort skaliert, sonst wie bisher logisch 1920 beibehalten.
        gapX: display.segments.length === 2 ? scale(geo.gapStarts[0]) : 1920,
        gaps: display.segments.length > 2 ? geo.gapStarts.map(scale) : undefined,
        boardType: 'default',
        monitorId,
        layoutType,
        screens: []
    };

    const screens = applyLegacyOverrides(display, layoutType, buildScreens(display, layoutType, geo))
        .map(screen => ({ ...screen, variant }));

    // 4K Ultra-HD: Canvas und Gehäuse sind doppelt so groß, deshalb muss auch
    // die Screen-Geometrie verdoppelt werden. Die Renderer zeichnen weiterhin
    // in logischen Pixeln (screen.w / scaleFactor), erhalten also unverändert
    // 1920×1080 bzw. 1080×1920.
    layout.screens = is4k
        ? screens.map(screen => ({
            ...screen,
            x: screen.x * 2,
            y: screen.y * 2,
            w: screen.w * 2,
            h: screen.h * 2
        }))
        : screens;

    return layout;
}

/**
 * Erzeugt dynamisch das vollständige Layout-Objekt für TrainDisplay und App.svelte.
 * Unterstützt Gesamtanzeigen, Multi-Monitor Pop-Outs (targetScreen) und die
 * vier Darstellungsvarianten (Full HD / 4K je Quer- und Hochformat).
 *
 * Kompatibilitäts-Adapter für `displayConfigStore`: löst das Preset auf und
 * delegiert an `createLayout`. `withBezel === false` entspricht dem Gehäuse
 * `none` (kein Rahmen, kein Steg).
 *
 * @param {string} [monitorId='zim2x32'] - Gewählter Monitor
 * @param {string} [layoutType='zuganzeiger'] - Gewählter DB-Anzeigetyp
 * @param {boolean} [withBezel=true] - Ob Gehäuse aktiv ist
 * @param {string|number|null} [targetScreen=null] - Ziel-Einzelschirm ('1', '2', '3' oder null für Gesamtanzeige)
 * @param {string|null} [boardVariantId=null] - 'fhd_landscape' | 'uhd_landscape' | 'fhd_portrait' | 'uhd_portrait'
 * @returns {object} Das konfigurierte Layout-Objekt
 */
export function generateActiveLayout(monitorId = 'zim2x32', layoutType = 'zuganzeiger', withBezel = true, targetScreen = null, boardVariantId = null) {
    const { preset } = resolvePresetProfile(monitorId);
    return createLayout({
        presetId: preset.id,
        layoutType,
        withBezel,
        variantId: boardVariantId,
        targetScreen
    });
}

/**
 * Erzeugt dynamisch das Layout für einen einzelnen Pop-Out-Monitor (?screen=1, ?screen=2, ?screen=3).
 * Garantiert 100% randlose, exakt passende Darstellung in der gewählten
 * Darstellungsvariante (Full HD / 4K, Quer- oder Hochformat).
 *
 * @param {string} [layoutType='zuganzeiger'] - 'zuganzeiger' | 'anschlusstafel' | 'anschlusstafel_zoom' | 'ankunftstafel' | 'wagenstand_gleis'
 * @param {string|number} [targetScreen='1'] - '1', '2' oder '3'
 * @param {string|null} [boardVariantId=null] - 'fhd_landscape' | 'uhd_landscape' | 'fhd_portrait' | 'uhd_portrait'
 * @returns {object} Layout-Objekt für den Einzelschirm
 */
export function generateTargetScreenLayout(layoutType = 'zuganzeiger', targetScreen = '1', boardVariantId = null) {
    const screenNum = parseInt(targetScreen, 10) || 1;
    // Die logischen Panelmaße stammen aus der Variante; der Canvas skaliert
    // für 4K mit ctx.scale(scale).
    const variantId = BOARD_VARIANTS[boardVariantId] ? boardVariantId : 'fhd_landscape';
    const variant = BOARD_VARIANTS[variantId];
    const sWidth = variant.panelW * variant.scale;
    const sHeight = variant.panelH * variant.scale;
    const scaleFactor = variant.scale;

    const layout = {
        id: `target_screen_${screenNum}_${variantId}_${layoutType}`,
        family: 'standard',
        width: sWidth,
        height: sHeight,
        scaleFactor,
        boardVariant: variantId,
        casingWidth: 0,
        casingHeight: 0,
        casingOffsetX: 0,
        casingOffsetY: 0,
        hasBezelGap: false,
        boardType: 'default',
        monitorId: `screen${screenNum}`,
        layoutType,
        screens: []
    };

    // 1. ZUGANZEIGER (Bahnsteig / Gleis)
    if (layoutType === 'zuganzeiger') {
        if (screenNum === 1) {
            // Screen 1: Hauptmonitor (große Schrift, Ziel, Vias, Reihung)
            layout.screens = [
                { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: sWidth, h: sHeight, trainIndex: 0 }
            ];
        } else if (screenNum === 2) {
            // Screen 2: 2x Nebenmonitor (Folgezug + Rotierend)
            layout.screens = [
                { id: 'nebenmonitor_1', type: 'neben', x: 0, y: 0, w: sWidth / 2, h: sHeight, trainIndex: 1 },
                { id: 'nebenmonitor_2', type: 'neben_rotierend', x: sWidth / 2, y: 0, w: sWidth / 2, h: sHeight }
            ];
        } else {
            // Screen 3: Weiterer Folgezug
            layout.screens = [
                { id: 'nebenmonitor_3', type: 'neben', x: 0, y: 0, w: sWidth / 2, h: sHeight, trainIndex: 2 },
                { id: 'nebenmonitor_4', type: 'neben_rotierend', x: sWidth / 2, y: 0, w: sWidth / 2, h: sHeight }
            ];
        }
    }
    // 2. ANSCHLUSSTAFEL (Abfahrten)
    else if (layoutType === 'anschlusstafel') {
        const colIdx = Math.max(0, screenNum - 1);
        layout.screens = [
            { id: `abfahrt_col${screenNum}`, type: 'abfahrt', x: 0, y: 0, w: sWidth, h: sHeight, colIndex: colIdx, maxCols: 3 }
        ];
    }
    // 2b. ANSCHLUSSTAFEL ZOOM (4 Zeilen / Bildschirm)
    else if (layoutType === 'anschlusstafel_zoom' || layoutType === 'anschlusstafel_zoom_icons') {
        const colIdx = Math.max(0, screenNum - 1);
        const showQualityIcons = layoutType === 'anschlusstafel_zoom_icons';
        layout.screens = [
            { id: `abfahrt_zoom_col${screenNum}`, type: 'abfahrt_zoom', x: 0, y: 0, w: sWidth, h: sHeight, colIndex: colIdx, maxCols: 3, maxRows: 4, showQualityIcons }
        ];
    }
    // 3. ANKUNFTSTAFEL (Ankünfte)
    else if (layoutType === 'ankunftstafel') {
        const colIdx = Math.max(0, screenNum - 1);
        layout.screens = [
            { id: `ankunft_col${screenNum}`, type: 'ankunft', x: 0, y: 0, w: sWidth, h: sHeight, colIndex: colIdx, maxCols: 3 }
        ];
    }
    // 4. WAGENSTANDSANZEIGER (Gleis-Vitrine)
    else if (layoutType === 'wagenstand_gleis') {
        if (screenNum === 1) {
            layout.screens = [
                { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: sWidth, h: sHeight, trainIndex: 0 }
            ];
        } else {
            layout.screens = [
                { id: 'vitrine_main', type: 'vitrine32', x: 0, y: 0, w: sWidth, h: sHeight, trainIndex: 0 }
            ];
        }
    }

    // Varianten-ID an jeden Screen stempeln (Renderer wählen darüber ihre Tokens).
    layout.screens = layout.screens.map(screen => ({ ...screen, variant: variantId }));

    return layout;
}
