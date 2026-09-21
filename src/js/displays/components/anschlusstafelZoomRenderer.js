// js/displays/components/anschlusstafelZoomRenderer.js
import { COLORS, FONTS } from '../core/constants.js';

/**
 * Dedizierter Renderer für die DB-Anschlusstafel im Zoom-Layout (4 Zeilen Vollbild).
 *
 * Spezifikation:
 * - Kein Header (keine obere Leiste mit Uhrzeit, Stationsname oder DB-Logo)
 * - Volle 1080p Bildhöhe für exakt 4 Abfahrten (270px pro Zeile)
 * - Spalte 1 (links):
 *     Oben: Geplante Abfahrtszeit (groß, 78px) + weißer Inverskasten für Echtzeit/Verspätung
 *     Unten: SPNV/SPFV Linien- und Zugnummer (38px, direkt unter der Zeit)
 * - Spalte 2 (mitte):
 *     Oben: Großer Zielbahnhof (80px) + Piktogramme (z.B. Flugzeug ✈)
 *     Unten: Via-Haltestellenkette mit Bindestrich-Trenner ' - ' (34px)
 * - Spalte 3 (rechts):
 *     Normal: Reine Gleisnummer (enorm groß, 94px, ohne 'Gl.')
 *     Gleiswechsel: Geplantes Gleis oben durchgestrichen, neues Gleis darunter im weißen Inverskasten
 */

const MAX_ROWS = 4;

/**
 * Zeichnet das gesamte Zoom-Board ohne Header über die volle Bildschirmhöhe.
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D Kontext
 * @param {import('../../features/journey/journey.svelte.js').Journey[]} journeys - Fahrtenliste
 * @param {number} width - Bildschirmbreite (z.B. 1920)
 * @param {number} height - Bildschirmhöhe (z.B. 1080)
 * @param {object} renderCtx - Render-Kontext mit Pagination-Daten
 * @param {object} screenOptions - Bildschirmspezifische Optionen (colIndex, maxCols)
 */
export function drawAnschlusstafelZoomBoard(ctx, journeys = [], width = 1920, height = 1080, renderCtx = {}, screenOptions = {}) {
    // 1. Hintergrund füllen (DB-Blau einheitlich, kein Zebra)
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
    ctx.fillRect(0, 0, width, height);

    // 2. Fahrten filtern: Nur reguläre Abfahrten
    const allJourneys = journeys || [];
    const trains = allJourneys.filter(j => !j.infoscreen && !j.ankunft);

    // 3. Spalten- und Pagination-Berechnung
    const colIndex = screenOptions.colIndex || 0;
    const maxCols = screenOptions.maxCols || 1;
    const rowHeight = height / MAX_ROWS; // 270px bei 1080p

    const trainsPerPage = MAX_ROWS * maxCols;
    const totalTrainPages = Math.max(1, Math.ceil(trains.length / trainsPerPage));
    const activeTrainPage = (renderCtx.departurePageIndex || 0) % totalTrainPages;
    const pageOffset = (activeTrainPage * trainsPerPage) + (colIndex * MAX_ROWS);
    const visibleTrains = trains.slice(pageOffset, pageOffset + MAX_ROWS);

    ctx.save();
    if (renderCtx.departurePageAlpha !== undefined && totalTrainPages > 1) {
        ctx.globalAlpha = renderCtx.departurePageAlpha;
    }

    if (trains.length === 0) {
        drawNoDeparturesNotice(ctx, width, height);
    } else {
        for (let i = 0; i < MAX_ROWS; i++) {
            const rowY = i * rowHeight;
            const train = visibleTrains[i];

            if (train) {
                drawZoomRow(ctx, train, 0, rowY, width, rowHeight);
            } else {
                drawEmptyZoomRow(ctx, 0, rowY, width, rowHeight);
            }
        }
    }

    ctx.restore();
}

/**
 * Zeichnet eine einzelne Fahrtzeile im DB ZIM 4-Zeilen-Format.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../../features/journey/journey.svelte.js').Journey} train
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 */
function drawZoomRow(ctx, train, x, y, width, height) {
    const isAusfall = !!train.ausfall;
    const hasTrackChange = !!train.hasTrackChange;

    // Horizontale Trennlinie am unteren Rand der Zeile
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x, y + height - 1, width, 1);

    // Vertikale Textanker (obere und untere Textzeile innerhalb der 270px)
    const upperY = y + (height * 0.44); // ~118px bei 270px
    const lowerY = y + (height * 0.78); // ~210px bei 270px

    // ========================================================
    // SPALTE 1: Abfahrtszeit, Echtzeit-Box & Zugnummer (Links)
    // ========================================================
    const timeX = x + 40;
    const plannedTime = train.scheduledTime || '--:--';

    // 1.1 Geplante Abfahrtszeit
    ctx.font = FONTS.bold(78);
    ctx.textAlign = 'left';
    ctx.fillStyle = isAusfall ? '#ef4444' : COLORS.WHITE;
    ctx.fillText(plannedTime, timeX, upperY);

    const timeMetrics = ctx.measureText(plannedTime);
    const timeWidth = timeMetrics.width;

    if (isAusfall) {
        // Zeit durchstreichen
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(timeX - 4, upperY - 24);
        ctx.lineTo(timeX + timeWidth + 4, upperY - 24);
        ctx.stroke();

        // Roter Hinweis neben der Zeit
        ctx.font = FONTS.bold(34);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('Fällt aus', timeX + timeWidth + 20, upperY - 4);
    } else if (train.expectedTime && train.expectedTime !== train.scheduledTime) {
        // 1.2 Echtzeit / Verspätung: Weißer Inverskasten direkt rechts neben der Zeit
        const boxX = timeX + timeWidth + 18;
        const boxW = 120;
        const boxH = 50;
        const boxY = upperY - 46;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();

        ctx.font = FONTS.bold(36);
        ctx.fillStyle = COLORS.NAVY;
        ctx.textAlign = 'center';
        ctx.fillText(train.expectedTime, boxX + (boxW / 2), boxY + 36);
        ctx.textAlign = 'left';
    }

    // 1.3 Zugnummer / Linie direkt unter der Abfahrtszeit (kein Badge-Hintergrund)
    const displayName = train.effectiveDisplayName || train.displayName || train.name || 'Zug';
    ctx.font = FONTS.bold(38);
    ctx.fillStyle = COLORS.WHITE;
    ctx.textAlign = 'left';
    ctx.fillText(displayName, timeX, lowerY);

    // ========================================================
    // SPALTE 3: Gleis / Abfahrtsort (Rechts)
    // ========================================================
    const rightMargin = 50;
    const gleisRightX = x + width - rightMargin;
    const scheduledTrack = train.platform || '-';
    const changedTrack = train.ezGleis || scheduledTrack;

    let trackReservedWidth = 200;

    if (hasTrackChange) {
        trackReservedWidth = 240;
        // Gleiswechsel-Spezifikation:
        // Geplantes Gleis oben durchgestrichen
        ctx.font = FONTS.bold(50);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ef4444';
        const planTrackY = y + 78;
        ctx.fillText(scheduledTrack, gleisRightX, planTrackY);

        const planMetrics = ctx.measureText(scheduledTrack);
        const planW = planMetrics.width;

        // Geplantes Gleis durchstreichen
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(gleisRightX - planW - 4, planTrackY - 15);
        ctx.lineTo(gleisRightX + 4, planTrackY - 15);
        ctx.stroke();

        // Abweichendes Gleis invertiert DARUNTER im weißen Kasten
        const newBoxW = Math.max(120, planW + 50);
        const newBoxH = 74;
        const newBoxX = gleisRightX - newBoxW;
        const newBoxY = y + 106;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(newBoxX, newBoxY, newBoxW, newBoxH, 8);
        ctx.fill();

        ctx.font = FONTS.bold(58);
        ctx.fillStyle = COLORS.NAVY;
        ctx.textAlign = 'center';
        ctx.fillText(changedTrack, newBoxX + (newBoxW / 2), newBoxY + 54);
    } else {
        // Normalfall: Ausschließlich die reine Gleisnummer, extrem groß und prominent
        ctx.font = FONTS.bold(94);
        ctx.fillStyle = COLORS.WHITE;
        ctx.textAlign = 'right';
        ctx.fillText(scheduledTrack, gleisRightX, y + (height * 0.58));
    }

    // ========================================================
    // SPALTE 2: Zielbahnhof, Piktogramme & Via-Halte (Mitte)
    // ========================================================
    const destX = x + 440;
    const availableDestWidth = width - destX - trackReservedWidth - 30;

    // 2.1 Zielbahnhof
    let destText = train.destinationLang || train.destination || 'Ziel';
    const isAirport = destText.includes('Flughafen') || destText.includes('BER');
    if (isAirport && !destText.includes('✈')) {
        destText += ' ✈';
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = isAusfall ? '#94a3b8' : COLORS.WHITE;

    // Dynamisches Herunterskalieren bei überlangen Stationsnamen für perfekte Lesbarkeit
    let destFontSize = 80;
    ctx.font = FONTS.bold(destFontSize);
    while (destFontSize > 54 && ctx.measureText(destText).width > availableDestWidth) {
        destFontSize -= 2;
        ctx.font = FONTS.bold(destFontSize);
    }

    // Falls selbst mit minimaler Schriftgröße zu lang: Kürzen mit Ellipsis
    if (ctx.measureText(destText).width > availableDestWidth) {
        while (destText.length > 0 && ctx.measureText(destText + '...').width > availableDestWidth) {
            destText = destText.slice(0, -1);
        }
        destText += '...';
    }

    ctx.fillText(destText, destX, upperY);

    // 2.2 Via-Haltestellenkette mit ' - ' Trenner
    let viaStr = '';
    if (train.vias && train.vias.length > 0) {
        viaStr = train.vias.join(' - ');
    }
    if (train.verkehrtAb && train.verkehrtAb !== '0') {
        viaStr = `Verkehrt ab ${train.verkehrtAb} - ${viaStr}`;
    }

    if (viaStr) {
        ctx.font = FONTS.regular(34);
        ctx.fillStyle = '#cbd5e1';

        // Kürzung mit Ellipsis bei Überlänge
        if (ctx.measureText(viaStr).width > availableDestWidth) {
            while (viaStr.length > 0 && ctx.measureText(viaStr + '...').width > availableDestWidth) {
                viaStr = viaStr.slice(0, -1);
            }
            viaStr += '...';
        }

        ctx.fillText(viaStr, destX, lowerY);
    }
}

/**
 * Zeichnet eine leere Zeile bei dünner Fahrplanbelegung.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 */
function drawEmptyZoomRow(ctx, x, y, width, height) {
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(x, y + height - 1, width, 1);
}

/**
 * Hinweis bei keinen Abfahrten.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
function drawNoDeparturesNotice(ctx, width, height) {
    ctx.textAlign = 'center';
    ctx.font = FONTS.bold(44);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Keine Abfahrten im gewählten Zeitraum', width / 2, height * 0.45);

    ctx.font = FONTS.italic(30);
    ctx.fillStyle = '#64748b';
    ctx.fillText('No departures scheduled in this time period', width / 2, (height * 0.45) + 48);
}
