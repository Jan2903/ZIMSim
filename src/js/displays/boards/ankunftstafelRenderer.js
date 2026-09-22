// js/displays/boards/ankunftstafelRenderer.js
import { COLORS, FONTS } from '../core/constants.js';
import { truncateWithEllipsis } from '../core/textUtils.js';
import { getSimulatedTime } from '../../core/utils/config.js';

/**
 * Renderer für die DB-Ankunftstafel (Nur Ankünfte).
 *
 * Spalten:
 * 1. Geplant / Planned (Ankunftszeit)
 * 2. Erwartet / Expected (Verspätung / Echtzeit)
 * 3. Zug / Train (Farbliche Liniennummer)
 * 4. Startbahnhof / Departure station (Herkunft des Zuges)
 * 5. Gleis / Platform
 * 6. Piktogramme & Störungshinweise
 */

export function drawAnkunftBoard(ctx, journeys = [], width = 1920, height = 1080, renderCtx = {}, screenOptions = {}) {
    const isPortrait = height > width; // z.B. Stele 1080×1920
    const HEADER_HEIGHT = isPortrait ? 110 : 80;
    const SUBHEADER_HEIGHT = isPortrait ? 40 : 34;

    // 1. Hintergrund (Midnightblue – passend zum Standard-Zuganzeiger)
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
    ctx.fillRect(0, 0, width, height);

    // 2. Kopfbereich zeichnen
    drawAnkunftHeader(ctx, width, HEADER_HEIGHT, renderCtx);

    // 3. Spaltenköpfe zeichnen (Geplant, Erwartet, Zug, Startbahnhof, Gleis)
    const tableTop = HEADER_HEIGHT + SUBHEADER_HEIGHT;
    drawSubHeader(ctx, width, HEADER_HEIGHT, SUBHEADER_HEIGHT, isPortrait);

    // 4. Fahrten für diese Spalte / diesen Bildschirm filtern
    const colIndex = screenOptions.colIndex || 0;
    const maxCols = screenOptions.maxCols || 1;
    const maxRows = isPortrait ? (screenOptions.maxRows || 20) : (screenOptions.maxRows || 7);

    // 4. Fahrten für diese Spalte / diesen Bildschirm filtern (Strikte Filterung: nur Ankünfte)
    const allTrains = (journeys || []).filter(j => !j.infoscreen && j.ankunft);
    const trainsPerCol = maxRows;
    const startIndex = colIndex * trainsPerCol;
    const visibleTrains = allTrains.slice(startIndex, startIndex + trainsPerCol);

    const availableHeight = height - tableTop - 10;
    const rowHeight = availableHeight / maxRows;

    // 5. Zeilen zeichnen
    if (allTrains.length === 0) {
        drawNoArrivalsMessage(ctx, width, tableTop, availableHeight, isPortrait);
    } else {
        for (let i = 0; i < maxRows; i++) {
            const rowY = tableTop + (i * rowHeight);
            const train = visibleTrains[i];

            if (train) {
                drawAnkunftRow(ctx, train, 0, rowY, width, rowHeight, i % 2 === 1, isPortrait);
            } else {
                drawEmptyAnkunftRow(ctx, 0, rowY, width, rowHeight, i % 2 === 1);
            }
        }
    }
}

/**
 * Zeichnet eine formatierte DB-Meldung, wenn keine Ankünfte vorliegen.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} topY
 * @param {number} availableHeight
 * @param {boolean} isPortrait
 * @returns {void}
 */
function drawNoArrivalsMessage(ctx, width, topY, availableHeight, isPortrait) {
    const centerY = topY + (availableHeight / 2);
    ctx.textAlign = 'center';
    ctx.font = FONTS.bold(isPortrait ? 30 : 38);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Keine Ankünfte im gewählten Zeitraum', width / 2, centerY - 15);

    ctx.font = FONTS.italic(isPortrait ? 22 : 26);
    ctx.fillStyle = '#64748b';
    ctx.fillText('No arrivals scheduled in this time period', width / 2, centerY + 25);
}

/**
 * Zeichnet die Haupt-Kopfzeile der Ankunftstafel.
 */
function drawAnkunftHeader(ctx, width, height, renderCtx) {
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE_HEADER;
    ctx.fillRect(0, 0, width, height);

    // Akzentstreifen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(0, height - 2, width, 2);

    const simTime = getSimulatedTime();
    const timeStr = simTime.toTimeString().slice(0, 5); // "17:51"

    // Uhrzeit links
    ctx.font = FONTS.bold(height > 90 ? 46 : 40);
    ctx.fillStyle = COLORS.WHITE;
    ctx.textAlign = 'left';
    ctx.fillText(`🕒 ${timeStr}`, 30, height * 0.62);

    // Titel "Ankunft Arrivals"
    ctx.font = FONTS.bold(height > 90 ? 46 : 40);
    ctx.fillText('Ankunft', 210, height * 0.62);

    ctx.font = FONTS.italic(height > 90 ? 32 : 28);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Arrivals', 360, height * 0.62);

    // DB-Logo rechts
    const logoX = width - 80;
    const logoY = (height / 2) - 20;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(logoX, logoY, 54, 38, 6);
    ctx.stroke();

    ctx.font = FONTS.bold(26);
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.fillText('DB', logoX + 27, logoY + 28);
}

/**
 * Zeichnet die Spaltenüberschriften nach DB-Vorgabe.
 */
function drawSubHeader(ctx, width, topY, height, isPortrait) {
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE_HEADER;
    ctx.fillRect(0, topY, width, height);

    ctx.fillStyle = '#94a3b8';
    ctx.font = FONTS.regular(isPortrait ? 22 : 20);
    ctx.textAlign = 'left';

    const textY = topY + (height * 0.72);

    if (isPortrait) {
        ctx.fillText('Geplant', 30, textY);
        ctx.fillText('Erwartet', 125, textY);
        ctx.fillText('Zug', 225, textY);
        ctx.fillText('Startbahnhof', 360, textY);
        ctx.textAlign = 'right';
        ctx.fillText('Gleis', width - 40, textY);
    } else {
        ctx.fillText('Geplant', 35, textY);
        ctx.fillText('Erwartet', 160, textY);
        ctx.fillText('Zug', 310, textY);
        ctx.fillText('Startbahnhof / Herkunft', 500, textY);
        ctx.textAlign = 'right';
        ctx.fillText('Gleis', width - 60, textY);
    }
}

/**
 * Zeichnet eine einzelne Zeile der Ankunftstafel.
 */
function drawAnkunftRow(ctx, train, x, y, width, height, isAlt, isPortrait) {
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x, y, width, 1);

    const isAusfall = !!train.ausfall;
    const textY = y + (height * 0.68);
    const fontSize = isPortrait ? 30 : 34;

    // 1. Geplante Ankunftszeit
    ctx.font = FONTS.bold(fontSize);
    ctx.textAlign = 'left';
    ctx.fillStyle = isAusfall ? '#ef4444' : COLORS.WHITE;
    const plannedTime = train.scheduledTime || '--:--';
    ctx.fillText(plannedTime, isPortrait ? 30 : 35, textY);

    if (isAusfall) {
        // Zeit durchstreichen
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(isPortrait ? 25 : 30, textY - 10);
        ctx.lineTo(isPortrait ? 105 : 120, textY - 10);
        ctx.stroke();
    }

    // 2. Erwartete Ankunftszeit (Verspätung)
    const expX = isPortrait ? 125 : 160;
    if (isAusfall) {
        ctx.font = FONTS.bold(isPortrait ? 22 : 24);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('Fällt aus', expX, textY);
    } else if (train.expectedTime && train.expectedTime !== train.scheduledTime) {
        ctx.font = FONTS.bold(isPortrait ? 26 : 28);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(train.expectedTime, expX, textY);
    }

    // 3. Zug / Linie (Farbiger Badge)
    const trainX = isPortrait ? 225 : 310;
    const trainName = train.displayTitle;
    const badgeW = isPortrait ? 115 : 140;
    const badgeH = height * 0.72;
    const badgeY = y + (height * 0.14);

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(trainX, badgeY, badgeW, badgeH, 5);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = FONTS.bold(isPortrait ? 26 : 28);
    ctx.fillStyle = COLORS.WHITE;
    ctx.textAlign = 'center';
    ctx.fillText(trainName, trainX + (badgeW / 2), textY);

    // 4. Startbahnhof (Herkunft des Zuges)
    const originX = isPortrait ? 360 : 500;
    ctx.textAlign = 'left';
    ctx.font = FONTS.bold(fontSize);
    ctx.fillStyle = isAusfall ? '#94a3b8' : COLORS.WHITE;

    // Startbahnhof ermitteln
    let originStation = '';
    if (train.stops && train.stops.length > 0) {
        originStation = train.stops[0].name || '';
    }
    if (!originStation) {
        originStation = train.destinationLang || train.destination || 'Startbahnhof';
    }

    // Flughafen-Piktogramm wenn z.B. BER
    let hasAirport = originStation.includes('Flughafen') || originStation.includes('BER');

    const maxOriginW = isPortrait ? (width - originX - 160) : (width - originX - 300);
    originStation = truncateWithEllipsis(ctx, originStation, maxOriginW);

    ctx.fillText(originStation, originX, textY);

    if (hasAirport) {
        const oWidth = ctx.measureText(originStation).width;
        ctx.fillText(' ✈', originX + oWidth + 5, textY);
    }

    // 5. Gleis (Rechtsbündig)
    const gleisX = width - (isPortrait ? 40 : 60);
    const platform = train.ezGleis || train.platform || '-';
    ctx.textAlign = 'right';
    ctx.font = FONTS.bold(fontSize + 2);
    ctx.fillStyle = train.hasTrackChange ? '#f59e0b' : COLORS.WHITE;
    ctx.fillText(platform, gleisX, textY);
}

function drawEmptyAnkunftRow(ctx, x, y, width, height, isAlt) {
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(x, y, width, 1);
}

export { drawAnkunftBoard as drawAnkunftstafelBoard };
