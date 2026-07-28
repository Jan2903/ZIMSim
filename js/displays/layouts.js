export const LAYOUTS = {
    standard: {
        width: 4800, 
        height: 2676,
        backgroundUrl: 'images/layouts/standard_bg.jpg', // Optionales Hintergrundbild
        boardType: 'default',
        screens: [
            { id: 'hauptmonitor', type: 'haupt', x: 450, y: 680, w: 1920, h: 1080, trainIndex: 0 },
            { id: 'nebenmonitor_1', type: 'neben', x: 470 + 1920 + 30, y: 680, w: 960, h: 1080, trainIndex: 1 },
            { id: 'nebenmonitor_2', type: 'neben_rotierend', x: 470 + 1920 + 30 + 960, y: 680, w: 960, h: 1080 }
        ]
    },
    voranzeiger: {
        width: 2120, // 1920 + 200px Rand
        height: 1280, // 1080 + 200px Rand
        backgroundUrl: 'images/layouts/voranzeiger_bg.png', // Optionales Hintergrundbild
        boardType: 'default',
        screens: [
            // 6 Listen-Zeilen untereinander, jeweils 180px hoch
            { id: 'row1', type: 'liste', x: 100, y: 100, w: 1920, h: 180, trainIndex: 0 },
            { id: 'row2', type: 'liste', x: 100, y: 280, w: 1920, h: 180, trainIndex: 1 },
            { id: 'row3', type: 'liste', x: 100, y: 460, w: 1920, h: 180, trainIndex: 2 },
            { id: 'row4', type: 'liste', x: 100, y: 640, w: 1920, h: 180, trainIndex: 3 },
            { id: 'row5', type: 'liste', x: 100, y: 820, w: 1920, h: 180, trainIndex: 4 },
            { id: 'row6', type: 'liste', x: 100, y: 1000, w: 1920, h: 180, trainIndex: 5 }
        ]
    },
    zimvitrine32wagenstand: {
        width: 2120, // 1920 + 200px Rand
        height: 1280, // 1080 + 200px Rand
        backgroundUrl: 'images/layouts/voranzeiger_bg.png', // We can reuse the voranzeiger_bg if it has a generic border
        boardType: 'default',
        screens: [
            { id: 'vitrine_main', type: 'vitrine32', x: 100, y: 100, w: 1920, h: 1080, trainIndex: 0 }
        ]
    }
};