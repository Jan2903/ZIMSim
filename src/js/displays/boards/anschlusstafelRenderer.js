// js/displays/boards/anschlusstafelRenderer.js
import { COLORS, FONTS } from '../core/constants.js';
import { drawText, drawWrappedText, truncateWithEllipsis, drawLineBadge } from '../core/textUtils.js';
import { getSimulatedTime } from '../../core/utils/config.js';
import { lineColorService } from '../../features/journey/services/lineColorService.svelte.js';
import { drawDBLogo, drawAnalogClock } from '../core/sharedRenderers.js';

/**
 * Vollständiger dynamischer Renderer für Voranzeiger und Abfahrtstafeln (Anschlusstafel).
 *
 * Eigenschaften:
 * - Dynamische Kopfzeile ("Abfahrt Departure", Station, Live-Uhrzeit)
 * - Flexible Abfahrtszeilen mit Echtzeit-Status, Verspätungen, Ausfällen, Vias und Gleiswechsel-Inverskästen
 * - Platzierung von Störungen/Infoscreens IMMER GANZ UNTEN (als statische Zeile(n) oder Ticker-Lauftext)
 * - Automatisches Abfahrts-Paging (10s) und Störungs-Paging (6s)
 */

/**
 * Zeichnet das gesamte Voranzeiger- / Anschlusstafel-Board auf den Canvas.
 * @param {CanvasRenderingContext2D} ctx - Der Canvas-Kontext.
 * @param {import('../../features/journey/journey.svelte.js').Journey[]} journeys - Alle Fahrten.
 * @param {number} width - Verfügbare Breite (z.B. 1920 oder 2560).
 * @param {number} height - Verfügbare Höhe (z.B. 1080 oder 1920).
 * @param {object} renderCtx - Render-Kontext mit Pagination- und Scroll-Daten.
 * @param {object} [screenOptions={}] - Optionale Bildschirminformationen.
 */
export function drawVoranzeigerBoard(ctx, journeys = [], width = 1920, height = 1080, renderCtx = {}, screenOptions = {}) {
    const isPortrait = height > width; // z.B. Stele 1080×1920
    const HEADER_HEIGHT = isPortrait ? 116 : 108;

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
 * Originalgetreu nach DB-Voranzeiger:
 * - Analoge Uhr & digitale Uhrzeit (HH MM) oben links
 * - "Abfahrt Departure"
 * - DB-Logo oben rechts
 * - Zweisprachige Spaltenüberschriften ("Zug / Train", "Zeit / Time", "Über / Via", "Ziel / Destination", "Gleis / Track")
 * - Weiße horizontale Unterstriche unter den Spaltenköpfen
 */
function drawHeader(ctx, width, height, renderCtx, isPortrait) {
    // Header-Hintergrund
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE_HEADER;
    ctx.fillRect(0, 0, width, height);

    // 1. Oben links: Analoge Uhr + digitale Uhrzeit (HH:MM ohne Sekunden)
    const simTime = getSimulatedTime();
    const hours = simTime.getHours();
    const minutes = simTime.getMinutes();
    const clockCenterX = isPortrait ? 30 : 44;
    const clockCenterY = isPortrait ? 32 : 36;
    const clockRadius = isPortrait ? 13 : 16;

    // Analoge Uhr aus sharedRenderers
    drawAnalogClock(ctx, clockCenterX, clockCenterY, clockRadius, simTime);

    // Digitale Uhrzeit (HH MM)
    const timeX = clockCenterX + clockRadius + (isPortrait ? 10 : 14);
    const timeStr = `${String(hours).padStart(2, '0')} ${String(minutes).padStart(2, '0')}`;
    ctx.fillStyle = COLORS.WHITE;
    ctx.font = FONTS.bold(isPortrait ? 28 : 36);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, timeX, clockCenterY);

    // 2. Titel: "Abfahrt Departure"
    const titleX = timeX + (isPortrait ? 80 : 110);
    ctx.font = FONTS.bold(isPortrait ? 30 : 38);
    ctx.fillText('Abfahrt', titleX, clockCenterY);

    const abfahrtW = ctx.measureText('Abfahrt').width;
    ctx.font = FONTS.italic(isPortrait ? 24 : 32);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Departure', titleX + abfahrtW + 10, clockCenterY);

    // 3. Oben rechts: DB-Logo aus sharedRenderers
    const logoW = isPortrait ? 52 : 62;
    const logoH = isPortrait ? 38 : 46;
    const logoX = width - (isPortrait ? 24 : 40) - logoW;
    const logoY = clockCenterY + (isPortrait ? 9 : 12);
    drawDBLogo(ctx, logoX, logoY, logoW, logoH);

    // Optionaler Seitenindikator bei Pagination links neben dem DB-Logo
    if (renderCtx.totalTrainPages && renderCtx.totalTrainPages > 1) {
        ctx.font = FONTS.regular(isPortrait ? 20 : 26);
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText(`Seite ${(renderCtx.activeTrainPage || 0) + 1}/${renderCtx.totalTrainPages}`, logoX - 20, clockCenterY);
    }

    // 4. Zweisprachige Spaltenbeschriftungen mit horizontalen Teilstrichen
    ctx.textBaseline = 'alphabetic';
    const subY1 = isPortrait ? 68 : 74;
    const subY2 = isPortrait ? 86 : 94;
    const lineY = isPortrait ? 96 : 104;
    const subFont = FONTS.regular(isPortrait ? 14 : 17);

    ctx.font = subFont;
    ctx.fillStyle = '#cbd5e1';

    // Spalte 1: Zug / Train & Zeit / Time
    const col1X = isPortrait ? 24 : 40;
    const col1W = isPortrait ? 190 : 260;
    ctx.textAlign = 'left';
    ctx.fillText('Zug / Train', col1X, subY1);
    ctx.fillText('Zeit / Time', col1X, subY2);

    // Spalte 2: Über / Via & Ziel / Destination
    const col2X = isPortrait ? 240 : 340;
    const col2W = width - col2X - (isPortrait ? 180 : 320);
    ctx.fillText('Über / Via', col2X, subY1);
    ctx.fillText('Ziel / Destination', col2X, subY2);

    // Spalte 3: Gleis / Track
    const col3X = width - (isPortrait ? 150 : 250);
    const col3W = width - col3X - (isPortrait ? 24 : 40);
    ctx.fillText('Gleis / Track', col3X, subY1);

    // Horizontale weiße Teilstriche unter den Spaltenköpfen
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(col1X, lineY, col1W, 2);
    ctx.fillRect(col2X, lineY, col2W, 2);
    ctx.fillRect(col3X, lineY, col3W, 2);
}

/**
 * Zeichnet eine einzelne Abfahrtszeile im Voranzeiger.
 * Originalgetreu nach DB-Standard:
 * - Bei Ausfall: Vollständige Zeileninvertierung (weißer Hintergrund, dunkelblaue Schrift aus COLORS.MIDNIGHT_BLUE, kein Rot)
 * - Vias ("Über / Via") oben, Fahrtziel ("Ziel / Destination") unten
 * - Zugnummer ("Zug / Train") oben, Abfahrtszeit ("Zeit / Time") unten
 * - Verspätung in weiß umrandetem Kasten [HH:MM] rechts neben der Planzeit
 * - Bei Gleiswechsel: Weißer Inverskasten mit reiner Gleisnummer in COLORS.MIDNIGHT_BLUE (ohne "Gl.")
 * - Reine Gleisnummern (ohne "Gl.")
 */
function drawTrainRow(ctx, train, x, y, width, height, isAlt, isPortrait = false) {
    const isAusfall = !!train.ausfall;
    const hasTrackChange = !!train.hasTrackChange;

    // 1. Zeilenhintergrund: Normal DB-Blau, bei Ausfall VOLLSTÄNDIG WEISS INVERTIERT
    if (isAusfall) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, width, height);
    } else {
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.fillRect(x, y, width, height);

        // Trennlinie nach unten
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(x + 40, y + height - 2, width - 80, 2);
    }

    // Textfarben: Bei Invertierung das bekannte Dunkelblau (COLORS.MIDNIGHT_BLUE) als Textfarbe!
    const primaryColor = isAusfall ? COLORS.MIDNIGHT_BLUE : COLORS.WHITE;
    const secondaryColor = isAusfall ? COLORS.MIDNIGHT_BLUE : '#cbd5e1';

    // ----------------------------------------------------
    // SPALTE 1: ZUG / TRAIN (oben) & ZEIT / TIME (unten)
    // ----------------------------------------------------
    const col1X = isPortrait ? 24 : 40;
    const displayName = train.displayTitle || '';

    // A. Oberes Sub-Element: Zug / Gattung
    const trainBoxW = isPortrait ? 115 : 150;
    const trainBoxH = isPortrait ? 34 : 40;
    const trainBoxY = y + (height * 0.16);

    if (isAusfall) {
        // Bei Ausfall im weißen Balken: Kasten mit dunkelblauem Rahmen & Text
        ctx.strokeStyle = COLORS.MIDNIGHT_BLUE;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(col1X, trainBoxY, trainBoxW, trainBoxH, 4);
        ctx.stroke();

        ctx.font = FONTS.bold(isPortrait ? 22 : 28);
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayName, col1X + (trainBoxW / 2), trainBoxY + (trainBoxH / 2));
    } else {
        // Reguläres Linien-/Gattungsbadge
        const font = FONTS.bold(isPortrait ? 22 : 28);
        const badgeStyle = lineColorService.resolveStyle(displayName, {
            operator: train.operator,
            defaultBgColor: '#1e293b',
            defaultTextColor: COLORS.WHITE
        });
        drawLineBadge(ctx, displayName, col1X, trainBoxY, trainBoxW, trainBoxH, {
            font,
            ...badgeStyle
        });
    }

    // B. Unteres Sub-Element: Zeit & Status
    ctx.textBaseline = 'alphabetic';
    const timeY = y + (height * 0.76);
    let timeTextX = col1X;

    const hasStatusChange = isAusfall || hasTrackChange || (train.expectedTime && train.expectedTime !== train.scheduledTime);
    if (hasStatusChange) {
        // Weißer Statuspunkt (bzw. dunkelblau bei Ausfall) vor der Zeit
        ctx.font = FONTS.bold(isPortrait ? 28 : 36);
        ctx.fillStyle = primaryColor;
        ctx.textAlign = 'left';
        ctx.fillText('•', timeTextX, timeY);
        timeTextX += (isPortrait ? 18 : 24);
    }

    if (isAusfall) {
        // Ausfall-Kreuz vor der Zeit
        ctx.font = FONTS.bold(isPortrait ? 30 : 38);
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.textAlign = 'left';
        ctx.fillText('×', timeTextX, timeY);
        timeTextX += (isPortrait ? 22 : 28);
    }

    // Planabfahrtszeit
    const schedTime = train.scheduledTime || '--:--';
    ctx.font = FONTS.bold(isPortrait ? 34 : 46);
    ctx.fillStyle = primaryColor;
    ctx.textAlign = 'left';
    ctx.fillText(schedTime, timeTextX, timeY);

    if (isAusfall) {
        // Zeit mit horizontaler Linie in Dunkelblau durchstreichen
        const schedW = ctx.measureText(schedTime).width;
        ctx.strokeStyle = COLORS.MIDNIGHT_BLUE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(timeTextX - 2, timeY - (isPortrait ? 11 : 14));
        ctx.lineTo(timeTextX + schedW + 2, timeY - (isPortrait ? 11 : 14));
        ctx.stroke();
    } else if (train.expectedTime && train.expectedTime !== train.scheduledTime) {
        // Verspätungskasten [HH:MM] rechts neben der Planzeit
        const schedW = ctx.measureText(schedTime).width;
        const delayBoxX = timeTextX + schedW + (isPortrait ? 10 : 14);
        const delayBoxW = isPortrait ? 78 : 96;
        const delayBoxH = isPortrait ? 30 : 36;
        const delayBoxY = timeY - (isPortrait ? 24 : 32);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(delayBoxX, delayBoxY, delayBoxW, delayBoxH, 4);
        ctx.stroke();

        ctx.font = FONTS.bold(isPortrait ? 22 : 28);
        ctx.fillStyle = COLORS.WHITE;
        ctx.textAlign = 'center';
        ctx.fillText(train.expectedTime, delayBoxX + (delayBoxW / 2), timeY - 2);
    }

    // ----------------------------------------------------
    // SPALTE 2: ÜBER / VIA (oben) & ZIEL / DESTINATION (unten)
    // ----------------------------------------------------
    const destX = isPortrait ? 240 : 340;

    // A. Oberes Sub-Element: Vias / "Fahrt fällt aus"
    const viaY = y + (height * 0.32);
    ctx.textAlign = 'left';

    if (isAusfall) {
        ctx.font = FONTS.regular(isPortrait ? 24 : 30);
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.fillText('Fahrt fällt aus', destX, viaY);
    } else {
        ctx.font = FONTS.regular(isPortrait ? 20 : 26);
        ctx.fillStyle = secondaryColor;

        let viaStr = (train.vias && train.vias.length > 0) ? train.vias.join(' - ') : '';
        if (train.verkehrtAb && train.verkehrtAb !== '0') {
            viaStr = `Verkehrt ab ${train.verkehrtAb} - ${viaStr}`;
        }
        const rightMargin = isPortrait ? 180 : 320;
        const maxViaWidth = width - destX - rightMargin;
        viaStr = truncateWithEllipsis(ctx, viaStr, maxViaWidth);
        ctx.fillText(viaStr, destX, viaY);
    }

    // B. Unteres Sub-Element: Fahrtziel
    const destY = y + (height * 0.76);
    let destText = train.displayDestination || '';
    if (/flughafen|airport/i.test(destText) && !destText.includes('✈')) {
        destText = `✈ ${destText}`;
    }

    ctx.font = FONTS.bold(isPortrait ? 34 : 46);
    ctx.fillStyle = primaryColor;
    ctx.fillText(destText, destX, destY);

    // ----------------------------------------------------
    // SPALTE 3: GLEIS / TRACK
    // ----------------------------------------------------
    const gleisX = width - (isPortrait ? 150 : 250);
    const gleisY = y + (height * 0.76);
    const rawTrack = train.platform || '-';
    const cleanTrack = String(rawTrack).replace(/^Gl\.\s*/i, '').trim();

    if (isAusfall) {
        ctx.font = FONTS.bold(isPortrait ? 34 : 46);
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.textAlign = 'left';
        ctx.fillText('-', gleisX, gleisY);
    } else if (hasTrackChange) {
        // Gleiswechsel: Weißer Inverskasten mit neuer Gleisnummer in COLORS.MIDNIGHT_BLUE
        const newTrack = (train.ezGleis || cleanTrack).replace(/^Gl\.\s*/i, '').trim();
        const boxW = isPortrait ? 85 : 110;
        const boxH = isPortrait ? 44 : 52;
        const boxY = gleisY - (isPortrait ? 34 : 40);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(gleisX - 6, boxY, boxW, boxH, 4);
        ctx.fill();

        ctx.font = FONTS.bold(isPortrait ? 34 : 46);
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.textAlign = 'center';
        ctx.fillText(newTrack, gleisX - 6 + (boxW / 2), gleisY);
    } else {
        ctx.font = FONTS.bold(isPortrait ? 34 : 46);
        ctx.fillStyle = COLORS.WHITE;
        ctx.textAlign = 'left';
        ctx.fillText(cleanTrack, gleisX, gleisY);
    }

    // ----------------------------------------------------
    // SPALTE 4: PIKTOGRAMME (z.B. Fahrradmitnahme)
    // ----------------------------------------------------
    const hasBike = train.hasBike || train.bike || (train.amenities && (train.amenities.includes('bike') || train.amenities.includes('bicycle')));
    if (hasBike && !isAusfall) {
        const bikeBoxSize = isPortrait ? 36 : 42;
        const bikeBoxX = width - (isPortrait ? 50 : 85);
        const bikeBoxY = gleisY - (isPortrait ? 28 : 34);

        ctx.strokeStyle = COLORS.WHITE;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bikeBoxX, bikeBoxY, bikeBoxSize, bikeBoxSize, 4);
        ctx.stroke();

        ctx.font = FONTS.bold(isPortrait ? 20 : 24);
        ctx.fillStyle = COLORS.WHITE;
        ctx.textAlign = 'center';
        ctx.fillText('🚲', bikeBoxX + (bikeBoxSize / 2), gleisY - 3);

        ctx.font = FONTS.bold(isPortrait ? 9 : 11);
        ctx.fillText('R', bikeBoxX + bikeBoxSize - 7, bikeBoxY + 11);
    }
}

/**
 * Zeichnet eine saubere leere Zeile bei unvollständiger Belegung.
 */
function drawEmptyRow(ctx, x, y, width, height, isAlt) {
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x + 40, y + height - 2, width - 80, 2);
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

export { drawVoranzeigerBoard as drawAnschlusstafelBoard };
