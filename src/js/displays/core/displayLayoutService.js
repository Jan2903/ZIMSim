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
    { id: 'wagenreihungsplan', name: 'Digitaler Wagenreihungsplan' }
];

/**
 * Erzeugt dynamisch das vollständige Layout-Objekt für TrainDisplay und App.svelte.
 * @param {string} monitorId - Gewählter Monitor
 * @param {string} layoutType - Gewählter DB-Anzeigetyp
 * @param {boolean} withBezel - Ob Gehäuse aktiv ist
 * @returns {object} Das konfigurierte Layout-Objekt
 */
export function generateActiveLayout(monitorId = 'zim2x32', layoutType = 'zuganzeiger', withBezel = true) {
    const prof = MONITOR_PROFILES.find(p => p.id === monitorId) || MONITOR_PROFILES[0];
    const width = withBezel ? prof.defaultW : prof.framelessW;
    const height = prof.h;

    const layout = {
        id: `${prof.id}_${layoutType}`,
        family: prof.family,
        width,
        height,
        casingWidth: prof.casingW,
        casingHeight: prof.casingH,
        casingOffsetX: prof.offX,
        casingOffsetY: prof.offY,
        hasBezelGap: withBezel && prof.hasBezelGap,
        gapWidth: prof.gapWidth,
        gapX: prof.gapX,
        gaps: prof.gaps,
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
            // Stele Hochkant: Zeigt Wagenreihungsplan mit Reihung & Sektoren (wie media_1789984220426.png)
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
            // 2 Spalten nebeneinander (wie media_1789984220415.png)
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
            // 20 Zeilen Ankünfte untereinander (1:1 wie media_1789984220412.png!)
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
            // Einzelbildschirm / Vitrine 32 / Stele 65h (wie media_1789984220426.png)
            layout.screens = [
                { id: 'plan_main', type: 'wagenreihung_plan', x: 0, y: 0, w: width, h: height, planOffset: 0 }
            ];
        }
    }

    return layout;
}
