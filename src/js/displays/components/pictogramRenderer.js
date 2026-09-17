// js/displays/components/pictogramRenderer.js
import { COLORS, FONTS, INFO } from '../core/constants.js';
import { drawIcon } from '../core/icons.js';

/**
 * Zeichnet eine Funktion (Piktogramm) in einer skalierten 100x100 Box.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - X-Position
 * @param {number} y - Y-Position
 * @param {number} size - Zielgröße der Box
 * @param {Function} drawFn - Zeichenfunktion, die im 100x100 Kontext arbeitet
 */
export function drawInNormalizedBox(ctx, x, y, size, drawFn) {
    ctx.save();
    ctx.translate(x, y);
    const scale = size / 100;
    ctx.scale(scale, scale);
    drawFn(ctx);
    ctx.restore();
}

/**
 * Deklaratives Array aller Piktogramm-Regeln.
 * Jede Regel prüft per `match`, ob ein bestimmtes Keyword im Info-Text oder der Zugnummer
 * enthalten ist, und zeichnet per `draw` das entsprechende Piktogramm im 100x100 Kontext.
 */
const PICTOGRAM_RULES = [
    {
        match: (info) => info.includes("Zug fällt heute aus") || info.includes("Keine Weiterfahrt nach"),
        draw: (ctx) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(0, 0, 100, 100);
            ctx.strokeStyle = COLORS.NAVY;
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(28, 28); ctx.lineTo(72, 72);
            ctx.moveTo(72, 28); ctx.lineTo(28, 72);
            ctx.stroke();
        }
    },
    {
        match: (info) => info.includes("Zug reservierungspflichtig"),
        draw: (ctx) => {
            ctx.lineWidth = "4";
            ctx.strokeStyle = COLORS.WHITE;
            ctx.strokeRect(2, 2, 96, 96);
            ctx.fillStyle = COLORS.WHITE;
            ctx.font = "48px 'DB Screen Sans', sans-serif"; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("R", 50, 50);
        }
    },
    {
        match: (info) => info.includes("Fahrradmitnahme reservierungspflichtig"),
        draw: (ctx) => {
            ctx.lineWidth = "4";
            ctx.strokeStyle = COLORS.WHITE;
            ctx.strokeRect(2, 2, 96, 96);
            
            ctx.save();
            ctx.translate(50, 66);
            ctx.scale(0.40, 0.40);
            ctx.translate(-50, -50);
            drawIcon(ctx, 'fahrrad', COLORS.WHITE);
            ctx.restore();

            ctx.fillStyle = COLORS.WHITE;
            ctx.font = "48px 'DB Screen Sans', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("R", 75, 28);
        }
    },
    {
        match: (info) => info.includes("Zusätzlicher Halt in"),
        draw: (ctx) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(0, 0, 100, 100);
            ctx.fillStyle = COLORS.NAVY;
            ctx.font = "bold 68px 'DB Screen Sans', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("H", 30, 60);
            ctx.font = "bold 64px 'DB Screen Sans', sans-serif";
            ctx.fillText("+", 65, 48);
        }
    },
    {
        match: (info) => info.includes("Ohne Halt in"),
        draw: (ctx) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(0, 0, 100, 100);
            ctx.fillStyle = COLORS.NAVY;
            ctx.font = "bold 68px 'DB Screen Sans', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("H", 30, 60);
            ctx.font = "bold 64px 'DB Screen Sans', sans-serif";
            ctx.fillText("-", 60, 36);
        }
    },
    {
        match: (info) => info.includes("Mehrere Wagen fehlen") || info.includes("Ein Wagen fehlt"),
        draw: (ctx) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(0, 0, 100, 100);
            drawIcon(ctx, 'wagen_fehlen', COLORS.NAVY);
        }
    },
    {
        match: (info) => info.includes("Kein gastronomisches Angebot"),
        draw: (ctx) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(0, 0, 100, 100);
            
            ctx.save();
            ctx.translate(30, 50);
            ctx.scale(0.5, 0.5);
            ctx.translate(-50, -50);
            drawIcon(ctx, 'gastronomie', COLORS.NAVY);
            ctx.restore();

            ctx.strokeStyle = 'red';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(10, 90);
            ctx.lineTo(90, 10);
            ctx.stroke();
        }
    },
    {
        match: (info) => info.includes("Universal-WC fehlt") || info.includes("Kein behindertengerechtes WC"),
        draw: (ctx) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(0, 0, 100, 100);

            ctx.save();
            ctx.translate(32, 28);
            ctx.scale(0.32, 0.32);
            ctx.translate(-50, -50);
            drawIcon(ctx, 'rollstuhl', COLORS.NAVY);
            ctx.restore();

            ctx.fillStyle = COLORS.NAVY;
            ctx.font = "48px 'DB Screen Sans', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("WC", 66, 75);
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(10, 90);
            ctx.lineTo(90, 10);
            ctx.stroke();
        }
    },
    {
        match: (info) => info.includes("Defekte fahrzeuggebundene Einstiegshilfe"),
        draw: (ctx) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(0, 0, 100, 100);
            
            ctx.save();
            ctx.translate(50, 50);
            ctx.scale(0.5, 0.5);
            ctx.translate(-50, -50);
            drawIcon(ctx, 'rollstuhl', COLORS.NAVY);
            ctx.restore();

            ctx.fillStyle = COLORS.NAVY;
            ctx.font = "bold 56px 'DB Screen Sans', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("!", 80, 36);
        }
    },
    {
        match: (info) => info.includes("Eingeschränkte Fahrradbeförderung"),
        draw: (ctx) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(0, 0, 100, 100);
            
            ctx.save();
            ctx.translate(50, 66);
            ctx.scale(0.40, 0.40);
            ctx.translate(-50, -50);
            drawIcon(ctx, 'fahrrad', COLORS.NAVY);
            ctx.restore();

            ctx.fillStyle = COLORS.NAVY;
            ctx.font = "bold 56px 'DB Screen Sans', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("!", 80, 36);
        }
    },
    {
        match: (info) => info.includes("Eingeschränktes gastronomisches Angebot"),
        draw: (ctx) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(0, 0, 100, 100);
            
            ctx.save();
            ctx.translate(30, 50);
            ctx.scale(0.5, 0.5);
            ctx.translate(-50, -50);
            drawIcon(ctx, 'gastronomie', COLORS.NAVY);
            ctx.restore();

            ctx.fillStyle = COLORS.NAVY;
            ctx.font = "bold 56px 'DB Screen Sans', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("!", 80, 36);
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
                // Zeichne die Regel in der normierten Box (y = 0)
                drawInNormalizedBox(ctx, x, 0, INFO.PICTOGRAM_SIZE, rule.draw);
                x += INFO.PICTOGRAM_STEP;
            }
        }
    }
    return x;
}
