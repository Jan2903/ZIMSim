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

    // Voranzeiger (Nativ 1080p, dynamische Abfahrtstafel)
    voranzeiger: {
        family: 'voranzeiger',
        width: 1920,
        height: 1080,
        casingWidth: 2460,
        casingHeight: 1600,
        casingOffsetX: 270,
        casingOffsetY: 260,
        boardType: 'default',
        screens: [
            { id: 'voranzeiger_main', type: 'voranzeiger', x: 0, y: 0, w: 1920, h: 1080 }
        ]
    },

    // Voranzeiger Links + Wagenstand Rechts (Doppelmonitor Kombi)
    voranzeiger_and_formation: {
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
            { id: 'voranzeiger_left', type: 'voranzeiger', x: 0, y: 0, w: 1920, h: 1080 },
            { id: 'vitrine_right', type: 'vitrine32', x: 1970, y: 0, w: 1920, h: 1080, trainIndex: 0 }
        ]
    },

    // ZIM-Vitrine 32" Wagenstandsanzeiger (Nativ 1080p)
    zimvitrine32wagenstand: {
        family: 'vitrine',
        width: 1920,
        height: 1080,
        casingWidth: 2120,
        casingHeight: 1380,
        casingOffsetX: 100,
        casingOffsetY: 100,
        boardType: 'default',
        screens: [
            { id: 'vitrine_main', type: 'vitrine32', x: 0, y: 0, w: 1920, h: 1080, trainIndex: 0 }
        ]
    },

    // ZIMwide (2560×1080 gestreckter Bar-Type)
    zimwide: {
        family: 'stretched',
        width: 2560,
        height: 1080,
        casingWidth: 2760,
        casingHeight: 1260,
        casingOffsetX: 100,
        casingOffsetY: 90,
        boardType: 'default',
        screens: [
            { id: 'wide_main', type: 'voranzeiger', x: 0, y: 0, w: 2560, h: 1080 }
        ]
    },

    // ZIMultrawide (3840×1080 nahtloses 32:9 Panel)
    zimultrawide: {
        family: 'stretched',
        width: 3840,
        height: 1080,
        casingWidth: 4040,
        casingHeight: 1260,
        casingOffsetX: 100,
        casingOffsetY: 90,
        boardType: 'default',
        screens: [
            { id: 'ultrawide_main', type: 'voranzeiger', x: 0, y: 0, w: 3840, h: 1080 }
        ]
    },

    // ZIMvitrine 65h (1080×1920 Portrait Aushangstele)
    zimvitrine65h: {
        family: 'stele',
        width: 1080,
        height: 1920,
        casingWidth: 1240,
        casingHeight: 2220,
        casingOffsetX: 80,
        casingOffsetY: 100,
        boardType: 'default',
        screens: [
            { id: 'stele_main', type: 'voranzeiger', x: 0, y: 0, w: 1080, h: 1920 }
        ]
    }
};