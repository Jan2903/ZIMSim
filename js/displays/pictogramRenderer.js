// js/displays/pictogramRenderer.js
import { COLORS, FONTS, INFO } from './constants.js';
import { images } from '../utils/utils.js';

/**
 * Zeichnet ein Bild sicher auf den Canvas mit optionalem Farb-Tinting.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} imgKey - Schlüssel im images-Objekt.
 * @param {number} scale - Skalierungsfaktor.
 * @param {number} imgX - Zentrierte X-Position.
 * @param {number} imgY - Zentrierte Y-Position.
 * @param {string|null} tintColor - Optionale Farbe zum Einfärben.
 */
function drawImageSafe(ctx, imgKey, scale, imgX, imgY, tintColor = null) {
    const img = images[imgKey];
    if (img && img.isLoaded && !img.isBroken) {
        try {
            let drawImg = img;
            const drawWidth = img.width * scale;
            const drawHeight = img.height * scale;
            if (tintColor) {
                // Offscreen-Canvas für Tinting erstellen
                const offCanvas = document.createElement('canvas');
                offCanvas.width = img.width;
                offCanvas.height = img.height;
                const offCtx = offCanvas.getContext('2d');
                offCtx.drawImage(img, 0, 0);
                offCtx.globalCompositeOperation = 'source-in';
                offCtx.fillStyle = tintColor;
                offCtx.fillRect(0, 0, img.width, img.height);
                offCtx.globalCompositeOperation = 'source-over';
                drawImg = offCanvas;
            }
            ctx.drawImage(drawImg, imgX - (drawWidth / 2), imgY - (drawHeight / 2), drawWidth, drawHeight);
        } catch (err) {
            console.warn(`Failed to draw pictogram ${imgKey}:`, err);
        }
    } else {
        console.warn(`Pictogram ${imgKey} not loaded or broken`);
    }
}

/**
 * Deklaratives Array aller Piktogramm-Regeln.
 * Jede Regel prüft per `match`, ob ein bestimmtes Keyword im Info-Text oder der Zugnummer
 * enthalten ist, und zeichnet per `draw` das entsprechende Piktogramm.
 * Neue Piktogramme können einfach als weiterer Eintrag hinzugefügt werden.
 */
const PICTOGRAM_RULES = [
    {
        match: (info) => info.includes("Zug fällt heute aus") || info.includes("Keine Weiterfahrt nach"),
        draw: (ctx, x) => {
            // Weißes Feld mit blauem Kreuz
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(x, 0, INFO.PICTOGRAM_SIZE, INFO.PICTOGRAM_SIZE);
            ctx.strokeStyle = COLORS.NAVY;
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(x + 28, 28); ctx.lineTo(x + 72, 72);
            ctx.moveTo(x + 72, 28); ctx.lineTo(x + 28, 72);
            ctx.stroke();
        }
    },
    {
        match: (_, nr) => nr.includes("FLX"),
        draw: (ctx, x) => {
            // Reservierungspflicht Flixtrain
            ctx.lineWidth = "4";
            ctx.strokeStyle = COLORS.WHITE;
            ctx.strokeRect(x + 2, 2, 96, 96);
            ctx.fillStyle = COLORS.WHITE;
            ctx.font = FONTS.regular(48);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("R", x + 75, 28);
        }
    },
    {
        match: (_, nr) => nr.includes("IC"),
        draw: (ctx, x) => {
            // Reservierungspflicht Fahrrad (IC/ICE)
            ctx.lineWidth = "4";
            ctx.strokeStyle = COLORS.WHITE;
            ctx.strokeRect(x + 2, 2, 96, 96);
            drawImageSafe(ctx, 'wagenreihung_fahrrad', 0.40, x + 50, 66);
            ctx.fillStyle = COLORS.WHITE;
            ctx.font = FONTS.regular(48);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("R", x + 75, 28);
        }
    },
    {
        match: (info) => info.includes("Heute mit Halt in"),
        draw: (ctx, x) => {
            // Zusätzlicher Halt: H+
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(x, 0, INFO.PICTOGRAM_SIZE, INFO.PICTOGRAM_SIZE);
            ctx.fillStyle = COLORS.NAVY;
            ctx.font = FONTS.bold(68);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("H", x + 30, 60);
            ctx.font = FONTS.bold(64);
            ctx.fillText("+", x + 65, 48);
        }
    },
    {
        match: (info) => info.includes("Heute ohne Halt in"),
        draw: (ctx, x) => {
            // Entfallener Halt: H-
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(x, 0, INFO.PICTOGRAM_SIZE, INFO.PICTOGRAM_SIZE);
            ctx.fillStyle = COLORS.NAVY;
            ctx.font = FONTS.bold(68);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("H", x + 30, 60);
            ctx.font = FONTS.bold(64);
            ctx.fillText("-", x + 60, 36);
        }
    },
    {
        match: (info) => info.includes("Mehrere Wagen fehlen") || info.includes("Ein Wagen fehlt"),
        draw: (ctx, x) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(x, 0, INFO.PICTOGRAM_SIZE, INFO.PICTOGRAM_SIZE);
            drawImageSafe(ctx, 'wagen_fehlen', 1, x + 50, 50, COLORS.NAVY);
        }
    },
    {
        match: (info) => info.includes("Kein gastronomisches Angebot"),
        draw: (ctx, x) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(x, 0, INFO.PICTOGRAM_SIZE, INFO.PICTOGRAM_SIZE);
            drawImageSafe(ctx, 'wagenreihung_gastronomie', 0.5, x + 30, 50, COLORS.NAVY);
            // Roter Querbalken (Durchgestrichenes Icon)
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(x + 10, 90);
            ctx.lineTo(x + 90, 10);
            ctx.stroke();
        }
    },
    {
        match: (info) => info.includes("Universal-WC fehlt") || info.includes("Kein behindertengerechtes WC"),
        draw: (ctx, x) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(x, 0, INFO.PICTOGRAM_SIZE, INFO.PICTOGRAM_SIZE);
            drawImageSafe(ctx, 'wagenreihung_rollstuhl', 0.32, x + 32, 28, COLORS.NAVY);
            ctx.fillStyle = COLORS.NAVY;
            ctx.font = FONTS.regular(48);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("WC", x + 66, 75);
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(x + 10, 90);
            ctx.lineTo(x + 90, 10);
            ctx.stroke();
        }
    },
    {
        match: (info) => info.includes("Defekte fahrzeuggebundene Einstiegshilfe"),
        draw: (ctx, x) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(x, 0, INFO.PICTOGRAM_SIZE, INFO.PICTOGRAM_SIZE);
            drawImageSafe(ctx, 'wagenreihung_rollstuhl', 0.5, x + 50, 50, COLORS.NAVY);
            ctx.fillStyle = COLORS.NAVY;
            ctx.font = FONTS.bold(56);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("!", x + 80, 36);
        }
    },
    {
        match: (info) => info.includes("Eingeschränkte Fahrradbeförderung"),
        draw: (ctx, x) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(x, 0, INFO.PICTOGRAM_SIZE, INFO.PICTOGRAM_SIZE);
            drawImageSafe(ctx, 'wagenreihung_fahrrad', 0.40, x + 50, 66, COLORS.NAVY);
            ctx.fillStyle = COLORS.NAVY;
            ctx.font = FONTS.bold(56);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("!", x + 80, 36);
        }
    },
    {
        match: (info) => info.includes("Eingeschränktes gastronomisches Angebot"),
        draw: (ctx, x) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(x, 0, INFO.PICTOGRAM_SIZE, INFO.PICTOGRAM_SIZE);
            drawImageSafe(ctx, 'wagenreihung_gastronomie', 0.5, x + 30, 50, COLORS.NAVY);
            ctx.fillStyle = COLORS.NAVY;
            ctx.font = FONTS.bold(56);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("!", x + 80, 36);
        }
    },
];

/**
 * Zeichnet alle relevanten Piktogramme basierend auf dem Info-Text und der Zugnummer.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} scrollText - Der Lauftext / Info-String.
 * @param {string} trainNumber - Die Zugnummer(n), z.B. "ICE 543 / ICE 553".
 * @param {boolean} fullScreen - Ob der Hauptmonitor gezeichnet wird.
 * @param {boolean} isArrival - Ob es sich um eine Ankunft handelt.
 * @returns {number} Die X-Position nach dem letzten gezeichneten Piktogramm.
 */
export function drawPictograms(ctx, scrollText, trainNumber, fullScreen, isArrival) {
    let x = fullScreen ? 100 : 50;
    if (!isArrival) {
        for (const rule of PICTOGRAM_RULES) {
            if (rule.match(scrollText, trainNumber)) {
                rule.draw(ctx, x);
                x += INFO.PICTOGRAM_STEP;
            }
        }
    }
    return x;
}
