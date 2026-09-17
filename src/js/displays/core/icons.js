// js/displays/core/icons.js

function createIcon(viewBox, elements) {
    return {
        viewBox,
        elements: elements.map(el => ({
            path: new Path2D(el.d),
            fill: el.fill
        }))
    };
}

/**
 * Sammlung aller Vektor-Icons. Jedes Icon hat eine eigene viewBox (native Größe)
 * und ein oder mehrere Pfade mit Farbdefinitionen.
 * "currentColor" wird beim Zeichnen durch die übergebene tintColor ersetzt.
 */
export const ICONS = {
    // 24x24 Icons (DB Standard)
    fahrrad: createIcon(24, [
        { d: "M 16.83 11.63 L 17.84 14.52 C 17.90 14.73 18.04 14.80 18.25 14.72 C 18.44 14.66 18.50 14.52 18.44 14.32 L 17.44 11.45 C 17.62 11.42 17.81 11.40 18.01 11.40 C 18.84 11.40 19.55 11.69 20.13 12.28 C 20.72 12.87 21.01 13.58 21.01 14.41 C 21.01 15.24 20.72 15.94 20.13 16.53 C 19.55 17.12 18.84 17.41 18.01 17.41 C 17.18 17.41 16.47 17.12 15.89 16.53 C 15.30 15.94 15.01 15.24 15.01 14.41 C 15.01 13.81 15.17 13.25 15.50 12.75 C 15.83 12.24 16.28 11.87 16.83 11.63 M 16.02 9.32 L 11.21 13.95 L 9.23 9.21 L 15.97 9.21 L 16.02 9.32 M 10.60 14.09 L 9.56 14.09 C 9.45 12.88 8.88 11.96 7.84 11.33 L 8.71 9.59 L 10.60 14.09 M 7.59 11.85 C 8.42 12.38 8.88 13.13 8.97 14.09 L 6.49 14.09 L 7.59 11.85 M 7.03 11.58 L 5.72 14.27 C 5.66 14.38 5.66 14.47 5.72 14.57 C 5.78 14.67 5.87 14.72 5.99 14.72 L 8.97 14.72 C 8.90 15.49 8.57 16.13 8.00 16.64 C 7.43 17.16 6.76 17.41 5.99 17.41 C 5.16 17.41 4.45 17.12 3.87 16.53 C 3.28 15.94 2.99 15.24 2.99 14.41 C 2.99 13.58 3.28 12.87 3.87 12.28 C 4.45 11.69 5.16 11.40 5.99 11.40 C 6.35 11.40 6.70 11.46 7.03 11.58 M 16.24 9.98 L 16.64 11.09 C 15.96 11.36 15.43 11.80 15.02 12.41 C 14.62 13.02 14.42 13.69 14.42 14.41 C 14.42 15.40 14.77 16.25 15.47 16.95 C 16.17 17.65 17.01 18.00 18.01 18.00 C 19.00 18.00 19.85 17.65 20.55 16.95 C 21.25 16.25 21.60 15.40 21.60 14.41 C 21.60 13.41 21.25 12.57 20.55 11.86 C 19.85 11.16 19.00 10.81 18.01 10.81 C 17.75 10.81 17.50 10.84 17.24 10.90 C 16.80 9.46 16.51 8.53 16.36 8.12 C 15.86 6.71 15.33 6.00 14.76 6.00 L 13.11 6.00 C 12.90 6.00 12.79 6.11 12.79 6.32 C 12.79 6.53 12.90 6.63 13.11 6.63 L 14.75 6.63 C 14.96 6.63 15.11 6.74 15.18 6.95 L 15.75 8.60 L 8.95 8.60 L 8.68 7.96 C 8.79 7.96 9.31 7.79 10.26 7.45 C 10.33 7.42 10.37 7.36 10.35 7.27 C 10.33 7.17 10.28 7.13 10.17 7.13 L 7.30 7.13 L 7.23 7.92 L 8.00 7.92 L 8.39 8.83 L 7.28 11.06 C 6.87 10.90 6.44 10.81 5.99 10.81 C 5.00 10.81 4.15 11.16 3.45 11.86 C 2.75 12.57 2.40 13.41 2.40 14.41 C 2.40 15.40 2.75 16.25 3.45 16.95 C 4.15 17.65 5.00 18.00 5.99 18.00 C 6.94 18.00 7.75 17.69 8.43 17.06 C 9.11 16.44 9.48 15.66 9.56 14.72 L 11.21 14.72 C 11.28 14.72 11.35 14.69 11.41 14.63 L 16.24 9.98", fill: "currentColor" }
    ]),
    gastronomie: createIcon(24, [
        { d: "M 10.31 20.92 L 10.31 8.77 C 10.31 8.50 10.60 8.18 11.20 7.82 C 11.42 7.59 11.53 6.99 11.53 6.02 C 11.53 5.10 11.44 3.98 11.27 2.66 C 11.24 2.54 11.18 2.48 11.11 2.48 C 11.00 2.48 10.95 2.54 10.95 2.66 L 10.95 6.09 C 10.95 6.32 10.85 6.43 10.63 6.43 C 10.41 6.43 10.31 6.32 10.31 6.09 L 10.31 2.66 C 10.31 2.54 10.24 2.48 10.12 2.48 C 9.99 2.48 9.93 2.54 9.93 2.66 L 9.93 6.09 C 9.93 6.32 9.81 6.43 9.59 6.43 C 9.37 6.43 9.26 6.32 9.26 6.09 L 9.26 2.66 C 9.26 2.54 9.19 2.48 9.07 2.48 C 8.94 2.48 8.88 2.54 8.88 2.66 L 8.88 6.09 C 8.88 6.32 8.77 6.43 8.55 6.43 C 8.34 6.43 8.23 6.32 8.23 6.09 L 8.23 2.66 C 8.23 2.54 8.18 2.48 8.07 2.48 C 8.00 2.48 7.95 2.54 7.94 2.66 C 7.75 4.03 7.65 5.15 7.65 6.02 C 7.65 6.98 7.76 7.58 7.98 7.82 C 8.16 7.95 8.35 8.09 8.54 8.23 C 8.76 8.41 8.88 8.59 8.88 8.77 L 8.88 20.92 C 8.88 21.37 9.12 21.60 9.59 21.60 C 10.07 21.60 10.31 21.37 10.31 20.92 M 14.05 4.19 C 13.86 4.88 13.76 5.65 13.76 6.50 L 13.76 10.70 C 13.76 10.87 13.85 10.97 14.03 11.00 L 14.68 11.25 C 14.77 11.29 14.81 11.36 14.81 11.45 L 14.81 20.92 C 14.81 21.37 15.06 21.60 15.57 21.60 C 15.76 21.60 15.94 21.54 16.10 21.41 C 16.27 21.28 16.35 21.12 16.35 20.92 L 16.35 3.35 C 16.35 3.04 16.26 2.80 16.07 2.63 C 15.89 2.46 15.65 2.40 15.37 2.46 C 14.77 2.58 14.33 3.16 14.05 4.19", fill: "currentColor" }
    ]),
    bistro: createIcon(24, [
        { d: "M 16.37 7.97 C 16.90 7.97 17.35 8.15 17.73 8.52 C 18.11 8.89 18.30 9.34 18.30 9.87 C 18.30 10.40 18.11 10.85 17.74 11.22 C 17.37 11.59 16.92 11.78 16.39 11.78 L 16.37 7.97 M 16.37 12.55 L 16.37 12.36 C 17.06 12.36 17.65 12.12 18.14 11.63 C 18.63 11.15 18.87 10.57 18.87 9.87 C 18.87 9.18 18.63 8.59 18.15 8.11 C 17.67 7.63 17.09 7.39 16.39 7.39 L 16.37 6.75 L 7.21 6.75 L 7.21 12.55 C 7.21 12.98 7.36 13.35 7.67 13.64 C 7.97 13.94 8.33 14.08 8.76 14.08 L 14.84 14.08 C 15.27 14.08 15.63 13.94 15.92 13.64 C 16.22 13.35 16.37 12.98 16.37 12.55 M 21.60 15.39 L 2.40 15.39 C 2.40 15.85 2.64 16.28 3.12 16.67 C 3.60 17.06 4.08 17.25 4.55 17.25 L 19.45 17.25 C 19.92 17.25 20.40 17.06 20.88 16.67 C 21.36 16.28 21.60 15.85 21.60 15.39", fill: "currentColor" }
    ]),
    
    // 32x32 Icons
    wagen_fehlen: createIcon(32, [
        // Weißes Rechteck mit abgerundeten Ecken (x=3, y=3, w=26, h=26, rx=1)
        { d: "M 4 3 L 28 3 A 1 1 0 0 1 29 4 L 29 28 A 1 1 0 0 1 28 29 L 4 29 A 1 1 0 0 1 3 28 L 3 4 A 1 1 0 0 1 4 3 Z", fill: "#fff" },
        // Dunkelblaues Icon
        { d: "M24 14.5a1 1 0 0 1 1 1V22h-1.001L24 23a.25.25 0 0 1-.25.25h-3.5A.25.25 0 0 1 20 23l-.001-1h-8L12 23a.25.25 0 0 1-.25.25h-3.5A.25.25 0 0 1 8 23l-.001-1H7v-6.5a1 1 0 0 1 1-1zM22.75 16H9.25a.25.25 0 0 0-.25.25v2.5c0 .138.112.25.25.25h13.5a.25.25 0 0 0 .25-.25v-2.5a.25.25 0 0 0-.25-.25m2.5-5.5H18V8.75h7.25z", fill: "currentColor" }
    ]),

    rollstuhl: createIcon(24, [
        { d: "M 12 2 a 2 2 0 1 0 0.001 0 Z M 19 13 v -2 c -1.54 0.02 -3.09 -0.75 -4.07 -1.83 l -1.29 -1.43 c -0.17 -0.19 -0.38 -0.34 -0.61 -0.45 c -0.01 0 -0.01 -0.01 -0.02 -0.01 H 13 c -0.35 -0.2 -0.75 -0.3 -1.19 -0.26 C 10.76 7.11 10 8.04 10 9.09 V 15 c 0 1.1 0.9 2 2 2 h 5 v 5 h 2 v -5.5 c 0 -1.1 -0.9 -2 -2 -2 h -3 v -3.45 c 1.29 1.07 3.25 1.94 5 1.95 z m -6.17 5 c -0.41 1.16 -1.52 2 -2.83 2 c -1.66 0 -3 -1.34 -3 -3 c 0 -1.31 0.84 -2.41 2 -2.83 V 12.1 c -2.28 0.46 -4 2.48 -4 4.9 c 0 2.76 2.24 5 5 5 c 2.42 0 4.44 -1.72 4.9 -4 h -2.07 z", fill: "currentColor" }
    ]),
    mehrzweck: {
        draw: (ctx, tintColor) => {
            // Fahrrad links (50x50 skaliert auf linke Hälfte)
            ctx.save();
            ctx.translate(0, 24);
            ctx.scale(0.5, 0.5);
            drawIcon(ctx, 'fahrrad', tintColor);
            ctx.restore();

            // Rollstuhl rechts (50x50 skaliert auf rechte Hälfte)
            ctx.save();
            ctx.translate(50, 24);
            ctx.scale(0.5, 0.5);
            drawIcon(ctx, 'rollstuhl', tintColor);
            ctx.restore();
        }
    },
    schlafwagen: createIcon(100, [
        // Bett (Matratze mit Kopf- und Fußteil)
        { d: "M 10 34 V 66 H 18 V 57 H 82 V 66 H 90 V 34 H 82 V 49 H 18 V 34 Z", fill: "currentColor" },
        // Kopfkissen (links)
        { d: "M 21 46 V 31 H 27 C 33 31, 36 38, 36 46 Z", fill: "currentColor" },
        // Decke / Person (rechts)
        { d: "M 39 46 V 31 H 68 C 75 31, 79 38, 79 46 Z", fill: "currentColor" }
    ]),
    liegewagen: createIcon(100, [
        // Kopfkissen
        { d: "M 10 33 H 22 C 30 33, 35 38, 35 48 H 10 Z", fill: "currentColor" },
        // Bett (Matratze und Beine)
        { d: "M 10 51 H 90 V 68 H 82 V 59 H 18 V 68 H 10 Z", fill: "currentColor" }
    ])
};

/**
 * Zeichnet ein Icon skaliert im 100x100 Format an Position 0,0.
 * Diese Funktion gleicht die native `viewBox` des Icons automatisch auf 100x100 an,
 * sodass im Renderer immer verlässlich mit 100x100 Flächen gearbeitet werden kann.
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas Context
 * @param {string} iconKey - Der Schlüssel des Icons in `ICONS`
 * @param {string} tintColor - Die Farbe, die "currentColor" ersetzt
 */
export function drawIcon(ctx, iconKey, tintColor) {
    const icon = ICONS[iconKey];
    if (!icon) return;
    
    ctx.save();
    if (typeof icon.draw === 'function') {
        icon.draw(ctx, tintColor);
    } else {
        // Skaliere die native ViewBox auf 100x100.
        // Ein Icon mit viewBox 24 wird hier um den Faktor 100/24 (ca 4.16x) vergrößert.
        const scale = 100 / icon.viewBox;
        ctx.scale(scale, scale);
        
        for (const el of icon.elements) {
            ctx.fillStyle = el.fill === "currentColor" ? tintColor : el.fill;
            ctx.fill(el.path);
        }
    }
    
    ctx.restore();
}
