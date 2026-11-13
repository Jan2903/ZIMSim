// js/displays/boards/anschlusstafelTokens.js

/**
 * Geometrie- und Schrift-Tokens der Anschlusstafel (Voranzeiger).
 *
 * Alle Werte sind logische Pixel der jeweiligen Ausrichtung:
 *   landscape -> 1920×1080 logische Fläche
 *   portrait  -> 1080×1920 logische Fläche
 * Die 4K-Varianten nutzen dieselbe logische Fläche mit canvas-weitem
 * ctx.scale(2) und überschreiben nur die Werte, die sich im echten
 * 4K-Design unterscheiden (z. B. die Zeilenanzahl).
 *
 * Spalten werden im Token-Service aufgelöst: absolute Werte über `x`/`w`,
 * breitenrelative Werte über `xFromRight`/`wFromRight`.
 */

/**
 * Gemeinsame Störungs- und Ticker-Geometrie.
 * Diese Werte sind in beiden Ausrichtungen identisch und werden lediglich
 * um die ausrichtungsspezifische Ticker-Höhe ergänzt.
 */
const DISRUPTION = {
    staticBox: {
        insetX: 16,
        insetY: 8,
        borderWidth: 2.5,
        background: '#101a3d',
        borderColor: '#f59e0b'
    },
    staticBadge: {
        offsetX: 36,
        offsetY: 26,
        iconOffsetY: 32,
        iconSize: 42,
        titleOffsetX: 48,
        titleOffsetY: 28,
        titleSize: 32,
        pageRightOffset: 40,
        pageSize: 24,
        pageColor: '#cbd5e1',
        accentColor: '#f59e0b'
    },
    staticText: {
        offsetX: 48,
        offsetY: 68,
        rightPadding: 60,
        lineHeight: 42,
        fontSize: 34,
        maxLines: 3
    },
    ticker: {
        background: '#0e1738',
        accentColor: '#f59e0b',
        borderHeight: 2,
        badgeWidth: 200,
        badgeBackground: '#1e293b',
        badgeFontSize: 28,
        badgeTextY: 46,
        clipLeftGap: 10,
        clipRightGap: 20,
        textLeftGap: 20,
        textY: 47,
        fontSize: 34
    }
};

export const ANSCHLUSSTAFEL_TOKENS = {
    // Querformat 1920×1080 (Basis für fhd_landscape und uhd_landscape)
    landscape: {
        meta: { maxRows: 6 },
        header: {
            height: 108,
            clock: { offsetX: 22, centerY: 30, radius: 18 },
            time: { gap: 16, fontSize: 42 },
            title: { y: 46, deSize: 44, enSize: 44 },
            logo: { width: 72, height: 50, offsetY: 0 },
            labels: { y1: 74, y2: 96, deSize: 19, enSize: 19, gap: 6, color: '#e2e8f0' }
        },
        columns: {
            train: { x: 72, w: 280 },
            via: { x: 388, w: 1140 },
            track: { x: 1560, w: 150 },
            icons: { x: 1738, w: 154 }
        },
        row: {
            separator: { thickness: 2 },
            badge: { height: 40, yFactor: 0.14, fontSize: 30, paddingX: 24, minWidth: 72 },
            time: { yFactor: 0.78, fontSize: 60 },
            cross: { offsetX: 28, fontSize: 44 },
            delay: { offsetX: 12, fontSize: 32, minWidth: 96, height: 40 },
            alarm: { offsetX: 28, offsetY: 20, radius: 8, lineWidth: 3 },
            via: { yFactor: 0.30, fontSize: 30, paddingRight: 20 },
            haltMessage: { fontSize: 32, clipHeight: 46 },
            dest: { fontSize: 62 },
            bracket: { xOffset: 22, armOffset: 8, yOffset: 20, lineWidth: 2.5 },
            track: {
                fontSize: 70,
                changeBoxWidth: 136,
                changeBoxHeight: 64,
                changeBoxBottomGap: 4,
                changeBoxColumnInset: 8,
                changeBoxYOffset: 34
            },
            icons: { size: 52, yOffset: 46, gap: 8 }
        },
        disruption: { tickerHeight: 75, ...DISRUPTION }
    },

    // Hochformat 1080×1920 (Basis für fhd_portrait und uhd_portrait)
    portrait: {
        meta: { maxRows: 16 },
        header: {
            height: 116,
            clock: { offsetX: 16, centerY: 28, radius: 13 },
            time: { gap: 10, fontSize: 28 },
            title: { y: 40, deSize: 30, enSize: 30 },
            logo: { width: 52, height: 38, offsetY: 0 },
            labels: { y1: 74, y2: 94, deSize: 14, enSize: 14, gap: 6, color: '#e2e8f0' }
        },
        // col2/col3/col4 liegen rechtsbündig am Displayrand und werden
        // deshalb breitenrelativ aufgelöst.
        columns: {
            train: { x: 24, w: 190 },
            via: { x: 240, wFromRight: 190 },
            track: { xFromRight: 170, w: 95 },
            icons: { xFromRight: 65, w: 45 }
        },
        row: {
            separator: { thickness: 2 },
            badge: { height: 34, yFactor: 0.14, fontSize: 22, paddingX: 16, minWidth: 60 },
            time: { yFactor: 0.78, fontSize: 34 },
            cross: { offsetX: 18, fontSize: 30 },
            delay: { offsetX: 10, fontSize: 22, minWidth: 78, height: 30 },
            alarm: { offsetX: 18, offsetY: 10, radius: 6, lineWidth: 2 },
            via: { yFactor: 0.30, fontSize: 20, paddingRight: 20 },
            haltMessage: { fontSize: 24, clipHeight: 34 },
            dest: { fontSize: 34 },
            bracket: { xOffset: 14, armOffset: 4, yOffset: 12, lineWidth: 2.5 },
            track: {
                fontSize: 38,
                changeBoxWidth: 136,
                changeBoxHeight: 44,
                changeBoxBottomGap: 4,
                changeBoxColumnInset: 8,
                changeBoxYOffset: 34
            },
            icons: { size: 36, yOffset: 28, gap: 8 }
        },
        disruption: { tickerHeight: 90, ...DISRUPTION }
    },

    // 4K-Overrides: nur die Werte, die vom hochskalierten Basisdesign abweichen.
    overrides: {
        uhd_landscape: {
            meta: { maxRows: 8 }
        },
        uhd_portrait: {
            meta: { maxRows: 20 }
        }
    }
};
