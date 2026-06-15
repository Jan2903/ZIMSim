// js/displays/sharedRenderers.js
import { COLORS, FONTS } from './constants.js';
import { drawText } from './textUtils.js';

/**
 * Zeichnet das DB-Logo (abgerundetes Rechteck mit Text "DB")
 */
export function drawDBLogo(ctx, x, y) {
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x, y - 43, 80, 60, 8);
    ctx.stroke();
    drawText(ctx, "DB", x + 40, y + 3, FONTS.bold(45), COLORS.WHITE, 'center', 'middle');
}

/**
 * Zeichnet eine virtuelle analoge Uhr inkl. Stunden- und Minutenzeiger.
 */
export function drawAnalogClock(ctx, x, y, radius = 35) {
    ctx.strokeStyle = COLORS.WHITE;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Hands
    const now = new Date();
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
