import { COLORS, FONTS, FORMATION } from './constants.js';
import { drawFormation, drawSectors } from './formationRenderer.js';
import { drawText } from './textUtils.js';
import { drawDBLogo, drawAnalogClock } from './sharedRenderers.js';

function drawVitrineHeader(ctx, width, activeFeatureIndex, progress, trackNumber, featureAlpha = 1.0) {
    // 1. Clock (Left)
    drawAnalogClock(ctx, 80, 80);
    
    // Digital Time
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    drawText(ctx, timeStr, 150, 110, FONTS.bold(86), COLORS.WHITE, 'left', 'middle');

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
    drawText(ctx, currentFeat.de, startX, 80, FONTS.regular(35), COLORS.WHITE, 'left', 'middle');
    drawText(ctx, currentFeat.en, startX + w1 + 10, 80, FONTS.italic(35), COLORS.WHITE, 'left', 'middle');
    ctx.restore();

    // 3. Track & DB Logo (Right)
    drawText(ctx, 'Gleis', width - 420, 80, FONTS.regular(35), COLORS.WHITE, 'right', 'middle');
    drawText(ctx, 'Platform', width - 300, 80, FONTS.italic(35), COLORS.WHITE, 'right', 'middle');
    drawText(ctx, trackNumber || "", width - 280, 90, FONTS.bold(66), COLORS.WHITE, 'left', 'middle');
    
    drawDBLogo(ctx, width - 110, 80);
}

function drawVitrineRow(ctx, journeys, yOffset, width, platform, activeFeatureStr, startX, usableWidth, featureAlpha = 1.0) {
    // Horizontale Trennlinie
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, yOffset); 
    ctx.lineTo(width, yOffset);
    ctx.stroke();

    if (!journeys || journeys.length === 0) return;

    // Journeys is an array of coupled trains, journeys[0] is the primary
    const primary = journeys[0];
    const scheduled = primary.scheduledTime || "";
    const expected = primary.expectedTime || "";
    
    // Time
    drawText(ctx, scheduled, 20, yOffset + 150, FONTS.regular(75), COLORS.WHITE, 'left', 'middle');
    
    if (expected && expected !== scheduled) {
        ctx.fillStyle = COLORS.WHITE;
        ctx.fillRect(180, yOffset + 95, 100, 55);
        drawText(ctx, expected, 230, yOffset + 140, FONTS.bold(48), COLORS.MIDNIGHT_BLUE, 'center', 'middle');
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
        featureAlpha: featureAlpha
    });
    ctx.restore();

    // Default Position, falls keine Formation gezeichnet wurde
    let textX = 400; 
    if (formationResult && formationResult.trainPixelStart !== undefined) {
        textX = formationResult.trainPixelStart;
    }

    // Zugname, Ziel, Vias
    const trainName = primary.effectiveDisplayName || "";
    const dest = primary.destination || "";
    const vias = (primary.vias || []).join(" - ");

    // Kleines Label für Zugnummer
    ctx.fillStyle = COLORS.DIM_GREY;
    ctx.font = FONTS.bold(28);
    const nameWidth = ctx.measureText(trainName).width;
    ctx.fillRect(textX, yOffset + 37, nameWidth + 20, 35);
    drawText(ctx, trainName, textX + 10, yOffset + 65, FONTS.bold(30), COLORS.WHITE, 'left', 'middle');

    // Ziel
    ctx.font = FONTS.regular(65);
    drawText(ctx, dest, textX, yOffset + 135, FONTS.regular(65), COLORS.WHITE, 'left', 'middle');
    
    // Vias
    if (vias) {
        const destWidth = ctx.measureText(dest + " ").width;
        drawText(ctx, "über " + vias, textX + destWidth + 10, yOffset + 133, FONTS.regular(35), COLORS.WHITE, 'left', 'middle');
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
        featureAlpha = 1.0
    } = animOptions;

    drawVitrineHeader(ctx, width, activeFeatureIndex, progress, trackNumber, featureAlpha);

    const startX = 288; // 15% von 1920
    const usableWidth = 1344; // 70% von 1920 (85% - 15%)
    const arrowBuffer = FORMATION.ARROW_BUFFER;
    const meterAreaPixels = usableWidth - 2 * arrowBuffer;
    const pixelPerMeter = meterAreaPixels / (platform.length || 420);
    const meterOrigin = startX + arrowBuffer;

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

    const rowHeight = 300;
    const startY = 225;

    for (let i = 0; i < 3; i++) {
        const journeys = journeyGroups[i] || [];
        drawVitrineRow(ctx, journeys, startY + (i * rowHeight), width, platform, activeFeatureStr, startX, usableWidth, featureAlpha);
    }
}
