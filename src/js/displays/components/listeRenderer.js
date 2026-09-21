// js/displays/components/listeRenderer.js
import { COLORS, FONTS } from '../core/constants.js';
import { drawText, drawWrappedText, truncateWithEllipsis } from '../core/textUtils.js';
import { getSimulatedTime } from '../../core/utils/config.js';

/**
 * Vollständiger dynamischer Renderer für Voranzeiger und Abfahrtstafeln.
 *
 * Eigenschaften:
 * - Dynamische Kopfzeile ("Abfahrt Departure", Station, Live-Uhrzeit)
 * - Flexible Abfahrtszeilen mit Echtzeit-Status, Verspätungen, Ausfällen, Vias und Gleiswechsel-Inverskästen
 * - Platzierung von Störungen/Infoscreens IMMER GANZ UNTEN (als statische Zeile(n) oder Ticker-Lauftext)
 * - Automatisches Abfahrts-Paging (10s) und Störungs-Paging (6s)
 */

/**
 * Zeichnet das gesamte Voranzeiger-Board auf den Canvas.
 * @param {CanvasRenderingContext2D} ctx - Der Canvas-Kontext.
 * @param {import('../../features/journey/journey.svelte.js').Journey[]} journeys - Alle Fahrten.
 * @param {number} width - Verfügbare Breite (z.B. 1920 oder 2560).
 * @param {number} height - Verfügbare Höhe (z.B. 1080 oder 1920).
 * @param {object} renderCtx - Render-Kontext mit Pagination- und Scroll-Daten.
 */
export function drawVoranzeigerBoard(ctx, journeys = [], width = 1920, height = 1080, renderCtx = {}, screenOptions = {}) {
    const isPortrait = height > width; // z.B. Stele 1080×1920
    const HEADER_HEIGHT = isPortrait ? 100 : 90;

    // 1. Hintergrund füllen (Standard DB-Blau aus Default-Layout)
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
    ctx.fillRect(0, 0, width, height);

    // 2. Fahrten filtern: Ausschließlich reguläre Abfahrten vs. Infoscreens (Strikte Trennung)
    const allJourneys = journeys || [];
    const trains = allJourneys.filter(j => !j.infoscreen && !j.ankunft);
    const infos = allJourneys.filter(j => j.infoscreen);

    // 3. Störungszone unten analysieren
    let disruptionRows = 0;
    let isTickerMode = false;
    let activeInfo = null;
    let activeInfoIndex = 0;

    // Störungsbereich auf der letzten Spalte oder Einzelmonitor anzeigen
    const colIndex = screenOptions.colIndex || 0;
    const maxCols = screenOptions.maxCols || 1;
    const showDisruptionOnThisScreen = (maxCols === 1 || colIndex === maxCols - 1);

    if (infos.length > 0 && showDisruptionOnThisScreen) {
        activeInfoIndex = (renderCtx.disruptionPageIndex || 0) % infos.length;
        activeInfo = infos[activeInfoIndex];

        if (activeInfo.infoscreenMode === 'ticker') {
            isTickerMode = true;
        } else {
            // Statische Zeilen: 1, 2 oder 3 Zeilen (clamped)
            disruptionRows = Math.min(Math.max(1, activeInfo.infoscreenRows || 1), 3);
        }
    }

    // 4. Zeilenraster berechnen
    const baseTotalRows = screenOptions.maxRows || (isPortrait ? 16 : 6);
    let availableTrainRows = baseTotalRows;
    let disruptionBoxHeight = 0;

    if (isTickerMode) {
        disruptionBoxHeight = isPortrait ? 90 : 75;
    } else if (disruptionRows > 0) {
        availableTrainRows = Math.max(1, baseTotalRows - disruptionRows);
    }

    const usableTrainHeight = height - HEADER_HEIGHT - disruptionBoxHeight;
    const trainRowHeight = usableTrainHeight / availableTrainRows;

    // 5. Abfahrts-Pagination berechnen (über alle Spalten hinweg)
    const trainsPerPage = availableTrainRows * maxCols;
    const totalTrainPages = Math.max(1, Math.ceil(trains.length / trainsPerPage));
    const activeTrainPage = (renderCtx.departurePageIndex || 0) % totalTrainPages;
    const pageOffset = (activeTrainPage * trainsPerPage) + (colIndex * availableTrainRows);
    const visibleTrains = trains.slice(pageOffset, pageOffset + availableTrainRows);

    // Render-Kontext für Header-Seitenzähler ("Seite X/Y") anreichern
    renderCtx.totalTrainPages = totalTrainPages;
    renderCtx.activeTrainPage = activeTrainPage;

    // 6. Kopfzeile zeichnen (nach Pagination-Berechnung, damit Seitenzahl verfügbar ist)
    drawHeader(ctx, width, HEADER_HEIGHT, renderCtx, isPortrait);

    // 7. Züge rendern
    ctx.save();
    // Sanfte Überblendung für Abfahrts-Paging
    if (renderCtx.departurePageAlpha !== undefined && totalTrainPages > 1) {
        ctx.globalAlpha = renderCtx.departurePageAlpha;
    }

    if (trains.length === 0) {
        // Hinweis bei keinen Abfahrten
        const centerY = HEADER_HEIGHT + (usableTrainHeight / 2);
        ctx.textAlign = 'center';
        ctx.font = FONTS.bold(isPortrait ? 30 : 38);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Keine Abfahrten im gewählten Zeitraum', width / 2, centerY - 15);

        ctx.font = FONTS.italic(isPortrait ? 22 : 26);
        ctx.fillStyle = '#64748b';
        ctx.fillText('No departures scheduled in this time period', width / 2, centerY + 25);
    } else {
        for (let i = 0; i < availableTrainRows; i++) {
            const rowY = HEADER_HEIGHT + (i * trainRowHeight);
            const train = visibleTrains[i];

            if (train) {
                drawTrainRow(ctx, train, 0, rowY, width, trainRowHeight, i % 2 === 1, isPortrait);
            } else {
                // Leere Zeile bei dünnem Fahrplan (dezenter Hintergrund ohne Artefakte)
                drawEmptyRow(ctx, 0, rowY, width, trainRowHeight, i % 2 === 1);
            }
        }
    }
    ctx.restore();

    // 8. Störungsbereich ganz unten rendern
    if (infos.length > 0 && activeInfo && showDisruptionOnThisScreen) {
        const disruptionY = height - (isTickerMode ? disruptionBoxHeight : (disruptionRows * trainRowHeight));
        const disruptionH = isTickerMode ? disruptionBoxHeight : (disruptionRows * trainRowHeight);

        ctx.save();
        if (renderCtx.disruptionPageAlpha !== undefined && infos.length > 1) {
            ctx.globalAlpha = renderCtx.disruptionPageAlpha;
        }

        if (isTickerMode) {
            drawTickerBottom(ctx, activeInfo, 0, disruptionY, width, disruptionH, renderCtx);
        } else {
            drawStaticDisruptionBottom(ctx, activeInfo, activeInfoIndex + 1, infos.length, 0, disruptionY, width, disruptionH);
        }
        ctx.restore();
    }
}

/**
 * Zeichnet die Kopfzeile der Abfahrtstafel.
 */
function drawHeader(ctx, width, height, renderCtx, isPortrait) {
    // Header-Hintergrund
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE_HEADER;
    ctx.fillRect(0, 0, width, height);

    // Akzent-Linie unten
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(0, height - 2, width, 2);

    // Links: "Abfahrt Departure"
    ctx.fillStyle = COLORS.WHITE;
    ctx.font = FONTS.bold(44);
    ctx.textAlign = 'left';
    ctx.fillText('Abfahrt', 40, 58);

    ctx.font = FONTS.italic(30);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Departure', 195, 58);

    // Mitte: Bahnhofsname
    const stationName = renderCtx.journeyStore?.stationContext?.stationName || 'Abfahrten';
    ctx.fillStyle = COLORS.WHITE;
    ctx.font = FONTS.bold(40);
    ctx.textAlign = 'center';
    ctx.fillText(stationName, width / 2, 58);

    // Rechts: Live-Uhrzeit (HH:MM:SS)
    const simTime = getSimulatedTime();
    const timeStr = simTime.toTimeString().split(' ')[0]; // "14:35:10"
    ctx.fillStyle = COLORS.WHITE;
    ctx.font = FONTS.bold(46);
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, width - 40, 58);

    // Optionaler Seitenindikator bei Pagination
    if (renderCtx.totalTrainPages && renderCtx.totalTrainPages > 1) {
        ctx.font = FONTS.regular(28);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`Seite ${(renderCtx.activeTrainPage || 0) + 1}/${renderCtx.totalTrainPages}`, width - 260, 58);
    }
}

/**
 * Zeichnet eine einzelne Abfahrtszeile im Voranzeiger.
 */
function drawTrainRow(ctx, train, x, y, width, height, isAlt, isPortrait = false) {
    // Zeilenhintergrund: Einheitliches DB-Blau (kein Zebra-Muster)
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
    ctx.fillRect(x, y, width, height);

    // Feine Trennlinie nach oben
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(x, y, width, 1);

    const isAusfall = !!train.ausfall;
    const hasTrackChange = !!train.hasTrackChange;

    const timeFontSize = isPortrait ? 36 : 48;
    const destFontSize = isPortrait ? 34 : 48;
    const viaFontSize = isPortrait ? 22 : 28;

    // 1. Spalte: Zeit
    const timeX = isPortrait ? 24 : 40;
    const timeY = y + (height * (isPortrait ? 0.48 : 0.44));
    ctx.font = FONTS.bold(timeFontSize);
    ctx.textAlign = 'left';
    ctx.fillStyle = isAusfall ? '#ef4444' : COLORS.WHITE;
    ctx.fillText(train.scheduledTime || '--:--', timeX, timeY);

    if (isAusfall) {
        // Zeit durchstreichen
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = isPortrait ? 3 : 4;
        ctx.beginPath();
        ctx.moveTo(timeX - 4, timeY - (isPortrait ? 11 : 14));
        ctx.lineTo(timeX + (isPortrait ? 95 : 120), timeY - (isPortrait ? 11 : 14));
        ctx.stroke();

        // Roter Hinweis darunter
        ctx.font = FONTS.bold(isPortrait ? 20 : 26);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('Fällt aus', timeX, timeY + (isPortrait ? 28 : 36));
    } else if (train.expectedTime && train.expectedTime !== train.scheduledTime) {
        // Verspätungshinweis
        ctx.font = FONTS.bold(isPortrait ? 22 : 28);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`ca. ${train.expectedTime}`, timeX, timeY + (isPortrait ? 28 : 36));
    }

    // 2. Spalte: Zug / Gattung
    const trainX = isPortrait ? 140 : 180;
    const displayName = train.displayTitle;
    const trainBoxW = isPortrait ? 120 : 160;
    const trainBoxH = isPortrait ? 38 : 46;
    const trainBoxY = timeY - (isPortrait ? 28 : 34);

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(trainX, trainBoxY, trainBoxW, trainBoxH, 6);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = FONTS.bold(isPortrait ? 24 : 34);
    ctx.fillStyle = COLORS.WHITE;
    ctx.textAlign = 'center';
    ctx.fillText(displayName, trainX + (trainBoxW / 2), trainBoxY + (isPortrait ? 27 : 33));

    // 3. Spalte: Ziel & Vias
    const destX = isPortrait ? 280 : 380;
    ctx.textAlign = 'left';
    ctx.font = FONTS.bold(destFontSize);
    ctx.fillStyle = isAusfall ? '#94a3b8' : COLORS.WHITE;
    const destText = train.displayDestination;
    ctx.fillText(destText, destX, timeY);

    // Vias / Haltestellenkette
    const viaY = timeY + (isPortrait ? 30 : 38);
    ctx.font = FONTS.regular(viaFontSize);
    ctx.fillStyle = '#94a3b8';
    let viaStr = (train.vias && train.vias.length > 0) ? train.vias.join(' • ') : '';
    if (train.verkehrtAb && train.verkehrtAb !== '0') {
        viaStr = `Verkehrt ab ${train.verkehrtAb} • ${viaStr}`;
    }
    
    // Abschneiden bei Überlänge mit Auslassungspunkten
    const rightMargin = isPortrait ? 180 : 320;
    const maxViaWidth = width - destX - rightMargin;
    viaStr = truncateWithEllipsis(ctx, viaStr, maxViaWidth);
    ctx.fillText(viaStr, destX, viaY);

    // 4. Spalte: Gleis
    const gleisX = width - (isPortrait ? 160 : 260);
    const gleisNum = train.platform || '-';

    if (hasTrackChange) {
        // Gleiswechsel-Inverskasten
        const boxW = isPortrait ? 140 : 200;
        const boxH = isPortrait ? 44 : 56;
        const boxY = timeY - (isPortrait ? 30 : 38);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(gleisX, boxY, boxW, boxH, 6);
        ctx.fill();

        ctx.font = FONTS.bold(isPortrait ? 28 : 36);
        ctx.fillStyle = COLORS.NAVY;
        ctx.textAlign = 'center';
        ctx.fillText(`Gl. ${train.ezGleis || gleisNum}`, gleisX + (boxW / 2), boxY + (isPortrait ? 31 : 39));

        ctx.font = FONTS.regular(isPortrait ? 18 : 22);
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`statt ${gleisNum}`, gleisX + (boxW / 2), boxY + (isPortrait ? 60 : 76));
    } else {
        ctx.font = FONTS.bold(isPortrait ? 36 : 44);
        ctx.fillStyle = COLORS.WHITE;
        ctx.textAlign = 'left';
        ctx.fillText(`Gl. ${gleisNum}`, gleisX, timeY);
    }
}

/**
 * Zeichnet eine saubere leere Zeile bei unvollständiger Belegung.
 */
function drawEmptyRow(ctx, x, y, width, height, isAlt) {
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x, y, width, 1);
}

/**
 * Zeichnet eine prominente statische Störungsbox am unteren Bildschirmrand.
 */
function drawStaticDisruptionBottom(ctx, infoJourney, pageNum, totalPages, x, y, width, height) {
    // 1. Box-Hintergrund (Warnendes Nachtblau mit solidem Rand)
    ctx.fillStyle = '#101a3d';
    ctx.fillRect(x + 16, y + 8, width - 32, height - 16);

    // Rand in Signal-Orange/Rot
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 16, y + 8, width - 32, height - 16);

    // 2. Warn-Icon und Header-Badge
    const badgeX = x + 36;
    const badgeY = y + 26;
    
    // Warndreieck
    ctx.font = FONTS.bold(42);
    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'left';
    ctx.fillText('⚠', badgeX, badgeY + 32);

    // Badge-Text
    ctx.font = FONTS.bold(32);
    ctx.fillStyle = '#f59e0b';
    const title = infoJourney.displayNameOverride || 'GROSSSTÖRUNG / INFORMATION';
    ctx.fillText(title, badgeX + 48, badgeY + 28);

    // Mehrfach-Meldungen Indikator (z.B. Meldung 1/2)
    if (totalPages > 1) {
        ctx.font = FONTS.regular(24);
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'right';
        ctx.fillText(`Meldung ${pageNum}/${totalPages}`, width - 40, badgeY + 28);
    }

    // 3. Störungstext(e) darstellen
    const textX = badgeX + 48;
    const textY = badgeY + 68;
    const maxTextWidth = width - textX - 60;

    let messageText = '';
    if (infoJourney.infoTexts && infoJourney.infoTexts.length > 0) {
        messageText = infoJourney.infoTexts
            .filter(t => t.visible)
            .map(t => t.text)
            .join(' ');
    } else if (infoJourney.scrollText) {
        messageText = infoJourney.scrollText;
    }

    if (!messageText) {
        messageText = 'Bitte beachten Sie die Lautsprecheransagen und Aushänge am Bahnsteig.';
    }

    drawWrappedText(ctx, messageText, textX, textY, maxTextWidth, 42, FONTS.regular(34), COLORS.WHITE, 'left', 3);
}

/**
 * Zeichnet einen schlanken Lauftext-Ticker am unteren Bildschirmrand.
 */
function drawTickerBottom(ctx, infoJourney, x, y, width, height, renderCtx) {
    ctx.fillStyle = '#0e1738';
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x, y, width, 2);

    // Statischer Warn-Badge links
    const badgeW = 200;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y + 2, badgeW, height - 2);

    ctx.font = FONTS.bold(28);
    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ INFORMATION', x + (badgeW / 2), y + 46);

    // Lauftext rechts
    let tickerText = infoJourney.scrollText || '';
    if (!tickerText && infoJourney.infoTexts) {
        tickerText = infoJourney.infoTexts.filter(t => t.visible).map(t => t.text).join(' +++ ');
    }
    if (!tickerText) tickerText = 'Aktuelle Fahrplanänderungen vorbehalten.';

    const fullTicker = `+++ ${tickerText} +++ ${tickerText} +++`;

    // Clipping für den Tickerbereich
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + badgeW + 10, y, width - badgeW - 20, height);
    ctx.clip();

    ctx.font = FONTS.regular(34);
    ctx.fillStyle = COLORS.WHITE;
    ctx.textAlign = 'left';

    const textWidth = ctx.measureText(fullTicker).width;
    const offset = ((renderCtx.tickerOffset || 0) % (textWidth / 2));
    ctx.fillText(fullTicker, x + badgeW + 20 - offset, y + 47);
    ctx.restore();
}

/**
 * Exportierte Platzhalter-Funktion für Kompatibilität mit dem bisherigen Import in TrainDisplay.
 */
export function drawListeRow(ctx, journey, width, height) {
    if (!journey) return;
    drawTrainRow(ctx, journey, 0, 0, width, height, false);
}
