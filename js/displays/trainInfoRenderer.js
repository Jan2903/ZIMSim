// js/displays/trainInfoRenderer.js
import { COLORS, FONTS, INFO } from './constants.js';
import { drawText, drawWrappedText, drawInfoTopText, drawTextInRectangle } from './textUtils.js';
import { drawPictograms } from './pictogramRenderer.js';
import { calculateCoachPositions, getSectorsForCoaches } from '../utils/formationUtils.js';

function areJourneysMerged(journeys) {
    if (!journeys || journeys.length <= 1) return true;
    const firstDest = (journeys[0].destination || "").trim();
    const firstVias = (journeys[0].vias || []).join('|').trim();
    const firstTime = (journeys[0].scheduledTime || "").trim();
    for (let i = 1; i < journeys.length; i++) {
        if ((journeys[i].destination || "").trim() !== firstDest) return false;
        if ((journeys[i].vias || []).join('|').trim() !== firstVias) return false;
        if ((journeys[i].scheduledTime || "").trim() !== firstTime) return false;
    }
    return true;
}

function getPlatformSectors(targetJourney, allJourneys, platform) {
    if (targetJourney.sectors) return targetJourney.sectors;
    if (!targetJourney || !targetJourney.formation || !targetJourney.formation.groups) return "";
    
    const sectors = new Set();
    let hasStaticSectorInfo = false;
    for (const group of targetJourney.formation.groups) {
        for (const coach of group.coaches) {
            const pos = coach.platformPosition;
            if (pos) {
                if (pos.sector) {
                    sectors.add(pos.sector);
                    hasStaticSectorInfo = true;
                } else if (pos.name && pos.name.length === 1) {
                    sectors.add(pos.name);
                    hasStaticSectorInfo = true;
                }
            }
        }
    }
    
    if (hasStaticSectorInfo) {
        const sectorArr = Array.from(sectors).sort();
        if (sectorArr.length === 0) return "";
        if (sectorArr.length === 1) return sectorArr[0];
        return `${sectorArr[0]}-${sectorArr[sectorArr.length - 1]}`;
    }

    if (allJourneys && platform) {
        const { allCoaches } = calculateCoachPositions(allJourneys);
        const targetGroups = new Set(targetJourney.formation.groups);
        
        const targetCoaches = [];
        
        for (const item of allCoaches) {
            if (targetGroups.has(item.group)) {
                targetCoaches.push(item);
            }
        }
        
        if (targetCoaches.length > 0) {
            return getSectorsForCoaches(targetCoaches, platform);
        }
    }

    return "";
}

/**
 * Zeichnet die Störungs-Overlays (Ausfall, Gleiswechsel, VerkehrtAb) für Nebenmonitore.
 * Liest direkt die camelCase-Properties vom Journey-Model.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../models/journey.js').Journey} journey - Die Fahrt-Daten.
 * @param {import('./textUtils.js').RenderContext} renderCtx - Render-Kontext.
 */
export function drawDisruptionOverlay(ctx, journey, renderCtx) {
    const abfahrt = journey.scheduledTime || "";
    const abfahrtA = journey.expectedTime || "";
    const ziel = journey.destination || "";
    const vias = journey.vias || [];
    const trainNr = journey.effectiveDisplayName || "";

    const { gleiswechsel = "0", ausfall = false, verkehrtAb = "0" } = journey;

    ctx.textBaseline = 'middle';

    if (ausfall) {
        drawInfoTopText(ctx, COLORS.DARK_RED, COLORS.WHITE, 'Fährt fällt aus / ', 'Cancelled', 50, 430);
    } else if (verkehrtAb !== "0") {
        drawInfoTopText(ctx, COLORS.DARK_RED, COLORS.WHITE, 'Halt entfällt hier / ', 'Stop cancelled', 50, 490);
    } else if (gleiswechsel !== "0") {
        drawInfoTopText(ctx, COLORS.ORANGE, COLORS.WHITE, 'Gleisänderung / ', 'Track change', 50, 450);
    }

    // Weißer Hintergrund für den Info-Bereich
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(3, 100, INFO.SIDE_SCREEN_WIDTH, 700);

    // Abfahrtszeit
    drawText(ctx, abfahrt, 50, 200, FONTS.regular(120), COLORS.NAVY, 'left');

    // Abweichende Zeit (in Rechteck)
    drawTextInRectangle(ctx, abfahrtA, 330, 195, FONTS.regular(90), 'left', 90, 10,
        renderCtx, 0, COLORS.NAVY, COLORS.WHITE);

    // Zugnummer (in Rechteck, rechtsbündig)
    drawTextInRectangle(ctx, trainNr, 890, 200, FONTS.regular(75), 'right', 75, 10,
        renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, true, true);

    // Ziel
    drawText(ctx, ziel, 50, 360, FONTS.regular(120), COLORS.NAVY, 'left');

    // Zusätzliche Informationen je nach Störungstyp
    if (gleiswechsel !== "0") {
        const viaFull = vias.filter(v => v !== "").join(' - ');
        drawWrappedText(ctx, viaFull, 50, 520, 880, 100, FONTS.regular(70), COLORS.NAVY, 'left');
    } else if (verkehrtAb !== "0") {
        const verkehrtAbMessage = 'Verkehrt heute ab / Departing today from ' + verkehrtAb;
        drawWrappedText(ctx, verkehrtAbMessage, 50, 520, 880, 100, FONTS.regular(70), COLORS.NAVY, 'left');
    }
}

/**
 * Zeichnet den kompletten Info-Bereich eines Monitors:
 * Piktogramme, Lauftext, Abfahrtszeit, Ziel, Via-Halte, Störungen.
 *
 * Liest direkt die camelCase-Properties vom Journey-Model.
 * Bei gekoppelten Zügen (Flügelzüge) enthält das Array mehrere Journeys.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../models/journey.js').Journey[]} journeys - Array von Fahrt-Daten (1+ bei Flügelzügen).
 * @param {number} width - Die verfügbare Breite des Screens.
 * @param {import('./textUtils.js').RenderContext} renderCtx - Render-Kontext.
 */
export function drawTrainInfo(ctx, journeys, width, renderCtx) {
    const { fullScreen, screen, scrollManager, zugID, canvas, cssScale = 1 } = renderCtx;

    const primary = journeys[0];

    const {
        scrollText = "",
        gleiswechsel = "0",
        ausfall = false,
        verkehrtAb = "0",
        ankunft = false,
        infoscreen = false,
    } = primary;

    const abfahrt = primary.scheduledTime || "";
    const abfahrtA = primary.expectedTime || "";
    const nr = journeys.map(j => j.effectiveDisplayName).filter(Boolean).join(' / ') || "";

    // Piktogramme zeichnen (gibt X-Position nach letztem Icon zurück)
    let x = drawPictograms(ctx, scrollText, nr, fullScreen, ankunft);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Lauftext bestimmen
    let infoToScroll = scrollText;
    if (ankunft) infoToScroll = "Ankunft / Arrival";
    if (infoscreen || gleiswechsel !== "0" || ausfall || verkehrtAb !== "0") infoToScroll = "";

    // Weißer Hintergrund für Lauftext
    ctx.fillStyle = COLORS.WHITE;
    if (infoToScroll !== "") ctx.fillRect(x, 0, width - x, INFO.HEADER_HEIGHT);

    // Scrollenden Info-Text erstellen/aktualisieren
    scrollManager.createOrUpdate(
        canvas, zugID, "info", infoToScroll,
        `${(screen.x + x + 5) * cssScale}px`,
        `${screen.y * cssScale}px`,
        `${(screen.w - x - 5) * cssScale}px`,
        `${100 * cssScale}px`,
        COLORS.NAVY,
        `${Math.round(67 * cssScale)}px "Open Sans Condensed"`
    );

    // --- Störungsanzeige für Nebenmonitore ---
    if (!fullScreen && (infoscreen || gleiswechsel !== "0" || ausfall || verkehrtAb !== "0")) {
        if (infoscreen) {
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillRect(0, 0, INFO.SIDE_SCREEN_WIDTH, 800);
            drawWrappedText(ctx, scrollText, 50, 120, 900, 80, FONTS.regular(70), COLORS.NAVY, 'left');
        } else {
            drawDisruptionOverlay(ctx, primary, renderCtx);
        }
        return;
    }

    // --- Trennlinie am linken Rand (nur Nebenmonitore) ---
    if (!fullScreen) {
        ctx.strokeStyle = COLORS.WHITE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, 800);
        ctx.stroke();
    }

    const isMerged = areJourneysMerged(journeys);

    // === HAUPTMONITOR (fullScreen) ===
    if (fullScreen) {
        if (ankunft) {
            drawText(ctx, abfahrt, 100, 220, FONTS.regular(180), COLORS.WHITE, 'left');
            if (abfahrtA && abfahrtA !== abfahrt) {
                drawTextInRectangle(ctx, abfahrtA, 520, 215, FONTS.regular(120), 'left', 120, 20,
                    renderCtx, 0, COLORS.WHITE, COLORS.NAVY);
            }
            drawTextInRectangle(ctx, nr, 1855, 220, FONTS.regular(100), 'right', 100, 15,
                renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true);

            const fromDestination = primary.destination || "";
            drawText(ctx, "Bitte nicht einsteigen", 110, 450, FONTS.regular(180), COLORS.WHITE, 'left');
            drawText(ctx, "Please do not board", 105, 670, FONTS.italic(180), COLORS.WHITE, 'left');
            drawText(ctx, 'von / from ' + fromDestination, 112, 850, FONTS.regular(70), COLORS.WHITE, 'left');
        } else if (isMerged) {
            drawText(ctx, abfahrt, 100, 220, FONTS.regular(180), COLORS.WHITE, 'left');
            if (abfahrtA && abfahrtA !== abfahrt) {
                drawTextInRectangle(ctx, abfahrtA, 520, 215, FONTS.regular(120), 'left', 120, 20,
                    renderCtx, 0, COLORS.WHITE, COLORS.NAVY);
            }
            drawTextInRectangle(ctx, nr, 1855, 220, FONTS.regular(100), 'right', 100, 15,
                renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true);

            let yPos = 420;
            drawText(ctx, primary.destination, 100, yPos, FONTS.regular(180), COLORS.WHITE, 'left');
            const viaText = (primary.vias || []).join(' - ');
            drawWrappedText(ctx, viaText, 112, yPos + 150,  1800,80,FONTS.regular(70), COLORS.WHITE, 'left');
        } else {
            const zoneWidth = width / 2; // Split screen for true wing trains
            const maxTrains = Math.min(journeys.length, 2);

            for (let i = 0; i < maxTrains; i++) {
                const journey = journeys[i];
                const xOffset = i * zoneWidth;
                
                const jAbfahrt = journey.scheduledTime || "";
                const jAbfahrtA = journey.expectedTime || "";
                
                const drawTime = (i === 0) || (jAbfahrt !== primary.scheduledTime || jAbfahrtA !== primary.expectedTime);

                if (drawTime) {
                    drawText(ctx, jAbfahrt, xOffset + 50, 200, FONTS.regular(120), COLORS.WHITE, 'left');
                    if (jAbfahrtA && jAbfahrtA !== jAbfahrt) {
                        drawTextInRectangle(ctx, jAbfahrtA, xOffset + 330, 195, FONTS.regular(90), 'left', 90, 10,
                            renderCtx, 0, COLORS.WHITE, COLORS.NAVY);
                    }
                }
                
                const rightAlignX = xOffset + zoneWidth - 70; // Matches 890 for 960 width
                drawTextInRectangle(ctx, journey.effectiveDisplayName, rightAlignX, 200, FONTS.regular(75), 'right', 75, 10,
                    renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true);

                let yPos = 360;
                drawText(ctx, journey.destination, xOffset + 50, yPos, FONTS.regular(120), COLORS.WHITE, 'left');
                yPos += 160;
                const viaText = (journey.vias || []).join(' - ');
                drawWrappedText(ctx, viaText, xOffset + 50, yPos, zoneWidth - 100, 80, FONTS.regular(70), COLORS.WHITE, 'left');
            }
        }

    // === NEBENMONITOR (compact) ===
    } else {
        drawText(ctx, abfahrt, 50, 200, FONTS.regular(120), COLORS.WHITE, 'left');
        if (abfahrtA && abfahrtA !== abfahrt) {
            drawTextInRectangle(ctx, abfahrtA, 330, 195, FONTS.regular(90), 'left', 90, 10,
                renderCtx, 0, COLORS.WHITE, COLORS.NAVY);
        }
        
        if (isMerged) {
            drawTextInRectangle(ctx, nr, 890, 200, FONTS.regular(75), 'right', 75, 10,
                renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true);
        }

        if (ankunft) {
            const fromDestination = primary.destination || "";
            drawText(ctx, 'von / from ' + fromDestination, 50, 360, FONTS.regular(67), COLORS.WHITE, 'left');
            scrollManager.createOrUpdate(canvas, zugID, 'ankunft', "Bitte nicht einsteigen",
                `${(screen.x + 50) * cssScale}px`, `${(screen.y + 420) * cssScale}px`,
                `${(screen.w - 50) * cssScale}px`, `${120 * cssScale}px`, COLORS.WHITE, `${Math.round(120 * cssScale)}px "Open Sans Condensed"`);
            scrollManager.createOrUpdate(canvas, zugID, 'arrival', "Please do not board",
                `${(screen.x + 50) * cssScale}px`, `${(screen.y + 560) * cssScale}px`,
                `${(screen.w - 50) * cssScale}px`, `${120 * cssScale}px`, COLORS.WHITE, `italic ${Math.round(120 * cssScale)}px "Open Sans Condensed"`);
        } else if (isMerged) {
            let yPos = 360;
            drawText(ctx, primary.destination, 50, yPos, FONTS.regular(120), COLORS.WHITE, 'left');
            yPos += 160;
            const viaText = (primary.vias || []).join(' - ');
            drawWrappedText(ctx, viaText, 50, yPos, 880, 80, FONTS.regular(70), COLORS.WHITE, 'left');
        } else {
            let yPos = 360;
            const destFont = FONTS.regular(90);
            const bracketX = 20;
            const bracketStartY = yPos; 
            let lastYPos = yPos;

            for (const journey of journeys) {
                drawText(ctx, journey.destination, 50, yPos, destFont, COLORS.WHITE, 'left');
                drawTextInRectangle(ctx, journey.effectiveDisplayName, 890, yPos, FONTS.regular(75), 'right', 75, 10,
                    renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true);
                
                const sectors = getPlatformSectors(journey, journeys, renderCtx.platform);
                if (sectors) {
                    drawText(ctx, sectors, 890, yPos + 100, FONTS.regular(64), COLORS.WHITE, 'right');
                }
                
                lastYPos = yPos;
                yPos += 240;
            }

            const bracketEndY = lastYPos;
            const bracketHeight = bracketEndY - bracketStartY;
            
            ctx.strokeStyle = COLORS.WHITE;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(bracketX + 15, bracketStartY);
            ctx.lineTo(bracketX, bracketStartY);
            ctx.lineTo(bracketX, bracketStartY + bracketHeight);
            ctx.lineTo(bracketX + 15, bracketStartY + bracketHeight);
            ctx.stroke();
        }
    }
}
