// js/displays/boards/zuganzeigerRenderer.js
import { COLORS, FONTS } from '../../core/constants/theme.js';
import { INFO } from '../core/constants.js';
import { drawText, drawWrappedText, drawInfoTopText, drawTextInRectangle, drawInvertedTimeBox } from '../core/textUtils.js';
import { drawPictograms } from '../primitives/pictogramRenderer.js';
import { calculateCoachPositions, getSectorsForCoaches, getPlatformSectors } from '../../features/formation/formationUtils.js';
import { formatDisplayName, combineTrainNames } from '../../features/journey/trainNumberFormatter.js';
import { JourneyCouplingService } from '../../features/journey/services/journeyCouplingService.js';
import { journeyStore } from '../../core/state/stores.js';

function areJourneysMerged(journeys) {
    return JourneyCouplingService.areJourneysMerged(journeys);
}


/**
 * Zeichnet den kompletten Info-Bereich eines Monitors:
 * Piktogramme, Lauftext, Abfahrtszeit, Ziel, Via-Halte, Störungen.
 *
 * Liest direkt die camelCase-Properties vom Journey-Model.
 * Bei gekoppelten Zügen (Flügelzüge) enthält das Array mehrere Journeys.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../../models/journey.js').Journey[]} journeys - Array von Fahrt-Daten (1+ bei Flügelzügen).
 * @param {number} width - Die verfügbare Breite des Screens.
 * @param {number} height - Die verfügbare Höhe des Screens.
 * @param {import('../core/textUtils.js').RenderContext} renderCtx - Render-Kontext.
 */
export function drawTrainInfo(ctx, journeys, width, height, renderCtx) {
    const { fullScreen, screen, scrollManager, zugID, canvas } = renderCtx;
    const pAlpha = renderCtx.pageAlpha !== undefined ? renderCtx.pageAlpha : 1.0;
    ctx.globalAlpha = pAlpha;

    const offX = canvas ? canvas.offsetLeft : 0;
    const offY = canvas ? canvas.offsetTop : 0;

    const primary = journeys[0];
    const trainRenderCtx = {
        ...renderCtx,
        operator: primary?.operator,
        stationContext: renderCtx?.journeyStore?.stationContext || journeyStore?.stationContext
    };

    let {
        scrollText = "",
        ausfall = false,
        verkehrtAb = "0",
        ankunft = false,
        infoscreen = false,
    } = primary;

    if (!ankunft && primary.linkedArrivalJourneyId && renderCtx.journeyStore) {
        // Der Ankunftstext wird nun nativ als 'arrival-context' im infoTexts Array von Journey verwaltet.
        // Das bedeutet, primary.scrollText beinhaltet ihn bereits dynamisch!
    }

    const abfahrt = primary.scheduledTime || "";
    const abfahrtA = primary.expectedTime || "";
    const nr = combineTrainNames(journeys, journeyStore.nrwMode) || "";

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
    
    const isMerged = areJourneysMerged(journeys);

    // Die Schwächung (Zugteil endet in...) wird nun nativ als 'strengthening' Baustein im infoTexts Array von Journey verwaltet!
    // Dadurch beinhaltet `infoToScroll` (abgeleitet von `scrollText`) bereits alle aktivierten Texte in korrekter Reihenfolge.

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

    // Scrollenden Info-Text erstellen/aktualisieren (Offset an Gehäuse-Position des Canvas anpassen)
    scrollManager.createOrUpdate(
        canvas, zugID, "info", infoToScroll,
        `${offX + screen.x + x + 5}px`,
        `${offY + screen.y}px`,
        `${screen.w - x - 5}px`,
        `100px`,
        COLORS.NAVY,
        FONTS.regular(67),
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

    // === HAUPTMONITOR (fullScreen) ===
    if (fullScreen) {
        if (ankunft) {
            drawText(ctx, abfahrt, 100, 220, FONTS.regular(180), COLORS.WHITE, 'left');
            if (abfahrtA && abfahrtA !== abfahrt) {
                drawInvertedTimeBox(ctx, abfahrtA, 500, 215, FONTS.regular(120), {
                    paddingX: 20,
                    height: 140
                });
            }
            drawTextInRectangle(ctx, nr, 1855, 220, FONTS.regular(100), 'right', 100, 15,
                trainRenderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true, true);

            const fromDestination = primary.destinationLang || primary.destination || "";
            drawText(ctx, "Bitte nicht einsteigen", 110, 450, FONTS.regular(180), COLORS.WHITE, 'left');
            drawText(ctx, "Please do not board", 105, 670, FONTS.italic(180), COLORS.WHITE, 'left');
            drawText(ctx, 'von / from ' + fromDestination, 112, 850, FONTS.regular(70), COLORS.WHITE, 'left');
        } else if (isMerged) {
            drawText(ctx, abfahrt, 100, 220, FONTS.regular(200), COLORS.WHITE, 'left');
            if (abfahrtA && abfahrtA !== abfahrt) {
                drawInvertedTimeBox(ctx, abfahrtA, 530, 215, FONTS.regular(120), {
                    paddingX: 20,
                    height: 140
                });
            }
            drawTextInRectangle(ctx, nr, 1855, 220, FONTS.regular(100), 'right', 100, 15,
                trainRenderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true, true);

            let yPos = 470;
            drawText(ctx, primary.destinationLang || primary.destination, 100, yPos, FONTS.regular(200), COLORS.WHITE, 'left');
            const viaText = (primary.vias || []).join(' - ');
            drawWrappedText(ctx, viaText, 112, yPos + 200,  1800,100,FONTS.regular(75), COLORS.WHITE, 'left', 2);
        } else {
            const maxTrains = Math.min(journeys.length, 4);

            if (maxTrains <= 2) {
                const zoneWidth = width / 2; // 2-Spalten Split-Screen bei bis zu 2 Flügelzügen

                for (let i = 0; i < maxTrains; i++) {
                    const journey = journeys[i];
                    const xOffset = i * zoneWidth + 30;

                    const jAbfahrt = journey.scheduledTime || "";
                    const jAbfahrtA = journey.expectedTime || "";

                    const drawTime = (i === 0) || (jAbfahrt !== primary.scheduledTime || jAbfahrtA !== primary.expectedTime);

                    if (drawTime) {
                        drawText(ctx, jAbfahrt, xOffset + 50, 200, FONTS.regular(120), COLORS.WHITE, 'left');
                        if (jAbfahrtA && jAbfahrtA !== jAbfahrt) {
                            drawInvertedTimeBox(ctx, jAbfahrtA, xOffset + 320, 195, FONTS.regular(90), {
                                paddingX: 10,
                                height: 100
                            });
                        }
                    }

                    const rightAlignX = xOffset + zoneWidth - 70; // Matches 890 for 960 width
                    drawTextInRectangle(ctx, formatDisplayName(journey.effectiveDisplayName, journeyStore.nrwMode), rightAlignX, 200, FONTS.regular(75), 'right', 75, 10,
                        { ...trainRenderCtx, operator: journey.operator }, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true, true);

                    let yPos = 360;
                    drawText(ctx, journey.destinationLang || journey.destination, xOffset + 50, yPos, FONTS.regular(128), COLORS.WHITE, 'left');
                    yPos += 160;
                    const viaText = (journey.vias || []).join(' - ');
                    drawWrappedText(ctx, viaText, xOffset + 50, yPos, zoneWidth - 100, 100, FONTS.regular(75), COLORS.WHITE, 'left', 3);
                }
            } else {
                // Bei mehr als 2 Zügen/Zielen (3 oder 4): Vertikal untereinander mit Klammer wie Nebenmonitor
                const bracketX = 50;
                const rowHeight = maxTrains === 3 ? 190 : 145;
                const startY = maxTrains === 3 ? 200 : 175;
                const destFont = FONTS.regular(maxTrains === 3 ? 90 : 75);
                const timeFont = FONTS.regular(maxTrains === 3 ? 90 : 75);
                const badgeFont = maxTrains === 3 ? 75 : 65;
                const viaFont = FONTS.regular(maxTrains === 3 ? 60 : 50);

                let lastYPos = startY;

                for (let i = 0; i < maxTrains; i++) {
                    const journey = journeys[i];
                    const yPos = startY + (i * rowHeight);
                    lastYPos = yPos;

                    // 1. Zeit & ggf. Verspätungsbox
                    const jAbfahrt = journey.scheduledTime || "";
                    const jAbfahrtA = journey.expectedTime || "";
                    drawText(ctx, jAbfahrt, 110, yPos, timeFont, COLORS.WHITE, 'left');

                    let nextX = 360;
                    if (jAbfahrtA && jAbfahrtA !== jAbfahrt) {
                        const delayFont = FONTS.regular(maxTrains === 3 ? 70 : 55);
                        drawInvertedTimeBox(ctx, jAbfahrtA, 350, yPos - 5, delayFont, {
                            paddingX: 10,
                            height: maxTrains === 3 ? 80 : 65
                        });
                        nextX = 550;
                    }

                    // 2. Zugname / Liniennummer
                    drawTextInRectangle(ctx, formatDisplayName(journey.effectiveDisplayName, journeyStore.nrwMode), nextX + 170, yPos - 5, FONTS.regular(badgeFont), 'right', badgeFont, 10,
                        { ...trainRenderCtx, operator: journey.operator }, 0, COLORS.DIM_GREY, COLORS.WHITE, false, true, true);

                    // 3. Ziel
                    const destX = nextX + 210;
                    let destText = journey.destinationLang || journey.destination;
                    drawText(ctx, destText, destX, yPos, destFont, COLORS.WHITE, 'left');

                    // 4. Abschnitte / Sektoren (rechtsbündig)
                    const sectors = getPlatformSectors(journey, journeys, renderCtx.platform);
                    if (sectors) {
                        drawText(ctx, `Abschnitt ${sectors}`, 1855, yPos, FONTS.regular(maxTrains === 3 ? 65 : 55), COLORS.WHITE, 'right');
                    }

                    // 5. Optionale Vias (nur bei 3 Zügen, bei 4 Zeilen Platzgründe)
                    if (maxTrains === 3 && journey.vias && journey.vias.length > 0) {
                        const viaText = journey.vias.slice(0, 4).join(' - ');
                        drawWrappedText(ctx, viaText, destX, yPos + 60, 950, 60, viaFont, COLORS.WHITE, 'left', 1);
                    }
                }

                // Durchgehende geschweifte Klammer links mit horizontalen Abzweigen
                ctx.strokeStyle = COLORS.WHITE;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(bracketX + 20, startY - 35);
                ctx.lineTo(bracketX, startY - 35);
                ctx.lineTo(bracketX, lastYPos + 15);
                ctx.lineTo(bracketX + 20, lastYPos + 15);
                for (let i = 1; i < maxTrains - 1; i++) {
                    const midY = startY + (i * rowHeight) - 10;
                    ctx.moveTo(bracketX, midY);
                    ctx.lineTo(bracketX + 20, midY);
                }
                ctx.stroke();
            }
        }


    // === NEBENMONITOR (compact) ===
    } else {
        const textColor = isDisrupted ? COLORS.NAVY : COLORS.WHITE;
        const rectBgColor = isDisrupted ? COLORS.NAVY : COLORS.WHITE;
        const rectTextColor = isDisrupted ? COLORS.WHITE : COLORS.NAVY;

        drawText(ctx, abfahrt, 50, 200, FONTS.regular(120), textColor, 'left');
        if (abfahrtA && abfahrtA !== abfahrt) {
            drawInvertedTimeBox(ctx, abfahrtA, 320, 195, FONTS.regular(90), {
                paddingX: 10,
                height: 100,
                backgroundColor: rectBgColor,
                textColor: rectTextColor
            });
        }
        
        if (isMerged) {
            drawTextInRectangle(ctx, nr, 890, 200, FONTS.regular(75), 'right', 75, 10,
                trainRenderCtx, 0, COLORS.DIM_GREY, COLORS.WHITE, isDisrupted, true, true);
        }

        if (ankunft) {
            const fromDestination = primary.destinationKurz || primary.destination || "";
            if (isDisrupted) {
                // Bei Störung: Ein kombinierter Scrolltext weiter oben
                drawText(ctx, 'von / from ' + fromDestination, 50, 520, FONTS.regular(75), textColor, 'left');
                scrollManager.createOrUpdate(canvas, zugID, 'ankunft', "Bitte nicht einsteigen Please do not board",
                    `${offX + screen.x + 50}px`, `${offY + screen.y + 300}px`,
                    `${screen.w - 50}px`, `128px`, textColor, FONTS.regular(128), pAlpha);
                // Den separaten arrival Scrolltext löschen
                scrollManager.createOrUpdate(canvas, zugID, 'arrival', "", "", "", "", "", "", "", pAlpha);
            } else {
                // Normales Layout
                drawText(ctx, 'von / from ' + fromDestination, 50, 670, FONTS.regular(75), textColor, 'left');
                scrollManager.createOrUpdate(canvas, zugID, 'ankunft', "Bitte nicht einsteigen",
                    `${offX + screen.x + 50}px`, `${offY + screen.y + 280}px`,
                    `${screen.w - 50}px`, `120px`, textColor, FONTS.regular(120), pAlpha);
                scrollManager.createOrUpdate(canvas, zugID, 'arrival', "Please do not board",
                    `${offX + screen.x + 50}px`, `${offY + screen.y + 430}px`,
                    `${screen.w - 50}px`, `120px`, textColor, FONTS.italic(120), pAlpha);
            }
        } else if (isMerged) {
            let yPos = 360;
            
            ctx.font = FONTS.regular(128);
            let destText = primary.destinationLang || primary.destination;
            const availableWidth = width - 100; // 50px margin each side
            if (ctx.measureText(destText).width > availableWidth) {
                destText = primary.destinationKurz || primary.destination;
            }
            
            drawText(ctx, destText, 50, yPos, FONTS.regular(128), textColor, 'left');
            yPos += 160;
            
            let infoToDraw = null;
            if (renderCtx.activeInfoText) {
                infoToDraw = renderCtx.activeInfoText.text;
            }

            if (infoToDraw) {
                const viaFont = FONTS.regular(isDisrupted ? 70 : 75);
                drawWrappedText(ctx, infoToDraw, 50, yPos, 880, 100, viaFont, textColor, 'left', 3);
            } else if (!ausfall) {
                let viaText = (primary.vias || []).join(' - ');
                if (verkehrtAb !== "0") {
                    viaText = 'Verkehrt heute ab / Departing today from ' + verkehrtAb;
                }
                const viaFont = FONTS.regular(isDisrupted ? 70 : 75);
                drawWrappedText(ctx, viaText, 50, yPos, 880, 100, viaFont, textColor, 'left', 3);
            }
        } else {
            const maxTrains = Math.min(journeys.length, 4);
            const rowStep = maxTrains <= 2 ? 240 : (maxTrains === 3 ? 170 : 130);
            const startY = maxTrains <= 2 ? 360 : (maxTrains === 3 ? 310 : 270);
            const destFont = FONTS.regular(maxTrains <= 2 ? 90 : (maxTrains === 3 ? 75 : 65));
            const badgeFont = maxTrains <= 2 ? 75 : (maxTrains === 3 ? 65 : 55);
            const sectorFont = FONTS.regular(maxTrains <= 2 ? 64 : (maxTrains === 3 ? 55 : 45));

            const bracketX = 20;
            const bracketStartY = startY;
            let lastYPos = startY;

            for (let i = 0; i < maxTrains; i++) {
                const journey = journeys[i];
                const yPos = startY + (i * rowStep);
                let destText = journey.destinationLang || journey.destination;
                ctx.font = destFont;
                const availableWidth = 800; // Platz für Zugnummer rechts lassen
                if (ctx.measureText(destText).width > availableWidth) {
                    destText = journey.destinationKurz || journey.destination;
                }
                
                drawText(ctx, destText, 50, yPos, destFont, textColor, 'left');
                drawTextInRectangle(ctx, formatDisplayName(journey.effectiveDisplayName, journeyStore.nrwMode), 890, yPos, FONTS.regular(badgeFont), 'right', badgeFont, 10,
                    { ...trainRenderCtx, operator: journey.operator }, 0, COLORS.DIM_GREY, COLORS.WHITE, isDisrupted, true, true);
                
                const sectors = getPlatformSectors(journey, journeys, renderCtx.platform);
                if (sectors) {
                    const sectorYOffset = maxTrains === 4 ? 60 : (maxTrains === 3 ? 70 : 100);
                    drawText(ctx, sectors, 890, yPos + sectorYOffset, sectorFont, textColor, 'right');
                }
                
                lastYPos = yPos;
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
            // Zusätzliche Mittelabzweige bei 3 oder 4 Zügen
            for (let i = 1; i < maxTrains - 1; i++) {
                const midY = startY + (i * rowStep);
                ctx.moveTo(bracketX, midY);
                ctx.lineTo(bracketX + 15, midY);
            }
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

