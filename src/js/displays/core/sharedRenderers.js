// js/displays/sharedRenderers.js
import { COLORS, FONTS } from '../../core/constants/theme.js';
import { drawText, fillTextCentered } from './textUtils.js';
import { getSimulatedTime } from '../../core/utils/config.js';
import { isBlinkPhaseOn } from '../../core/utils/blinkUtils.js';

/**
 * Zeichnet das DB-Logo (abgerundetes Rechteck mit Text "DB")
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} [w=80]
 * @param {number} [h=60]
 * @returns {void}
 */
export function drawDBLogo(ctx, x, y, w = 80, h = 60) {
    const scale = w / 80;
    const lineWidth = Math.max(2, Math.round(4 * scale));
    const fontSize = Math.round(44 * (h / 60));
    const radius = Math.round(8 * scale);
    const boxY = y - (h / 2);

    ctx.save();
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.roundRect(x, boxY, w, h, radius);
    ctx.stroke();

    ctx.font = FONTS.bold(fontSize);
    ctx.fillStyle = COLORS.WHITE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fillTextCentered(ctx, "DB", x + (w / 2), y);
    ctx.restore();
}


/**
 * Zeichnet eine virtuelle analoge Uhr inkl. Stunden- und Minutenzeiger.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} [radius=35]
 * @param {Date|null} [customTime=null]
 * @returns {void}
 */
export function drawAnalogClock(ctx, x, y, radius = 35, customTime = null) {
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = Math.max(1.5, Math.round(radius * 0.1));
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Hands
    const now = customTime || getSimulatedTime();
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const millis = now.getMilliseconds();
    
    // Smooth seconds
    const smoothSeconds = seconds + millis / 1000;
    
    const hourAngle = (hours + minutes / 60) * (Math.PI * 2 / 12) - Math.PI / 2;
    const minAngle = (minutes + smoothSeconds / 60) * (Math.PI * 2 / 60) - Math.PI / 2;
    
    // Hour hand
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(hourAngle) * (radius * 0.55), y + Math.sin(hourAngle) * (radius * 0.55));
    ctx.stroke();
    
    // Minute hand
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(minAngle) * (radius * 0.8), y + Math.sin(minAngle) * (radius * 0.8));
    ctx.stroke();
    
    // Center dot
    ctx.fillStyle = COLORS.WHITE;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Zeichnet eine digitale Uhrzeit (HH:MM) mit optional blinkendem Doppelpunkt.
 *
 * Stunden, Doppelpunkt und Minuten werden als separate Segmente gezeichnet,
 * damit die Minuten beim Ausblenden des Doppelpunkts nicht verrutschen.
 * Der Doppelpunkt nutzt dieselbe Blinkphase wie der Abfahrtsalarm
 * (siehe isBlinkPhaseOn), sodass beide Elemente synchron blinken.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Date} time - Anzuzeigende Uhrzeit.
 * @param {number} x - Linke Kante des Textes.
 * @param {number} y - Vertikale Position: Mittelachse bei 'center', sonst wie ctx.textBaseline.
 * @param {object} [options={}] - Darstellungsoptionen.
 * @param {number} [options.fontSize=42] - Schriftgröße in Pixeln.
 * @param {string} [options.color=COLORS.WHITE] - Textfarbe.
 * @param {boolean} [options.blinkColon=true] - Ob der Doppelpunkt blinken soll.
 * @param {'center'|'baseline'} [options.verticalAlign='center'] - Interpretationsart von y.
 * @returns {number} Gesamtbreite der gezeichneten Uhrzeit in Pixeln.
 */
export function drawDigitalClock(ctx, time, x, y, options = {}) {
    const {
        fontSize = 42,
        color = COLORS.WHITE,
        blinkColon = true,
        verticalAlign = 'center'
    } = options;

    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const font = FONTS.bold(fontSize);

    ctx.font = font;
    ctx.textAlign = 'left';

    const hoursWidth = ctx.measureText(hours).width;
    const colonWidth = ctx.measureText(':').width;
    const minutesWidth = ctx.measureText(minutes).width;

    /**
     * Zeichnet ein Segment an seiner linken Kante.
     * @param {string} text - Segmenttext.
     * @param {number} segmentX - Linke Kante des Segments.
     * @returns {void}
     */
    const drawSegment = (text, segmentX) => {
        if (verticalAlign === 'center') {
            ctx.fillStyle = color;
            fillTextCentered(ctx, text, segmentX, y);
        } else {
            drawText(ctx, text, segmentX, y, font, color, 'left');
        }
    };

    drawSegment(hours, x);

    // Doppelpunkt phasengleich zum Abfahrtsalarm ein-/ausblenden.
    if (!blinkColon || isBlinkPhaseOn()) {
        drawSegment(':', x + hoursWidth);
    }

    drawSegment(minutes, x + hoursWidth + colonWidth);

    return hoursWidth + colonWidth + minutesWidth;
}
