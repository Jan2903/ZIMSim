// js/displays/listeRenderer.js
import { COLORS, FONTS } from './constants.js';
import { drawText } from './textUtils.js';

/**
 * Renderer für den Voranzeiger-Listenmodus.
 * Zeichnet eine einzelne Abfahrtszeile im kompakten Listenformat (1920x180px).
 *
 * @param {CanvasRenderingContext2D} ctx - Der Canvas-Kontext.
 * @param {import('../models/journey.js').Journey} journey - Die Fahrt-Daten.
 * @param {number} width - Die verfügbare Breite (z.B. 1920).
 * @param {number} height - Die verfügbare Höhe (z.B. 180).
 */
export function drawListeRow(ctx, journey, width, height) {
    // Horizontale Trennlinie am unteren Rand jeder Zeile
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height - 1);
    ctx.lineTo(width, height - 1);
    ctx.stroke();

    if (!journey) return;

    const isCancelled = journey.ausfall;
    const hasTrackChange = journey.hasTrackChange;
    const isArrival = journey.ankunft;

    // 1. Zeitspalte (Left: x = 20)
    const planTime = journey.scheduledTime || '';
    const expectedTime = journey.expectedTime || '';
    const hasDelay = expectedTime && expectedTime !== planTime;

    ctx.font = FONTS.regular(85);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isCancelled ? COLORS.DARK_RED : COLORS.WHITE;
    ctx.fillText(planTime, 20, 60);

    if (hasDelay && !isCancelled) {
        ctx.fillStyle = COLORS.WHITE;
        ctx.fillRect(190, 30, 95, 55);
        ctx.font = FONTS.bold(44);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.fillText(expectedTime, 237, 58);
    }

    // 2. Zugnummer / Produktgattung Badge (x = 310)
    const trainName = journey.effectiveDisplayName || journey.name || '';
    if (trainName) {
        ctx.font = FONTS.bold(42);
        const nameWidth = ctx.measureText(trainName).width;
        const badgeX = 310;
        const badgeY = 32;
        const badgeHeight = 52;
        const badgePadding = 12;

        let badgeBg = COLORS.DIM_GREY;
        let badgeTextColor = COLORS.WHITE;
        const isIC = trainName.includes('IC') || trainName.includes('EC');
        const isFLX = trainName.includes('FLX');

        if (isIC) {
            badgeBg = COLORS.WHITE;
            badgeTextColor = COLORS.NAVY;
        } else if (isFLX) {
            badgeBg = COLORS.LIME;
            badgeTextColor = COLORS.WHITE;
        }

        ctx.fillStyle = badgeBg;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, nameWidth + 2 * badgePadding, badgeHeight, 8);
        ctx.fill();

        ctx.fillStyle = badgeTextColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(trainName, badgeX + badgePadding + nameWidth / 2, badgeY + badgeHeight / 2 + 2);
    }

    // 3. Zielbahnhof / Herkunft (x = 550)
    let destText = journey.effectiveDestination;
    if (isArrival) {
        destText = 'von ' + (journey.destinationKurz || journey.destination);
    }
    
    ctx.font = FONTS.regular(85);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isCancelled ? COLORS.DARK_RED : COLORS.WHITE;
    
    const maxDestWidth = 850;
    if (ctx.measureText(destText).width > maxDestWidth) {
        destText = journey.effectiveDestinationKurz;
    }
    ctx.fillText(destText, 550, 60);

    // 4. Unterzeile: Zwischenhalte (Vias) oder Störungsmeldung (y = 130)
    let subText = '';
    let subColor = 'rgba(255, 255, 255, 0.8)';
    let subFont = FONTS.regular(44);

    if (isCancelled) {
        subText = 'Fahrt fällt heute aus / Cancelled';
        subColor = COLORS.DARK_RED;
        subFont = FONTS.bold(44);
    } else if (journey.verkehrtAb && journey.verkehrtAb !== '0') {
        subText = `Verkehrt heute erst ab ${journey.verkehrtAb}`;
        subColor = COLORS.DARK_RED;
    } else if (hasTrackChange) {
        subText = `Gleisänderung: Heute von Gleis ${journey.ezGleis}`;
        subColor = COLORS.ORANGE;
        subFont = FONTS.bold(44);
    } else if (journey.delayReason) {
        subText = `${journey.delayReason}`;
        subColor = COLORS.ORANGE;
    } else if (isArrival) {
        subText = 'Ankunft / Arrival — Bitte nicht einsteigen';
    } else {
        const vias = journey.vias || [];
        if (vias.length > 0) {
            subText = 'über ' + vias.join(' - ');
        } else if (journey.scrollText) {
            subText = journey.scrollText;
        }
    }

    if (subText) {
        ctx.font = subFont;
        ctx.fillStyle = subColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        const maxSubWidth = 1200;
        let renderedSub = subText;
        if (ctx.measureText(renderedSub).width > maxSubWidth) {
            while (renderedSub.length > 3 && ctx.measureText(renderedSub + '...').width > maxSubWidth) {
                renderedSub = renderedSub.substring(0, renderedSub.length - 1);
            }
            renderedSub += '...';
        }
        ctx.fillText(renderedSub, 310, 130);
    }

    // 5. Gleisspalte (Right: x = width - 40)
    const planTrack = journey.platform ? String(journey.platform) : '';
    const ezTrack = journey.ezGleis ? String(journey.ezGleis) : '';

    if (hasTrackChange) {
        ctx.font = FONTS.regular(50);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText(`(${planTrack})`, width - 150, 60);

        ctx.fillStyle = COLORS.ORANGE;
        ctx.font = FONTS.bold(95);
        ctx.fillText(ezTrack, width - 40, 60);

        ctx.font = FONTS.regular(36);
        ctx.fillStyle = COLORS.ORANGE;
        ctx.fillText('Gleis', width - 40, 130);
    } else if (planTrack || ezTrack) {
        const trackToDisplay = ezTrack || planTrack;
        ctx.fillStyle = COLORS.WHITE;
        ctx.font = FONTS.bold(95);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(trackToDisplay, width - 40, 60);

        ctx.font = FONTS.regular(36);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText('Gleis', width - 40, 130);
    }
}
