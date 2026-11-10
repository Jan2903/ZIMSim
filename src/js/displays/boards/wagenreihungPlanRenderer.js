// js/displays/boards/wagenreihungPlanRenderer.js
import { COLORS, FONTS } from '../../core/constants/theme.js';
import { FORMATION } from '../core/constants.js';
import { getSimulatedTime } from '../../core/utils/config.js';
import { drawFormation, drawSectors } from '../primitives/formationRenderer.js';
import { drawDBLogo, drawAnalogClock, drawDigitalClock } from '../core/sharedRenderers.js';
import { drawInvertedTimeBox, getVerticalCenterOffset, truncateWithEllipsis, drawText, drawTextInRectangle } from '../core/textUtils.js';
import { lineColorService } from '../../core/services/lineColorService.svelte.js';
import { JourneyViaService } from '../../features/journey/services/journeyViaService.js';

/**
 * Renderer für den Digitalen Wagenreihungsplan der DB.
 *
 * Struktur:
 * - Kopfzeile: Uhrzeit, "Abfahrt Departure", Sektoren [A] bis [G], "Gleis", DB-Logo
 * - 4 bis 5 Zugzeilen:
 *    Links: Zugnummer, Abfahrtszeit (ggf. Verspätungsfeld), DB-Logo
 *    Mitte: Zielbahnhof, Zwischenhalte und maßstabsgetreue Wagenreihung unter den Sektoren
 *    Rechts: Gleisnummer in großer Schrift
 */

export function drawWagenreihungPlan(ctx, journeyGroups = [], platform = {}, width = 1920, height = 1080, renderCtx = {}, screenOptions = {}) {
    const isPortrait = height > width;
    const HEADER_HEIGHT = isPortrait ? 130 : 100;

    // 1. Hintergrund (Midnightblue – passend zum Standard-Zuganzeiger)
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
    ctx.fillRect(0, 0, width, height);

    // Sektor-Bereich berechnen (standardmäßig Sektoren A bis G)
    const sectorStartX = isPortrait ? (width * 0.22) : (width * 0.26);
    const sectorUsableWidth = isPortrait ? (width * 0.62) : (width * 0.62);

    // 2. Kopfbereich mit Sektor-Leiste zeichnen
    drawPlanHeader(ctx, width, HEADER_HEIGHT, sectorStartX, sectorUsableWidth, platform, isPortrait);

    // 3. Fahrten für diesen Bildschirm ermitteln
    const planOffset = screenOptions.planOffset || 0;
    const maxRows = isPortrait ? 6 : 5;
    const groups = (journeyGroups || []).slice(planOffset, planOffset + maxRows);

    const availableHeight = height - HEADER_HEIGHT;
    const rowHeight = availableHeight / maxRows;

    // 4. Zeilen rendern
    for (let i = 0; i < maxRows; i++) {
        const rowY = HEADER_HEIGHT + (i * rowHeight);
        const trainGroup = groups[i] || [];

        drawPlanRow(
            ctx,
            trainGroup,
            platform,
            0,
            rowY,
            width,
            rowHeight,
            sectorStartX,
            sectorUsableWidth,
            i % 2 === 1,
            isPortrait
        );
    }
}

/**
 * Zeichnet die Kopfzeile mit Live-Uhrzeit, Titel, Sektor-Kästchen [A]..[G], Gleis-Label und DB-Logo.
 */
function drawPlanHeader(ctx, width, height, sectorStartX, sectorUsableWidth, platform, isPortrait) {
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE_HEADER;
    ctx.fillRect(0, 0, width, height);

    // Feine Akzent-Linie unten
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(0, height - 2, width, 2);

    const simTime = getSimulatedTime();

    // 1. Uhrzeit links (Analoge Uhr + Digitalzeit mit blinkendem Doppelpunkt)
    const clockRadius = isPortrait ? 22 : 26;
    const clockCenterX = (isPortrait ? 20 : 30) + clockRadius;
    const clockCenterY = height * 0.50;
    drawAnalogClock(ctx, clockCenterX, clockCenterY, clockRadius, simTime);

    drawDigitalClock(ctx, simTime, clockCenterX + clockRadius + 14, height * 0.58, {
        fontSize: isPortrait ? 38 : 42,
        verticalAlign: 'baseline'
    });

    // 2. "Abfahrt Departure"
    const titleX = isPortrait ? 180 : 210;
    drawText(ctx, 'Abfahrt', titleX, height * 0.58, FONTS.bold(isPortrait ? 36 : 42), COLORS.WHITE, 'left');
    drawText(ctx, 'Departure', titleX + (isPortrait ? 130 : 160), height * 0.58, FONTS.italic(isPortrait ? 26 : 30), '#94a3b8', 'left');

    // 3. Sektoren A bis G in Kästchen zentriert über dem Zug-Reihungsbereich
    const defaultSectors = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const sectorCount = defaultSectors.length;
    const sectorStep = sectorUsableWidth / sectorCount;

    // Horizontale Führungsstrecke für die Sektoren
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sectorStartX, height * 0.52);
    ctx.lineTo(sectorStartX + sectorUsableWidth, height * 0.52);
    ctx.stroke();

    ctx.textAlign = 'center';
    for (let s = 0; s < sectorCount; s++) {
        const secX = sectorStartX + (s * sectorStep) + (sectorStep / 2);
        const boxSize = isPortrait ? 34 : 40;
        const boxY = (height * 0.52) - (boxSize / 2);

        // Kasten [ A ]
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE_HEADER;
        ctx.fillRect(secX - (boxSize / 2), boxY, boxSize, boxSize);

        ctx.strokeStyle = COLORS.WHITE;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(secX - (boxSize / 2), boxY, boxSize, boxSize);

        drawText(ctx, defaultSectors[s], secX, boxY + (boxSize * 0.72), FONTS.bold(isPortrait ? 22 : 26), COLORS.WHITE, 'center');
    }

    // 4. "Gleis" Spaltenkopf rechts
    const gleisHeaderX = width - (isPortrait ? 50 : 80);
    drawText(ctx, 'Gleis', gleisHeaderX, height * 0.76, FONTS.regular(isPortrait ? 20 : 24), '#94a3b8', 'center');

    // 5. DB-Logo ganz rechts oben
    const logoX = width - (isPortrait ? 70 : 105);
    const logoY = 16;
    drawDBLogo(ctx, logoX, logoY + 18);
}

/**
 * Zeichnet eine einzelne Zeile im Wagenreihungsplan.
 */
function drawPlanRow(ctx, trainGroup, platform, x, y, width, height, sectorStartX, sectorUsableWidth, isAlt, isPortrait) {
    // Zeilenhintergrund: Einheitliches DB-Blau (kein Zebra-Muster)
    ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
    ctx.fillRect(x, y, width, height);

    // Trennlinie nach unten
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(x, y + height - 1, width, 1);

    if (!trainGroup || trainGroup.length === 0) {
        return; // Leere Zeile bei wenigen Zügen
    }

    const primary = trainGroup[0];
    const isAusfall = !!primary.ausfall;
    const hasDelay = primary.expectedTime && primary.expectedTime !== primary.scheduledTime;

    // ========================================================
    // SPALTE 1: Zugnummer, Abfahrtszeit, Logo (Links)
    // ========================================================
    const col1X = isPortrait ? 20 : 30;

    // 1. Zugname / Gattung (z.B. "ICE 1638")
    const trainName = primary.displayTitle;
    const badgeStyle = lineColorService.resolveStyle(trainName, {
        operator: primary.operator,
        stationContext: platform,
        inverted: false,
        fullScreen: true
    });
    drawTextInRectangle(ctx, trainName, col1X, y + (height * 0.26), FONTS.bold(isPortrait ? 22 : 26), 'left', isPortrait ? 22 : 26, 10, renderCtx, 0, badgeStyle.backgroundColor, badgeStyle.textColor, false, false, badgeStyle.hasMatchedRule);

    // 2. Abfahrtszeit (z.B. "06:07")
    const timeY = y + (height * 0.54);
    drawText(ctx, primary.scheduledTime || '--:--', col1X, timeY, FONTS.bold(isPortrait ? 38 : 46), isAusfall ? '#ef4444' : COLORS.WHITE, 'left');

    if (isAusfall) {
        // Zeit durchstreichen
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(col1X - 2, timeY - 12);
        ctx.lineTo(col1X + (isPortrait ? 95 : 120), timeY - 12);
        ctx.stroke();

        drawText(ctx, 'Fällt aus', col1X, timeY + 30, FONTS.bold(20), '#ef4444', 'left');
    } else if (hasDelay) {
        // Verspätungsfeld (invertierter, eckiger Kasten wie auf den übrigen Tafeln)
        const schedW = ctx.measureText(primary.scheduledTime || '--:--').width;
        const delayX = col1X + schedW + 12;
        const scheduledCenterY = timeY - getVerticalCenterOffset(ctx, primary.expectedTime);

        drawInvertedTimeBox(ctx, primary.expectedTime, delayX, scheduledCenterY, FONTS.bold(isPortrait ? 22 : 26), {
            minWidth: isPortrait ? 85 : 100,
            height: isPortrait ? 34 : 40
        });
    }

    // 3. Kleines DB-Badge links unten
    const badgeW = 44;
    const badgeH = 28;
    const badgeY = y + (height * 0.65);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(col1X, badgeY, badgeW, badgeH, 4);
    ctx.stroke();

    drawText(ctx, 'DB', col1X + (badgeW / 2), badgeY + 20, FONTS.bold(18), '#ef4444', 'center');

    // ========================================================
    // SPALTE 2: Zielbahnhof, Zwischenhalte & Wagenreihung (Mitte)
    // ========================================================
    const col2X = sectorStartX;

    // 1. Zielbahnhof
    drawText(ctx, destText, col2X, y + (height * 0.28), FONTS.bold(isPortrait ? 34 : 42), isAusfall ? '#94a3b8' : COLORS.WHITE, 'left');

    // 2. Zwischenhalte / Vias
    const viaFont = FONTS.regular(isPortrait ? 18 : 22);
    const viaText = JourneyViaService.getDisplayVias(primary, {
        maxWidth: sectorUsableWidth,
        maxLines: 1,
        font: viaFont,
        separator: ' - '
    }).map(s => s.nameKurz || s.name).join(' - ');
    if (viaText) {
        ctx.font = viaFont;
        const viaDisplay = truncateWithEllipsis(ctx, viaText, sectorUsableWidth);
        drawText(ctx, viaDisplay, col2X, y + (height * 0.44), viaFont, '#94a3b8', 'left');
    }

    // 3. Wagenreihung maßstäblich zeichnen (sauber skaliert, um Zeilenüberlauf zu verhindern)
    if (primary.formation && primary.formation.coaches && primary.formation.coaches.length > 0) {
        ctx.save();
        // Verfügbare Höhe im unteren Zeilenbereich
        const availableFormationHeight = height * 0.44;
        const targetFormationHeight = 95; // Tatsächlich benötigte vertikale Ausdehnung (70 bis 165px)
        const scaleY = Math.min(1.0, availableFormationHeight / targetFormationHeight);

        // Vertikale Einbettung direkt unterhalb der Vias-Zeile
        const formationY = y + (height * 0.48);
        ctx.translate(0, formationY);
        // COACH_Y_OFFSET (70px) nach oben kompensieren und vertikal stauchen
        ctx.translate(0, -FORMATION.COACH_Y_OFFSET * scaleY);
        ctx.scale(1.0, scaleY);

        drawFormation(ctx, trainGroup, platform, {
            fullScreen: true,
            activeFeature: 'wagennummern',
            hideSectors: true,
            hideDestinations: true,
            customStartX: sectorStartX,
            customUsableWidth: sectorUsableWidth,
            isVitrine: true,
            drawLayer: 'all'
        });
        ctx.restore();
    }

    // ========================================================
    // SPALTE 3: Gleisnummer (Rechts)
    // ========================================================
    const gleisX = width - (isPortrait ? 50 : 80);
    const platformNum = primary.ezGleis || primary.platform || '-';
    drawText(ctx, platformNum, gleisX, y + (height * 0.58), FONTS.bold(isPortrait ? 48 : 58), primary.hasTrackChange ? '#f59e0b' : COLORS.WHITE, 'center');
}
