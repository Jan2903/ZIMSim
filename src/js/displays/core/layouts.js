export const LAYOUTS = {
    // Standard Doppelmonitor mit DB-Gehäuse (Web-Vorschau mit 50px Trennsteg zwischen Monitor 1 und 2)
    standard: {
        family: 'standard',
        width: 3890, 
        height: 1080,
        hasBezelGap: true,
        gapWidth: 50,
        gapX: 1920,
        casingWidth: 4430,
        casingHeight: 1600,
        casingOffsetX: 270,
        casingOffsetY: 260,
        boardType: 'default',
        screens: [
            { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: 1920, h: 1080, trainIndex: 0 },
            { id: 'nebenmonitor_1', type: 'neben', x: 1970, y: 0, w: 960, h: 1080, trainIndex: 1 },
            { id: 'nebenmonitor_2', type: 'neben_rotierend', x: 2930, y: 0, w: 960, h: 1080 }
        ]
    },

    // Standard Doppelmonitor randlos (2x 1080p nebeneinander = 3840x1080, nativ & 100% bezel-free für Vollbild/Kiosk)
    standard_frameless: {
        family: 'standard',
        width: 3840, 
        height: 1080,
        hasBezelGap: false,
        boardType: 'default',
        screens: [
            { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: 1920, h: 1080, trainIndex: 0 },
            { id: 'nebenmonitor_1', type: 'neben', x: 1920, y: 0, w: 960, h: 1080, trainIndex: 1 },
            { id: 'nebenmonitor_2', type: 'neben_rotierend', x: 2880, y: 0, w: 960, h: 1080 }
        ]
    },

    // Triple-Monitor mit DB-Gehäuse (3 Monitore nebeneinander: Haupt + 2x Neben mit je 50px Steg)
    standard_3screen: {
        family: 'standard',
        width: 5860, 
        height: 1080,
        hasBezelGap: true,
        gapWidth: 50,
        casingWidth: 6400,
        casingHeight: 1600,
        casingOffsetX: 270,
        casingOffsetY: 260,
        boardType: 'default',
        screens: [
            { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: 1920, h: 1080, trainIndex: 0 },
            { id: 'nebenmonitor_1', type: 'neben', x: 1970, y: 0, w: 960, h: 1080, trainIndex: 1 },
            { id: 'nebenmonitor_2', type: 'neben_rotierend', x: 2930, y: 0, w: 960, h: 1080 },
            { id: 'nebenmonitor_3', type: 'neben', x: 3940, y: 0, w: 960, h: 1080, trainIndex: 2 },
            { id: 'nebenmonitor_4', type: 'neben_rotierend', x: 4900, y: 0, w: 960, h: 1080 }
        ]
    },

    // Triple-Monitor randlos (3x 1080p nebeneinander = 5760x1080 für Ultrawide 32:9 / Kiosk)
    standard_3screen_frameless: {
        family: 'standard',
        width: 5760, 
        height: 1080,
        hasBezelGap: false,
        boardType: 'default',
        screens: [
            { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: 1920, h: 1080, trainIndex: 0 },
            { id: 'nebenmonitor_1', type: 'neben', x: 1920, y: 0, w: 960, h: 1080, trainIndex: 1 },
            { id: 'nebenmonitor_2', type: 'neben_rotierend', x: 2880, y: 0, w: 960, h: 1080 },
            { id: 'nebenmonitor_3', type: 'neben', x: 3840, y: 0, w: 960, h: 1080, trainIndex: 2 },
            { id: 'nebenmonitor_4', type: 'neben_rotierend', x: 4800, y: 0, w: 960, h: 1080 }
        ]
    },

    // Einzelschirm: Hauptmonitor (1080p)
    standard_screen1: {
        family: 'standard',
        width: 1920,
        height: 1080,
        casingWidth: 2460,
        casingHeight: 1600,
        casingOffsetX: 270,
        casingOffsetY: 260,
        boardType: 'default',
        screens: [
            { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: 1920, h: 1080, trainIndex: 0 }
        ]
    },

    // Einzelschirm: Nebenmonitore (1080p, geteilt in 2x 960px)
    standard_screen2: {
        family: 'standard',
        width: 1920,
        height: 1080,
        boardType: 'default',
        screens: [
            { id: 'nebenmonitor_1', type: 'neben', x: 0, y: 0, w: 960, h: 1080, trainIndex: 1 },
            { id: 'nebenmonitor_2', type: 'neben_rotierend', x: 960, y: 0, w: 960, h: 1080 }
        ]
    },

    // Einzelschirm: Optionaler 3. Monitor (1080p)
    standard_screen3: {
        family: 'standard',
        width: 1920,
        height: 1080,
        boardType: 'default',
        screens: [
            { id: 'nebenmonitor_3', type: 'neben', x: 0, y: 0, w: 960, h: 1080, trainIndex: 2 },
            { id: 'nebenmonitor_4', type: 'neben_rotierend', x: 960, y: 0, w: 960, h: 1080 }
        ]
    },

    // 4K Ultra-HD Doppelmonitor (2x 4K = 7680x2160)
    standard_4k: {
        family: 'standard',
        width: 7680,
        height: 2160,
        scaleFactor: 2.0,
        boardType: 'default',
        screens: [
            { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: 3840, h: 2160, trainIndex: 0 },
            { id: 'nebenmonitor_1', type: 'neben', x: 3840, y: 0, w: 1920, h: 2160, trainIndex: 1 },
            { id: 'nebenmonitor_2', type: 'neben_rotierend', x: 5760, y: 0, w: 1920, h: 2160 }
        ]
    },

    // 4K Einzelschirm: Hauptmonitor (3840x2160)
    standard_4k_screen1: {
        family: 'standard',
        width: 3840,
        height: 2160,
        scaleFactor: 2.0,
        boardType: 'default',
        screens: [
            { id: 'hauptmonitor', type: 'haupt', x: 0, y: 0, w: 3840, h: 2160, trainIndex: 0 }
        ]
    },

    // 4K Einzelschirm: Nebenmonitore (3840x2160)
    standard_4k_screen2: {
        family: 'standard',
        width: 3840,
        height: 2160,
        scaleFactor: 2.0,
        boardType: 'default',
        screens: [
            { id: 'nebenmonitor_1', type: 'neben', x: 0, y: 0, w: 1920, h: 2160, trainIndex: 1 },
            { id: 'nebenmonitor_2', type: 'neben_rotierend', x: 1920, y: 0, w: 1920, h: 2160 }
        ]
    },

    // Voranzeiger (Nativ 1080p, 6 Zeilen je 180px)
    voranzeiger: {
        width: 1920,
        height: 1080,
        boardType: 'default',
        screens: [
            // 6 Listen-Zeilen untereinander, jeweils 180px hoch
            { id: 'row1', type: 'liste', x: 0, y: 0, w: 1920, h: 180, trainIndex: 0 },
            { id: 'row2', type: 'liste', x: 0, y: 180, w: 1920, h: 180, trainIndex: 1 },
            { id: 'row3', type: 'liste', x: 0, y: 360, w: 1920, h: 180, trainIndex: 2 },
            { id: 'row4', type: 'liste', x: 0, y: 540, w: 1920, h: 180, trainIndex: 3 },
            { id: 'row5', type: 'liste', x: 0, y: 720, w: 1920, h: 180, trainIndex: 4 },
            { id: 'row6', type: 'liste', x: 0, y: 900, w: 1920, h: 180, trainIndex: 5 }
        ]
    },

    // ZIM-Vitrine 32" Wagenstandsanzeiger (Nativ 1080p)
    zimvitrine32wagenstand: {
        width: 1920,
        height: 1080,
        boardType: 'default',
        screens: [
            { id: 'vitrine_main', type: 'vitrine32', x: 0, y: 0, w: 1920, h: 1080, trainIndex: 0 }
        ]
    }
};