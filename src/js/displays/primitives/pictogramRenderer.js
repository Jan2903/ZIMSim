// js/displays/primitives/pictogramRenderer.js
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
        match: (info) => info.includes("Ersatzverkehr mit Bus ist eingerichtet") || info.includes("Ersatzverkehr"),
        draw: (ctx) => {
            ctx.fillStyle = "#B21C6D";
            ctx.fillRect(0, 0, 100, 100);
            drawIcon(ctx, 'ersatzverkehr');
        }
    },
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
            ctx.font = FONTS.regular(48);
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
            ctx.save();
            ctx.translate(50, 66);
            ctx.scale(0.40, 0.40);
            ctx.translate(-50, -50);
            drawIcon(ctx, 'fahrrad', COLORS.WHITE);
            ctx.restore();

            ctx.fillStyle = COLORS.WHITE;
            ctx.font = FONTS.regular(48);
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
            ctx.font = FONTS.bold(68);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("H", 30, 60);
            ctx.font = FONTS.bold(64);
            ctx.fillText("+", 65, 48);
        }
    },
    {
        match: (info) => info.includes("Ohne Halt in"),
        draw: (ctx) => {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(0, 0, 100, 100);
            ctx.fillStyle = COLORS.NAVY;
            ctx.font = FONTS.bold(68);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("H", 30, 60);
            ctx.font = FONTS.bold(64);
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
            ctx.font = FONTS.regular(48);
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
            ctx.font = FONTS.bold(56);
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
            ctx.font = FONTS.bold(56);
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
            ctx.font = FONTS.bold(56);
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

/**
 * Findet bis zu `maxCount` passende Piktogramm-Regeln für eine Fahrt basierend auf Text und Zugnummer.
 * @param {string} scrollText - Der Lauftext / Info-String
 * @param {string} trainNumber - Die Zugnummer
 * @param {number} [maxCount=2] - Maximale Anzahl an Piktogrammen
 * @returns {Array<object>} Liste passender Piktogramm-Regeln
 */
export function getMatchingPictogramRules(scrollText, trainNumber, maxCount = 2) {
    if (!scrollText && !trainNumber) return [];
    const text = scrollText || '';
    const nr = trainNumber || '';
    const matches = [];
    for (const rule of PICTOGRAM_RULES) {
        if (rule.match(text, nr)) {
            matches.push(rule);
            if (matches.length >= maxCount) break;
        }
    }
    return matches;
}

/**
 * Zeichnet bis zu `maxCount` Qualitätsmerkmal-Piktogramme rechtsbündig nebeneinander.
 * @param {CanvasRenderingContext2D} ctx - Canvas Kontext
 * @param {string} scrollText - Der Lauftext / Info-String
 * @param {string} trainNumber - Die Zugnummer
 * @param {number} rightX - Rechter Ankerpunkt für die Piktogramme
 * @param {number} y - Y-Position (oberer Rand der Boxen)
 * @param {number} [size=52] - Kantenlänge der quadratischen Box
 * @param {number} [gap=8] - Abstand zwischen zwei Piktogrammen
 * @param {number} [maxCount=2] - Maximale Anzahl darzustellender Piktogramme
 * @returns {number} Gesamtbreite aller gezeichneten Piktogramme
 */
export function drawQualityIcons(ctx, scrollText, trainNumber, rightX, y, size = 52, gap = 8, maxCount = 2) {
    const rules = getMatchingPictogramRules(scrollText, trainNumber, maxCount);
    if (rules.length === 0) return 0;

    const totalWidth = (rules.length * size) + ((rules.length - 1) * gap);
    let startX = rightX - totalWidth;

    for (const rule of rules) {
        drawInNormalizedBox(ctx, startX, y, size, rule.draw);
        startX += size + gap;
    }

    return totalWidth;
}
