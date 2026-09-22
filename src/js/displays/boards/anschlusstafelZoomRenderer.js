// js/displays/boards/anschlusstafelZoomRenderer.js
import { COLORS, FONTS } from '../core/constants.js';
import { truncateWithEllipsis, drawLineBadge } from '../core/textUtils.js';
import { drawQualityIcons } from '../primitives/pictogramRenderer.js';
import { lineColorService } from '../../features/journey/services/lineColorService.svelte.js';

/**
 * Dedizierter Renderer für die DB-Anschlusstafel im Zoom-Layout (4 Zeilen Vollbild).
 *
 * Spezifikation nach Vorbild realer DB ZIM-Zoom-Displays:
 * - Volle 1080p Bildhöhe für exakt 4 Abfahrten (270px pro Zeile).
 * - Spalte 1 (links):
 *     Oben: Gattungs-/Linien-Badge (z.B. [RB 61], [RE 80 / 11466]) in dezent hinterlegter Box.
 *     Unten: Geplante Abfahrtszeit (groß, 82px) + bei Verspätung weißer Inverskasten rechts daneben.
 * - Spalte 2 (mitte):
 *     Oben: Haltestellenkette (Vias getrennt mit Halbgeviertstrich ' – ')
 *           ODER bei Störungen/Hinweisen/Ausfall der Infotext/Lauftext als Ersatz der Vias!
 *     Unten: Großer Zielbahnhof (82px) + automatische Piktogramme (z.B. Flughafen ✈).
 * - Spalte 3 (rechts):
 *     Variante A (Standard): Reine Gleisnummer/Abschnitt sehr groß (92px) auf der Grundlinie des Ziels.
 *                            Bei Gleiswechsel neues Gleis im weißen Inverskasten (ohne Altgleis).
 *     Variante B (Icons):    Gleis oben kleiner (54px) und darunter bis zu 2 Qualitätsmerkmale (z.B. Fahrradmitnahme reservierungspflichtig).
 * - Ausfall:
 *     Die gesamte Zeile wird vollflächig weiß invertiert mit dunkelblauer Schrift.
 *     Gleis zeigt '-', Infotextzeile zeigt Störungsmeldung oder Fallback 'Fahrt fällt aus'.
 */

const MAX_ROWS = 4;

/**
 * Zeichnet das gesamte Zoom-Board ohne Header über die volle Bildschirmhöhe.
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D Kontext
 * @param {import('../../features/journey/journey.svelte.js').Journey[]} journeys - Fahrtenliste
 * @param {number} width - Bildschirmbreite (z.B. 1920)
 * @param {number} height - Bildschirmhöhe (z.B. 1080)
 * @param {object} renderCtx - Render-Kontext mit Pagination-Daten und tickerOffset
 * @param {object} screenOptions - Bildschirmspezifische Optionen (colIndex, maxCols, showQualityIcons)
 */
export function drawAnschlusstafelZoomBoard(ctx, journeys = [], width = 1920, height = 1080, renderCtx = {}, screenOptions = {}) {
    // 1. Hintergrund füllen (DB-Blau einheitlich)
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
                drawZoomRow(ctx, train, 0, rowY, width, rowHeight, renderCtx, screenOptions);
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
 * @param {object} renderCtx
 * @param {object} screenOptions
 */
function drawZoomRow(ctx, train, x, y, width, height, renderCtx = {}, screenOptions = {}) {
    const isAusfall = !!train.ausfall;
    const hasTrackChange = !!train.hasTrackChange;
    const showQualityIcons = Boolean(screenOptions?.showQualityIcons);

    // 1. Hintergrund & Trennlinie
    if (isAusfall) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, width, height);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(x, y + height - 1, width, 1);
    } else {
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.fillRect(x, y, width, height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x, y + height - 1, width, 1);
    }

    // 2. Vertikale Textanker (optimiert für 270px Zeilenhöhe)
    const upperY = y + 80;
    const lowerY = y + 218;

    // 3. Spalte 1: Badge oben, Zeit & Verspätung unten
    const col1X = x + 40;
    drawZoomBadge(ctx, train.displayTitle, col1X, upperY, isAusfall);
    drawZoomTimeAndDelay(ctx, train.scheduledTime, train.expectedTime, col1X, lowerY, isAusfall);

    // 4. Spalte 3: Gleis & Qualitätsmerkmale (Rechts)
    const rightMargin = 50;
    const gleisRightX = x + width - rightMargin;

    let scheduledTrack = train.platform || '-';
    if (train.sectors && !scheduledTrack.includes(train.sectors)) {
        scheduledTrack = `${scheduledTrack} ${train.sectors}`;
    }
    let changedTrack = train.ezGleis || scheduledTrack;
    if (train.ezGleis && train.sectors && !changedTrack.includes(train.sectors)) {
        changedTrack = `${changedTrack} ${train.sectors}`;
    }

    drawZoomTrackColumn(
        ctx,
        scheduledTrack,
        changedTrack,
        hasTrackChange,
        isAusfall,
        showQualityIcons,
        train.scrollText,
        train.name,
        gleisRightX,
        upperY,
        lowerY
    );

    // 5. Spalte 2: Zielbahnhof & Vias/Infotext (Mitte)
    const destX = x + 400;
    const trackReservedW = showQualityIcons ? 230 : 270;
    const availableMiddleW = width - destX - trackReservedW;

    drawZoomMiddleColumn(ctx, train, isAusfall, destX, upperY, lowerY, availableMiddleW, renderCtx);
}

/**
 * Zeichnet den Zuggattungs-/Linien-Badge in der oberen Zeile der Spalte 1.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} displayName - Name oder Linie des Zuges (z.B. "RB 61", "RE 80 / 11466")
 * @param {number} x - X-Koordinate
 * @param {number} y - Y-Koordinate
 * @param {boolean} isAusfall - Ob die Zeile vollflächig invertiert ist
 */
function drawZoomBadge(ctx, displayName, x, y, isAusfall) {
    const font = FONTS.bold(40);
    ctx.font = font;
    const textWidth = ctx.measureText(displayName).width;
    const paddingX = 16;
    const badgeW = Math.max(116, textWidth + (paddingX * 2));
    const badgeH = 52;
    const badgeY = y - 38;

    const style = lineColorService.resolveStyle(displayName, {
        isAusfall,
        defaultBgColor: '#1f3d47',
        defaultTextColor: COLORS.WHITE
    });

    drawLineBadge(ctx, displayName, x, badgeY, badgeW, badgeH, {
        font,
        ...style
    });
}

/**
 * Zeichnet die geplante Abfahrtszeit und die optionale Verspätungsbox in Spalte 1 unten.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} scheduledTime - Geplante Abfahrtszeit (HH:mm)
 * @param {string} expectedTime - Echtzeit / erwartete Zeit (HH:mm)
 * @param {number} x - X-Koordinate
 * @param {number} y - Y-Koordinate (Grundlinie der Schrift)
 * @param {boolean} isAusfall - Ob die Zeile vollflächig invertiert ist
 */
function drawZoomTimeAndDelay(ctx, scheduledTime, expectedTime, x, y, isAusfall) {
    const plannedTime = scheduledTime || '--:--';
    ctx.font = FONTS.bold(84);
    ctx.textAlign = 'left';
    ctx.fillStyle = isAusfall ? COLORS.NAVY : COLORS.WHITE;
    ctx.fillText(plannedTime, x, y);

    // Verspätungsbox (nur bei regulären, nicht-ausgefallenen Fahrten mit Zeitabweichung)
    if (!isAusfall && expectedTime && expectedTime !== scheduledTime) {
        const timeWidth = ctx.measureText(plannedTime).width;
        const boxX = x + timeWidth + 16;
        const boxW = 126;
        const boxH = 56;
        const boxY = y - 60; // Zentriert die Box vertikal zu den Ziffern

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();

        ctx.font = FONTS.bold(38);
        ctx.fillStyle = COLORS.NAVY;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(expectedTime, boxX + (boxW / 2), boxY + (boxH / 2) + 1);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
    }
}

/**
 * Zeichnet die mittlere Spalte: Oben Vias oder Info-/Lauftext, unten großer Zielbahnhof.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../../features/journey/journey.svelte.js').Journey} train
 * @param {boolean} isAusfall - Ob Zeile invertiert ist
 * @param {number} x - X-Koordinate
 * @param {number} upperY - Y-Koordinate obere Zeile
 * @param {number} lowerY - Y-Koordinate untere Zeile
 * @param {number} availableWidth - Nutzbare Spaltenbreite
 * @param {object} renderCtx - Render-Kontext mit tickerOffset
 */
function drawZoomMiddleColumn(ctx, train, isAusfall, x, upperY, lowerY, availableWidth, renderCtx) {
    // 1. OBERE ZEILE: Infotext (falls vorhanden) oder Via-Kette
    let infoText = '';
    if (isAusfall) {
        infoText = train.scrollText || train.delayReason || 'Fahrt fällt aus';
    } else if (train.scrollText) {
        infoText = train.scrollText;
    } else if (train.delayReason) {
        infoText = train.delayReason;
    }

    if (infoText) {
        ctx.font = FONTS.bold(44);
        const textWidth = ctx.measureText(infoText).width;
        const textColor = isAusfall ? COLORS.NAVY : '#cbd5e1';

        if (textWidth > availableWidth) {
            // Ticker / Marquee mit Canvas-Clipping
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, upperY - 44, availableWidth, 60);
            ctx.clip();

            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            const tickerItem = `+++ ${infoText} `;
            const tickerItemW = ctx.measureText(tickerItem).width;
            const offset = ((renderCtx.tickerOffset || 0) * 1.6) % tickerItemW;
            ctx.fillText(tickerItem + tickerItem + tickerItem, x - offset, upperY);
            ctx.restore();
        } else {
            // Text passt ohne Scrollen
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            ctx.fillText(infoText, x, upperY);
        }
    } else {
        // Reguläre Via-Kette
        let viaStr = '';
        if (train.vias && train.vias.length > 0) {
            viaStr = train.vias.join(' – ');
        }
        if (train.verkehrtAb && train.verkehrtAb !== '0') {
            viaStr = `Verkehrt ab ${train.verkehrtAb} – ${viaStr}`;
        }

        if (viaStr) {
            ctx.font = FONTS.bold(42);
            ctx.fillStyle = isAusfall ? COLORS.NAVY : '#cbd5e1';
            ctx.textAlign = 'left';
            viaStr = truncateWithEllipsis(ctx, viaStr, availableWidth);
            ctx.fillText(viaStr, x, upperY);
        }
    }

    // 2. UNTERE ZEILE: Großer Zielbahnhof
    let destText = train.displayDestination;
    const isAirport = destText.includes('Flughafen') || destText.includes('BER');
    if (isAirport && !destText.includes('✈')) {
        destText += ' ✈';
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = isAusfall ? COLORS.NAVY : COLORS.WHITE;

    let destFontSize = 86;
    ctx.font = FONTS.bold(destFontSize);
    while (destFontSize > 54 && ctx.measureText(destText).width > availableWidth) {
        destFontSize -= 2;
        ctx.font = FONTS.bold(destFontSize);
    }
    destText = truncateWithEllipsis(ctx, destText, availableWidth);
    ctx.fillText(destText, x, lowerY);
}

/**
 * Zeichnet die rechte Spalte für Gleis und optionale Qualitätsmerkmale.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} scheduledTrack - Geplantes Gleis (inkl. Sektoren)
 * @param {string} changedTrack - Abweichendes Gleis (inkl. Sektoren)
 * @param {boolean} hasTrackChange - Ob Gleiswechsel vorliegt
 * @param {boolean} isAusfall - Ob Fahrt ausgefallen ist
 * @param {boolean} showQualityIcons - Variante B (Gleis oben + Icons unten)
 * @param {string} scrollText - Infotext / Qualitätsattribute
 * @param {string} trainNumber - Zugnummer
 * @param {number} gleisRightX - Rechter Rand für rechtsbündigen Text
 * @param {number} upperY - Y-Koordinate obere Zeile
 * @param {number} lowerY - Y-Koordinate untere Zeile
 */
function drawZoomTrackColumn(ctx, scheduledTrack, changedTrack, hasTrackChange, isAusfall, showQualityIcons, scrollText, trainNumber, gleisRightX, upperY, lowerY) {
    if (!showQualityIcons) {
        // ========================================================
        // VARIANTE A: Großes Gleis unten (Standard)
        // ========================================================
        if (isAusfall) {
            ctx.font = FONTS.bold(96);
            ctx.fillStyle = COLORS.NAVY;
            ctx.textAlign = 'right';
            ctx.fillText('-', gleisRightX, lowerY);
        } else if (hasTrackChange) {
            // Gleiswechsel: Neues Gleis im weißen Inverskasten (kein Altgleis)
            ctx.font = FONTS.bold(72);
            const trackMetrics = ctx.measureText(changedTrack);
            const boxW = Math.max(120, trackMetrics.width + 36);
            const boxH = 76;
            const boxX = gleisRightX - boxW;
            const boxY = lowerY - 68;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 8);
            ctx.fill();

            ctx.fillStyle = COLORS.NAVY;
            ctx.textAlign = 'center';
            ctx.fillText(changedTrack, boxX + (boxW / 2), boxY + 55);
        } else {
            // Normal: Reine Gleisnummer groß und prominent
            ctx.font = FONTS.bold(96);
            ctx.fillStyle = COLORS.WHITE;
            ctx.textAlign = 'right';
            ctx.fillText(scheduledTrack, gleisRightX, lowerY);
        }
    } else {
        // ========================================================
        // VARIANTE B: Gleis oben + bis zu 2 Qualitätsmerkmale unten
        // ========================================================
        // 1. Gleis in der oberen Zeile
        if (isAusfall) {
            ctx.font = FONTS.bold(68);
            ctx.fillStyle = COLORS.NAVY;
            ctx.textAlign = 'right';
            ctx.fillText('-', gleisRightX, upperY);
        } else if (hasTrackChange) {
            // Gleiswechsel oben im Inverskasten
            ctx.font = FONTS.bold(54);
            const trackMetrics = ctx.measureText(changedTrack);
            const boxW = Math.max(90, trackMetrics.width + 24);
            const boxH = 54;
            const boxX = gleisRightX - boxW;
            const boxY = upperY - 42;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 6);
            ctx.fill();

            ctx.fillStyle = COLORS.NAVY;
            ctx.textAlign = 'center';
            ctx.fillText(changedTrack, boxX + (boxW / 2), boxY + 40);
        } else {
            ctx.font = FONTS.bold(68);
            ctx.fillStyle = COLORS.WHITE;
            ctx.textAlign = 'right';
            ctx.fillText(scheduledTrack, gleisRightX, upperY);
        }

        // 2. Bis zu 2 Qualitätsmerkmal-Icons in der unteren Zeile
        if (!isAusfall) {
            const iconSize = 56;
            const iconGap = 8;
            drawQualityIcons(ctx, scrollText, trainNumber, gleisRightX, lowerY - 58, iconSize, iconGap, 2);
        }
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
