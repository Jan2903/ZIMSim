// js/displays/formationRenderer.js
import { Coach } from '../models/coach.js';
import { COLORS, FONTS, FORMATION } from './constants.js';
import { drawText } from './textUtils.js';
import {
    drawLocomotive, drawStartWagon, drawEndWagon, drawMiddleWagon,
    drawCoupling, drawDirectionArrow, drawFirstClassBar,
    drawClassLabel, drawCompactClassLabels,
    drawAmenityIcon, drawCompactAmenityIcons,
    drawWagonNumber, drawCompactWagonNumbers,
    mapCoachType
} from './coachRenderer.js';

/**
 * Zeichnet die Bahnsteig-Sektoren (A, B, C, ...) über der Wagenreihung.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<[string, number]>} sectors - Array von [Name, StartMeter]-Paaren.
 * @param {number} scaleFactor - Pixel pro Meter.
 */
export function drawSectors(ctx, sectors, scaleFactor) {
    ctx.fillStyle = COLORS.WHITE;
    ctx.font = FONTS.regular(45);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    sectors.forEach(([name, position]) => {
        const displayPos = FORMATION.THRESHOLD + 50 + (position * scaleFactor);
        ctx.fillText(name, displayPos, 2);
    });
}

/**
 * Zeichnet die gesamte Wagenreihung für eine Abfahrt inkl. Wagen-Shapes,
 * Sektoren, Richtungspfeile und Features (Nummern/Klasse/Ausstattung).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../models/departure.js').Departure} departure - Die Abfahrtsdaten.
 * @param {import('../models/trainData.js').TrainData} trainData - Gesamte Zugdaten (für Bahnsteig).
 * @param {object} options
 * @param {boolean} options.fullScreen - Hauptmonitor (true) oder Nebenmonitor (false).
 * @param {string} options.activeFeature - 'wagennummern', 'ausstattung' oder 'klasse'.
 */
export function drawFormation(ctx, departure, trainData, options = {}) {
    const {
        fullScreen = false,
        activeFeature = 'wagennummern',
    } = options;

    const y = FORMATION.COACH_Y_OFFSET;

    const {
        direction = 1,
        startMeter = 0,
        groups = [],
        skalieren = false,
        gleiswechsel = "0",
        ausfall = false,
        verkehrtAb = "0",
        ankunft = false,
        infoscreen = false,
    } = departure;

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
        return;
    } else if (infoscreen || ausfall || (verkehrtAb !== "0")) {
        ctx.fillStyle = COLORS.WHITE;
        ctx.fillRect(3, 0, 960, 280);
        return;
    } else if (ankunft) {
        if (fullScreen) {
            ctx.textBaseline = 'top';
            const firstGroup = groups[0] || {};
            drawText(ctx, 'von / from ' + (firstGroup.destination || ''), 105, 20, FONTS.regular(67), COLORS.WHITE, 'left');
        }
        return;
    }

    // --- Normale Wagenreihung ---

    if (groups.length === 0 || groups.every(g => g.coaches.length === 0)) return;

    const threshold = FORMATION.THRESHOLD;
    const coachGap = fullScreen ? FORMATION.COACH_GAP_FULL : FORMATION.COACH_GAP_COMPACT;
    const groupGap = FORMATION.GROUP_GAP;
    const usableDisplayLength = fullScreen ? FORMATION.USABLE_WIDTH_FULL : FORMATION.USABLE_WIDTH_COMPACT;
    const platformLengthMeters = trainData.platform.length;
    let pixelPerMeter = usableDisplayLength / platformLengthMeters;

    // Alle Wagen aller Zugteile in eine flache Liste bringen
    const allCoaches = [];
    groups.forEach(group => {
        group.coaches.forEach((coach, index) => {
            allCoaches.push({
                coach, group,
                isFirstInGroup: index === 0,
                isLastInGroup: index === group.coaches.length - 1
            });
        });
    });

    if (allCoaches.length === 0) return;

    // Optional: Skalierung verdoppeln wenn der Zug sehr kurz ist
    let totalLengthMeters = allCoaches.reduce((sum, c) => sum + c.coach.length, 0);
    if (skalieren && (totalLengthMeters * pixelPerMeter) < (usableDisplayLength / 2)) {
        pixelPerMeter *= 2;
    }

    // Position und Pixellänge jedes Wagens berechnen
    const drawableCoaches = [];
    let currentX = threshold + (startMeter * pixelPerMeter);

    for (let i = 0; i < allCoaches.length; i++) {
        const currentItem = allCoaches[i];
        const { coach, group } = currentItem;
        const coachPixelLength = coach.length * pixelPerMeter;

        drawableCoaches.push({
            ...currentItem,
            coachData: coach,
            x: currentX,
            pixelLength: coachPixelLength,
            destination: group.destination,
            trainNumber: group.trainNumber
        });

        currentX += coachPixelLength;

        // Abstand zum nächsten Wagen berechnen
        if (i < allCoaches.length - 1) {
            const nextItem = allCoaches[i + 1];
            const nextGroup = nextItem.group;

            if (group !== nextGroup) {
                // Zugteil-Grenze: Kupplung zeichnen wenn verschiedene Ziele/Nummern
                if (group.destination !== nextGroup.destination || group.trainNumber !== nextGroup.trainNumber) {
                    const couplingX = currentX + groupGap / 2;
                    drawCoupling(ctx, couplingX, y);
                    currentX += groupGap;
                } else {
                    currentX += groupGap / 3;
                }
            } else {
                currentX += coachGap;
            }
        }
    }

    const trainPixelStart = drawableCoaches.length > 0 ? drawableCoaches[0].x : 0;
    const trainPixelEnd = currentX;

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
        if (isFirstInGroup && groups.length > 1) {
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
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = COLORS.WHITE;
            ctx.fillText("X", x + (drawableCoach.length / 2), y + 44);
        } else {
            drawFirstClassBar(ctx, drawableCoach, x, y, fullScreen);
            if (fullScreen) {
                if (activeFeature === "klasse") drawClassLabel(ctx, drawableCoach, x, y);
                if (activeFeature === "ausstattung") drawAmenityIcon(ctx, drawableCoach, x, y);
                if (activeFeature === "wagennummern") drawWagonNumber(ctx, drawableCoach, x, y);
            }
        }
    }

    // Kompakte Features für Nebenmonitore
    if (!fullScreen) {
        const scaledCoaches = drawableCoaches.map(dc => ({
            ...dc.coachData,
            start: dc.x,
            length: dc.pixelLength,
            coach_type: mapCoachType(dc)
        }));
        if (activeFeature === "klasse") drawCompactClassLabels(ctx, scaledCoaches, y);
        if (activeFeature === "ausstattung") drawCompactAmenityIcons(ctx, scaledCoaches, y);
        if (activeFeature === "wagennummern") drawCompactWagonNumbers(ctx, scaledCoaches, y);
    }

    // Sektoren zeichnen (A, B, C, ...)
    const platformSectors = trainData.platform.sections.map(s => [s.name, s.startMeter]);
    drawSectors(ctx, platformSectors, pixelPerMeter);
}
