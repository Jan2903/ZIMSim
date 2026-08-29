// js/displays/textUtils.js
import { COLORS, FONTS, INFO } from './constants.js';

/**
 * @typedef {object} RenderContext
 * @property {boolean} fullScreen - Ob der Vollbild-Modus aktiv ist.
 * @property {object} screen - Das aktuelle Screen-Objekt aus dem Layout.
 * @property {import('./scrollManager.js').ScrollManager} scrollManager - Der ScrollManager.
 * @property {number} zugID - Die ID des aktuellen Zuges (1-basiert).
 * @property {HTMLCanvasElement} canvas - Das Canvas-Element.
 */

/**
 * Zeichnet einen einfachen Text auf den Canvas.
 */
export function drawText(ctx, text, x, y, font, textColor, textAlign) {
    ctx.font = font;
    ctx.textAlign = textAlign;
    ctx.fillStyle = textColor;
    ctx.fillText(text, x, y);
}

/**
 * Zeichnet Text mit automatischem Zeilenumbruch.
 * @returns {number} Die Y-Position nach der letzten Zeile.
 */
export function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, font, textColor, textAlign) {
    let line = '';
    if (text !== "") {
        const words = text.split(' ');
        ctx.font = font; // Wird für die Breitenmessung benötigt

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const testWidth = ctx.measureText(testLine).width;
            if (testWidth > maxWidth && n > 0) {
                drawText(ctx, line, x, y, font, textColor, textAlign);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        drawText(ctx, line, x, y, font, textColor, textAlign);
    }
    return y + (line === '' ? 0 : lineHeight);
}

/**
 * Zeichnet den farbigen Info-Header für Störungsmeldungen (z.B. "Gleisänderung / Track change").
 */
export function drawInfoTopText(ctx, backgroundColor, textColor, infoText1, infoText2, x1, x2) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, INFO.SIDE_SCREEN_WIDTH, INFO.HEADER_HEIGHT);
    ctx.fillStyle = textColor;
    ctx.font = FONTS.regular(67);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(infoText1, x1, 55);
    ctx.font = FONTS.italic(67);
    ctx.fillText(infoText2, x2, 55);
}

/**
 * Liest die Hintergrundfarbe eines Pixels am rechten Rand eines Screens.
 * Wird für die dynamische Breitenerkennung bei Zugnummern benötigt.
 * @returns {number[]} RGBA-Werte als Array [r, g, b, a].
 */
export function getBackgroundColor(ctx, screen) {
    if (!screen) return [0, 0, 128, 255]; // Fallback: Navy
    const absX = screen.x + screen.w - 25;
    const absY = screen.y + 200;
    const pixel = ctx.getImageData(absX, absY, 1, 1).data;
    return [pixel[0], pixel[1], pixel[2], pixel[3]];
}

/**
 * Ermittelt die maximal verfügbare Breite für die Zugnummer,
 * indem von rechts nach links nach freien Pixeln gescannt wird.
 * @returns {number} Die maximale Breite in Pixeln.
 */
export function findMaxTextWidth(ctx, startX, yCenter, height, screen) {
    if (!screen) return startX;

    const bgColor = getBackgroundColor(ctx, screen);

    const halfH = height / 2;
    const top = Math.floor(Math.max(0, screen.y + yCenter - halfH));
    const bottom = Math.ceil(Math.min(ctx.canvas.height, screen.y + yCenter + halfH));
    const checkHeight = bottom - top;

    const absStartX = Math.floor(screen.x + startX);
    const scanWidth = absStartX - screen.x;

    if (scanWidth <= 0 || checkHeight <= 0) return 0;

    const imgData = ctx.getImageData(screen.x, top, scanWidth, checkHeight).data;

    let maxWidth = 0;
    // Von rechts nach links den gesammelten Bereich überprüfen
    for (let xOffset = scanWidth - 1; xOffset >= 0; xOffset--) {
        let isClear = true;
        for (let yOffset = 0; yOffset < checkHeight; yOffset++) {
            const i = (yOffset * scanWidth + xOffset) * 4;
            if (
                imgData[i] !== bgColor[0] ||
                imgData[i + 1] !== bgColor[1] ||
                imgData[i + 2] !== bgColor[2] ||
                imgData[i + 3] !== bgColor[3]
            ) {
                isClear = false;
                break;
            }
        }

        if (isClear) {
            maxWidth++;
        } else {
            break;
        }
    }

    return maxWidth;
}

/**
 * Zeichnet Text in einem gerundeten Rechteck mit optionalem Scrolling
 * und spezieller IC/FLX-Farblogik.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} font
 * @param {string} textAlign
 * @param {number} textHeight
 * @param {number} rectPadding
 * @param {RenderContext} renderCtx - Kontext mit Screen, ScrollManager etc.
 * @param {number} [cornerRadius=0]
 * @param {string} [rectColor=COLORS.DIM_GREY]
 * @param {string} [textColor=COLORS.WHITE]
 * @param {boolean} [inverted=false]
 * @param {boolean} [widthLimited=false]
 */
export function drawTextInRectangle(ctx, text, x, y, font, textAlign, textHeight, rectPadding, renderCtx, cornerRadius = 0, rectColor = COLORS.DIM_GREY, textColor = COLORS.WHITE, inverted = false, widthLimited = false) {
    const { fullScreen = false, screen = null, scrollManager = null, zugID = 1, canvas = null } = renderCtx || {};

    ctx.font = font;
    ctx.textAlign = textAlign;

    const originalTextWidth = ctx.measureText(text).width;
    let textWidth = originalTextWidth;

    let shouldScroll = false;

    if (widthLimited && screen) {
        const checkHeight = 50; // Vertikaler Scanbereich
        const availableWidth = findMaxTextWidth(ctx, x, y, checkHeight, screen);
        const finalWidth = Math.max(10, availableWidth - 40); // 20px Padding je Seite

        if (textWidth > finalWidth) {
            textWidth = finalWidth;
            shouldScroll = true;
        }
    }

    let stroke = false;
    if (text !== "") {
        if (text.includes("IC")) {
            if (fullScreen) {
                textColor = COLORS.NAVY;
                ctx.fillStyle = COLORS.WHITE;
                cornerRadius = 15;
            } else {
                if (inverted) {
                    stroke = true;
                    cornerRadius = 10;
                    textColor = COLORS.NAVY;
                    ctx.fillStyle = COLORS.NAVY;
                    ctx.strokeStyle = COLORS.NAVY;
                    ctx.lineWidth = 4;
                } else {
                    textColor = COLORS.NAVY;
                    ctx.fillStyle = COLORS.WHITE;
                    cornerRadius = 15;
                }
            }
        } else if (text.includes("FLX")) {
            textColor = COLORS.WHITE;
            ctx.fillStyle = COLORS.LIME;
        } else {
            ctx.fillStyle = rectColor;
        }

        ctx.beginPath();
        if (textAlign === 'left') {
            ctx.roundRect(x - rectPadding, y - textHeight / 2 - rectPadding, textWidth + 2 * rectPadding, textHeight + rectPadding, cornerRadius);
        } else if (textAlign === 'right') {
            ctx.roundRect(x - textWidth - rectPadding, y - textHeight / 2 - rectPadding, textWidth + 2 * rectPadding, textHeight + rectPadding, cornerRadius);
        }
        if (stroke) {
            ctx.stroke();
        } else {
            ctx.fill();
        }

        if (shouldScroll && scrollManager && canvas && screen) {
            const boxLeft = textAlign === 'right'
                ? x - textWidth - rectPadding
                : x - rectPadding;

            scrollManager.createOrUpdate(
                canvas, zugID, 'zugNr_' + Math.round(y), text,
                `${canvas.offsetLeft + screen.x + boxLeft}px`,
                `${canvas.offsetTop + screen.y + y - (textHeight / 2) - rectPadding}px`,
                `${textWidth + 2 * rectPadding}px`,
                `${textHeight + rectPadding}px`,
                textColor, font
            );
        } else {
            drawText(ctx, text, x, y, font, textColor, textAlign);
        }
    }
}
