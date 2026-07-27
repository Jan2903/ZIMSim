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
 * Zeichnet den kompletten Info-Bereich eines Monitors:
 * Piktogramme, Lauftext, Abfahrtszeit, Ziel, Via-Halte, Störungen.
 *
 * Liest direkt die camelCase-Properties vom Journey-Model.
 * Bei gekoppelten Zügen (Flügelzüge) enthält das Array mehrere Journeys.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../models/journey.js').Journey[]} journeys - Array von Fahrt-Daten (1+ bei Flügelzügen).
 * @param {number} width - Die verfügbare Breite des Screens.
 * @param {number} height - Die verfügbare Höhe des Screens.
 * @param {import('./textUtils.js').RenderContext} renderCtx - Render-Kontext.
 */
export function drawTrainInfo(ctx, journeys, width, height, renderCtx) {
    const { fullScreen, screen, scrollManager, zugID, canvas, cssScale = 1 } = renderCtx;
    const pAlpha = renderCtx.pageAlpha !== undefined ? renderCtx.pageAlpha : 1.0;
    ctx.globalAlpha = pAlpha;

    const primary = journeys[0];

    let {
        scrollText = "",
        ausfall = false,
        verkehrtAb = "0",
        ankunft = false,
        infoscreen = false,
    } = primary;

    if (!ankunft && primary.linkedArrivalJourneyId && renderCtx.journeyStore) {
        const arrivalJourney = renderCtx.journeyStore.getJourney(primary.linkedArrivalJourneyId);
        if (arrivalJourney) {
            const contextText = primary.generateArrivalContextText(arrivalJourney);
            if (contextText) {
                if (scrollText) {
                    scrollText = contextText + " +++ " + scrollText;
                } else {
                    scrollText = contextText;
                }
            }
        }
    }

    const abfahrt = primary.scheduledTime || "";
    const abfahrtA = primary.expectedTime || "";
    const nr = journeys.map(j => j.effectiveDisplayName).filter(Boolean).join(' / ') || "";

    const hasAnyTrackChange = journeys.some(j => j.hasTrackChange);
    
    // Streng exklusiv für Nebenmonitore (!fullScreen)
    const isDisrupted = !fullScreen && (ausfall || verkehrtAb !== "0" || hasAnyTrackChange);

    // Infoscreen Sonderfall
    if (!fullScreen && infoscreen) {
        ctx.fillStyle = COLORS.WHITE;
        ctx.fillRect(3, 0, width - 3, height);
        
        let textToDraw = scrollText;
        if (renderCtx.activeInfoText) {
            textToDraw = renderCtx.activeInfoText.text;
        }
        drawWrappedText(ctx, textToDraw, 50, 120, 900, 80, FONTS.regular(70), COLORS.NAVY, 'left');
        
        if (renderCtx.totalPages && renderCtx.totalPages > 1) {
            drawPaginationDots(ctx, renderCtx, width, height, COLORS.NAVY);
        }
        return;
    }

    // Piktogramme zeichnen (gibt X-Position nach letztem Icon zurück)
    let x = drawPictograms(ctx, scrollText, nr, fullScreen, ankunft);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Lauftext bestimmen
    let infoToScroll = scrollText;
    if (ankunft) infoToScroll = "Ankunft / Arrival";
    if (infoscreen || hasAnyTrackChange || ausfall || verkehrtAb !== "0") infoToScroll = "";

    // 1. Hintergrund füllen
    if (isDisrupted) {
        ctx.fillStyle = COLORS.WHITE;
        ctx.fillRect(3, 0, width - 3, height); // ab x=3 wegen Trennlinie
    } else {
        // Weißer Hintergrund für Lauftext
        ctx.fillStyle = COLORS.WHITE;
        if (infoToScroll !== "") ctx.fillRect(x, 0, width - x, INFO.HEADER_HEIGHT);
    }

    // Scrollenden Info-Text erstellen/aktualisieren
    scrollManager.createOrUpdate(
        canvas, zugID, "info", infoToScroll,
        `${(screen.x + x + 5) * cssScale}px`,
        `${screen.y * cssScale}px`,
        `${(screen.w - x - 5) * cssScale}px`,
        `${100 * cssScale}px`,
        COLORS.NAVY,
        `${Math.round(67 * cssScale)}px "Open Sans Condensed"`,
        pAlpha
    );

    // 2. Top-Banner zeichnen
    if (isDisrupted) {
        if (ausfall) {
            drawInfoTopText(ctx, COLORS.DARK_RED, COLORS.WHITE, 'Fährt fällt aus / ', 'Cancelled', 50, 430);
        } else if (verkehrtAb !== "0") {
            drawInfoTopText(ctx, COLORS.DARK_RED, COLORS.WHITE, 'Halt entfällt hier / ', 'Stop cancelled', 50, 490);
        } else if (hasAnyTrackChange) {
            drawInfoTopText(ctx, COLORS.ORANGE, COLORS.WHITE, 'Gleisänderung / ', 'Track change', 50, 450);
        }
    }

    // --- Trennlinie am linken Rand (nur Nebenmonitore) ---
    if (!fullScreen) {
        ctx.strokeStyle = COLORS.WHITE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, height);
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
            drawText(ctx, abfahrt, 100, 220, FONTS.regular(200), COLORS.WHITE, 'left');
            if (abfahrtA && abfahrtA !== abfahrt) {
                drawTextInRectangle(ctx, abfahrtA, 550, 215, FONTS.regular(120), 'left', 120, 20,
                    renderCtx, 0, COLORS.WHITE, COLORS.NAVY);
            }
            drawTextInRectangle(ctx, nr, 1855, 220, FONTS.regular(100), 'right', 100, 15,
                renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true);

            let yPos = 470;
            drawText(ctx, primary.destination, 100, yPos, FONTS.regular(200), COLORS.WHITE, 'left');
            const viaText = (primary.vias || []).join(' - ');
            drawWrappedText(ctx, viaText, 112, yPos + 200,  1800,100,FONTS.regular(75), COLORS.WHITE, 'left');
        } else {
            const zoneWidth = width / 2; // Split screen for true wing trains
            const maxTrains = Math.min(journeys.length, 2);

            for (let i = 0; i < maxTrains; i++) {
                const journey = journeys[i];
                const xOffset = i * zoneWidth + 30;
                
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
                drawText(ctx, journey.destination, xOffset + 50, yPos, FONTS.regular(128), COLORS.WHITE, 'left');
                yPos += 160;
                const viaText = (journey.vias || []).join(' - ');
                drawWrappedText(ctx, viaText, xOffset + 50, yPos, zoneWidth - 100, 100, FONTS.regular(75), COLORS.WHITE, 'left');
            }
        }

    // === NEBENMONITOR (compact) ===
    } else {
        const textColor = isDisrupted ? COLORS.NAVY : COLORS.WHITE;
        const rectBgColor = isDisrupted ? COLORS.NAVY : COLORS.WHITE;
        const rectTextColor = isDisrupted ? COLORS.WHITE : COLORS.NAVY;

        drawText(ctx, abfahrt, 50, 200, FONTS.regular(120), textColor, 'left');
        if (abfahrtA && abfahrtA !== abfahrt) {
            drawTextInRectangle(ctx, abfahrtA, 330, 195, FONTS.regular(90), 'left', 90, 10,
                renderCtx, 0, rectBgColor, rectTextColor);
        }
        
        if (isMerged) {
            drawTextInRectangle(ctx, nr, 890, 200, FONTS.regular(75), 'right', 75, 10,
                renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, isDisrupted, true);
        }

        if (ankunft) {
            const fromDestination = primary.destination || "";
            if (isDisrupted) {
                // Bei Störung: Ein kombinierter Scrolltext weiter oben
                drawText(ctx, 'von / from ' + fromDestination, 50, 520, FONTS.regular(75), textColor, 'left');
                scrollManager.createOrUpdate(canvas, zugID, 'ankunft', "Bitte nicht einsteigen Please do not board",
                    `${(screen.x + 50) * cssScale}px`, `${(screen.y + 300) * cssScale}px`,
                    `${(screen.w - 50) * cssScale}px`, `${128 * cssScale}px`, textColor, `${Math.round(128 * cssScale)}px "Open Sans Condensed"`, pAlpha);
                // Den separaten arrival Scrolltext löschen
                scrollManager.createOrUpdate(canvas, zugID, 'arrival', "", "", "", "", "", "", "", pAlpha);
            } else {
                // Normales Layout
                drawText(ctx, 'von / from ' + fromDestination, 50, 670, FONTS.regular(75), textColor, 'left');
                scrollManager.createOrUpdate(canvas, zugID, 'ankunft', "Bitte nicht einsteigen",
                    `${(screen.x + 50) * cssScale}px`, `${(screen.y + 280) * cssScale}px`,
                    `${(screen.w - 50) * cssScale}px`, `${120 * cssScale}px`, textColor, `${Math.round(120 * cssScale)}px "Open Sans Condensed"`, pAlpha);
                scrollManager.createOrUpdate(canvas, zugID, 'arrival', "Please do not board",
                    `${(screen.x + 50) * cssScale}px`, `${(screen.y + 430) * cssScale}px`,
                    `${(screen.w - 50) * cssScale}px`, `${120 * cssScale}px`, textColor, `italic ${Math.round(120 * cssScale)}px "Open Sans Condensed"`, pAlpha);
            }
        } else if (isMerged) {
            let yPos = 360;
            drawText(ctx, primary.destination, 50, yPos, FONTS.regular(128), textColor, 'left');
            yPos += 160;
            
            let infoToDraw = null;
            if (renderCtx.activeInfoText) {
                infoToDraw = renderCtx.activeInfoText.text;
            }

            if (infoToDraw) {
                const viaFont = FONTS.regular(isDisrupted ? 70 : 75);
                drawWrappedText(ctx, infoToDraw, 50, yPos, 880, 100, viaFont, textColor, 'left');
            } else if (!ausfall) {
                let viaText = (primary.vias || []).join(' - ');
                if (verkehrtAb !== "0") {
                    viaText = 'Verkehrt heute ab / Departing today from ' + verkehrtAb;
                }
                const viaFont = FONTS.regular(isDisrupted ? 70 : 75);
                drawWrappedText(ctx, viaText, 50, yPos, 880, 100, viaFont, textColor, 'left');
            }
        } else {
            let yPos = 360;
            const destFont = FONTS.regular(90);
            const bracketX = 20;
            const bracketStartY = yPos; 
            let lastYPos = yPos;

            for (const journey of journeys) {
                drawText(ctx, journey.destination, 50, yPos, destFont, textColor, 'left');
                drawTextInRectangle(ctx, journey.effectiveDisplayName, 890, yPos, FONTS.regular(75), 'right', 75, 10,
                    renderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, isDisrupted, true);
                
                const sectors = getPlatformSectors(journey, journeys, renderCtx.platform);
                if (sectors) {
                    drawText(ctx, sectors, 890, yPos + 100, FONTS.regular(64), textColor, 'right');
                }
                
                lastYPos = yPos;
                yPos += 240;
            }

            const bracketEndY = lastYPos;
            const bracketHeight = bracketEndY - bracketStartY;
            
            ctx.strokeStyle = textColor;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(bracketX + 15, bracketStartY);
            ctx.lineTo(bracketX, bracketStartY);
            ctx.lineTo(bracketX, bracketStartY + bracketHeight);
            ctx.lineTo(bracketX + 15, bracketStartY + bracketHeight);
            ctx.stroke();
        }

        // 4. Den "Bottom-Banner" am unteren Rand (Neues Gleis)
        if (isDisrupted && hasAnyTrackChange) {
            ctx.save();
            ctx.translate(0, 820);
            ctx.fillStyle = COLORS.ORANGE;
            ctx.fillRect(3, 0, width - 3, height - 820);
            ctx.fillStyle = COLORS.WHITE;
            drawText(ctx, 'Neues Gleis', 50, 50, FONTS.regular(67), COLORS.WHITE, 'left');
            drawText(ctx, 'New track', 50-5, 125, FONTS.italic(67), COLORS.WHITE, 'left');
            drawText(ctx, primary.ezGleis, width - 40, 80, FONTS.regular(128), COLORS.WHITE, 'right');
            ctx.restore();
        }

        if (renderCtx.totalPages && renderCtx.totalPages > 1) {
            drawPaginationDots(ctx, renderCtx, width, height, textColor);
        }
    }
}

/**
 * Zeichnet die Paginierungs-Punkte für den rotierenden Nebenmonitor.
 * @param {CanvasRenderingContext2D} ctx 
 * @param {object} renderCtx 
 * @param {number} width 
 * @param {number} height 
 * @param {string} dotColor 
 */
function drawPaginationDots(ctx, renderCtx, width, height, dotColor) {
    const dotRadius = 8;
    const dotSpacing = 60; // Abstand zwischen den Dots verdoppelt
    const totalWidth = (renderCtx.totalPages - 1) * dotSpacing;
    const startX = width / 2 - totalWidth / 2;
    const dotY = height - 40;

    for (let i = 0; i < renderCtx.totalPages; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * dotSpacing, dotY, dotRadius, 0, Math.PI * 2);
        
        ctx.strokeStyle = dotColor;
        ctx.lineWidth = 2;
        
        if (i === renderCtx.activePageIndex) {
            ctx.fillStyle = dotColor;
            ctx.fill();
            ctx.stroke(); // Stroke hinzufügen, damit die Außenmaße identisch zum leeren Kreis sind
        } else {
            ctx.stroke();
        }
    }
}

export function shouldRenderFormation(journeys) {
    if (!journeys || journeys.length === 0) return false;
    const primary = journeys[0];

    // Keine Formation bei Störungs-Overlays
    if (primary.hasTrackChange) return false;
    if (primary.infoscreen || primary.ausfall || primary.verkehrtAb !== "0") return false;
    
    // Keine Formation bei Ankünften
    if (primary.ankunft) return false;
    
    // Keine Formation, wenn keine Wagengruppen existieren
    const allFormationGroups = journeys.flatMap(j => j.formation ? j.formation.groups : []);
    if (allFormationGroups.length === 0 || allFormationGroups.every(g => g.coaches.length === 0)) return false;

    return true;
}

