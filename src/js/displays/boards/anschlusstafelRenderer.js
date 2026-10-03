// js/displays/boards/anschlusstafelRenderer.js
import { COLORS, FONTS } from '../core/constants.js';
import { drawText, drawWrappedText, truncateWithEllipsis, drawLineBadge } from '../core/textUtils.js';
import { getSimulatedTime } from '../../core/utils/config.js';
import { lineColorService } from '../../features/journey/services/lineColorService.svelte.js';
import { drawDBLogo, drawAnalogClock } from '../core/sharedRenderers.js';
import { drawQualityIcons, getMatchingPictogramRules } from '../primitives/pictogramRenderer.js';

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
                const prevTrain = visibleTrains[i - 1];
                const nextTrain = visibleTrains[i + 1];

                const isCoupledWithPrev = !!(prevTrain && (
                    (train.couplingGroupId && train.couplingGroupId === prevTrain.couplingGroupId) ||
                    (train.coupled && prevTrain.coupled && train.platform === prevTrain.platform && train.scheduledTime === prevTrain.scheduledTime)
                ));

                const isCoupledWithNext = !!(nextTrain && (
                    (train.couplingGroupId && train.couplingGroupId === nextTrain.couplingGroupId) ||
                    (train.coupled && nextTrain.coupled && train.platform === nextTrain.platform && train.scheduledTime === nextTrain.scheduledTime)
                ));

                drawTrainRow(ctx, train, 0, rowY, width, trainRowHeight, i % 2 === 1, isPortrait, {
                    isCoupledWithPrev,
                    isCoupledWithNext,
                    prevTrain,
                    nextTrain
                });
            } else {
                // Leere Zeilen bei dünnem Fahrplan auffüllen
                drawEmptyRow(ctx, 0, rowY, width, trainRowHeight, i % 2 === 1, isPortrait);
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
 * Berechnet das einheitliche 4-Spalten-Raster für Header, Zeilen und leere Zeilen.
 * Spalte 1: Zug / Train (oben) & Zeit / Time (unten)
 * Spalte 2: Über / Via (oben) & Ziel / Destination (unten)
 * Spalte 3: Gleis / Track
 * Spalte 4: Symbole / Piktogramme
 *
 * @param {number} width - Gesamtbreite des Displays
 * @param {boolean} isPortrait - Ob Hochformat aktiv ist
 * @returns {{col1X: number, col1W: number, col2X: number, col2W: number, col3X: number, col3W: number, col4X: number, col4W: number}}
 */
function getColumnGeometry(width, isPortrait) {
    if (isPortrait) {
        const col1X = 24;
        const col1W = 190;
        const col2X = 240;
        const col2W = width - col2X - 190;
        const col3X = width - 170;
        const col3W = 95;
        const col4X = width - 65;
        const col4W = 45;
        return { col1X, col1W, col2X, col2W, col3X, col3W, col4X, col4W };
    }

    // Querformat (Standard 1920×1080):
    // Rand links: 72px, Rand rechts: 28px (Spalten weiter rechts, schmaler rechter Rand)
    const col1X = 72;
    const col1W = 280;
    const col2X = 388;
    const col2W = 1140;
    const col3X = 1560;
    const col3W = 150;
    const col4X = 1738;
    const col4W = 154;

    return { col1X, col1W, col2X, col2W, col3X, col3W, col4X, col4W };
}

/**
 * Zeichnet die Kopfzeile der Abfahrtstafel.
 * Originalgetreu nach DB-Voranzeiger:
 * - Analoge Uhr & digitale Uhrzeit (HH:MM) oben links
 * - "Abfahrt Departure"
 * - DB-Logo oben rechts
 * - Zweisprachige Spaltenüberschriften ("Zug / Train", "Zeit / Time", "Über / Via", "Ziel / Destination", "Gleis / Track")
 * - Kein abweichender Hintergrund (einheitliches DB-Blau über den gesamten Bildschirm)
 * - Horizontale Trennstriche werden von den darunterliegenden Zeilen oben gerendert
 */
function drawHeader(ctx, width, height, renderCtx, isPortrait) {
    // Spalten-Geometrie für Header und Zeilen einheitlich (4-Spalten-Raster)
    const { col1X, col1W, col2X, col2W, col3X, col3W, col4X, col4W } = getColumnGeometry(width, isPortrait);

    // 1. Oben links: Analoge Uhr + digitale Uhrzeit (HH:MM mit Doppelpunkt)
    const simTime = getSimulatedTime();
    const hours = simTime.getHours();
    const minutes = simTime.getMinutes();
    const clockCenterX = isPortrait ? (col1X + 16) : (col1X + 22);
    const clockCenterY = isPortrait ? 28 : 30;
    const clockRadius = isPortrait ? 13 : 18;

    // Analoge Uhr aus sharedRenderers
    drawAnalogClock(ctx, clockCenterX, clockCenterY, clockRadius, simTime);

    // Digitale Uhrzeit (HH:MM)
    const timeX = clockCenterX + clockRadius + (isPortrait ? 10 : 16);
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    ctx.fillStyle = COLORS.WHITE;
    ctx.font = FONTS.bold(isPortrait ? 28 : 42);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, timeX, clockCenterY);

    // 2. Titel: "Abfahrt Departure" (bündig über der Über/Ziel-Spalte)
    const titleX = isPortrait ? (timeX + 80) : col2X;
    ctx.font = FONTS.bold(isPortrait ? 30 : 44);
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillText('Abfahrt', titleX, clockCenterY);

    const abfahrtW = ctx.measureText('Abfahrt').width;
    ctx.font = FONTS.italic(isPortrait ? 24 : 40);
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillText('Departure', titleX + abfahrtW + 12, clockCenterY);

    // 3. Oben rechts: DB-Logo aus sharedRenderers (über der Symbol-Spalte rechtsbündig)
    const logoW = isPortrait ? 52 : 72;
    const logoH = isPortrait ? 38 : 50;
    const logoX = col4X + col4W - logoW;
    const logoY = clockCenterY;
    drawDBLogo(ctx, logoX, logoY, logoW, logoH);

    // Optionaler Seitenindikator bei Pagination links neben dem DB-Logo
    if (renderCtx.totalTrainPages && renderCtx.totalTrainPages > 1) {
        ctx.font = FONTS.regular(isPortrait ? 20 : 26);
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText(`Seite ${(renderCtx.activeTrainPage || 0) + 1}/${renderCtx.totalTrainPages}`, logoX - 20, clockCenterY);
    }

    // 4. Zweisprachige Spaltenbeschriftungen (Trennstriche werden von den Zeilen oben gerendert)
    ctx.textBaseline = 'alphabetic';
    const subY1 = isPortrait ? 74 : 74;
    const subY2 = isPortrait ? 94 : 96;
    const subFont = FONTS.bold(isPortrait ? 14 : 19);

    ctx.font = subFont;
    ctx.fillStyle = '#e2e8f0';

    // Spalte 1: Zug / Train & Zeit / Time
    ctx.textAlign = 'left';
    ctx.fillText('Zug / Train', col1X, subY1);
    ctx.fillText('Zeit / Time', col1X, subY2);

    // Spalte 2: Über / Via & Ziel / Destination
    ctx.fillText('Über / Via', col2X, subY1);
    ctx.fillText('Ziel / Destination', col2X, subY2);

    // Spalte 3: Gleis / Track (zentriert über der Gleisspalte auf Grundlinie von Zeit & Ziel)
    ctx.textAlign = 'center';
    ctx.fillText('Gleis / Track', col3X + (col3W / 2), subY2);
}

/**
 * Zeichnet eine einzelne Abfahrtszeile im Voranzeiger.
 * Originalgetreu nach DB-Standard:
 * - Bei Ausfall: Vollständige Zeileninvertierung (weißer Hintergrund, dunkelblaue Schrift aus COLORS.MIDNIGHT_BLUE, kein Rot)
 * - Vias ("Über / Via") oben, Fahrtziel ("Ziel / Destination") unten
 * - Zugnummer ("Zug / Train") oben, Abfahrtszeit ("Zeit / Time") unten
 * - Bei Flügelzug:
 *   a) Keine Trennstriche zwischen beiden Zugteilen
 *   b) Verbindungs-Klammer links vor den Zielen
 *   c) Beim zweiten Teilzug keine Zeitanzeige, wenn Planzeit übereinstimmt
 * - Trennstriche werden pro Zeile OBEN gerendert für absolut gleichmäßige Abstände
 * - Reine Gleisnummern (ohne "Gl.")
 * @param {CanvasRenderingContext2D} ctx - Canvas Kontext
 * @param {object} train - Zugfahrt-Daten
 * @param {number} x - X-Position
 * @param {number} y - Y-Position (oberer Rand der Zeile)
 * @param {number} width - Zeilenbreite
 * @param {number} height - Zeilenhöhe
 * @param {boolean} isAlt - Alternierender Zeilenhintergrund
 * @param {boolean} [isPortrait=false] - Ob Hochformat aktiv ist
 * @param {object} [coupledInfo={}] - Kopplungs-Informationen (Flügelzug)
 * @returns {void}
 */
function drawTrainRow(ctx, train, x, y, width, height, isAlt, isPortrait = false, coupledInfo = {}) {
    const isAusfall = !!train.ausfall;
    const hasTrackChange = !!train.hasTrackChange;
    const isCoupledWithPrev = !!coupledInfo.isCoupledWithPrev;
    const isCoupledWithNext = !!coupledInfo.isCoupledWithNext;
    const prevTrain = coupledInfo.prevTrain;

    // 1. Spaltengeometrie (exakt synchronisiert mit dem Header)
    const { col1X, col1W, col2X, col2W, col3X, col3W, col4X, col4W } = getColumnGeometry(width, isPortrait);

    // 1. Zeilenhintergrund: Bei Ausfall VOLLSTÄNDIG WEISS INVERTIERT
    if (isAusfall) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, width, height);
    } else {
        // Segmentierte weiße Trennstriche nach OBEN pro Spalte (oben statt unten gerendert!)
        // Bei Teilzug 2 eines Flügelzugs oder direkt unter einer Ausfallzeile: KEINE Trennstriche nach oben!
        const prevWasAusfall = prevTrain && (prevTrain.ausfall || prevTrain.isCancelled);
        if (!isCoupledWithPrev && !prevWasAusfall) {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(col1X, y, col1W, 2);
            ctx.fillRect(col2X, y, col2W, 2);
            ctx.fillRect(col3X, y, col3W, 2);
            ctx.fillRect(col4X, y, col4W, 2);
        }
    }

    // Textfarben: Bei Invertierung das bekannte Dunkelblau (COLORS.MIDNIGHT_BLUE) als Textfarbe!
    const primaryColor = isAusfall ? COLORS.MIDNIGHT_BLUE : COLORS.WHITE;
    const secondaryColor = isAusfall ? COLORS.MIDNIGHT_BLUE : COLORS.WHITE;

    // ----------------------------------------------------
    // SPALTE 1: ZUG / TRAIN (oben) & ZEIT / TIME (unten)
    // ----------------------------------------------------
    const displayName = train.displayTitle || '';
    const badgeH = isPortrait ? 34 : 40;
    const badgeY = y + (height * 0.14);

    ctx.font = FONTS.bold(isPortrait ? 22 : 30);
    const textW = ctx.measureText(displayName).width;
    const badgePadding = isPortrait ? 16 : 24;
    const badgeW = Math.max(isPortrait ? 60 : 72, Math.min(col1W, textW + badgePadding));

    if (isAusfall) {
        // Bei Ausfall im weißen Balken: Gattungs-/Linienbadge
        const font = FONTS.bold(isPortrait ? 22 : 30);
        let badgeStyle = lineColorService.resolveStyle(displayName, {
            operator: train.operator,
            isAusfall: true,
            defaultBgColor: '#1c6276',
            defaultTextColor: COLORS.WHITE
        });
        if (badgeStyle.backgroundColor === '#ffffff' || badgeStyle.shape === 'outline') {
            badgeStyle = {
                ...badgeStyle,
                backgroundColor: '#1c6276',
                textColor: COLORS.WHITE,
                borderColor: 'transparent',
                shape: 'rounded'
            };
        }
        drawLineBadge(ctx, displayName, col1X, badgeY, badgeW, badgeH, {
            font,
            ...badgeStyle
        });
    } else {
        // Reguläres Linien-/Gattungsbadge
        const font = FONTS.bold(isPortrait ? 22 : 30);
        const badgeStyle = lineColorService.resolveStyle(displayName, {
            operator: train.operator,
            defaultBgColor: '#1e293b',
            defaultTextColor: COLORS.WHITE
        });
        drawLineBadge(ctx, displayName, col1X, badgeY, badgeW, badgeH, {
            font,
            ...badgeStyle
        });
    }

    // B. Unteres Sub-Element: Zeit & Status
    // Beim zweiten/unteren Flügelzug keine Anzeige der Uhrzeit (wenn Planzeit übereinstimmt)
    const isSecondCoupledPart = isCoupledWithPrev && (prevTrain && train.scheduledTime === prevTrain.scheduledTime);
    const timeY = y + (height * 0.78);

    if (!isSecondCoupledPart) {
        ctx.textBaseline = 'alphabetic';

        // Planabfahrtszeit: Bleibt IMMER linksbündig auf col1X (auch bei Ausfall nicht verschoben)
        const schedTime = train.scheduledTime || '--:--';
        ctx.font = FONTS.bold(isPortrait ? 34 : 60);
        ctx.fillStyle = primaryColor;
        ctx.textAlign = 'left';
        ctx.fillText(schedTime, col1X, timeY);

        if (isAusfall) {
            // Ausfall-Kreuz "×" im freien linken Randbereich links von col1X (Abfahrtszeit bleibt fest auf col1X)
            const crossX = col1X - (isPortrait ? 18 : 28);
            ctx.font = FONTS.bold(isPortrait ? 30 : 44);
            ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
            ctx.textAlign = 'center';
            ctx.fillText('×', crossX, timeY);
        } else if (train.expectedTime && train.expectedTime !== train.scheduledTime) {
            // Verspätungskasten: Invertierter, ausgefüllter weißer eckiger (nicht gerundeter) Kasten
            const schedW = ctx.measureText(schedTime).width;
            const delayBoxX = col1X + schedW + (isPortrait ? 10 : 12);
            const delayBoxW = isPortrait ? 78 : 96;
            const delayBoxH = isPortrait ? 30 : 40;
            const delayBoxY = timeY - (isPortrait ? 24 : 36);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(delayBoxX, delayBoxY, delayBoxW, delayBoxH);

            ctx.font = FONTS.bold(isPortrait ? 22 : 32);
            ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(train.expectedTime, delayBoxX + (delayBoxW / 2), delayBoxY + (delayBoxH / 2));
        }
    }

    // ----------------------------------------------------
    // SPALTE 2: ÜBER / VIA (oben) & ZIEL / DESTINATION (unten) + VERBINDUNGS-KLAMMER
    // ----------------------------------------------------

    // A. Oberes Sub-Element: Vias / "Fahrt fällt aus"
    const viaY = y + (height * 0.30);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (isAusfall) {
        ctx.font = FONTS.bold(isPortrait ? 24 : 32);
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.fillText('Fahrt fällt aus', col2X, viaY);
    } else {
        ctx.font = FONTS.bold(isPortrait ? 20 : 30);
        ctx.fillStyle = secondaryColor;

        let viaStr = (train.vias && train.vias.length > 0) ? train.vias.join(' – ') : '';
        if (train.verkehrtAb && train.verkehrtAb !== '0') {
            viaStr = `Verkehrt ab ${train.verkehrtAb} – ${viaStr}`;
        }
        viaStr = truncateWithEllipsis(ctx, viaStr, col2W - 20);
        ctx.fillText(viaStr, col2X, viaY);
    }

    // B. Unteres Sub-Element: Fahrtziel
    const destY = timeY;
    let destText = train.displayDestination || '';
    if (/flughafen|airport/i.test(destText) && !destText.includes('✈')) {
        destText = `✈ ${destText}`;
    }

    ctx.font = FONTS.bold(isPortrait ? 34 : 62);
    ctx.fillStyle = primaryColor;
    ctx.fillText(destText, col2X, destY);

    // C. Verbindungs-Klammer ("T" / Flügelzug-Symbol)
    // Wenn dieser Zug mit dem nächsten gekoppelt ist: verbindet destY mit destY der nächsten Zeile
    if (isCoupledWithNext) {
        const dest1Y = destY;
        const dest2Y = y + height + (height * 0.78);

        const bracketX = col2X - (isPortrait ? 14 : 22);
        const bracketArmRight = col2X - (isPortrait ? 4 : 8);
        const bracketTopY = dest1Y - (isPortrait ? 12 : 20);
        const bracketBottomY = dest2Y - (isPortrait ? 12 : 20);

        ctx.strokeStyle = COLORS.WHITE;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(bracketArmRight, bracketTopY);
        ctx.lineTo(bracketX, bracketTopY);
        ctx.lineTo(bracketX, bracketBottomY);
        ctx.lineTo(bracketArmRight, bracketBottomY);
        ctx.stroke();
    }

    // ----------------------------------------------------
    // SPALTE 3: GLEIS / TRACK
    // ----------------------------------------------------
    const gleisY = timeY;
    const rawTrack = train.platform || '-';
    const cleanTrack = String(rawTrack).replace(/^Gl\.\s*/i, '').trim();

    if (isAusfall) {
        ctx.font = FONTS.bold(isPortrait ? 38 : 70);
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('-', col3X + (col3W / 2), gleisY);
    } else if (hasTrackChange) {
        // Gleiswechsel: Weißer Inverskasten mit neuer Gleisnummer in COLORS.MIDNIGHT_BLUE
        const newTrack = (train.ezGleis || cleanTrack).replace(/^Gl\.\s*/i, '').trim();
        const boxW = isPortrait ? (col3W - 8) : 136;
        const boxH = isPortrait ? 44 : 64;
        const boxX = col3X + ((col3W - boxW) / 2);
        const boxY = isPortrait ? (gleisY - 34) : (y + height - boxH - 4);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        ctx.font = FONTS.bold(isPortrait ? 34 : 54);
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(newTrack, boxX + (boxW / 2), boxY + (boxH / 2));
    } else {
        ctx.font = FONTS.bold(isPortrait ? 38 : 70);
        ctx.fillStyle = COLORS.WHITE;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(cleanTrack, col3X + (col3W / 2), gleisY);
    }

    // ----------------------------------------------------
    // SPALTE 4: PIKTOGRAMME (Qualitätsmerkmale aus pictogramRenderer, max. 2, linksbündig)
    // ----------------------------------------------------
    if (!isAusfall) {
        let qualityText = train.scrollText || '';
        if (train.infoTexts && Array.isArray(train.infoTexts)) {
            const fullInfo = train.infoTexts.map(t => t.text || '').join(' ');
            if (fullInfo) qualityText += (qualityText ? ' ' : '') + fullInfo;
        }
        if (train.hasReservation || train.needsReservation || /flx|flixtrain/i.test(train.displayTitle || '')) {
            qualityText += ' Zug reservierungspflichtig';
        }
        if (train.hasBike || train.bike || (train.amenities && (train.amenities.includes('bike') || train.amenities.includes('bicycle')))) {
            qualityText += ' Fahrradmitnahme reservierungspflichtig';
        }

        const iconSize = isPortrait ? 36 : 52;
        const iconY = destY - (isPortrait ? 28 : 46);

        const matchingRules = getMatchingPictogramRules(qualityText, displayName, 2);
        if (matchingRules.length > 0) {
            const gap = 8;
            const leftX = col4X;
            drawQualityIcons(ctx, qualityText, displayName, leftX, iconY, iconSize, gap, 2, 'left');
        }
    }
}

/**
 * Zeichnet eine saubere leere Zeile bei unvollständiger Belegung mit segmentierten Teilstrichen oben.
 * @param {CanvasRenderingContext2D} ctx - Canvas Kontext
 * @param {number} x - X-Position
 * @param {number} y - Y-Position (oberer Rand)
 * @param {number} width - Zeilenbreite
 * @param {number} height - Zeilenhöhe
 * @param {boolean} isAlt - Alternierender Zeilenhintergrund
 * @param {boolean} [isPortrait=false] - Ob Hochformat aktiv ist
 * @returns {void}
 */
function drawEmptyRow(ctx, x, y, width, height, isAlt, isPortrait = false) {
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
    ctx.fillRect(x, y, width, height);

    const { col1X, col1W, col2X, col2W, col3X, col3W, col4X, col4W } = getColumnGeometry(width, isPortrait);

    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(col1X, y, col1W, 2);
    ctx.fillRect(col2X, y, col2W, 2);
    ctx.fillRect(col3X, y, col3W, 2);
    ctx.fillRect(col4X, y, col4W, 2);
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
