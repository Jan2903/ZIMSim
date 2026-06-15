// js/displays/trainInfoRenderer.js
import { COLORS, FONTS, INFO } from './constants.js';
import { drawText, drawWrappedText, drawInfoTopText, drawTextInRectangle } from './textUtils.js';
import { drawPictograms } from './pictogramRenderer.js';

/**
 * Zeichnet die Störungs-Overlays (Ausfall, Gleiswechsel, VerkehrtAb) für Nebenmonitore.
 * Liest direkt die camelCase-Properties vom Departure-Model (bereinigt gegenüber der alten Version).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../models/departure.js').Departure} departure - Die Abfahrtsdaten.
 * @param {import('./textUtils.js').RenderContext} renderCtx - Render-Kontext.
 */
export function drawDisruptionOverlay(ctx, departure, renderCtx) {
    const mainGroup = departure.groups[0] || {};
    const abfahrt = mainGroup.scheduledTime || "";
    const abfahrtA = mainGroup.expectedTime || "";
    const ziel = mainGroup.destination || "";
    const vias = mainGroup.vias || [];
    const trainNr = departure.groups.map(g => g.trainNumber).filter(Boolean).join(' / ') || "";

    const { gleiswechsel = "0", ausfall = false, verkehrtAb = "0" } = departure;

    ctx.textBaseline = 'middle';

    if (ausfall) {
        drawInfoTopText(ctx, COLORS.DARK_RED, COLORS.WHITE, 'Fährt fällt aus / ', 'Cancelled', 50, 430);
    } else if (verkehrtAb !== "0") {
        drawInfoTopText(ctx, COLORS.DARK_RED, COLORS.WHITE, 'Halt entfällt hier / ', 'Stop cancelled', 50, 490);
    } else if (gleiswechsel !== "0") {
        drawInfoTopText(ctx, COLORS.ORANGE, COLORS.WHITE, 'Gleisänderung / ', 'Track change', 50, 450);
    }

    // Weißer Hintergrund für den Info-Bereich
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(3, 100, INFO.SIDE_SCREEN_WIDTH, 700);

    // Abfahrtszeit
    drawText(ctx, abfahrt, 50, 200, FONTS.regular(120), COLORS.NAVY, 'left');

    // Abweichende Zeit (in Rechteck)
    drawTextInRectangle(ctx, abfahrtA, 330, 195, FONTS.regular(90), 'left', 90, 10,
        renderCtx, 0, COLORS.NAVY, COLORS.WHITE);

    // Zugnummer (in Rechteck, rechtsbündig)
    drawTextInRectangle(ctx, trainNr, 890, 200, FONTS.regular(75), 'right', 75, 10,
        renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, true, true);

    // Ziel
    drawText(ctx, ziel, 50, 360, FONTS.regular(120), COLORS.NAVY, 'left');

    // Zusätzliche Informationen je nach Störungstyp
    if (gleiswechsel !== "0") {
        const viaFull = vias.filter(v => v !== "").join(' ');
        drawWrappedText(ctx, viaFull, 50, 520, 880, 100, FONTS.regular(70), COLORS.NAVY, 'left');
    } else if (verkehrtAb !== "0") {
        const verkehrtAbMessage = 'Verkehrt heute ab / Departing today from ' + verkehrtAb;
        drawWrappedText(ctx, verkehrtAbMessage, 50, 520, 880, 100, FONTS.regular(70), COLORS.NAVY, 'left');
    }
}

/**
 * Zeichnet den kompletten Info-Bereich eines Monitors:
 * Piktogramme, Lauftext, Abfahrtszeit, Ziel, Via-Halte, Störungen.
 *
 * Bereinigung: Liest jetzt direkt die camelCase-Properties vom Departure-Model
 * (statt der alten Großbuchstaben-Aliase wie `Gleiswechsel`, `Ausfall` etc.).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../models/departure.js').Departure} departure - Die Abfahrtsdaten.
 * @param {number} width - Die verfügbare Breite des Screens.
 * @param {import('./textUtils.js').RenderContext} renderCtx - Render-Kontext.
 */
export function drawTrainInfo(ctx, departure, width, renderCtx) {
    const { fullScreen, screen, scrollManager, zugID, canvas } = renderCtx;

    const {
        groups = [],
        scrollText = "",
        gleiswechsel = "0",
        ausfall = false,
        verkehrtAb = "0",
        ankunft = false,
        infoscreen = false,
    } = departure;

    const mainGroup = groups[0] || {};
    const abfahrt = mainGroup.scheduledTime || "";
    const abfahrtA = mainGroup.expectedTime || "";
    const nr = groups.map(g => g.trainNumber).filter(Boolean).join(' / ') || "";

    // Piktogramme zeichnen (gibt X-Position nach letztem Icon zurück)
    let x = drawPictograms(ctx, scrollText, nr, fullScreen, ankunft);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Lauftext bestimmen
    let infoToScroll = scrollText;
    if (ankunft) infoToScroll = "Ankunft / Arrival";
    if (infoscreen || gleiswechsel !== "0" || ausfall || verkehrtAb !== "0") infoToScroll = "";

    // Weißer Hintergrund für Lauftext
    ctx.fillStyle = COLORS.WHITE;
    if (infoToScroll !== "") ctx.fillRect(x, 0, width - x, INFO.HEADER_HEIGHT);

    // Scrollenden Info-Text erstellen/aktualisieren
    scrollManager.createOrUpdate(
        canvas, zugID, "info", infoToScroll,
        `${canvas.offsetLeft + screen.x + x + 5}px`,
        `${canvas.offsetTop + screen.y}px`,
        `${screen.w - x - 5}px`,
        '100px',
        COLORS.NAVY,
        FONTS.regular(67)
    );

    // --- Störungsanzeige für Nebenmonitore ---
    if (!fullScreen && (infoscreen || gleiswechsel !== "0" || ausfall || verkehrtAb !== "0")) {
        if (infoscreen) {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(0, 0, INFO.SIDE_SCREEN_WIDTH, 800);
            drawWrappedText(ctx, scrollText, 50, 120, 900, 80, FONTS.regular(70), COLORS.NAVY, 'left');
        } else {
            drawDisruptionOverlay(ctx, departure, renderCtx);
        }
        return;
    }

    // --- Trennlinie am linken Rand (nur Nebenmonitore) ---
    if (!fullScreen) {
        ctx.strokeStyle = COLORS.WHITE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, 800);
        ctx.stroke();
    }

    // === HAUPTMONITOR (fullScreen) ===
    if (fullScreen) {
        drawText(ctx, abfahrt, 100, 220, FONTS.regular(180), COLORS.WHITE, 'left');
        drawTextInRectangle(ctx, abfahrtA, 520, 215, FONTS.regular(120), 'left', 120, 20,
            renderCtx, 0, COLORS.WHITE, COLORS.NAVY);
        drawTextInRectangle(ctx, nr, 1855, 220, FONTS.regular(100), 'right', 100, 15,
            renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true);

        if (ankunft) {
            const fromDestination = mainGroup.destination || "";
            drawText(ctx, "Bitte nicht einsteigen", 110, 450, FONTS.regular(180), COLORS.WHITE, 'left');
            drawText(ctx, "Please do not board", 105, 670, FONTS.italic(180), COLORS.WHITE, 'left');
            drawText(ctx, 'von / from ' + fromDestination, 112, 850, FONTS.regular(70), COLORS.WHITE, 'left');
        } else {
            let yPos = 420;
            const destFont = groups.length > 1 ? FONTS.regular(140) : FONTS.regular(180);
            const viaFont = groups.length > 1 ? FONTS.regular(60) : FONTS.regular(70);
            const lineSpacing = groups.length > 1 ? 150 : 200;

            for (const group of groups) {
                drawText(ctx, group.destination, 100, yPos, destFont, COLORS.WHITE, 'left');
                drawTextInRectangle(ctx, group.trainNumber, 1855, yPos, FONTS.regular(100), 'right', 100, 15,
                    renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true);

                const viaText = (group.vias || []).join(' - ');
                drawText(ctx, viaText, 112, yPos + lineSpacing * 0.5, viaFont, COLORS.WHITE, 'left');
                yPos += lineSpacing;
            }
        }

    // === NEBENMONITOR (compact) ===
    } else {
        drawText(ctx, abfahrt, 50, 200, FONTS.regular(120), COLORS.WHITE, 'left');
        drawTextInRectangle(ctx, abfahrtA, 330, 195, FONTS.regular(90), 'left', 90, 10,
            renderCtx, 0, COLORS.WHITE, COLORS.NAVY);
        drawTextInRectangle(ctx, nr, 890, 200, FONTS.regular(75), 'right', 75, 10,
            renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true);

        if (ankunft) {
            const fromDestination = mainGroup.destination || "";
            drawText(ctx, 'von / from ' + fromDestination, 50, 360, FONTS.regular(67), COLORS.WHITE, 'left');
            scrollManager.createOrUpdate(canvas, zugID, 'ankunft', "Bitte nicht einsteigen",
                `${canvas.offsetLeft + screen.x + 50}px`, `${canvas.offsetTop + screen.y + 420}px`,
                `${screen.w - 50}px`, '120px', COLORS.WHITE, FONTS.regular(120));
            scrollManager.createOrUpdate(canvas, zugID, 'arrival', "Please do not board",
                `${canvas.offsetLeft + screen.x + 50}px`, `${canvas.offsetTop + screen.y + 560}px`,
                `${screen.w - 50}px`, '120px', COLORS.WHITE, FONTS.italic(120));
        } else {
            let yPos = 360;
            const destFont = groups.length > 1 ? FONTS.regular(90) : FONTS.regular(120);
            const viaFont = FONTS.regular(70);
            const destLineHeight = groups.length > 1 ? 100 : 160;
            const viaLineHeight = 80;

            for (const group of groups) {
                drawText(ctx, group.destination, 50, yPos, destFont, COLORS.WHITE, 'left');
                drawTextInRectangle(ctx, group.trainNumber, 890, yPos, FONTS.regular(75), 'right', 75, 10,
                    renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true);
                yPos += destLineHeight;
                const viaText = (group.vias || []).join(' ');
                yPos = drawWrappedText(ctx, viaText, 50, yPos, 880, viaLineHeight, viaFont, COLORS.WHITE, 'left');
                yPos += 20;
            }
        }
    }
}
