// js/displays/boards/wagenstandGleisTokens.js

/**
 * Geometrie- und Schrift-Tokens des Wagenstandsanzeigers (Gleis-Vitrine).
 *
 * Alle Werte sind logische Pixel der jeweiligen Ausrichtung:
 *   landscape -> 1920×1080 logische Fläche
 *   portrait  -> 1080×1920 logische Fläche
 *
 * Werte mit `FromRight` werden im Renderer von der Displaybreite abgezogen;
 * die Spalten selbst sind hier bewusst nicht enthalten, weil sich der
 * Wagenstandsanzeiger über die Bahnsteig-Breite (`startXRatio` /
 * `usableWidthRatio`) definiert.
 *
 * Die 4K-Varianten zeichnen dieselbe logische Fläche mit canvas-weitem
 * ctx.scale(2) und überschreiben nur die Werte, die sich im echten
 * 4K-Design unterscheiden (z. B. die Zeilenanzahl).
 *
 * `meta.rowScale` skaliert den Inhalt einer Zeile (Zeit, Formation, Labels)
 * um die Zeilenmitte. Da die Formation dabei mitschrumpft, wird die
 * verfügbare Bahnsteigbreite im Renderer gegenläufig dividiert, sodass die
 * Zeile horizontal weiterhin die volle Displaybreite nutzt.
 */

/**
 * Gemeinsame Basisgeometrie des Querformats. Hochformat und 4K leiten
 * davon ab und überschreiben nur die abweichenden Werte.
 */
const LANDSCAPE_BASE = {
    // Zeilenraster des Bahnsteigs. `rowCount` bestimmt, wie viele Züge
    // untereinander Platz finden (FullHD: 3, Hochformat: 5, 4K: 4 bzw. 6).
    meta: { rowCount: 3, startY: 225, rowHeight: 300, rowScale: 1 },

    // Horizontaler Aufbau: Der Bahnsteig beginnt bei 15 % der Breite und
    // belegt 70 % der Displaybreite.
    layout: { startXRatio: 0.15, usableWidthRatio: 0.70 },

    header: {
        clock: { x: 80, y: 80, radius: 35 },
        digitalClock: { x: 150, y: 110, fontSize: 86 },
        progress: { width: 400, y: 110, height: 8 },
        feature: { y: 80, deSize: 35, enSize: 35, gap: 10 },
        track: {
            gleisFromRight: 420,
            platformFromRight: 300,
            labelY: 80,
            labelSize: 35,
            numberFromRight: 280,
            numberY: 90,
            numberSize: 66
        },
        logo: { fromRight: 110, y: 80, width: 80, height: 60 }
    },

    // Zugbeschriftung über dem ersten Wagen eines Zugteils.
    label: {
        font: 30,
        badgeHeight: 40,
        badgeCenterYOffset: 65,
        paddingX: 14,
        minWidth: 20,
        destFont: 65,
        destYOffset: 135,
        viaFont: 35,
        viaYOffset: 133,
        viaGap: 10
    },

    row: {
        separator: { lineWidth: 2 },
        time: { x: 56, baselineOffset: 150, fontSize: 75 },
        delay: { offsetX: 12, fontSize: 48, paddingX: 10, minWidth: 100, height: 55 },
        alarm: { offsetX: 36, offsetY: 26, radius: 8, lineWidth: 3 },
        formation: { offsetY: 100 }
    },

    // Bahnsteigsektoren und rote Standort-Linie.
    sectors: {
        translateY: 160,
        redDotY: 190,
        redDotRadius: 16,
        redLineStartY: 230,
        redLineWidth: 3
    }
};

/**
 * Hochformat-Kopfzeile: Uhr/Zeit links, Feature-Fortschritt in der Mitte,
 * Gleis + Logo rechts. Die Werte sind gegenüber dem Querformat verkleinert,
 * damit die Blöcke auf 1080 px Breite nicht kollidieren.
 */
const PORTRAIT_HEADER = {
    clock: { x: 56, y: 58, radius: 24 },
    digitalClock: { x: 96, y: 82, fontSize: 54 },
    progress: { width: 340, y: 96, height: 7 },
    feature: { y: 66, deSize: 26, enSize: 26, gap: 8 },
    track: {
        gleisFromRight: 260,
        platformFromRight: 160,
        labelY: 66,
        labelSize: 26,
        numberFromRight: 140,
        numberY: 74,
        numberSize: 52
    },
    logo: { fromRight: 80, y: 60, width: 64, height: 48 }
};

export const WAGENSTAND_GLEIS_TOKENS = {
    // Querformat 1920×1080 (Basis für fhd_landscape und uhd_landscape)
    landscape: LANDSCAPE_BASE,

    // Hochformat 1080×1920 (Basis für fhd_portrait und uhd_portrait).
    // Fünf Zeilen à 339 px füllen die Stele unterhalb der Sektorleiste.
    // Die Zeit-Spalte ist schmaler gesetzt und der Bahnsteig beginnt weiter
    // rechts, damit Zeit + Verspätungskasten nicht in die Zielbeschriftung
    // der Formation laufen.
    portrait: {
        ...LANDSCAPE_BASE,
        meta: { rowCount: 5, startY: 225, rowHeight: 339, rowScale: 1 },
        layout: { startXRatio: 0.24, usableWidthRatio: 0.68 },
        header: PORTRAIT_HEADER,
        row: {
            ...LANDSCAPE_BASE.row,
            time: { x: 24, baselineOffset: 150, fontSize: 66 }
        }
    },

    // Varianten-Overrides: nur die Werte, die vom skalierten Basisdesign
    // abweichen. 4K zeigt mehr, dafür kleinere Zeilen.
    overrides: {
        uhd_landscape: {
            meta: { rowCount: 4, rowHeight: 213.75, rowScale: 0.7125 }
        },
        uhd_portrait: {
            meta: { rowCount: 6, rowHeight: 282.5, rowScale: 0.9416666666666667 }
        }
    }
};
