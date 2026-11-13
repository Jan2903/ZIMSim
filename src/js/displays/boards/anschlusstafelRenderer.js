// js/displays/boards/anschlusstafelRenderer.js
import { COLORS, FONTS } from '../../core/constants/theme.js';
import { drawText, drawWrappedText, truncateWithEllipsis, drawLineBadge, drawInvertedTimeBox, fillTextCentered, getVerticalCenterOffset } from '../core/textUtils.js';
import { getSimulatedTime, config } from '../../core/utils/config.js';
import { lineColorService } from '../../core/services/lineColorService.svelte.js';
import { drawDBLogo, drawAnalogClock, drawDigitalClock } from '../core/sharedRenderers.js';
import { getDepartureAlarmState, drawDepartureAlarmMarker } from '../core/departureAlarmRenderer.js';
import { drawQualityIcons, getMatchingPictogramRules } from '../primitives/pictogramRenderer.js';
import { JourneyCouplingService } from '../../features/journey/services/journeyCouplingService.js';
import { JourneyViaService } from '../../features/journey/services/journeyViaService.js';
import { getHaltMessageText, getQualityText, drawScrollingText } from '../core/infoTextDisplayUtils.js';
import { journeyStore } from '../../core/state/stores.js';
import { displayConfigStore } from '../core/displayConfigStore.svelte.js';
import { getBoardTokens } from '../core/boardTokenService.js';

/**
 * Vollständiger dynamischer Renderer für Voranzeiger und Abfahrtstafeln (Anschlusstafel).
 *
 * Eigenschaften:
 * - Dynamische Kopfzeile ("Abfahrt Departure", Station, Live-Uhrzeit)
 * - Flexible Abfahrtszeilen mit Echtzeit-Status, Verspätungen, Ausfällen, Vias und Gleiswechsel-Inverskästen
 * - Platzierung von Störungen/Infoscreens IMMER GANZ UNTEN (als statische Zeile(n) oder Ticker-Lauftext)
 * - Optionales oder manuelles Abfahrts-Paging und Störungs-Paging (6s)
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
    // Geometrie- und Schriftwerte der aktiven Darstellungsvariante.
    const t = getBoardTokens('anschlusstafel', {
        variantId: screenOptions.variant,
        width,
        height
    });

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
    const baseTotalRows = screenOptions.maxRows || t.meta.maxRows;
    let availableTrainRows = baseTotalRows;
    let disruptionBoxHeight = 0;

    if (isTickerMode) {
        disruptionBoxHeight = t.disruption.tickerHeight;
    } else if (disruptionRows > 0) {
        availableTrainRows = Math.max(1, baseTotalRows - disruptionRows);
    }

    const usableTrainHeight = height - t.header.height - disruptionBoxHeight;
    const trainRowHeight = usableTrainHeight / availableTrainRows;

    // 5. Gekoppelte Züge mit identischem Ziel/Verlauf zu einer Zeile zusammenfassen & Pagination berechnen
    const consolidatedTrains = JourneyCouplingService.consolidateMergedTrains(trains, journeyStore.nrwMode);
    const trainsPerPage = availableTrainRows * maxCols;
    const totalTrainPages = Math.max(1, Math.ceil(consolidatedTrains.length / trainsPerPage));
    displayConfigStore.setTotalDeparturePages(totalTrainPages);

    const activeTrainPage = (renderCtx.departurePageIndex || 0) % totalTrainPages;
    const pageOffset = (activeTrainPage * trainsPerPage) + (colIndex * availableTrainRows);
    const visibleTrains = consolidatedTrains.slice(pageOffset, pageOffset + availableTrainRows);

    // Render-Kontext anreichern
    renderCtx.totalTrainPages = totalTrainPages;
    renderCtx.activeTrainPage = activeTrainPage;

    // 6. Kopfzeile zeichnen
    drawHeader(ctx, width, t, renderCtx);

    // 7. Züge rendern
    ctx.save();
    // Sanfte Überblendung für Abfahrts-Paging (nur bei aktiviertem Auto-Paging)
    if (config.voranzeigerAutoPage && renderCtx.departurePageAlpha !== undefined && totalTrainPages > 1) {
        ctx.globalAlpha = renderCtx.departurePageAlpha;
    }

    for (let i = 0; i < availableTrainRows; i++) {
        const rowY = t.header.height + (i * trainRowHeight);
        const train = visibleTrains[i];

        if (!train) continue;

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

        drawTrainRow(ctx, train, 0, rowY, width, trainRowHeight, i % 2 === 1, t, {
            isCoupledWithPrev,
            isCoupledWithNext,
            prevTrain,
            nextTrain,
            renderCtx
        });
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
            drawTickerBottom(ctx, activeInfo, 0, disruptionY, width, disruptionH, renderCtx, t);
        } else {
            drawStaticDisruptionBottom(ctx, activeInfo, activeInfoIndex + 1, infos.length, 0, disruptionY, width, disruptionH, t);
        }
        ctx.restore();
    }
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
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width - Gesamtbreite des Displays
 * @param {object} t - Aufgelöste Board-Tokens der aktiven Variante
 * @param {object} renderCtx - Render-Kontext
 * @returns {void}
 */
function drawHeader(ctx, width, t, renderCtx) {
    // Spaltenraster (identisch für Header und Zeilen). Die Werte stammen aus
    // den Board-Tokens: Spalte 1 Zug/Zeit, Spalte 2 Über/Ziel, Spalte 3 Gleis,
    // Spalte 4 Symbole/Piktogramme.
    const col1X = t.columns.train.x;
    const col2X = t.columns.via.x;
    const col3X = t.columns.track.x;
    const col4X = t.columns.icons.x;
    const col4W = t.columns.icons.w;

    // 1. Oben links: Analoge Uhr + digitale Uhrzeit (HH:MM mit Doppelpunkt)
    const simTime = getSimulatedTime();
    const clockCenterX = col1X + t.header.clock.offsetX;
    const clockCenterY = t.header.clock.centerY;
    const clockRadius = t.header.clock.radius;

    // Analoge Uhr aus sharedRenderers
    drawAnalogClock(ctx, clockCenterX, clockCenterY, clockRadius, simTime);

    // Digitale Uhrzeit (HH:MM) mit blinkendem Doppelpunkt
    const timeX = clockCenterX + clockRadius + t.header.time.gap;
    drawDigitalClock(ctx, simTime, timeX, clockCenterY, { fontSize: t.header.time.fontSize });

    // 2. Titel: "Abfahrt Departure" (bündig über der Über/Ziel-Spalte)
    const depY = t.header.title.y;
    let subFont;
    let subItalic;
    subFont = FONTS.bold(t.header.title.deSize);
    subItalic = FONTS.italic(t.header.title.enSize);
    drawSubLabel('Abfahrt Departure', col2X, depY, 'left', " ");

    // 3. Oben rechts: DB-Logo aus sharedRenderers (über der Symbol-Spalte rechtsbündig)
    const logoW = t.header.logo.width;
    const logoH = t.header.logo.height;
    const logoX = col4X + col4W - logoW;
    const logoY = clockCenterY + t.header.logo.offsetY;
    drawDBLogo(ctx, logoX, logoY, logoW, logoH);

    // 4. Zweisprachige Spaltenbeschriftungen (Trennstriche werden von den Zeilen oben gerendert)
    //    Deutscher Teil fett, englischer Teil kursiv (wie Titel "Abfahrt Departure")
    const subY1 = t.header.labels.y1;
    const subY2 = t.header.labels.y2;
    subFont = FONTS.bold(t.header.labels.deSize);
    subItalic = FONTS.italic(t.header.labels.enSize);

    // Zeichnet zweisprachigen Label: "Deutsch / English" mit Englisch kursiv versetzt
    function drawSubLabel(text, x, y, align, regex = " / ") {
        const [de, en] = text.split(regex);
        ctx.font = subFont;
        const deW = ctx.measureText(de).width;
        ctx.font = subItalic;
        const enW = ctx.measureText(en).width;
        const gap = t.header.labels.gap;
        const totalW = deW + gap + enW;
        const startX = align === 'center' ? x - totalW / 2 : x;
        drawText(ctx, de, startX, y, subFont, t.header.labels.color, 'left');
        drawText(ctx, en, startX + deW + gap, y, subItalic, t.header.labels.color, 'left');
    }

    drawSubLabel('Zug / Train', col1X, subY1, 'left');
    drawSubLabel('Zeit / Time', col1X, subY2, 'left');

    // Spalte 2: Über / Via & Ziel / Destination
    drawSubLabel('Über / Via', col2X, subY1, 'left');
    drawSubLabel('Ziel / Destination', col2X, subY2, 'left');

    // Spalte 3: Gleis / Track
    drawSubLabel('Gleis / Track', col3X, subY2, 'left');
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
 * @param {object} t - Aufgelöste Board-Tokens der aktiven Variante
 * @param {object} [coupledInfo={}] - Kopplungs-Informationen (Flügelzug)
 * @returns {void}
 */
function drawTrainRow(ctx, train, x, y, width, height, isAlt, t, coupledInfo = {}) {
    const isPortrait = t.variant.orientation === 'portrait';
    const isAusfall = !!train.ausfall;
    const hasTrackChange = !!train.hasTrackChange;
    const isCoupledWithPrev = !!coupledInfo.isCoupledWithPrev;
    const isCoupledWithNext = !!coupledInfo.isCoupledWithNext;
    const prevTrain = coupledInfo.prevTrain;

    // 1. Spaltengeometrie (exakt synchronisiert mit dem Header)
    const col1X = t.columns.train.x;
    const col1W = t.columns.train.w;
    const col2X = t.columns.via.x;
    const col2W = t.columns.via.w;
    const col3X = t.columns.track.x;
    const col3W = t.columns.track.w;
    const col4X = t.columns.icons.x;

    // 1. Zeilenhintergrund: Bei Ausfall VOLLSTÄNDIG WEISS INVERTIERT
    if (isAusfall) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, width, height);
    } else {
        // Segmentierte weiße Trennstriche nach OBEN pro Spalte (oben statt unten gerendert!)
        // Bei Teilzug 2 eines Flügelzugs oder direkt unter einer Ausfallzeile: KEINE Trennstriche nach oben!
        const prevWasAusfall = prevTrain && (prevTrain.ausfall || prevTrain.isCancelled);
        if (!isCoupledWithPrev && !prevWasAusfall) {
            const separatorHeight = t.row.separator.thickness;
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(col1X, y, col1W, separatorHeight);
            ctx.fillRect(col2X, y, col2W, separatorHeight);
            ctx.fillRect(col3X, y, col3W, separatorHeight);
            ctx.fillRect(col4X, y, t.columns.icons.w, separatorHeight);
        }
    }

    // Textfarben: Bei Invertierung das bekannte Dunkelblau (COLORS.MIDNIGHT_BLUE) als Textfarbe!
    const primaryColor = isAusfall ? COLORS.MIDNIGHT_BLUE : COLORS.WHITE;
    const secondaryColor = isAusfall ? COLORS.MIDNIGHT_BLUE : COLORS.WHITE;

    // ----------------------------------------------------
    // SPALTE 1: ZUG / TRAIN (oben) & ZEIT / TIME (unten)
    // ----------------------------------------------------
    const displayName = train.displayTitle || '';
    const badgeH = t.row.badge.height;
    const badgeY = y + (height * t.row.badge.yFactor);

    ctx.font = FONTS.bold(t.row.badge.fontSize);
    const textW = ctx.measureText(displayName).width;
    const badgePadding = t.row.badge.paddingX;
    const badgeW = Math.max(t.row.badge.minWidth, Math.min(col1W, textW + badgePadding));

    if (isAusfall) {
        // Bei Ausfall im weißen Balken: Gattungs-/Linienbadge
        const font = FONTS.bold(t.row.badge.fontSize);
        let badgeStyle = lineColorService.resolveStyle(displayName, {
            operator: train.operator,
            isAusfall: true
        });
        if (badgeStyle.backgroundColor === '#ffffff' || badgeStyle.shape === 'outline') {
            badgeStyle = {
                ...badgeStyle,
                backgroundColor: '#1c6276',
                textColor: COLORS.WHITE,
                borderColor: 'transparent',
                shape: 'rectangle'
            };
        }
        drawLineBadge(ctx, displayName, col1X, badgeY, badgeW, badgeH, {
            font,
            ...badgeStyle
        });
    } else {
        // Reguläres Linien-/Gattungsbadge
        const font = FONTS.bold(t.row.badge.fontSize);
        const badgeStyle = lineColorService.resolveStyle(displayName, {
            operator: train.operator
        });
        drawLineBadge(ctx, displayName, col1X, badgeY, badgeW, badgeH, {
            font,
            ...badgeStyle
        });
    }

    // B. Unteres Sub-Element: Zeit & Status
    // Beim zweiten/unteren Flügelzug keine Anzeige der Uhrzeit (wenn Planzeit übereinstimmt)
    const isSecondCoupledPart = isCoupledWithPrev && (prevTrain && train.scheduledTime === prevTrain.scheduledTime);
    const timeY = y + (height * t.row.time.yFactor);

    if (!isSecondCoupledPart) {
        // Planabfahrtszeit: Bleibt IMMER linksbündig auf col1X (auch bei Ausfall nicht verschoben)
        const schedTime = train.scheduledTime || '--:--';
        drawText(ctx, schedTime, col1X, timeY, FONTS.bold(t.row.time.fontSize), primaryColor, 'left');

        if (isAusfall) {
            // Ausfall-Kreuz "×" im freien linken Randbereich links von col1X (Abfahrtszeit bleibt fest auf col1X)
            const crossX = col1X - t.row.cross.offsetX;
            drawText(ctx, '×', crossX, timeY, FONTS.bold(t.row.cross.fontSize), COLORS.MIDNIGHT_BLUE, 'center');
        } else if (train.expectedTime && train.expectedTime !== train.scheduledTime) {
            // Verspätungskasten: Invertierter, ausgefüllter weißer eckiger (nicht gerundeter) Kasten
            const schedW = ctx.measureText(schedTime).width;
            const delayBoxX = col1X + schedW + t.row.delay.offsetX;
            const scheduledCenterY = timeY - getVerticalCenterOffset(ctx, train.expectedTime);

            drawInvertedTimeBox(ctx, train.expectedTime, delayBoxX, scheduledCenterY, FONTS.bold(t.row.delay.fontSize), {
                minWidth: t.row.delay.minWidth,
                height: t.row.delay.height
            });
        }

        // Abfahrtsalarm: weißer Punkt links von der Abfahrtszeit (gleiche Position wie das ×-Kreuz)
        const alarm = getDepartureAlarmState(train);
        if (alarm.visible) {
            const dotX = col1X - t.row.alarm.offsetX;
            drawDepartureAlarmMarker(ctx, dotX, timeY - t.row.alarm.offsetY, {
                radius: t.row.alarm.radius,
                lineWidth: t.row.alarm.lineWidth,
                blinking: alarm.blinking
            });
        }
    }

    // ----------------------------------------------------
    // SPALTE 2: ÜBER / VIA (oben) & ZIEL / DESTINATION (unten) + VERBINDUNGS-KLAMMER
    // ----------------------------------------------------

    // A. Oberes Sub-Element: Haltbezogene Meldungen / Vias / "Fahrt fällt aus"
    const viaY = y + (height * t.row.via.yFactor);
    const viaFont = FONTS.bold(t.row.via.fontSize);
    const maxViaWidth = col2W - t.row.via.paddingRight;
    const rowRenderCtx = coupledInfo.renderCtx || {};
    ctx.textAlign = 'left';

    if (isAusfall) {
        drawScrollingText(
            ctx,
            getHaltMessageText(train),
            col2X,
            viaY,
            maxViaWidth,
            FONTS.bold(t.row.haltMessage.fontSize),
            COLORS.MIDNIGHT_BLUE,
            rowRenderCtx,
            { speed: 1.8, clipHeight: t.row.haltMessage.clipHeight }
        );
    } else {
        const haltText = getHaltMessageText(train);

        if (haltText) {
            // Haltbezogene Meldung ersetzt die Via-Kette vollständig.
            drawScrollingText(
                ctx,
                haltText,
                col2X,
                viaY,
                maxViaWidth,
                viaFont,
                secondaryColor,
                rowRenderCtx,
                { speed: 1.8, clipHeight: t.row.haltMessage.clipHeight }
            );
        } else {
            // Bestehende Via-Kette (ohne "Verkehrt ab"-Präfix)
            const viaNames = JourneyViaService.getDisplayVias(train, {
                maxWidth: maxViaWidth,
                maxLines: 1,
                font: viaFont,
                separator: ' – '
            }).map(s => s.nameKurz || s.name).join(' – ');

            ctx.font = viaFont;
            const viaStr = truncateWithEllipsis(ctx, viaNames, maxViaWidth);
            if (viaStr) {
                drawText(ctx, viaStr, col2X, viaY, viaFont, secondaryColor, 'left');
            }
        }
    }

    // B. Unteres Sub-Element: Fahrtziel
    const destY = timeY;
    let destText = train.displayDestination || '';
    if (/flughafen|airport/i.test(destText) && !destText.includes('✈')) {
        destText = `✈ ${destText}`;
    }

    drawText(ctx, destText, col2X, destY, FONTS.bold(t.row.dest.fontSize), primaryColor, 'left');

    // C. Verbindungs-Klammer ("T" / Flügelzug-Symbol)
    // Wenn dieser Zug mit dem nächsten gekoppelt ist: verbindet destY mit destY der nächsten Zeile
    if (isCoupledWithNext) {
        const dest1Y = destY;
        const dest2Y = y + height + (height * t.row.time.yFactor);

        const bracketX = col2X - t.row.bracket.xOffset;
        const bracketArmRight = col2X - t.row.bracket.armOffset;
        const bracketTopY = dest1Y - t.row.bracket.yOffset;
        const bracketBottomY = dest2Y - t.row.bracket.yOffset;

        ctx.strokeStyle = COLORS.WHITE;
        ctx.lineWidth = t.row.bracket.lineWidth;
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
        drawText(ctx, '-', col3X + (col3W / 2), gleisY, FONTS.bold(t.row.track.fontSize), COLORS.MIDNIGHT_BLUE, 'center');
    } else if (hasTrackChange) {
        // Gleiswechsel: Weißer Inverskasten mit neuer Gleisnummer in COLORS.MIDNIGHT_BLUE
        const newTrack = (train.ezGleis || cleanTrack).replace(/^Gl\.\s*/i, '').trim();
        const boxW = isPortrait ? (col3W - t.row.track.changeBoxColumnInset) : t.row.track.changeBoxWidth;
        const boxH = t.row.track.changeBoxHeight;
        const boxX = col3X + ((col3W - boxW) / 2);
        const boxY = isPortrait ? (gleisY - t.row.track.changeBoxYOffset) : (y + height - boxH - t.row.track.changeBoxBottomGap);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        // Textfarbe explizit setzen: durch das weiße Rechteck stand die
        // Textfarbe zuvor ebenfalls auf Weiß (unsichtbarer Gleiswechsel-Text).
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.textAlign = 'center';
        fillTextCentered(ctx, newTrack, boxX + (boxW / 2), boxY + (boxH / 2));
    } else {
        drawText(ctx, cleanTrack, col3X + (col3W / 2), gleisY, FONTS.bold(t.row.track.fontSize), COLORS.WHITE, 'center');
    }

    // ----------------------------------------------------
    // SPALTE 4: PIKTOGRAMME (Qualitätsmerkmale aus pictogramRenderer, max. 2, linksbündig)
    // ----------------------------------------------------
    if (!isAusfall) {
        const qualityText = getQualityText(train);

        const iconSize = t.row.icons.size;
        const iconY = destY - t.row.icons.yOffset;

        const matchingRules = getMatchingPictogramRules(qualityText, displayName, 2);
        if (matchingRules.length > 0) {
            const gap = t.row.icons.gap;
            const leftX = col4X;
            drawQualityIcons(ctx, qualityText, displayName, leftX, iconY, iconSize, gap, 2, 'left');
        }
    }
}

/**
 * Zeichnet eine prominente statische Störungsbox am unteren Bildschirmrand.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} infoJourney - Infoscreen-Journey
 * @param {number} pageNum - Aktuelle Meldungsnummer
 * @param {number} totalPages - Gesamtanzahl Meldungen
 * @param {number} x - X-Position
 * @param {number} y - Y-Position
 * @param {number} width - Breite
 * @param {number} height - Höhe
 * @param {object} t - Aufgelöste Board-Tokens der aktiven Variante
 * @returns {void}
 */
function drawStaticDisruptionBottom(ctx, infoJourney, pageNum, totalPages, x, y, width, height, t) {
    const box = t.disruption.staticBox;
    const badge = t.disruption.staticBadge;
    const text = t.disruption.staticText;

    // 1. Box-Hintergrund (Warnendes Nachtblau mit solidem Rand)
    ctx.fillStyle = box.background;
    ctx.fillRect(x + box.insetX, y + box.insetY, width - (2 * box.insetX), height - (2 * box.insetY));

    // Rand in Signal-Orange/Rot
    ctx.strokeStyle = box.borderColor;
    ctx.lineWidth = box.borderWidth;
    ctx.strokeRect(x + box.insetX, y + box.insetY, width - (2 * box.insetX), height - (2 * box.insetY));

    // 2. Warn-Icon und Header-Badge
    const badgeX = x + badge.offsetX;
    const badgeY = y + badge.offsetY;

    drawText(ctx, '⚠', badgeX, badgeY + badge.iconOffsetY, FONTS.bold(badge.iconSize), badge.accentColor, 'left');

    // Badge-Text
    const title = infoJourney.displayNameOverride || 'GROSSSTÖRUNG / INFORMATION';
    drawText(ctx, title, badgeX + badge.titleOffsetX, badgeY + badge.titleOffsetY, FONTS.bold(badge.titleSize), badge.accentColor, 'left');

    // Mehrfach-Meldungen Indikator (z.B. Meldung 1/2)
    if (totalPages > 1) {
        drawText(ctx, `Meldung ${pageNum}/${totalPages}`, width - badge.pageRightOffset, badgeY + badge.titleOffsetY, FONTS.regular(badge.pageSize), badge.pageColor, 'right');
    }

    // 3. Störungstext(e) darstellen
    const textX = badgeX + text.offsetX;
    const textY = badgeY + text.offsetY;
    const maxTextWidth = width - textX - text.rightPadding;

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

    drawWrappedText(ctx, messageText, textX, textY, maxTextWidth, text.lineHeight, FONTS.regular(text.fontSize), COLORS.WHITE, 'left', text.maxLines);
}

/**
 * Zeichnet einen schlanken Lauftext-Ticker am unteren Bildschirmrand.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} infoJourney - Infoscreen-Journey
 * @param {number} x - X-Position
 * @param {number} y - Y-Position
 * @param {number} width - Breite
 * @param {number} height - Höhe
 * @param {object} renderCtx - Render-Kontext
 * @param {object} t - Aufgelöste Board-Tokens der aktiven Variante
 * @returns {void}
 */
function drawTickerBottom(ctx, infoJourney, x, y, width, height, renderCtx, t) {
    const ticker = t.disruption.ticker;

    ctx.fillStyle = ticker.background;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = ticker.accentColor;
    ctx.fillRect(x, y, width, ticker.borderHeight);

    // Statischer Warn-Badge links
    const badgeW = ticker.badgeWidth;
    ctx.fillStyle = ticker.badgeBackground;
    ctx.fillRect(x, y + ticker.borderHeight, badgeW, height - ticker.borderHeight);

    drawText(ctx, '⚠ INFORMATION', x + (badgeW / 2), y + ticker.badgeTextY, FONTS.bold(ticker.badgeFontSize), ticker.accentColor, 'center');

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
    ctx.rect(x + badgeW + ticker.clipLeftGap, y, width - badgeW - ticker.clipRightGap, height);
    ctx.clip();

    ctx.font = FONTS.regular(ticker.fontSize);
    ctx.fillStyle = COLORS.WHITE;
    ctx.textAlign = 'left';

    const textWidth = ctx.measureText(fullTicker).width;
    const offset = ((renderCtx.tickerOffset || 0) % (textWidth / 2));
    drawText(ctx, fullTicker, x + badgeW + ticker.textLeftGap - offset, y + ticker.textY, FONTS.regular(ticker.fontSize), COLORS.WHITE, 'left');
    ctx.restore();
}

/**
 * Exportierte Platzhalter-Funktion für Kompatibilität mit dem bisherigen Import in TrainDisplay.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} journey - Einzelne Fahrt
 * @param {number} width - Breite
 * @param {number} height - Höhe
 * @returns {void}
 */
export function drawListeRow(ctx, journey, width, height) {
    if (!journey) return;
    const t = getBoardTokens('anschlusstafel', { width, height });
    drawTrainRow(ctx, journey, 0, 0, width, height, false, t);
}

export { drawVoranzeigerBoard as drawAnschlusstafelBoard };
