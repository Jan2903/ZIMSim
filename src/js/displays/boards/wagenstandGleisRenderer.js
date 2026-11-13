// js/displays/boards/wagenstandGleisRenderer.js
import { COLORS, FONTS } from '../../core/constants/theme.js';
import { FORMATION } from '../core/constants.js';
import { drawFormation, drawSectors } from '../primitives/formationRenderer.js';
import { drawLineBadge, drawText, drawInvertedTimeBox, truncateWithEllipsis } from '../core/textUtils.js';
import { drawDBLogo, drawAnalogClock, drawDigitalClock } from '../core/sharedRenderers.js';
import { getDepartureAlarmState, drawDepartureAlarmMarker } from '../core/departureAlarmRenderer.js';
import { getSimulatedTime } from '../../core/utils/config.js';
import { combineTrainNames } from '../../features/journey/trainNumberFormatter.js';
import { JourneyCouplingService } from '../../features/journey/services/journeyCouplingService.js';
import { JourneyViaService } from '../../features/journey/services/journeyViaService.js';
import { lineColorService } from '../../core/services/lineColorService.svelte.js';
import { getBoardTokens } from '../core/boardTokenService.js';

/**
 * Zeichnet die Kopfzeile der Gleis-Vitrine.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width - Displaybreite in logischen Pixeln
 * @param {number} activeFeatureIndex - Index der aktiven Ausstattungsseite
 * @param {number} progress - Fortschritt der Feature-Rotation (0..1)
 * @param {string|number} trackNumber - Angezeigtes Gleis
 * @param {object} t - Aufgelöste Board-Tokens der aktiven Variante
 * @param {number} [featureAlpha=1.0] - Überblend-Alpha der Feature-Texte
 * @returns {void}
 */
function drawVitrineHeader(ctx, width, activeFeatureIndex, progress, trackNumber, t, featureAlpha = 1.0) {
    // 1. Clock (Left)
    drawAnalogClock(ctx, t.header.clock.x, t.header.clock.y, t.header.clock.radius);
    
    // Digital Time (mit blinkendem Doppelpunkt)
    const now = getSimulatedTime();
    drawDigitalClock(ctx, now, t.header.digitalClock.x, t.header.digitalClock.y, {
        fontSize: t.header.digitalClock.fontSize,
        verticalAlign: 'baseline'
    });

    // 2. Progress Bar & Features (Center)
    const features = [
        { de: "Wagennummern", en: "Coach numbers" },
        { de: "Ausstattungsmerkmale", en: "Service Features" },
        { de: "Wagenklassen", en: "Class features" }
    ];

    let cx = width / 2;
    const currentFeat = features[activeFeatureIndex];

    // Progress bar line
    const barWidth = t.header.progress.width;
    const barX = cx - barWidth / 2;
    const barY = t.header.progress.y;
    ctx.fillStyle = COLORS.DIM_GREY;
    ctx.fillRect(barX, barY, barWidth, t.header.progress.height);
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(barX, barY, barWidth * progress, t.header.progress.height);

    // Feature text
    ctx.font = FONTS.regular(t.header.feature.deSize);
    const w1 = ctx.measureText(currentFeat.de).width;
    ctx.font = FONTS.italic(t.header.feature.enSize);
    const w2 = ctx.measureText(currentFeat.en).width;
    
    const startX = barX;

    ctx.save();
    ctx.globalAlpha = featureAlpha;
    drawText(ctx, currentFeat.de, startX, t.header.feature.y, FONTS.regular(t.header.feature.deSize), COLORS.WHITE, 'left');
    drawText(ctx, currentFeat.en, startX + w1 + t.header.feature.gap, t.header.feature.y, FONTS.italic(t.header.feature.enSize), COLORS.WHITE, 'left');
    ctx.restore();

    // 3. Track & DB Logo (Right)
    drawText(ctx, 'Gleis', width - t.header.track.gleisFromRight, t.header.track.labelY, FONTS.regular(t.header.track.labelSize), COLORS.WHITE, 'right');
    drawText(ctx, 'Platform', width - t.header.track.platformFromRight, t.header.track.labelY, FONTS.italic(t.header.track.labelSize), COLORS.WHITE, 'right');
    drawText(ctx, trackNumber || "", width - t.header.track.numberFromRight, t.header.track.numberY, FONTS.bold(t.header.track.numberSize), COLORS.WHITE, 'left');
    
    drawDBLogo(ctx, width - t.header.logo.fromRight, t.header.logo.y, t.header.logo.width, t.header.logo.height);
}

/**
 * Zeichnet Linienbadge, Ziel und Vias eines Zugteils über dessen erstem Wagen.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../../features/journey/journey.svelte.js').Journey} journey
 * @param {number} x - Linke Kante des tatsächlichen Zugteil-Beginns.
 * @param {number} yOffset - Oberer Rand der Vitrine-Zeile.
 * @param {number} maxWidth - Verfügbare Breite bis zum nächsten Zugteil.
 * @param {object} t - Aufgelöste Board-Tokens der aktiven Variante
 * @param {string|null} [displayName=null] - Optionaler kombinierter Zugname.
 * @returns {void}
 */
function drawVitrineTrainLabel(ctx, journey, x, yOffset, maxWidth, t, displayName = null) {
    if (!journey) return;

    const availableWidth = Math.max(20, maxWidth);
    const name = displayName || journey.displayTitle || "";
    const labelFont = FONTS.bold(t.label.font);
    const badgeHeight = t.label.badgeHeight;
    const badgeCenterY = yOffset + t.label.badgeCenterYOffset;

    if (name) {
        ctx.font = labelFont;
        const badgePaddingX = t.label.paddingX;
        const maxTextWidth = Math.max(1, availableWidth - 2 * badgePaddingX);
        const badgeText = truncateWithEllipsis(ctx, name, maxTextWidth);
        const textWidth = ctx.measureText(badgeText).width;
        const badgeWidth = Math.min(availableWidth, Math.max(t.label.minWidth, textWidth + 2 * badgePaddingX));
        const badgeStyle = lineColorService.resolveStyle(badgeText, {
            operator: journey.operator
        });

        drawLineBadge(ctx, badgeText, x, badgeCenterY - badgeHeight / 2, badgeWidth, badgeHeight, {
            font: labelFont,
            ...badgeStyle
        });
    }

    const dest = journey.displayDestination || "";
    const destFont = FONTS.regular(t.label.destFont);
    ctx.font = destFont;
    const destText = truncateWithEllipsis(ctx, dest, availableWidth);
    drawText(ctx, destText, x, yOffset + t.label.destYOffset, destFont, COLORS.WHITE, 'left');

    const viaFont = FONTS.regular(t.label.viaFont);
    const destWidth = ctx.measureText(destText + " ").width;
    const viaMaxWidth = Math.max(0, availableWidth - destWidth - t.label.viaGap);

    // Nur zeichnen, wenn nach dem Zielbahnhof überhaupt sinnvoll Platz bleibt.
    ctx.font = viaFont;
    const viaPrefix = "über ";
    const minViaWidth = ctx.measureText(viaPrefix).width + 40;
    if (viaMaxWidth >= minViaWidth) {
        const viaNames = JourneyViaService.getDisplayVias(journey, {
            maxWidth: viaMaxWidth,
            maxLines: 1,
            font: viaFont,
            separator: " - ",
            prefix: viaPrefix
        }).map(s => s.nameKurz || s.name).join(" - ");

        if (viaNames) {
            const viaText = truncateWithEllipsis(ctx, viaPrefix + viaNames, viaMaxWidth);
            drawText(ctx, viaText, x + destWidth + t.label.viaGap, yOffset + t.label.viaYOffset, viaFont, COLORS.WHITE, 'left');
        }
    }
}

/**
 * Zeichnet eine Vitrine-Zeile (Trennlinie, Abfahrtszeit, Formation, Labels).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object[]} journeys - Züge dieser Zeile
 * @param {number} yOffset - Oberer Rand der Zeile
 * @param {number} width - Displaybreite
 * @param {object} platform - Bahnsteig-Objekt
 * @param {string} activeFeatureStr - Aktives Ausstattungsmerkmal
 * @param {number} startX - Linke Kante des Bahnsteigbereichs
 * @param {number} usableWidth - Breite des Bahnsteigbereichs
 * @param {object} t - Aufgelöste Board-Tokens der aktiven Variante
 * @param {number} [featureAlpha=1.0] - Überblend-Alpha der Features
 * @param {string} [drawLayer='all'] - 'all' | 'static' | 'dynamic'
 * @returns {void}
 */
function drawVitrineRow(ctx, journeys, yOffset, width, platform, activeFeatureStr, startX, usableWidth, t, featureAlpha = 1.0, drawLayer = 'all') {
    if (drawLayer === 'all' || drawLayer === 'static') {
        // Horizontale Trennlinie (bewusst außerhalb der Zeilen-Skalierung,
        // damit sie immer die volle Displaybreite abdeckt)
        ctx.strokeStyle = COLORS.WHITE;
        ctx.lineWidth = t.row.separator.lineWidth;
        ctx.beginPath();
        ctx.moveTo(0, yOffset); 
        ctx.lineTo(width, yOffset);
        ctx.stroke();
    }

    if (!journeys || journeys.length === 0) return;

    const primary = journeys[0];

    // Zeileninhalt um `rowScale` skalieren. Die virtuelle Zeile ist breiter
    // als das Display; dadurch nutzt die mitskalierte Formation weiterhin
    // die volle physische Breite.
    const s = t.meta.rowScale;
    const virtualStartX = startX / s;
    const virtualUsableWidth = usableWidth / s;

    ctx.save();
    ctx.translate(0, yOffset);
    ctx.scale(s, s);

    // Linker Rand der Zeit-Spalte: lässt Platz für den Abfahrtsalarm-Punkt.
    const timeX = t.row.time.x;
    const timeBaselineY = t.row.time.baselineOffset;

    if (drawLayer === 'all' || drawLayer === 'static') {
        const scheduled = primary.scheduledTime || "";
        const expected = primary.expectedTime || "";

        // Time
        const timeFont = FONTS.regular(t.row.time.fontSize);
        drawText(ctx, scheduled, timeX, timeBaselineY, timeFont, COLORS.WHITE, 'left');

        if (expected && expected !== scheduled) {
            const scheduledWidth = ctx.measureText(scheduled).width;
            drawInvertedTimeBox(ctx, expected, timeX + scheduledWidth + t.row.delay.offsetX, timeBaselineY, FONTS.bold(t.row.delay.fontSize), {
                paddingX: t.row.delay.paddingX,
                minWidth: t.row.delay.minWidth,
                height: t.row.delay.height
            });
        }
    }

    // Abfahrtsalarm: blinkender Punkt links neben der Abfahrtszeit.
    // Nur im dynamischen Layer zeichnen, damit er nicht dauerhaft im
    // statischen Layer eingebrannt wird und synchron mit der Uhr blinkt.
    if (drawLayer === 'dynamic') {
        const alarm = getDepartureAlarmState(primary);
        if (alarm.visible) {
            drawDepartureAlarmMarker(ctx, timeX - t.row.alarm.offsetX, timeBaselineY - t.row.alarm.offsetY, {
                radius: t.row.alarm.radius,
                lineWidth: t.row.alarm.lineWidth,
                blinking: alarm.blinking
            });
        }
    }

    // Formation zeichnen und Startposition abfragen
    ctx.save();
    ctx.translate(0, t.row.formation.offsetY);
    const formationResult = drawFormation(ctx, journeys, platform, {
        fullScreen: true,
        activeFeature: activeFeatureStr,
        hideSectors: true,
        hideDestinations: true,
        customStartX: virtualStartX,
        customUsableWidth: virtualUsableWidth,
        featureAlpha: featureAlpha,
        isVitrine: true,
        drawLayer: drawLayer
    });
    ctx.restore();

    if (drawLayer === 'all' || drawLayer === 'static') {
        // Default Position, falls keine Formation gezeichnet wurde
        let textX = 400;
        if (formationResult && formationResult.trainPixelStart !== undefined) {
            textX = formationResult.trainPixelStart;
        }

        // drawFormation/drawSectors hinterlassen 'alphabetic'; hier wieder
        // vertikal zentriert zeichnen.

        const rightEdge = virtualStartX + virtualUsableWidth;
        const anchors = formationResult?.journeyAnchors || [];
        const merged = JourneyCouplingService.areJourneysMerged(journeys);

        if (journeys.length > 1 && !merged && anchors.length > 1) {
            const parts = journeys.map((journey, journeyIndex) => {
                const anchor = anchors.find(entry => entry.journeyIndex === journeyIndex);
                return { journey, x: anchor?.x ?? textX };
            }).sort((a, b) => a.x - b.x);

            parts.forEach((part, index) => {
                const maxX = index < parts.length - 1 ? parts[index + 1].x - 12 : rightEdge;
                drawVitrineTrainLabel(ctx, part.journey, part.x, 0, maxX - part.x, t);
            });
        } else {
            const combinedName = journeys.length > 1 ? combineTrainNames(journeys) : null;
            drawVitrineTrainLabel(ctx, primary, textX, 0, rightEdge - textX, t, combinedName);
        }
    }

    // Skalierung der Zeile wieder aufheben.
    ctx.restore();
}

/**
 * Hauptfunktion für das ZIMVitrine32Wagenstand Layout
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object[][]} journeyGroups - Züge je Zeile
 * @param {object} platform - Bahnsteig-Objekt
 * @param {number} width - Displaybreite
 * @param {number} height - Displayhöhe
 * @param {string|number} trackNumber - Angezeigtes Gleis
 * @param {object} [animOptions={}] - Animations- und Variantenoptionen
 * @returns {void}
 */
export function drawVitrine32Wagenstand(ctx, journeyGroups, platform, width, height, trackNumber, animOptions = {}) {
    const {
        activeFeatureIndex = 0,
        activeFeatureStr = 'wagennummern',
        progress = 0,
        featureAlpha = 1.0,
        drawLayer = 'all',
        variant = null
    } = animOptions;

    // Geometrie- und Schriftwerte der aktiven Darstellungsvariante.
    const t = getBoardTokens('wagenstand_gleis', { variantId: variant, width, height });

    if (drawLayer === 'all' || drawLayer === 'dynamic') {
        drawVitrineHeader(ctx, width, activeFeatureIndex, progress, trackNumber, t, featureAlpha);
    }

    const startX = Math.round(width * t.layout.startXRatio);
    const usableWidth = Math.round(width * t.layout.usableWidthRatio);
    const arrowBuffer = FORMATION.ARROW_BUFFER;
    const meterAreaPixels = usableWidth - 2 * arrowBuffer;
    const pixelPerMeter = meterAreaPixels / (platform.length || 420);
    const meterOrigin = startX + arrowBuffer;

    if (drawLayer === 'all' || drawLayer === 'static') {
        // Draw platform sectors at the top
        ctx.save();
        ctx.translate(0, t.sectors.translateY);
        drawSectors(ctx, platform.sections, pixelPerMeter, meterOrigin, true);
        ctx.restore();

        // Rote Standort-Linie
        const currentLocation = platform.currentLocation !== undefined ? platform.currentLocation : 100;
        const redLineX = meterOrigin + (currentLocation * pixelPerMeter);
        
        ctx.strokeStyle = COLORS.RED;
        ctx.fillStyle = COLORS.RED;
        
        // Draw the red dot at the top of the line
        ctx.beginPath();
        ctx.arc(redLineX, t.sectors.redDotY, t.sectors.redDotRadius, 0, Math.PI * 2);
        ctx.fill();

        // Line downwards
        ctx.lineWidth = t.sectors.redLineWidth;
        ctx.beginPath();
        ctx.moveTo(redLineX, t.sectors.redLineStartY);
        ctx.lineTo(redLineX, height);
        ctx.stroke();
    }

    const startY = t.meta.startY;
    // Zeilenhöhe wird pro Variante aus den Tokens bestimmt; die
    // Render-Skalierung übernimmt trainDisplay.
    const rowHeight = t.meta.rowHeight;
    const rowCount = t.meta.rowCount;

    for (let i = 0; i < rowCount; i++) {
        const journeys = journeyGroups[i] || [];
        drawVitrineRow(ctx, journeys, startY + (i * rowHeight), width, platform, activeFeatureStr, startX, usableWidth, t, featureAlpha, drawLayer);
    }
}
