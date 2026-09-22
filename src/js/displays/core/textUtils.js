// js/displays/textUtils.js
import { COLORS, FONTS, INFO } from './constants.js';
import { lineColorService } from '../../features/journey/services/lineColorService.svelte.js';

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
export function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, font, textColor, textAlign, maxLines = 0) {
    let line = '';
    let lineCount = 0;
    if (text !== "") {
        const words = text.split(' ');
        ctx.font = font; // Wird für die Breitenmessung benötigt

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const testWidth = ctx.measureText(testLine).width;
            if (testWidth > maxWidth && n > 0) {
                lineCount++;
                if (maxLines > 0 && lineCount > maxLines) {
                    return y; // Hard cutoff: max lines reached
                }
                drawText(ctx, line, x, y, font, textColor, textAlign);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        
        lineCount++;
        if (maxLines === 0 || lineCount <= maxLines) {
            drawText(ctx, line, x, y, font, textColor, textAlign);
        }
    }
    return y + (line === '' ? 0 : lineHeight);
}

/**
 * Kürzt einen Text mit Ellipsis (...), falls er die maximale Breite überschreitet.
 * @param {CanvasRenderingContext2D} ctx - Der Canvas-Kontext (mit gesetzter Schriftart)
 * @param {string} text - Der ursprüngliche Text
 * @param {number} maxWidth - Die maximal erlaubte Breite in Pixeln
 * @returns {string} Der gekürzte Text (oder das Original)
 */
export function truncateWithEllipsis(ctx, text, maxWidth) {
    if (!text || ctx.measureText(text).width <= maxWidth) {
        return text;
    }
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return truncated ? (truncated + '...') : '';
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
 * Universelle Canvas-Zeichenfunktion für Linien- und Zuggattungs-Badges.
 * Wendet Form (Pille, Abgerundet, Eckig, Outline), Farben und Ränder
 * dynamisch und proportional zur gegebenen Boxgröße an.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D Kontext
 * @param {string} text - Anzuzeigender Linien-/Zugname
 * @param {number} x - X-Koordinate (links)
 * @param {number} y - Y-Koordinate (oben)
 * @param {number} width - Breite des Badges
 * @param {number} height - Höhe des Badges
 * @param {object} [options={}] - Styling- und Font-Optionen
 * @param {string} [options.font] - Canvas Font String
 * @param {string} [options.backgroundColor] - Hintergrundfarbe
 * @param {string} [options.textColor] - Textfarbe
 * @param {string} [options.borderColor] - Rahmenfarbe
 * @param {number} [options.borderWidth=1] - Rahmenbreite
 * @param {'pill' | 'rounded' | 'rectangle' | 'outline'} [options.shape='rounded'] - Badge-Form
 * @param {number} [options.cornerRadius] - Expliziter Eckenradius
 */
export function drawLineBadge(ctx, text, x, y, width, height, options = {}) {
    const shape = options.shape || 'rounded';
    let radius = 0;

    if (shape === 'pill') {
        radius = Math.min(width, height) / 2;
    } else if (shape === 'rounded' || shape === 'outline') {
        radius = options.cornerRadius !== undefined ? options.cornerRadius : Math.max(4, Math.round(height * 0.12));
    } else if (shape === 'rectangle') {
        radius = 0;
    }

    ctx.save();

    // 1. Pfad definieren
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);

    // 2. Füllung & Rahmen
    if (shape === 'outline') {
        if (options.backgroundColor && options.backgroundColor !== 'transparent') {
            ctx.fillStyle = options.backgroundColor;
            ctx.fill();
        }
        ctx.strokeStyle = options.borderColor || options.textColor || COLORS.WHITE;
        ctx.lineWidth = options.borderWidth || 2;
        ctx.stroke();
    } else {
        ctx.fillStyle = options.backgroundColor || '#1f3d47';
        ctx.fill();

        if (options.borderColor && options.borderColor !== 'transparent') {
            ctx.strokeStyle = options.borderColor;
            ctx.lineWidth = options.borderWidth || 1;
            ctx.stroke();
        }
    }

    // 3. Text zeichnen (zentriert)
    if (text) {
        if (options.font) ctx.font = options.font;
        ctx.fillStyle = options.textColor || COLORS.WHITE;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + (width / 2), y + (height / 2) + 1);
    }

    ctx.restore();
}

/**
 * Zeichnet Text in einem gerundeten Rechteck mit optionalem Scrolling
 * und zentral aufgelöster Linien-/Gattungsfarblogik.
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
 * @param {boolean} [isLineBadge=false] - Ob Linienfarben & Formen über LineColorService aufgelöst werden sollen
 */
export function drawTextInRectangle(ctx, text, x, y, font, textAlign, textHeight, rectPadding, renderCtx, cornerRadius = 0, rectColor = COLORS.DIM_GREY, textColor = COLORS.WHITE, inverted = false, widthLimited = false, isLineBadge = false) {
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

    if (text !== "") {
        let boxBg = rectColor;
        let boxTextColor = textColor;
        let boxBorderColor = 'transparent';
        let boxBorderWidth = 0;
        let boxRadius = cornerRadius;
        let isOutline = false;

        if (isLineBadge) {
            // Zentral aufgelöster Stil aus LineColorService
            const resolved = lineColorService.resolveStyle(text, {
                inverted,
                fullScreen,
                defaultBgColor: rectColor,
                defaultTextColor: textColor
            });

            if (resolved.hasMatchedRule) {
                boxBg = resolved.backgroundColor;
                boxTextColor = resolved.textColor;
                boxBorderColor = resolved.borderColor || 'transparent';
                boxBorderWidth = resolved.borderWidth || 1;
                isOutline = resolved.shape === 'outline';

                const boxWidthTemp = textWidth + 2 * rectPadding;
                const boxHeightTemp = textHeight + rectPadding;

                if (resolved.shape === 'pill') {
                    boxRadius = Math.min(boxWidthTemp, boxHeightTemp) / 2;
                } else if (resolved.shape === 'rectangle') {
                    boxRadius = 0;
                } else if (resolved.shape === 'rounded' || resolved.shape === 'outline') {
                    boxRadius = resolved.cornerRadius || Math.max(4, Math.round(boxHeightTemp * 0.12));
                }
            } else {
                // Kein Regel-Treffer: Standard ZIM (z.B. DIM_GREY auf Zuganzeiger ohne Zwangsrahmen)
                boxBg = rectColor;
                boxTextColor = textColor;
                boxRadius = cornerRadius;
            }
        }

        const boxWidth = textWidth + 2 * rectPadding;
        const boxHeight = textHeight + rectPadding;
        const boxX = textAlign === 'right' ? (x - textWidth - rectPadding) : (x - rectPadding);
        const boxY = y - textHeight / 2 - rectPadding;

        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, boxRadius);

        if (isOutline || (inverted && boxBorderColor && boxBorderColor !== 'transparent')) {
            if (boxBg && boxBg !== 'transparent') {
                ctx.fillStyle = boxBg;
                ctx.fill();
            }
            ctx.strokeStyle = boxBorderColor || boxTextColor;
            ctx.lineWidth = boxBorderWidth || 2;
            ctx.stroke();
        } else {
            if (boxBg && boxBg !== 'transparent') {
                ctx.fillStyle = boxBg;
                ctx.fill();
            }

            if (boxBorderColor && boxBorderColor !== 'transparent') {
                ctx.strokeStyle = boxBorderColor;
                ctx.lineWidth = boxBorderWidth || 1;
                ctx.stroke();
            }
        }

        if (shouldScroll && scrollManager && canvas && screen) {
            scrollManager.createOrUpdate(
                canvas, zugID, 'zugNr_' + Math.round(y), text,
                `${canvas.offsetLeft + screen.x + boxX}px`,
                `${canvas.offsetTop + screen.y + boxY}px`,
                `${boxWidth}px`,
                `${boxHeight}px`,
                boxTextColor, font
            );
        } else {
            drawText(ctx, text, x, y, font, boxTextColor, textAlign);
        }
    }
}

let _measuringCtx = null;

/**
 * Berechnet, wie viele Zeilen ein gegebener Text bei einer maximalen Breite einnimmt.
 * Nutzt einen gecachten Canvas-Kontext für optimale Performance ohne Garbage-Collection-Overhead.
 * @param {string} text - Der zu messende Text
 * @param {number} maxWidth - Maximale Breite in Pixeln
 * @param {string} font - Font-Definition (z.B. FONTS.regular(75))
 * @returns {number} Anzahl der Zeilen
 */
export function measureTextLines(text, maxWidth, font = 'normal 75px "Open Sans Condensed", sans-serif') {
    if (!text) return 0;
    if (typeof document === 'undefined') return 1;

    if (!_measuringCtx) {
        const canvas = document.createElement('canvas');
        _measuringCtx = canvas.getContext('2d');
    }

    _measuringCtx.font = font;
    const words = text.split(' ');
    let lines = 1;
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + words[i] + ' ';
        const testWidth = _measuringCtx.measureText(testLine).width;

        if (testWidth > maxWidth && i > 0) {
            lines++;
            currentLine = words[i] + ' ';
        } else {
            currentLine = testLine;
        }
    }
    return lines;
}
