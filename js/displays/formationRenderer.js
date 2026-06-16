// js/displays/formationRenderer.js
import { Coach } from '../models/coach.js';
import { COLORS, FONTS, FORMATION } from './constants.js';
import { drawText } from './textUtils.js';
import {
    drawLocomotive, drawStartWagon, drawEndWagon, drawMiddleWagon,
    drawCoupling, drawDirectionArrow, drawFirstClassBar,
    drawFullscreenClassLabels, drawCompactClassLabels,
    drawFullscreenAmenityIcons, drawCompactAmenityIcons,
    drawFullscreenWagonNumbers, drawCompactWagonNumbers,
    mapCoachType, getSafeCenter
} from './coachRenderer.js';

// Debug-Schalter: Meter-Markierungen am Bahnsteig anzeigen
export let DEBUG_METERS = false;

export function toggleDebugMeters() {
    DEBUG_METERS = !DEBUG_METERS;
    return DEBUG_METERS;
}

/**
 * Zeichnet die Bahnsteig-Sektoren (A, B, C, ...) über der Wagenreihung.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<[string, number]>} sectors - Array von [Name, StartMeter]-Paaren.
 * @param {number} scaleFactor - Pixel pro Meter.
 */
export function drawSectors(ctx, sections, scaleFactor, startX = FORMATION.THRESHOLD, boxed = false) {
    ctx.fillStyle = COLORS.WHITE;
    ctx.font = FONTS.regular(45);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    sections.forEach(s => {
        const position = (s.cubePosition !== undefined && s.cubePosition !== null) ? s.cubePosition : (s.startMeter + s.endMeter) / 2;
        const displayPos = startX + (position * scaleFactor);
        
        if (boxed) {
            ctx.strokeStyle = COLORS.WHITE;
            ctx.lineWidth = 2;
            ctx.strokeRect(displayPos - 22, -4, 48, 52);
        }
        
        ctx.fillText(s.name, displayPos, 2);
    });
}

/**
 * Zeichnet die gesamte Wagenreihung für eine oder mehrere Journeys inkl. Wagen-Shapes,
 * Sektoren, Richtungspfeile und Features (Nummern/Klasse/Ausstattung).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../models/journey.js').Journey[]} journeys - Array von Fahrt-Daten (1+ bei Flügelzügen).
 * @param {import('../models/platform.js').Platform} platform - Das Bahnsteig-Objekt.
 * @param {object} options
 * @param {boolean} options.fullScreen - Hauptmonitor (true) oder Nebenmonitor (false).
 * @param {string} options.activeFeature - 'wagennummern', 'ausstattung' oder 'klasse'.
 */
export function drawFormation(ctx, journeys, platform, options = {}) {
    const {
        fullScreen = false,
        activeFeature = 'wagennummern',
        hideSectors = false,
        hideDestinations = false,
        featureAlpha = 1.0,
        customStartX = FORMATION.THRESHOLD,
        customUsableWidth = fullScreen ? FORMATION.USABLE_WIDTH_FULL : FORMATION.USABLE_WIDTH_COMPACT
    } = options;

    const y = FORMATION.COACH_Y_OFFSET;

    const primary = journeys[0];

    const {
        direction = 1,
        startMeter = 0,
        skalieren = false,
        gleiswechsel = "0",
        ausfall = false,
        verkehrtAb = "0",
        ankunft = false,
        infoscreen = false,
    } = primary;

    // FormationGroups aus allen Journeys zusammenführen (für Flügelzüge)
    const allFormationGroups = journeys.flatMap(j => j.formation ? j.formation.groups : []);

    // Trennlinie am linken Rand (nur Nebenmonitore)
    if (!fullScreen) {
        ctx.strokeStyle = COLORS.WHITE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, 280);
        ctx.stroke();
    }

    // --- Sonder-Overlays, die die Wagenreihung ersetzen ---

    if (gleiswechsel !== "0") {
        ctx.fillStyle = COLORS.ORANGE;
        ctx.fillRect(3, 0, 960, 280);
        ctx.fillStyle = COLORS.WHITE;
        drawText(ctx, 'Neues Gleis', 50, 50, FONTS.regular(67), COLORS.WHITE, 'left');
        drawText(ctx, 'New Track', 50, 125, FONTS.italic(67), COLORS.WHITE, 'left');
        drawText(ctx, gleiswechsel, 920, 80, FONTS.regular(128), COLORS.WHITE, 'right');
        return null;
    } else if (infoscreen || ausfall || (verkehrtAb !== "0")) {
        ctx.fillStyle = COLORS.WHITE;
        ctx.fillRect(3, 0, 960, 280);
        return null;
    } else if (ankunft) {
        if (fullScreen) {
            ctx.textBaseline = 'top';
            const firstGroup = allFormationGroups[0] || {};
            drawText(ctx, 'von / from ' + (firstGroup.destination || ''), 105, 20, FONTS.regular(67), COLORS.WHITE, 'left');
        }
        return null;
    }

    // --- Normale Wagenreihung ---

    if (allFormationGroups.length === 0 || allFormationGroups.every(g => g.coaches.length === 0)) return null;

    const threshold = customStartX;
    const coachGap = fullScreen ? FORMATION.COACH_GAP_FULL : FORMATION.COACH_GAP_COMPACT;
    const groupGap = FORMATION.GROUP_GAP;
    const usableDisplayLength = customUsableWidth;
    const platformLengthMeters = platform.length;
    const arrowBuffer = FORMATION.ARROW_BUFFER;
    const meterAreaPixels = usableDisplayLength - 2 * arrowBuffer;
    let pixelPerMeter = meterAreaPixels / platformLengthMeters;
    const meterOrigin = threshold + arrowBuffer; // Pixel-Position von Meter 0

    // Alle Wagen aller Zugteile in eine flache Liste bringen
    const allCoaches = [];
    allFormationGroups.forEach(group => {
        group.coaches.forEach((coach, index) => {
            allCoaches.push({
                coach, group,
                isFirstInGroup: index === 0,
                isLastInGroup: index === group.coaches.length - 1
            });
        });
    });

    if (allCoaches.length === 0) return null;

    // Start- und End-Meter für jeden Wagen sicherstellen (als absolute Koordinaten)
    let currentMeter = startMeter;
    allCoaches.forEach(item => {
        if (item.coach.platformPosition && typeof item.coach.platformPosition.start === 'number') {
            item.startM = item.coach.platformPosition.start;
            item.endM = item.coach.platformPosition.end;
            currentMeter = item.endM; // Synchronisieren für evtl. folgende Wagen ohne Daten
        } else {
            item.startM = currentMeter;
            item.endM = currentMeter + item.coach.length;
            currentMeter = item.endM;
        }
    });

    // Optional: Skalierung verdoppeln wenn der Zug sehr kurz ist
    let totalLengthMeters = allCoaches[allCoaches.length - 1].endM - allCoaches[0].startM;
    if (skalieren && (totalLengthMeters * pixelPerMeter) < (usableDisplayLength / 2)) {
        pixelPerMeter *= 2;
    }

    // Position und Pixellänge jedes Wagens berechnen
    const drawableCoaches = [];

    for (let i = 0; i < allCoaches.length; i++) {
        const currentItem = allCoaches[i];
        const { coach, group, startM, endM } = currentItem;

        // Rohe, absolute Pixelkoordinaten aus den Metern (gerundet auf Pixel-Grid)
        let rawStartX = Math.round(meterOrigin + (startM * pixelPerMeter));
        let rawEndX = Math.round(meterOrigin + (endM * pixelPerMeter));

        // Gap-Berechnung (Kürzung am Rand)
        let leftGap = 0;
        let rightGap = 0;

        if (i > 0) {
            const prevItem = allCoaches[i - 1];
            if (prevItem.group !== group) {
                if (prevItem.group.destination !== group.destination || prevItem.group.trainNumber !== group.trainNumber) {
                    leftGap = groupGap;
                } else {
                    leftGap = groupGap / 3;
                }
            } else {
                leftGap = coachGap;
            }
        }

        if (i < allCoaches.length - 1) {
            const nextItem = allCoaches[i + 1];
            if (group !== nextItem.group) {
                if (group.destination !== nextItem.group.destination || group.trainNumber !== nextItem.group.trainNumber) {
                    rightGap = groupGap;
                } else {
                    rightGap = groupGap / 3;
                }
            } else {
                rightGap = coachGap;
            }
        }

        // Wagen an den Rändern einkürzen, um Platz für den Gap zu machen (auf ganze Pixel gerundet)
        const adjustedStartX = rawStartX + Math.round(leftGap / 2);
        const adjustedEndX = rawEndX - Math.round(rightGap / 2);
        const coachPixelLength = Math.max(adjustedEndX - adjustedStartX, 1);

        drawableCoaches.push({
            ...currentItem,
            coachData: coach,
            x: adjustedStartX,
            pixelLength: coachPixelLength,
            destination: group.destination,
            trainNumber: group.trainNumber
        });

        // Kupplung zeichnen, wenn hier ein Group-Wechsel stattfindet
        if (i < allCoaches.length - 1) {
            const nextItem = allCoaches[i + 1];
            if (group !== nextItem.group) {
                if (group.destination !== nextItem.group.destination || group.trainNumber !== nextItem.group.trainNumber) {
                    // Kupplung exakt auf die Berührungsgrenze zeichnen
                    drawCoupling(ctx, rawEndX, y);
                }
            }
        }
    }

    const trainPixelStart = meterOrigin + (allCoaches[0].startM * pixelPerMeter);
    const trainPixelEnd = meterOrigin + (allCoaches[allCoaches.length - 1].endM * pixelPerMeter);

    // Bahnsteig-Linie (links und rechts vom Zug)
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(threshold, FORMATION.PLATFORM_LINE_Y);
    ctx.lineTo(trainPixelStart - 10, FORMATION.PLATFORM_LINE_Y);
    ctx.moveTo(trainPixelEnd + 10, FORMATION.PLATFORM_LINE_Y);
    ctx.lineTo(threshold + usableDisplayLength, FORMATION.PLATFORM_LINE_Y);
    ctx.stroke();

    // Richtungspfeil
    if (direction === 0) {
        drawDirectionArrow(ctx, direction, trainPixelStart - 40, y);
    } else {
        drawDirectionArrow(ctx, direction, trainPixelEnd + 10, y);
    }

    // Jeden Wagen zeichnen
    for (let i = 0; i < drawableCoaches.length; i++) {
        const item = drawableCoaches[i];
        const { coachData, x, pixelLength, isFirstInGroup, isLastInGroup, destination, trainNumber } = item;
        const drawableCoach = new Coach({ ...coachData, length: pixelLength });

        // Wagen-Shape zeichnen
        if (coachData.type === 'locomotive' && fullScreen) {
            drawLocomotive(ctx, drawableCoach, x, y);
        } else if (coachData.type === 'control_car' && isFirstInGroup) {
            drawStartWagon(ctx, drawableCoach, x, y);
        } else if (coachData.type === 'control_car' && isLastInGroup) {
            drawEndWagon(ctx, drawableCoach, x, y);
        }

        let isStart = isFirstInGroup;
        let isEnd = isLastInGroup;

        const previousCoach = i > 0 ? drawableCoaches[i - 1].coachData : null;
        const nextCoach = i < drawableCoaches.length - 1 ? drawableCoaches[i + 1].coachData : null;

        if (coachData.type === 'middle_car') {
            if (isLastInGroup && nextCoach && nextCoach.type === 'middle_car') {
                isEnd = false;
            }
            if (isFirstInGroup && previousCoach && previousCoach.type === 'middle_car') {
                isStart = false;
            }
            drawMiddleWagon(ctx, drawableCoach, isStart, isEnd, x, y);
        }

        // Ziel-Label anzeigen bei mehreren Zugteilen
        if (isFirstInGroup && allFormationGroups.length > 1 && !hideDestinations) {
            if ((!previousCoach || (previousCoach.destination !== destination)) && (!previousCoach || (previousCoach.trainNumber !== trainNumber))) {
                ctx.fillStyle = COLORS.WHITE;
                ctx.font = FONTS.regular(58);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(destination, x, y + 155);
            }
        }

        // Wagen-Inhalt zeichnen (X für geschlossen, sonst Features)
        if (!coachData.open) {
            ctx.font = FONTS.bold(48);
            const textWidth = ctx.measureText("X").width;
            const safeX = getSafeCenter(x + (drawableCoach.length / 2), textWidth, x, x + drawableCoach.length);
            
            if (safeX !== null) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = COLORS.WHITE;
                ctx.fillText("X", safeX, y + 44);
            }
        } else {
            drawFirstClassBar(ctx, drawableCoach, x, y, fullScreen);
        }
    }

    // Layout-basierte Features für Vollbild und Kompakt
    ctx.save();
    ctx.globalAlpha = featureAlpha;
    const scaledCoaches = drawableCoaches.map(dc => ({
        ...dc.coachData,
        start: dc.x,
        length: dc.pixelLength,
        coach_type: mapCoachType(dc)
    }));
    
    if (fullScreen) {
        if (activeFeature === "klasse") drawFullscreenClassLabels(ctx, scaledCoaches, y);
        if (activeFeature === "ausstattung") drawFullscreenAmenityIcons(ctx, scaledCoaches, y);
        if (activeFeature === "wagennummern") drawFullscreenWagonNumbers(ctx, scaledCoaches, y);
    } else {
        if (activeFeature === "klasse") drawCompactClassLabels(ctx, scaledCoaches, y);
        if (activeFeature === "ausstattung") drawCompactAmenityIcons(ctx, scaledCoaches, y);
        if (activeFeature === "wagennummern") drawCompactWagonNumbers(ctx, scaledCoaches, y);
    }
    ctx.restore();

    // Sektoren zeichnen (A, B, C, ...)
    if (!hideSectors) {
        drawSectors(ctx, platform.sections, pixelPerMeter, meterOrigin);
    }

    // Debug: Meter-Markierungen am virtuellen Bahnsteig
    if (DEBUG_METERS) {
        const debugBaseY = FORMATION.PLATFORM_LINE_Y;
        const displayStart = threshold;                              // Gesamter Display-Bereich
        const displayEnd = threshold + usableDisplayLength;
        const platformPixelStart = meterOrigin;                      // Meter 0
        const platformPixelEnd = meterOrigin + meterAreaPixels;      // Meter max

        // Durchgehende Debug-Linie (gesamter Display-Bereich)
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(displayStart, debugBaseY + 18);
        ctx.lineTo(displayEnd, debugBaseY + 18);
        ctx.stroke();

        // Meter-Bereich hervorheben
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.beginPath();
        ctx.moveTo(platformPixelStart, debugBaseY + 18);
        ctx.lineTo(platformPixelEnd, debugBaseY + 18);
        ctx.stroke();

        // Arrow-Buffer-Zonen markieren (links und rechts)
        ctx.fillStyle = 'rgba(255, 80, 80, 0.1)';
        ctx.fillRect(displayStart, debugBaseY + 10, arrowBuffer, 20);
        ctx.fillRect(platformPixelEnd, debugBaseY + 10, arrowBuffer, 20);

        // Grenzen: Display-Rand und Meter-Grenzen
        [displayStart, displayEnd].forEach(px => {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px, debugBaseY + 8);
            ctx.lineTo(px, debugBaseY + 30);
            ctx.stroke();
        });
        [platformPixelStart, platformPixelEnd].forEach(px => {
            ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, debugBaseY + 8);
            ctx.lineTo(px, debugBaseY + 30);
            ctx.stroke();
        });

        // Meter-Ticks alle 50m
        ctx.font = FONTS.regular(18);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const step = 50;
        for (let m = 0; m <= platformLengthMeters; m += step) {
            const px = meterOrigin + (m * pixelPerMeter);
            const isBoundary = (m === 0 || m >= platformLengthMeters);

            ctx.strokeStyle = isBoundary
                ? 'rgba(255, 80, 80, 0.7)'
                : 'rgba(255, 255, 0, 0.5)';
            ctx.lineWidth = isBoundary ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(px, debugBaseY + 12);
            ctx.lineTo(px, debugBaseY + 26);
            ctx.stroke();

            ctx.fillStyle = isBoundary
                ? 'rgba(255, 80, 80, 0.8)'
                : 'rgba(255, 255, 0, 0.7)';
            ctx.fillText(`${m}m`, px, debugBaseY + 28);
        }

        // Arrow-Buffer Labels
        ctx.font = FONTS.regular(13);
        ctx.fillStyle = 'rgba(255, 80, 80, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('↔ Pfeil', displayStart + arrowBuffer / 2, debugBaseY + 44);
        ctx.fillText('Pfeil ↔', platformPixelEnd + arrowBuffer / 2, debugBaseY + 44);

        // Freie Meter-Bereiche beschriften (vor/nach Zug)
        ctx.font = FONTS.regular(14);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';

        const freeLeft = trainPixelStart - platformPixelStart;
        if (freeLeft > 80) {
            ctx.textAlign = 'center';
            const freeMLeft = Math.round(freeLeft / pixelPerMeter);
            ctx.fillText(`← ${freeMLeft}m frei`, (platformPixelStart + trainPixelStart) / 2, debugBaseY + 56);
        }

        const freeRight = platformPixelEnd - trainPixelEnd;
        if (freeRight > 80) {
            ctx.textAlign = 'center';
            const freeMRight = Math.round(freeRight / pixelPerMeter);
            ctx.fillText(`${freeMRight}m frei →`, (trainPixelEnd + platformPixelEnd) / 2, debugBaseY + 56);
        }
    }
    
    return {
        trainPixelStart,
        trainPixelEnd
    };
}
