// js/displays/coachRenderer.js
import { COLORS, FONTS, FORMATION, COUPLING } from './constants.js';
import { images } from '../utils/utils.js';

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

/**
 * Zeichnet die Klassen-Bezeichnung ("1." / "2.") in den Wagen (Vollbild).
 */
export function drawClassLabel(ctx, coach, x, y) {
    ctx.font = FONTS.bold(40);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (coach.isFirstClass()) {
        ctx.fillStyle = COLORS.ORANGE;
        ctx.fillText("1.", x + (coach.length / 2), y + 44);
    } else if (coach.coachClass === 2 && !coach.isLocomotive()) {
        ctx.fillStyle = COLORS.WHITE;
        ctx.fillText("2.", x + (coach.length / 2), y + 44);
    }
}

/**
 * Zeichnet zusammengefasste Klassen-Labels für die Kompaktansicht.
 * Benachbarte Wagen gleicher Klasse werden gruppiert.
 */
export function drawCompactClassLabels(ctx, scaledCoaches, y) {
    if (!scaledCoaches || scaledCoaches.length === 0) return;

    let currentGroup = [];

    const processGroup = (group) => {
        if (group.length === 0) return;

        const firstCoach = group[0];
        const lastCoach = group[group.length - 1];

        // In der Kompaktansicht wird nur die 1. Klasse hervorgehoben
        if (firstCoach.coachClass !== 1) return;

        const startPos = firstCoach.start;
        const endPos = lastCoach.start + lastCoach.length;
        const center = (startPos + endPos) / 2;

        ctx.font = FONTS.bold(40);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COLORS.ORANGE;
        ctx.fillText("1.", center, y + 44);
    };

    for (const coach of scaledCoaches) {
        if (currentGroup.length > 0 && coach.coachClass === currentGroup[0].coachClass) {
            currentGroup.push(coach);
        } else {
            processGroup(currentGroup);
            currentGroup = [coach];
        }
    }
    processGroup(currentGroup);
}

/**
 * Zeichnet ein Ausstattungs-Icon (Fahrrad, Rollstuhl, etc.) in einen Wagen (Vollbild).
 */
export function drawAmenityIcon(ctx, coach, x, y) {
    let imgKey;
    let scale;
    if (coach.hasAmenity('f')) imgKey = 'wagenreihung_fahrrad', scale = 0.28;
    else if (coach.hasAmenity('r')) imgKey = 'wagenreihung_rollstuhl', scale = 0.24;
    else if (coach.hasAmenity('m')) imgKey = 'wagenreihung_mehrzweck', scale = 0.28;
    else if (coach.hasAmenity('g')) imgKey = 'wagenreihung_gastronomie', scale = 0.32;
    const img = images[imgKey];
    if (img && img.isLoaded && !img.isBroken) {
        try {
            ctx.drawImage(img, x + (coach.length / 2) - (img.width * scale / 2), y + 42 - (img.height * scale / 2), img.width * scale, img.height * scale);
        } catch (err) {
            console.warn(`Failed to draw amenity image ${imgKey}:`, err);
        }
    }
}

/**
 * Zeichnet zusammengefasste Ausstattungs-Icons für die Kompaktansicht.
 */
export function drawCompactAmenityIcons(ctx, scaledCoaches, y) {
    if (!scaledCoaches || scaledCoaches.length === 0) return;

    const arraysAreEqual = (a, b) => {
        if (a.length !== b.length) return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, index) => val === sortedB[index]);
    };

    let currentGroup = [];

    const processGroup = (group) => {
        if (group.length === 0 || group[0].amenities.length === 0) return;

        const firstCoach = group[0];
        const lastCoach = group[group.length - 1];
        const amenities = firstCoach.amenities;

        const startPos = firstCoach.start;
        const endPos = lastCoach.start + lastCoach.length;
        const center = (startPos + endPos) / 2;

        let imgKey;
        let scale;
        if (amenities.includes('f')) { imgKey = 'wagenreihung_fahrrad'; scale = 0.28; }
        else if (amenities.includes('r')) { imgKey = 'wagenreihung_rollstuhl'; scale = 0.24; }
        else if (amenities.includes('m')) { imgKey = 'wagenreihung_mehrzweck'; scale = 0.28; }
        else if (amenities.includes('g')) { imgKey = 'wagenreihung_gastronomie'; scale = 0.32; }

        const img = images[imgKey];
        if (img && img.isLoaded && !img.isBroken) {
            try {
                ctx.drawImage(img, center - (img.width * scale / 2), y + 42 - (img.height * scale / 2), img.width * scale, img.height * scale);
            } catch (err) {
                console.warn(`Failed to draw compact amenity image ${imgKey}:`, err);
            }
        }
    };

    for (const coach of scaledCoaches) {
        if (currentGroup.length > 0 && arraysAreEqual(coach.amenities, currentGroup[0].amenities)) {
            currentGroup.push(coach);
        } else {
            processGroup(currentGroup);
            currentGroup = [coach];
        }
    }
    processGroup(currentGroup);
}

/**
 * Zeichnet die Wagennummer in einen Wagen (Vollbild).
 */
export function drawWagonNumber(ctx, coach, x, y) {
    if (coach.coachNumber && coach.coachNumber !== 0) {
        ctx.fillStyle = COLORS.WHITE;
        ctx.font = FONTS.regular(40);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(coach.coachNumber.toString(), x + (coach.length / 2), y + 44);
    }
}

/**
 * Zeichnet zusammengefasste Wagennummern für die Kompaktansicht.
 * Benachbarte Wagen werden als "31 - 37" dargestellt.
 */
export function drawCompactWagonNumbers(ctx, scaledCoaches, y) {
    if (!scaledCoaches || scaledCoaches.length === 0) return;

    let currentGroup = [];

    const processGroup = (group) => {
        if (group.length === 0) return;

        const firstCoach = group[0];
        const lastCoach = group[group.length - 1];

        const startPos = firstCoach.start;
        const endPos = lastCoach.start + lastCoach.length;
        const center = (startPos + endPos) / 2;

        const firstNumber = firstCoach.coachNumber;
        const lastNumber = lastCoach.coachNumber;

        const numberText = firstNumber === lastNumber ?
            firstNumber.toString() :
            `${firstNumber} - ${lastNumber}`;

        ctx.fillStyle = COLORS.WHITE;
        ctx.font = FONTS.regular(40);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(numberText, center, y + 44);
    };

    for (const coach of scaledCoaches) {
        // Wagen muss eine Nummer haben, um zu einer Gruppe zu gehören
        if (coach.coachNumber && coach.coachNumber !== '0' && coach.coachNumber !== '') {
            currentGroup.push(coach);
        } else {
            // Ende einer Gruppe
            processGroup(currentGroup);
            currentGroup = [];
        }
    }

    // Letzte Gruppe verarbeiten
    processGroup(currentGroup);
}

// ==========================================
// Hilfsfunktionen
// ==========================================

/**
 * Bestimmt den Wagen-Positions-Typ basierend auf Position innerhalb der Gruppe.
 * @returns {string} 'l' (Lok), 'a' (Anfang), 'e' (Ende), 'm' (Mitte), 'ma' (Mitte-Anfang), 'me' (Mitte-Ende)
 */
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
