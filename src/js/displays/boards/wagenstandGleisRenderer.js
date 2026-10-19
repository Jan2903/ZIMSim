// js/displays/boards/wagenstandGleisRenderer.js
import { COLORS, FONTS, FORMATION } from '../core/constants.js';
import { drawFormation, drawSectors } from '../primitives/formationRenderer.js';
import { drawLineBadge, drawText, drawInvertedTimeBox, truncateWithEllipsis } from '../core/textUtils.js';
import { drawDBLogo, drawAnalogClock } from '../core/sharedRenderers.js';
import { getSimulatedTime } from '../../core/utils/config.js';
import { formatHHMM } from '../../core/utils/dateUtils.js';
import { combineTrainNames } from '../../features/journey/trainNumberFormatter.js';
import { JourneyCouplingService } from '../../features/journey/services/journeyCouplingService.js';
import { lineColorService } from '../../features/journey/services/lineColorService.svelte.js';

function drawVitrineHeader(ctx, width, activeFeatureIndex, progress, trackNumber, featureAlpha = 1.0) {
    // Alle Texte dieses Headers sind vertikal um ihre y-Position zentriert.
    ctx.textBaseline = 'middle';

    // 1. Clock (Left)
    drawAnalogClock(ctx, 80, 80);
    
    // Digital Time
    const now = getSimulatedTime();
    const timeStr = formatHHMM(now);
    drawText(ctx, timeStr, 150, 110, FONTS.bold(86), COLORS.WHITE, 'left');

    // 2. Progress Bar & Features (Center)
    const features = [
        { de: "Wagennummern", en: "Coach numbers" },
        { de: "Ausstattungsmerkmale", en: "Service Features" },
        { de: "Wagenklassen", en: "Class features" }
    ];

    let cx = width / 2;
    const currentFeat = features[activeFeatureIndex];

    // Progress bar line
    const barWidth = 400;
    const barX = cx - barWidth / 2;
    const barY = 110;
    ctx.fillStyle = COLORS.DIM_GREY;
    ctx.fillRect(barX, barY, barWidth, 8);
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(barX, barY, barWidth * progress, 8);

    // Feature text
    ctx.font = FONTS.regular(35);
    const w1 = ctx.measureText(currentFeat.de).width;
    ctx.font = FONTS.italic(35);
    const w2 = ctx.measureText(currentFeat.en).width;
    
    const totalW = w1 + 10 + w2;
    const startX = barX;

    ctx.save();
    ctx.globalAlpha = featureAlpha;
    drawText(ctx, currentFeat.de, startX, 80, FONTS.regular(35), COLORS.WHITE, 'left');
    drawText(ctx, currentFeat.en, startX + w1 + 10, 80, FONTS.italic(35), COLORS.WHITE, 'left');
    ctx.restore();

    // 3. Track & DB Logo (Right)
    drawText(ctx, 'Gleis', width - 420, 80, FONTS.regular(35), COLORS.WHITE, 'right');
    drawText(ctx, 'Platform', width - 300, 80, FONTS.italic(35), COLORS.WHITE, 'right');
    drawText(ctx, trackNumber || "", width - 280, 90, FONTS.bold(66), COLORS.WHITE, 'left');
    
    drawDBLogo(ctx, width - 110, 80);
}

/**
 * Zeichnet Linienbadge, Ziel und Vias eines Zugteils über dessen erstem Wagen.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../../features/journey/journey.svelte.js').Journey} journey
 * @param {number} x - Linke Kante des tatsächlichen Zugteil-Beginns.
 * @param {number} yOffset - Oberer Rand der Vitrine-Zeile.
 * @param {number} maxWidth - Verfügbare Breite bis zum nächsten Zugteil.
 * @param {string|null} [displayName=null] - Optionaler kombinierter Zugname.
 * @returns {void}
 */
function drawVitrineTrainLabel(ctx, journey, x, yOffset, maxWidth, displayName = null) {
    if (!journey) return;

    const availableWidth = Math.max(20, maxWidth);
    const name = displayName || journey.displayTitle || "";
    const labelFont = FONTS.bold(30);
    const badgeHeight = 40;
    const badgeCenterY = yOffset + 65;

    if (name) {
        ctx.font = labelFont;
        const badgePaddingX = 14;
        const maxTextWidth = Math.max(1, availableWidth - 2 * badgePaddingX);
        const badgeText = truncateWithEllipsis(ctx, name, maxTextWidth);
        const textWidth = ctx.measureText(badgeText).width;
        const badgeWidth = Math.min(availableWidth, Math.max(20, textWidth + 2 * badgePaddingX));
        const badgeStyle = lineColorService.resolveStyle(badgeText, {
            operator: journey.operator,
            defaultBgColor: COLORS.DIM_GREY,
            defaultTextColor: COLORS.WHITE
        });

        drawLineBadge(ctx, badgeText, x, badgeCenterY - badgeHeight / 2, badgeWidth, badgeHeight, {
            font: labelFont,
            ...badgeStyle
        });
    }

    ctx.textBaseline = 'middle';

    const dest = journey.displayDestination || "";
    const destFont = FONTS.regular(65);
    ctx.font = destFont;
    const destText = truncateWithEllipsis(ctx, dest, availableWidth);
    drawText(ctx, destText, x, yOffset + 135, destFont, COLORS.WHITE, 'left');

    const vias = (journey.vias || []).join(" - ");
    if (vias) {
        const destWidth = ctx.measureText(destText + " ").width;
        const viaFont = FONTS.regular(35);
        const viaMaxWidth = Math.max(0, availableWidth - destWidth - 10);
        ctx.font = viaFont;
        const viaText = viaMaxWidth > 10
            ? truncateWithEllipsis(ctx, "über " + vias, viaMaxWidth)
            : "";
        if (viaText) {
            drawText(ctx, viaText, x + destWidth + 10, yOffset + 133, viaFont, COLORS.WHITE, 'left');
        }
    }
}

function drawVitrineRow(ctx, journeys, yOffset, width, platform, activeFeatureStr, startX, usableWidth, featureAlpha = 1.0, drawLayer = 'all') {
    if (drawLayer === 'all' || drawLayer === 'static') {
        // Horizontale Trennlinie
        ctx.strokeStyle = COLORS.WHITE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, yOffset); 
        ctx.lineTo(width, yOffset);
        ctx.stroke();
    }

    if (!journeys || journeys.length === 0) return;

    const primary = journeys[0];
    
    if (drawLayer === 'all' || drawLayer === 'static') {
        const scheduled = primary.scheduledTime || "";
        const expected = primary.expectedTime || "";

        // Zeitangaben sind vertikal um ihre y-Position zentriert.
        ctx.textBaseline = 'middle';

        // Time
        const timeFont = FONTS.regular(75);
        drawText(ctx, scheduled, 20, yOffset + 150, timeFont, COLORS.WHITE, 'left');

        if (expected && expected !== scheduled) {
            const scheduledWidth = ctx.measureText(scheduled).width;
            drawInvertedTimeBox(ctx, expected, 20 + scheduledWidth + 12, yOffset + 150, FONTS.bold(48), {
                paddingX: 10,
                minWidth: 100,
                height: 55
            });
        }
    }

    // Formation zeichnen und Startposition abfragen
    ctx.save();
    ctx.translate(0, yOffset + 100);
    const formationResult = drawFormation(ctx, journeys, platform, {
        fullScreen: true,
        activeFeature: activeFeatureStr,
        hideSectors: true,
        hideDestinations: true,
        customStartX: startX,
        customUsableWidth: usableWidth,
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
        ctx.textBaseline = 'middle';

        const rightEdge = startX + usableWidth;
        const anchors = formationResult?.journeyAnchors || [];
        const merged = JourneyCouplingService.areJourneysMerged(journeys);

        if (journeys.length > 1 && !merged && anchors.length > 1) {
            const parts = journeys.map((journey, journeyIndex) => {
                const anchor = anchors.find(entry => entry.journeyIndex === journeyIndex);
                return { journey, x: anchor?.x ?? textX };
            }).sort((a, b) => a.x - b.x);

            parts.forEach((part, index) => {
                const maxX = index < parts.length - 1 ? parts[index + 1].x - 12 : rightEdge;
                drawVitrineTrainLabel(ctx, part.journey, part.x, yOffset, maxX - part.x);
            });
        } else {
            const combinedName = journeys.length > 1 ? combineTrainNames(journeys) : null;
            drawVitrineTrainLabel(ctx, primary, textX, yOffset, rightEdge - textX, combinedName);
        }
    }
}

/**
 * Hauptfunktion für das ZIMVitrine32Wagenstand Layout
 */
export function drawVitrine32Wagenstand(ctx, journeyGroups, platform, width, height, trackNumber, animOptions = {}) {
    const {
        activeFeatureIndex = 0,
        activeFeatureStr = 'wagennummern',
        progress = 0,
        featureAlpha = 1.0,
        drawLayer = 'all'
    } = animOptions;

    if (drawLayer === 'all' || drawLayer === 'dynamic') {
        drawVitrineHeader(ctx, width, activeFeatureIndex, progress, trackNumber, featureAlpha);
    }

    const startX = Math.round(width * 0.15);
    const usableWidth = Math.round(width * 0.70);
    const arrowBuffer = FORMATION.ARROW_BUFFER;
    const meterAreaPixels = usableWidth - 2 * arrowBuffer;
    const pixelPerMeter = meterAreaPixels / (platform.length || 420);
    const meterOrigin = startX + arrowBuffer;

    if (drawLayer === 'all' || drawLayer === 'static') {
        // Draw platform sectors at the top
        ctx.save();
        ctx.translate(0, 160);
        drawSectors(ctx, platform.sections, pixelPerMeter, meterOrigin, true);
        ctx.restore();

        // Rote Standort-Linie
        const currentLocation = platform.currentLocation !== undefined ? platform.currentLocation : 100;
        const redLineX = meterOrigin + (currentLocation * pixelPerMeter);
        
        ctx.strokeStyle = COLORS.RED;
        ctx.fillStyle = COLORS.RED;
        
        // Draw the red dot at the top of the line
        ctx.beginPath();
        ctx.arc(redLineX, 190, 16, 0, Math.PI * 2);
        ctx.fill();

        // Line downwards
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(redLineX, 230);
        ctx.lineTo(redLineX, height);
        ctx.stroke();
    }

    const startY = 225;
    // Zeilenhöhe bleibt auf 1080 logische Pixel abgestimmt (Render-Skalierung
    // übernimmt trainDisplay); nur die Breite wird proportional skaliert.
    const rowHeight = 300;

    for (let i = 0; i < 3; i++) {
        const journeys = journeyGroups[i] || [];
        drawVitrineRow(ctx, journeys, startY + (i * rowHeight), width, platform, activeFeatureStr, startX, usableWidth, featureAlpha, drawLayer);
    }
}
