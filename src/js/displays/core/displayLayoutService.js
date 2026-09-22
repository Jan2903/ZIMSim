// js/displays/core/displayLayoutService.js

/**
 * Service zur dynamischen Generierung von Layout-Objekten
 * basierend auf der Kreuzung von Hardware-Monitor und DB-Anzeigetyp.
 */

export const MONITOR_PROFILES = [
    { id: 'zim2x32', name: 'ZIM 2×32" / 2×43" Doppel', defaultW: 3890, framelessW: 3840, h: 1080, casingW: 4430, casingH: 1600, offX: 270, offY: 260, hasBezelGap: true, gapWidth: 50, gapX: 1920, family: 'standard' },
    { id: 'zim3x32', name: 'ZIM 3×32" Triple', defaultW: 5860, framelessW: 5760, h: 1080, casingW: 6400, casingH: 1600, offX: 270, offY: 260, hasBezelGap: true, gapWidth: 50, gaps: [1920, 3940], family: 'standard' },
    { id: 'zim32_single', name: 'ZIM 32" / 43" / 46" Einzel', defaultW: 1920, framelessW: 1920, h: 1080, casingW: 2460, casingH: 1600, offX: 270, offY: 260, hasBezelGap: false, family: 'standard' },
    { id: 'zimvitrine32', name: 'ZIMvitrine 32" Stand', defaultW: 1920, framelessW: 1920, h: 1080, casingW: 2120, casingH: 1380, offX: 100, offY: 100, hasBezelGap: false, family: 'vitrine' },
    { id: 'zimvitrine65h', name: 'ZIMvitrine 65h Stele (9:16)', defaultW: 1080, framelessW: 1080, h: 1920, casingW: 1240, casingH: 2220, offX: 80, offY: 100, hasBezelGap: false, family: 'stele' },
    { id: 'zimwide', name: 'ZIMwide Bar-Type (21:9)', defaultW: 2560, framelessW: 2560, h: 1080, casingW: 2760, casingH: 1260, offX: 100, offY: 90, hasBezelGap: false, family: 'stretched' },
    { id: 'zimultrawide', name: 'ZIMultrawide (32:9 nahtlos)', defaultW: 3840, framelessW: 3840, h: 1080, casingW: 4040, casingH: 1260, offX: 100, offY: 90, hasBezelGap: false, family: 'stretched' },
];

export const LAYOUT_TYPES = [
    { id: 'zuganzeiger', name: 'Zuganzeiger (Bahnsteig / Gleis)' },
    { id: 'anschlusstafel', name: 'Anschlusstafel (Nur Abfahrten)' },
    { id: 'ankunftstafel', name: 'Ankunftstafel (Nur Ankünfte)' },
    { id: 'wagenreihungsplan', name: 'Digitaler Wagenreihungsplan' },
    { id: 'wagenstand_gleis', name: 'Wagenstandsanzeiger (Gleis)' },
    { id: 'anschlusstafel_zoom', name: 'Anschlusstafel Zoom 4× (Großes Gleis)' },
    { id: 'anschlusstafel_zoom_icons', name: 'Anschlusstafel Zoom 4× (mit Qualitätsmerkmalen)' }
];

/**
 * Erzeugt dynamisch das vollständige Layout-Objekt für TrainDisplay und App.svelte.
 * Unterstützt Gesamtanzeigen, Multi-Monitor Pop-Outs (targetScreen) und 4K Ultra-HD.
 * 
 * @param {string} [monitorId='zim2x32'] - Gewählter Monitor
 * @param {string} [layoutType='zuganzeiger'] - Gewählter DB-Anzeigetyp
 * @param {boolean} [withBezel=true] - Ob Gehäuse aktiv ist
 * @param {string|number|null} [targetScreen=null] - Ziel-Einzelschirm ('1', '2', '3' oder null für Gesamtanzeige)
 * @param {boolean} [is4k=false] - Ob 4K Ultra-HD Skalierung aktiv ist
 * @returns {object} Das konfigurierte Layout-Objekt
 */
export function generateActiveLayout(monitorId = 'zim2x32', layoutType = 'zuganzeiger', withBezel = true, targetScreen = null, is4k = false) {
    // ----------------------------------------------------
    // Multi-Monitor Pop-Outs (?screen=1, ?screen=2, ?screen=3)
    // Rendern exakt einen Einzelschirm in nativer Auflösung ohne Gehäuseränder
    // ----------------------------------------------------
    if (targetScreen) {
        return generateTargetScreenLayout(layoutType, targetScreen, is4k);
    }

    const prof = MONITOR_PROFILES.find(p => p.id === monitorId) || MONITOR_PROFILES[0];
    const scaleFactor = is4k ? 2.0 : 1.0;
    const baseW = withBezel ? prof.defaultW : prof.framelessW;
    const baseH = prof.h;
    const width = is4k ? baseW * 2 : baseW;
    const height = is4k ? baseH * 2 : baseH;

    const layout = {
        id: `${prof.id}_${is4k ? '4k_' : ''}${layoutType}`,
        family: prof.family,
        width,
        height,
        scaleFactor,
        casingWidth: is4k ? prof.casingW * 2 : prof.casingW,
        casingHeight: is4k ? prof.casingH * 2 : prof.casingH,
        casingOffsetX: is4k ? prof.offX * 2 : prof.offX,
        casingOffsetY: is4k ? prof.offY * 2 : prof.offY,
        hasBezelGap: withBezel && prof.hasBezelGap,
        gapWidth: prof.gapWidth ? (is4k ? prof.gapWidth * 2 : prof.gapWidth) : 0,
        gapX: prof.gapX ? (is4k ? prof.gapX * 2 : prof.gapX) : 1920,
        gaps: prof.gaps ? prof.gaps.map(g => is4k ? g * 2 : g) : undefined,
        boardType: 'default',
        monitorId: prof.id,
        layoutType,
        screens: []
    };

    // ========================================================
    // 1. ANZEIGETYP: ZUGANZEIGER (Bahnsteig / Gleisanzeige)
    // ========================================================
    if (layoutType === 'zuganzeiger') {
        if (prof.id === 'zim2x32') {
            const slot2X = withBezel ? 1970 : 1920;
            layout.screens = [
                { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: 1920, h: 1080, trainIndex: 0 },
                { id: 'nebenmonitor_1', type: 'neben', x: slot2X, y: 0, w: 960, h: 1080, trainIndex: 1 },
                { id: 'nebenmonitor_2', type: 'neben_rotierend', x: slot2X + 960, y: 0, w: 960, h: 1080 }
            ];
        } else if (prof.id === 'zim3x32') {
            const slot2X = withBezel ? 1970 : 1920;
            const slot3X = withBezel ? 3940 : 3840;
            layout.screens = [
                { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: 1920, h: 1080, trainIndex: 0 },
                { id: 'nebenmonitor_1', type: 'neben', x: slot2X, y: 0, w: 960, h: 1080, trainIndex: 1 },
                { id: 'nebenmonitor_2', type: 'neben_rotierend', x: slot2X + 960, y: 0, w: 960, h: 1080 },
                { id: 'nebenmonitor_3', type: 'neben', x: slot3X, y: 0, w: 960, h: 1080, trainIndex: 2 },
                { id: 'nebenmonitor_4', type: 'neben_rotierend', x: slot3X + 960, y: 0, w: 960, h: 1080 }
            ];
        } else if (prof.id === 'zimultrawide') {
            layout.screens = [
                { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: 1920, h: 1080, trainIndex: 0 },
                { id: 'nebenmonitor_1', type: 'neben', x: 1920, y: 0, w: 960, h: 1080, trainIndex: 1 },
                { id: 'nebenmonitor_2', type: 'neben_rotierend', x: 2880, y: 0, w: 960, h: 1080 }
            ];
        } else if (prof.id === 'zimvitrine65h') {
            // Stele Hochkant: Zeigt Wagenreihungsplan mit Reihung & Sektoren
            layout.screens = [
                { id: 'stele_zuganzeiger', type: 'wagenreihung_plan', x: 0, y: 0, w: 1080, h: 1920, planOffset: 0 }
            ];
        } else {
            // Einzelmonitore (zim32_single, zimvitrine32, zimwide)
            layout.screens = [
                { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: width, h: 1080, trainIndex: 0 }
            ];
        }
    }

    // ========================================================
    // 2. ANZEIGETYP: ANSCHLUSSTAFEL (Nur Abfahrten)
    // ========================================================
    else if (layoutType === 'anschlusstafel') {
        if (prof.id === 'zim2x32') {
            // 2 Spalten nebeneinander
            const slot2X = withBezel ? 1970 : 1920;
            layout.screens = [
                { id: 'abfahrt_col1', type: 'abfahrt', x: 0, y: 0, w: 1920, h: 1080, colIndex: 0, maxCols: 2 },
                { id: 'abfahrt_col2', type: 'abfahrt', x: slot2X, y: 0, w: 1920, h: 1080, colIndex: 1, maxCols: 2 }
            ];
        } else if (prof.id === 'zim3x32') {
            // 3 Spalten nebeneinander (3x Voranzeiger!)
            const slot2X = withBezel ? 1970 : 1920;
            const slot3X = withBezel ? 3940 : 3840;
            layout.screens = [
                { id: 'abfahrt_col1', type: 'abfahrt', x: 0, y: 0, w: 1920, h: 1080, colIndex: 0, maxCols: 3 },
                { id: 'abfahrt_col2', type: 'abfahrt', x: slot2X, y: 0, w: 1920, h: 1080, colIndex: 1, maxCols: 3 },
                { id: 'abfahrt_col3', type: 'abfahrt', x: slot3X, y: 0, w: 1920, h: 1080, colIndex: 2, maxCols: 3 }
            ];
        } else if (prof.id === 'zimultrawide') {
            layout.screens = [
                { id: 'abfahrt_col1', type: 'abfahrt', x: 0, y: 0, w: 1920, h: 1080, colIndex: 0, maxCols: 2 },
                { id: 'abfahrt_col2', type: 'abfahrt', x: 1920, y: 0, w: 1920, h: 1080, colIndex: 1, maxCols: 2 }
            ];
        } else if (prof.id === 'zimwide') {
            // Gestrecktes 21:9 Panel: 2 kompakte Spalten
            const colW = 1280;
            layout.screens = [
                { id: 'abfahrt_col1', type: 'abfahrt', x: 0, y: 0, w: colW, h: 1080, colIndex: 0, maxCols: 2 },
                { id: 'abfahrt_col2', type: 'abfahrt', x: colW, y: 0, w: colW, h: 1080, colIndex: 1, maxCols: 2 }
            ];
        } else if (prof.id === 'zimvitrine65h') {
            // 1 vertikale Spalte mit bis zu 18-20 Abfahrten
            layout.screens = [
                { id: 'abfahrt_stele', type: 'abfahrt_portrait', x: 0, y: 0, w: 1080, h: 1920, maxRows: 18 }
            ];
        } else {
            // 1 Standard-Spalte (zim32_single, zimvitrine32)
            layout.screens = [
                { id: 'abfahrt_single', type: 'abfahrt', x: 0, y: 0, w: width, h: 1080, colIndex: 0, maxCols: 1 }
            ];
        }
    }

    // ========================================================
    // 3. ANZEIGETYP: ANKUNFTSTAFEL (Nur Ankünfte)
    // ========================================================
    else if (layoutType === 'ankunftstafel') {
        if (prof.id === 'zim2x32') {
            const slot2X = withBezel ? 1970 : 1920;
            layout.screens = [
                { id: 'ankunft_col1', type: 'ankunft', x: 0, y: 0, w: 1920, h: 1080, colIndex: 0, maxCols: 2 },
                { id: 'ankunft_col2', type: 'ankunft', x: slot2X, y: 0, w: 1920, h: 1080, colIndex: 1, maxCols: 2 }
            ];
        } else if (prof.id === 'zim3x32') {
            const slot2X = withBezel ? 1970 : 1920;
            const slot3X = withBezel ? 3940 : 3840;
            layout.screens = [
                { id: 'ankunft_col1', type: 'ankunft', x: 0, y: 0, w: 1920, h: 1080, colIndex: 0, maxCols: 3 },
                { id: 'ankunft_col2', type: 'ankunft', x: slot2X, y: 0, w: 1920, h: 1080, colIndex: 1, maxCols: 3 },
                { id: 'ankunft_col3', type: 'ankunft', x: slot3X, y: 0, w: 1920, h: 1080, colIndex: 2, maxCols: 3 }
            ];
        } else if (prof.id === 'zimultrawide') {
            layout.screens = [
                { id: 'ankunft_col1', type: 'ankunft', x: 0, y: 0, w: 1920, h: 1080, colIndex: 0, maxCols: 2 },
                { id: 'ankunft_col2', type: 'ankunft', x: 1920, y: 0, w: 1920, h: 1080, colIndex: 1, maxCols: 2 }
            ];
        } else if (prof.id === 'zimwide') {
            const colW = 1280;
            layout.screens = [
                { id: 'ankunft_col1', type: 'ankunft', x: 0, y: 0, w: colW, h: 1080, colIndex: 0, maxCols: 2 },
                { id: 'ankunft_col2', type: 'ankunft', x: colW, y: 0, w: colW, h: 1080, colIndex: 1, maxCols: 2 }
            ];
        } else if (prof.id === 'zimvitrine65h') {
            // 20 Zeilen Ankünfte untereinander
            layout.screens = [
                { id: 'ankunft_stele', type: 'ankunft_portrait', x: 0, y: 0, w: 1080, h: 1920, maxRows: 20 }
            ];
        } else {
            layout.screens = [
                { id: 'ankunft_single', type: 'ankunft', x: 0, y: 0, w: width, h: 1080, colIndex: 0, maxCols: 1 }
            ];
        }
    }

    // ========================================================
    // 4. ANZEIGETYP: DIGITALER WAGENREIHUNGSPLAN
    // ========================================================
    else if (layoutType === 'wagenreihungsplan') {
        if (prof.id === 'zim2x32') {
            const slot2X = withBezel ? 1970 : 1920;
            layout.screens = [
                { id: 'plan_col1', type: 'wagenreihung_plan', x: 0, y: 0, w: 1920, h: 1080, planOffset: 0 },
                { id: 'plan_col2', type: 'wagenreihung_plan', x: slot2X, y: 0, w: 1920, h: 1080, planOffset: 4 }
            ];
        } else if (prof.id === 'zim3x32') {
            const slot2X = withBezel ? 1970 : 1920;
            const slot3X = withBezel ? 3940 : 3840;
            layout.screens = [
                { id: 'plan_col1', type: 'wagenreihung_plan', x: 0, y: 0, w: 1920, h: 1080, planOffset: 0 },
                { id: 'plan_col2', type: 'wagenreihung_plan', x: slot2X, y: 0, w: 1920, h: 1080, planOffset: 4 },
                { id: 'plan_col3', type: 'wagenreihung_plan', x: slot3X, y: 0, w: 1920, h: 1080, planOffset: 8 }
            ];
        } else {
            // Einzelbildschirm / Vitrine 32 / Stele 65h
            layout.screens = [
                { id: 'plan_main', type: 'wagenreihung_plan', x: 0, y: 0, w: width, h: height, planOffset: 0 }
            ];
        }
    // ========================================================
    // 5. ANZEIGETYP: WAGENSTANDSANZEIGER (Gleis-Vitrine / Kombi)
    // ========================================================
    } else if (layoutType === 'wagenstand_gleis') {
        if (prof.id === 'zim2x32') {
            // Klassische DB-Bahnsteigkombination: Links Zuganzeiger, Rechts 32" Wagenstandsanzeiger
            const slot2X = withBezel ? 1970 : 1920;
            layout.screens = [
                { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: 1920, h: 1080, trainIndex: 0 },
                { id: 'vitrine_right', type: 'vitrine32', x: slot2X, y: 0, w: 1920, h: 1080, trainIndex: 0 }
            ];
        } else if (prof.id === 'zim3x32') {
            // Triple: Haupt + Neben + Wagenstand
            const slot2X = withBezel ? 1970 : 1920;
            const slot3X = withBezel ? 3940 : 3840;
            layout.screens = [
                { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: 1920, h: 1080, trainIndex: 0 },
                { id: 'nebenmonitor_1', type: 'neben', x: slot2X, y: 0, w: 960, h: 1080, trainIndex: 1 },
                { id: 'nebenmonitor_2', type: 'neben_rotierend', x: slot2X + 960, y: 0, w: 960, h: 1080 },
                { id: 'vitrine_right', type: 'vitrine32', x: slot3X, y: 0, w: 1920, h: 1080, trainIndex: 0 }
            ];
        } else if (prof.id === 'zimvitrine65h') {
            // Hochkant-Stele: Zeigt den digitalen Wagenreihungsplan
            layout.screens = [
                { id: 'stele_plan', type: 'wagenreihung_plan', x: 0, y: 0, w: 1080, h: 1920, planOffset: 0 }
            ];
        } else {
            // Einzelmonitor (zimvitrine32, zim32_single, zimwide, etc.)
            layout.screens = [
                { id: 'vitrine_main', type: 'vitrine32', x: 0, y: 0, w: width, h: height, trainIndex: 0 }
            ];
        }
    }

    // ========================================================
    // 6. ANZEIGETYP: ANSCHLUSSTAFEL ZOOM (4 Zeilen pro FullHD-Bildschirm)
    // ========================================================
    else if (layoutType === 'anschlusstafel_zoom' || layoutType === 'anschlusstafel_zoom_icons') {
        const showQualityIcons = layoutType === 'anschlusstafel_zoom_icons';
        if (prof.id === 'zim2x32') {
            // 2 Spalten nebeneinander – je 4 große Abfahrtszeilen pro Bildschirm
            const slot2X = withBezel ? 1970 : 1920;
            layout.screens = [
                { id: 'abfahrt_zoom_col1', type: 'abfahrt_zoom', x: 0, y: 0, w: 1920, h: 1080, colIndex: 0, maxCols: 2, maxRows: 4, showQualityIcons },
                { id: 'abfahrt_zoom_col2', type: 'abfahrt_zoom', x: slot2X, y: 0, w: 1920, h: 1080, colIndex: 1, maxCols: 2, maxRows: 4, showQualityIcons }
            ];
        } else if (prof.id === 'zim3x32') {
            // 3 Spalten nebeneinander – je 4 große Abfahrtszeilen pro Bildschirm
            const slot2X = withBezel ? 1970 : 1920;
            const slot3X = withBezel ? 3940 : 3840;
            layout.screens = [
                { id: 'abfahrt_zoom_col1', type: 'abfahrt_zoom', x: 0, y: 0, w: 1920, h: 1080, colIndex: 0, maxCols: 3, maxRows: 4, showQualityIcons },
                { id: 'abfahrt_zoom_col2', type: 'abfahrt_zoom', x: slot2X, y: 0, w: 1920, h: 1080, colIndex: 1, maxCols: 3, maxRows: 4, showQualityIcons },
                { id: 'abfahrt_zoom_col3', type: 'abfahrt_zoom', x: slot3X, y: 0, w: 1920, h: 1080, colIndex: 2, maxCols: 3, maxRows: 4, showQualityIcons }
            ];
        } else if (prof.id === 'zimvitrine65h') {
            // Stele Hochkant: 8 große Zeilen (entspricht 4 auf FullHD-Verhältnis)
            layout.screens = [
                { id: 'abfahrt_zoom_stele', type: 'abfahrt_portrait', x: 0, y: 0, w: 1080, h: 1920, maxRows: 8, showQualityIcons }
            ];
        } else {
            // Einzelmonitor (zim32_single, zimvitrine32, zimwide, zimultrawide)
            layout.screens = [
                { id: 'abfahrt_zoom_single', type: 'abfahrt_zoom', x: 0, y: 0, w: width, h: 1080, colIndex: 0, maxCols: 1, maxRows: 4, showQualityIcons }
            ];
        }
    }

    return layout;
}

/**
 * Erzeugt dynamisch das Layout für einen einzelnen Pop-Out-Monitor (?screen=1, ?screen=2, ?screen=3).
 * Garantiert 100% randlose, exakt passende Darstellung in 1080p oder 4K Ultra-HD.
 * 
 * @param {string} [layoutType='zuganzeiger'] - 'zuganzeiger' | 'anschlusstafel' | 'anschlusstafel_zoom' | 'ankunftstafel' | 'wagenreihungsplan' | 'wagenstand_gleis'
 * @param {string|number} [targetScreen='1'] - '1', '2' oder '3'
 * @param {boolean} [is4k=false] - 4K Ultra-HD Skalierungs-Flag
 * @returns {object} Layout-Objekt für den Einzelschirm
 */
export function generateTargetScreenLayout(layoutType = 'zuganzeiger', targetScreen = '1', is4k = false) {
    const screenNum = parseInt(targetScreen, 10) || 1;
    const sWidth = is4k ? 3840 : 1920;
    const sHeight = is4k ? 2160 : 1080;
    const scaleFactor = is4k ? 2.0 : 1.0;

    const layout = {
        id: `target_screen_${screenNum}_${is4k ? '4k_' : ''}${layoutType}`,
        family: 'standard',
        width: sWidth,
        height: sHeight,
        scaleFactor,
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
    // 4. WAGENREIHUNGSPLAN
    else if (layoutType === 'wagenreihungsplan') {
        const offset = (screenNum - 1) * 4;
        layout.screens = [
            { id: `plan_col${screenNum}`, type: 'wagenreihung_plan', x: 0, y: 0, w: sWidth, h: sHeight, planOffset: offset }
        ];
    }
    // 5. WAGENSTANDSANZEIGER (Gleis-Vitrine)
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

    return layout;
}
