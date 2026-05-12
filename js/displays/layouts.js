export const LAYOUTS = {
    standard: {
        width: 4140, 
        height: 1280,
        screens: [
            { id: 'hauptmonitor', type: 'haupt', x: 100, y: 100, w: 1920, h: 1080, trainIndex: 0 },
            { id: 'nebenmonitor_1', type: 'neben', x: 2120, y: 100, w: 960, h: 1080, trainIndex: 1 },
            { id: 'nebenmonitor_2', type: 'neben_rotierend', x: 3080, y: 100, w: 960, h: 1080 }
        ]
    },
    voranzeiger: {
        width: 2120, // 1920 + 200px Rand
        height: 1280, // 1080 + 200px Rand
        screens: [
            // 6 Listen-Zeilen untereinander, jeweils 180px hoch
            { id: 'row1', type: 'liste', x: 100, y: 100, w: 1920, h: 180, trainIndex: 0 },
            { id: 'row2', type: 'liste', x: 100, y: 280, w: 1920, h: 180, trainIndex: 1 },
            { id: 'row3', type: 'liste', x: 100, y: 460, w: 1920, h: 180, trainIndex: 2 },
            { id: 'row4', type: 'liste', x: 100, y: 640, w: 1920, h: 180, trainIndex: 3 },
            { id: 'row5', type: 'liste', x: 100, y: 820, w: 1920, h: 180, trainIndex: 4 },
            { id: 'row6', type: 'liste', x: 100, y: 1000, w: 1920, h: 180, trainIndex: 5 }
        ]
    }
};