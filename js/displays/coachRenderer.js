// js/displays/coachRenderer.js
import { COLORS, FONTS, FORMATION, COUPLING } from './constants.js';
import { images } from '../utils/utils.js';

/**
 * Berechnet die sichere x-Koordinate für ein Feature.
 * Gibt null zurück, wenn das Feature zu breit ist.
 */
export function getSafeCenter(desiredCenter, featureWidth, startPos, endPos, padding = 4) {
    const safeStart = startPos + padding;
    const safeEnd = endPos - padding;
    if (featureWidth > (safeEnd - safeStart)) return null;
    
    let center = desiredCenter;
    const halfWidth = featureWidth / 2;
    if (center - halfWidth < safeStart) center = safeStart + halfWidth;
    if (center + halfWidth > safeEnd) center = safeEnd - halfWidth;
    return center;
}

// ==========================================
// Wagen-Shapes
// ==========================================

/**
 * Zeichnet den Richtungspfeil (Fahrtrichtung).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} direction - 0 = Links, 1 = Rechts.
 * @param {number} x - X-Position.
 * @param {number} y - Y-Position (COACH_Y_OFFSET).
 */
export function drawDirectionArrow(ctx, direction, x, y) {
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (direction === 0) { // Links
        ctx.moveTo(x - 2, y + 52); ctx.lineTo(x + 18, y + 32);
        ctx.moveTo(x, y + 50); ctx.lineTo(x + 30, y + 50);
        ctx.moveTo(x - 2, y + 48); ctx.lineTo(x + 18, y + 68);
    } else { // Rechts
        ctx.moveTo(x + 30 + 2, y + 52); ctx.lineTo(x + 12, y + 32);
        ctx.moveTo(x + 30, y + 50); ctx.lineTo(x, y + 50);
        ctx.moveTo(x + 30 + 2, y + 48); ctx.lineTo(x + 12, y + 68);
    }
    ctx.stroke();
}

/**
 * Zeichnet einen Steuerwagen als ersten Wagen (Nase links).
 */
export function drawStartWagon(ctx, coach, x, y) {
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 83); ctx.lineTo(x + 3, y + 20);     // Linke Vertikale
    ctx.moveTo(x + 2, y + 21); ctx.lineTo(x + 22, y - 1);      // Linke Diagonale
    ctx.moveTo(x + 20, y); ctx.lineTo(x + coach.length, y);     // Obere Linie
    ctx.moveTo(x, y + 80); ctx.lineTo(x + coach.length, y + 80); // Untere Linie
    ctx.stroke();
}

/**
 * Zeichnet einen Mittelwagen.
 * @param {boolean} isStart - Linke Abschlusslinie zeichnen?
 * @param {boolean} isEnd - Rechte Abschlusslinie zeichnen?
 */
export function drawMiddleWagon(ctx, coach, isStart, isEnd, x, y) {
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + coach.length, y);
    ctx.moveTo(x, y + 80); ctx.lineTo(x + coach.length, y + 80);
    if (isStart) {
        ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 83);
    }
    if (isEnd) {
        ctx.moveTo(x + coach.length, y - 3); ctx.lineTo(x + coach.length, y + 83);
    }
    ctx.stroke();
}

/**
 * Zeichnet einen Steuerwagen als letzten Wagen (Nase rechts).
 */
export function drawEndWagon(ctx, coach, x, y) {
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + coach.length - 20, y);                    // Obere Linie
    ctx.moveTo(x + coach.length - 22, y - 1); ctx.lineTo(x + coach.length - 2, y + 22); // Rechte Diagonale
    ctx.moveTo(x + coach.length - 3, y + 20); ctx.lineTo(x + coach.length - 3, y + 83); // Rechte Vertikale
    ctx.moveTo(x, y + 80); ctx.lineTo(x + coach.length, y + 80);               // Untere Linie
    ctx.stroke();
}

/**
 * Zeichnet eine Lokomotive (abgerundete Oberseite).
 */
export function drawLocomotive(ctx, coach, x, y) {
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 83);
    ctx.lineTo(x + 3, y + 40);
    ctx.arcTo(x + 3, y + 10, x + 30, y + 10, 20);
    ctx.lineTo(x + coach.length - 30, y + 10);
    ctx.arcTo(x + coach.length, y + 10, x + coach.length - 4, y + 40, 20);
    ctx.lineTo(x + coach.length - 4, y + 83);
    ctx.moveTo(x, y + 80);
    ctx.lineTo(x + coach.length, y + 80);
    ctx.stroke();
}

/**
 * Zeichnet die Kupplung (6 vertikale Punkte) zwischen zwei Zugteilen.
 */
export function drawCoupling(ctx, x, y) {
    ctx.fillStyle = COLORS.WHITE;
    const startY = y + COUPLING.START_Y_OFFSET;
    const endY = y + COUPLING.END_Y_OFFSET;
    const step = (endY - startY) / (COUPLING.NUM_DOTS - 1);

    for (let i = 0; i < COUPLING.NUM_DOTS; i++) {
        const dotY = startY + i * step;
        ctx.beginPath();
        ctx.arc(x, dotY, COUPLING.DOT_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// ==========================================
// Wagen-Features (Klasse, Nummern, Ausstattung)
// ==========================================

/**
 * Zeichnet den orangefarbenen 1.-Klasse-Balken unter dem Wagen.
 */
export function drawFirstClassBar(ctx, coach, x, y, fullScreen) {
    if (coach.isFirstClass()) {
        ctx.fillStyle = COLORS.ORANGE;
        let len = coach.length;
        if (!fullScreen) {
            // Anpassung für bestimmte Wagentypen (legacy)
            if (coach.coach_type === 'm') len += 4;
        }
        ctx.fillRect(x, y + 92, len, FORMATION.FIRST_CLASS_BAR_HEIGHT);
    }
}

// ==========================================
// Layout-Algorithmus für Features
// ==========================================

function getTrainParts(coaches) {
    const parts = [];
    let currentPart = [];
    for (const coach of coaches) {
        if (currentPart.length === 0) {
            currentPart.push(coach);
        } else {
            const prev = currentPart[currentPart.length - 1];
            // Wenn der physische Abstand > 12px ist, handelt es sich um eine Kupplung / neuen Zugteil
            const gap = coach.start - (prev.start + prev.length);
            if (gap <= 12) {
                currentPart.push(coach);
            } else {
                parts.push(currentPart);
                currentPart = [coach];
            }
        }
    }
    if (currentPart.length > 0) parts.push(currentPart);
    return parts;
}

function drawLayoutItems(ctx, items, safeStart, safeEnd, maxShift) {
    if (items.length === 0) return;
    const padding = 8; // Mindestabstand zwischen zwei Icons
    const limitL = safeStart + 12;
    const limitR = safeEnd - 12;
    
    // Sort items by desired x
    items.sort((a, b) => a.x - b.x);
    
    for (const item of items) {
        item.originalX = item.x;
        item.x = Math.max(limitL + item.width / 2, Math.min(item.x, limitR - item.width / 2));
    }
    
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 20) {
        changed = false;
        // Überlappungen auflösen
        for (let i = 0; i < items.length - 1; i++) {
            const curr = items[i];
            const next = items[i + 1];
            const reqDist = (curr.width / 2) + (next.width / 2) + padding;
            const dist = next.x - curr.x;
            if (dist < reqDist) {
                const overlap = reqDist - dist;
                curr.x -= overlap / 2;
                next.x += overlap / 2;
                changed = true;
            }
        }
        
        // Grenzen und maxShift anwenden
        for (const item of items) {
            if (item.x < item.originalX - maxShift) item.x = item.originalX - maxShift;
            if (item.x > item.originalX + maxShift) item.x = item.originalX + maxShift;
            if (item.x - item.width / 2 < limitL) item.x = limitL + item.width / 2;
            if (item.x + item.width / 2 > limitR) item.x = limitR - item.width / 2;
        }
        iterations++;
    }
    
    // Items zeichnen, falls sie sich nach der Layout-Auflösung nicht mehr überlappen
    const drawnItems = [];
    for (const curr of items) {
        let overlaps = false;
        for (const prev of drawnItems) {
            const reqDist = (prev.width / 2) + (curr.width / 2) + padding;
            // Epsilon (0.1) verwenden, um Float-Ungenauigkeiten zu vermeiden
            if (Math.abs(curr.x - prev.x) < reqDist - 0.1) {
                overlaps = true;
                break;
            }
        }
        if (!overlaps && curr.x - curr.width / 2 >= limitL - 0.1 && curr.x + curr.width / 2 <= limitR + 0.1) {
            drawnItems.push(curr);
            curr.drawFn(curr.x);
        }
    }
}

// ==========================================
// Fullscreen Features (Individuelle Wagen)
// ==========================================

export function drawFullscreenClassLabels(ctx, scaledCoaches, y) {
    const parts = getTrainParts(scaledCoaches);
    for (const part of parts) {
        const items = [];
        for (const coach of part) {
            if (!coach.open) continue;
            let text = null;
            let color = null;
            if (coach.coachClass === 1) {
                text = "1."; color = COLORS.ORANGE;
            } else if (coach.coachClass === 2 && coach.type !== 'locomotive') {
                text = "2."; color = COLORS.WHITE;
            }
            if (text) {
                ctx.font = FONTS.bold(40);
                items.push({
                    x: coach.start + coach.length / 2,
                    width: ctx.measureText(text).width,
                    drawFn: (finalX) => {
                        ctx.font = FONTS.bold(40);
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = color;
                        ctx.fillText(text, finalX, y + 44);
                    }
                });
            }
        }
        const safeStart = part[0].start;
        const safeEnd = part[part.length - 1].start + part[part.length - 1].length;
        drawLayoutItems(ctx, items, safeStart, safeEnd, 40);
    }
}

export function drawFullscreenAmenityIcons(ctx, scaledCoaches, y) {
    const parts = getTrainParts(scaledCoaches);
    for (const part of parts) {
        const items = [];
        for (const coach of part) {
            if (!coach.open) continue;
            let imgKey, scale;
            if (coach.amenities.includes('f')) { imgKey = 'wagenreihung_fahrrad'; scale = 0.28; }
            else if (coach.amenities.includes('r')) { imgKey = 'wagenreihung_rollstuhl'; scale = 0.24; }
            else if (coach.amenities.includes('m')) { imgKey = 'wagenreihung_mehrzweck'; scale = 0.28; }
            else if (coach.amenities.includes('g')) { imgKey = 'wagenreihung_gastronomie'; scale = 0.32; }
            
            const img = imgKey ? images[imgKey] : null;
            if (img && img.isLoaded && !img.isBroken) {
                items.push({
                    x: coach.start + coach.length / 2,
                    width: img.width * scale,
                    drawFn: (finalX) => {
                        try {
                            ctx.drawImage(img, finalX - (img.width * scale / 2), y + 42 - (img.height * scale / 2), img.width * scale, img.height * scale);
                        } catch (err) {}
                    }
                });
            }
        }
        const safeStart = part[0].start;
        const safeEnd = part[part.length - 1].start + part[part.length - 1].length;
        drawLayoutItems(ctx, items, safeStart, safeEnd, 40);
    }
}

export function drawFullscreenWagonNumbers(ctx, scaledCoaches, y) {
    const parts = getTrainParts(scaledCoaches);
    for (const part of parts) {
        const items = [];
        for (const coach of part) {
            if (!coach.open) continue;
            if (coach.coachNumber && coach.coachNumber !== 0 && coach.coachNumber !== '0') {
                const text = coach.coachNumber.toString();
                ctx.font = FONTS.regular(40);
                items.push({
                    x: coach.start + coach.length / 2,
                    width: ctx.measureText(text).width,
                    drawFn: (finalX) => {
                        ctx.fillStyle = COLORS.WHITE;
                        ctx.font = FONTS.regular(40);
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(text, finalX, y + 44);
                    }
                });
            }
        }
        const safeStart = part[0].start;
        const safeEnd = part[part.length - 1].start + part[part.length - 1].length;
        drawLayoutItems(ctx, items, safeStart, safeEnd, 40);
    }
}

// ==========================================
// Kompakte Features (Zusammengefasst)
// ==========================================

export function drawCompactClassLabels(ctx, scaledCoaches, y) {
    if (!scaledCoaches || scaledCoaches.length === 0) return;
    const parts = getTrainParts(scaledCoaches);
    
    for (const part of parts) {
        const items = [];
        let currentGroup = [];
        
        const processGroup = (group) => {
            if (group.length === 0) return;
            if (group[0].coachClass !== 1) return; // Nur 1. Klasse
            
            const firstCoach = group[0];
            const lastCoach = group[group.length - 1];
            const center = (firstCoach.start + lastCoach.start + lastCoach.length) / 2;
            
            ctx.font = FONTS.bold(40);
            items.push({
                x: center,
                width: ctx.measureText("1.").width,
                drawFn: (finalX) => {
                    ctx.font = FONTS.bold(40);
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = COLORS.ORANGE;
                    ctx.fillText("1.", finalX, y + 44);
                }
            });
        };

        for (const coach of part) {
            if (coach.open === false) {
                processGroup(currentGroup);
                currentGroup = [];
            } else if (currentGroup.length > 0 && coach.coachClass === currentGroup[0].coachClass) {
                currentGroup.push(coach);
            } else {
                processGroup(currentGroup);
                currentGroup = [coach];
            }
        }
        processGroup(currentGroup);
        
        const safeStart = part[0].start;
        const safeEnd = part[part.length - 1].start + part[part.length - 1].length;
        drawLayoutItems(ctx, items, safeStart, safeEnd, 100);
    }
}

export function drawCompactAmenityIcons(ctx, scaledCoaches, y) {
    if (!scaledCoaches || scaledCoaches.length === 0) return;
    
    const arraysAreEqual = (a, b) => {
        if (a.length !== b.length) return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, index) => val === sortedB[index]);
    };

    const parts = getTrainParts(scaledCoaches);
    for (const part of parts) {
        const items = [];
        let currentGroup = [];
        
        const processGroup = (group) => {
            if (group.length === 0 || group[0].amenities.length === 0) return;
            const firstCoach = group[0];
            const lastCoach = group[group.length - 1];
            const center = (firstCoach.start + lastCoach.start + lastCoach.length) / 2;
            const amenities = firstCoach.amenities;
            
            let imgKey, scale;
            if (amenities.includes('f')) { imgKey = 'wagenreihung_fahrrad'; scale = 0.28; }
            else if (amenities.includes('r')) { imgKey = 'wagenreihung_rollstuhl'; scale = 0.24; }
            else if (amenities.includes('m')) { imgKey = 'wagenreihung_mehrzweck'; scale = 0.28; }
            else if (amenities.includes('g')) { imgKey = 'wagenreihung_gastronomie'; scale = 0.32; }
            
            const img = imgKey ? images[imgKey] : null;
            if (img && img.isLoaded && !img.isBroken) {
                items.push({
                    x: center,
                    width: img.width * scale,
                    drawFn: (finalX) => {
                        try {
                            ctx.drawImage(img, finalX - (img.width * scale / 2), y + 42 - (img.height * scale / 2), img.width * scale, img.height * scale);
                        } catch (err) {}
                    }
                });
            }
        };

        for (const coach of part) {
            if (coach.open === false) {
                processGroup(currentGroup);
                currentGroup = [];
            } else if (currentGroup.length > 0 && arraysAreEqual(coach.amenities, currentGroup[0].amenities)) {
                currentGroup.push(coach);
            } else {
                processGroup(currentGroup);
                currentGroup = [coach];
            }
        }
        processGroup(currentGroup);
        
        const safeStart = part[0].start;
        const safeEnd = part[part.length - 1].start + part[part.length - 1].length;
        drawLayoutItems(ctx, items, safeStart, safeEnd, 100);
    }
}

export function drawCompactWagonNumbers(ctx, scaledCoaches, y) {
    if (!scaledCoaches || scaledCoaches.length === 0) return;
    const parts = getTrainParts(scaledCoaches);
    
    for (const part of parts) {
        const items = [];
        let currentGroup = [];
        
        const processGroup = (group) => {
            if (group.length === 0) return;
            const firstCoach = group[0];
            const lastCoach = group[group.length - 1];
            const center = (firstCoach.start + lastCoach.start + lastCoach.length) / 2;
            
            const firstNumber = firstCoach.coachNumber;
            const lastNumber = lastCoach.coachNumber;
            const numberText = firstNumber === lastNumber ? firstNumber.toString() : `${firstNumber} - ${lastNumber}`;
            
            ctx.font = FONTS.regular(40);
            items.push({
                x: center,
                width: ctx.measureText(numberText).width,
                drawFn: (finalX) => {
                    ctx.fillStyle = COLORS.WHITE;
                    ctx.font = FONTS.regular(40);
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(numberText, finalX, y + 44);
                }
            });
        };

        for (const coach of part) {
            if (coach.open !== false && coach.coachNumber && coach.coachNumber !== '0' && coach.coachNumber !== '') {
                currentGroup.push(coach);
            } else {
                processGroup(currentGroup);
                currentGroup = [];
            }
        }
        processGroup(currentGroup);
        
        const safeStart = part[0].start;
        const safeEnd = part[part.length - 1].start + part[part.length - 1].length;
        drawLayoutItems(ctx, items, safeStart, safeEnd, 100);
    }
}

// ==========================================
// Hilfsfunktionen
// ==========================================

export function mapCoachType({ coachData, isFirstInGroup, isLastInGroup }) {
    if (coachData.type === 'locomotive') return 'l';
    if (coachData.type === 'control_car') {
        if (isFirstInGroup && isLastInGroup) return 'a';
        if (isFirstInGroup) return 'a';
        if (isLastInGroup) return 'e';
    }
    if (coachData.type === 'middle_car') {
        if (isFirstInGroup && isLastInGroup) return 'ma';
        if (isFirstInGroup) return 'ma';
        if (isLastInGroup) return 'me';
        if (!isFirstInGroup && !isLastInGroup) return 'm';
    }
}
