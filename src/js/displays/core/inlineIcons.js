// js/displays/core/inlineIcons.js

import { drawText, getFontAscent, getVerticalCenterOffset } from './textUtils.js';
import { ICONS } from './icons.js';

/**
 * Inline-Symbole in Textzeilen.
 *
 * Texte können an beliebiger Stelle das Token `{iconKey}` enthalten, z. B.
 * `Zugteilung {zugteilung} in Hamm`. Gemessen und gezeichnet werden solche
 * Texte über die Helfer in diesem Modul; Canvas-Aufrufer nutzen
 * `measureInlineText`/`drawInlineText`, der DOM-Lauftext (ScrollManager)
 * nutzt `buildInlineIconFragment`.
 *
 * Größe und Sitz der Symbole stammen aus der Symbolvorlage (Bildschirmfoto
 * der DB-Anzeige): Versalhöhe 58 px, Grundlinie y = 697 px. Die Symbole sind
 * dort bewusst höher als Versalien (Zugteilung 1,35 x), die Wagenenden stehen
 * auf der Grundlinie, die Trennpunkte laufen darunter. Aus diesen
 * Referenzwerten und der Versalhöhe der jeweils verwendeten Schrift ergibt
 * sich die Darstellung dynamisch - für jede Schriftgröße und jeden Font.
 */

/** Versalhöhe der Symbolvorlage in px. */
const REF_CAP_HEIGHT = 58;

/**
 * Tintenüberstand je Symbol über/unter der Grundlinie in Referenzpixeln.
 * @type {Record<string, {above: number, below: number}>}
 */
const ICON_REF = {
    flugzeug: { above: 62, below: 8 },
    faehre: { above: 59, below: 8 },
    wende_links: { above: 58, below: 0 },
    wende_rechts: { above: 58, below: 0 },
    zugteilung: { above: 61, below: 16 },
    zugvereinigung: { above: 52, below: 0 },
    stadion: { above: 59, below: 0 },
    tuerlinie: { above: 61, below: 16 }
};

/** Seitlicher Abstand zwischen Text und Symbol, relativ zur Schriftgröße. */
const ICON_GAP_RATIO = 0.12;

/** Flughafen-Ziele: Name (deutsch/englisch) oder IATA-Code BER. */
const AIRPORT_RE = /flughafen|airport|\bBER\b/i;

const TOKEN_RE = /\{([a-z][a-z0-9_]*)\}/g;

/**
 * Zerlegt einen Text in Text- und Symbolabschnitte.
 * Unbekannte Token bleiben unverändert als Text erhalten.
 *
 * @param {string} text
 * @returns {Array<{type: 'text', text: string}|{type: 'icon', key: string}>}
 */
function parseInlineIcons(text) {
    if (!text) return [];
    const runs = [];
    let last = 0;
    for (const match of text.matchAll(TOKEN_RE)) {
        const key = match[1];
        if (!ICONS[key]) continue;
        if (match.index > last) runs.push({ type: 'text', text: text.slice(last, match.index) });
        runs.push({ type: 'icon', key });
        last = match.index + match[0].length;
    }
    if (last < text.length) runs.push({ type: 'text', text: text.slice(last) });
    return runs;
}

/**
 * Entfernt Unicode-Flugzeugzeichen aus einem Text; das Piktogramm wird
 * stattdessen als Vektor-Symbol gezeichnet (siehe {flugzeug}).
 *
 * @param {string} text
 * @returns {string}
 */
export function stripPlaneChar(text) {
    const value = String(text || '');
    if (!value.includes('✈')) return value;
    return value.replace(/✈/g, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Token für das Flugzeug-Piktogramm, inklusive trennendem Leerzeichen auf der
 * gewünschten Seite - oder '' wenn das Ziel kein Flughafen ist. Die drei
 * Tafel-Renderer teilen sich damit Erkennung, Schreibweise und Abstand.
 *
 * @param {string} text - Zieltext, vorher mit stripPlaneChar vom Unicode-✈ befreit
 * @param {'prefix'|'suffix'} [position='suffix']
 * @returns {string}
 */
export function planeIconToken(text, position = 'suffix') {
    if (!AIRPORT_RE.test(String(text || ''))) return '';
    return position === 'prefix' ? '{flugzeug} ' : ' {flugzeug}';
}

/**
 * Schriftgröße in px aus einem Canvas-Font-String.
 * @param {string} font
 * @returns {number}
 */
function fontSizeOf(font) {
    const match = /(\d+(?:\.\d+)?)px/.exec(font || '');
    return match ? parseFloat(match[1]) : 16;
}

/** @type {CanvasRenderingContext2D|null} */
let _measureCtx = null;

/**
 * Offscreen-Kontext, der nur zum Messen von Schriftmetriken dient.
 * @returns {CanvasRenderingContext2D}
 */
function measuringContext() {
    if (!_measureCtx) {
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        _measureCtx = canvas.getContext('2d');
    }
    return _measureCtx;
}

/**
 * Versalhöhe der übergebenen Schrift in px. Solange die Schrift noch nicht
 * geladen ist, wird mit 0,714 em gerechnet.
 *
 * @param {string} font - Canvas-Font-String
 * @returns {number}
 */
function capHeightOfFont(font) {
    const ctx = measuringContext();
    ctx.font = font;
    const cap = ctx.measureText('H').actualBoundingBoxAscent;
    return cap > 0 ? cap : fontSizeOf(font) * 0.714;
}

/** @type {Map<string, {x0: number, y0: number, w: number, h: number}>} */
const _inkBoundsCache = new Map();

/**
 * Ermittelt die Tintenausdehnung eines Icons in viewBox-Einheiten.
 * Einmalig über ein Offscreen-Canvas gerastert und gecacht, damit jedes Icon
 * unabhängig von seiner viewBox exakt auf die Zeilenhöhe skaliert werden kann.
 *
 * @param {string} key - Schlüssel in `ICONS`
 * @returns {{x0: number, y0: number, w: number, h: number}}
 */
function getInlineIconInk(key) {
    const cached = _inkBoundsCache.get(key);
    if (cached) return cached;

    const icon = ICONS[key];
    const S = 100;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    // Raster wird ausgelesen: willReadFrequently vermeidet die Browser-Warnung
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const scale = S / icon.viewBox;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff';
    for (const el of icon.elements) {
        ctx.fill(el.path, el.fillRule || 'nonzero');
    }
    ctx.restore();

    const data = ctx.getImageData(0, 0, S, S).data;
    let x0 = S, y0 = S, x1 = -1, y1 = -1;
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            if (data[(y * S + x) * 4 + 3] > 8) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
        }
    }

    // Pixel des 100er-Rasters zurück in viewBox-Einheiten
    const toView = icon.viewBox / S;
    const bounds = {
        x0: x0 * toView,
        y0: y0 * toView,
        w: (x1 - x0 + 1) * toView,
        h: (y1 - y0 + 1) * toView
    };
    _inkBoundsCache.set(key, bounds);
    return bounds;
}

/**
 * Layout eines Symbols für die übergebene Schrift: Tintenmaße, Überstände
 * über/unter der Grundlinie und Breite. Skaliert mit der Versalhöhe, damit
 * das Symbol in jeder Schriftgröße gleich sitzt.
 *
 * @param {string} key
 * @param {string} font - Canvas-Font-String
 * @returns {{ink: {x0: number, y0: number, w: number, h: number}, height: number, width: number, above: number, below: number}}
 */
function iconLayoutFor(key, font) {
    const ink = getInlineIconInk(key);
    const ref = ICON_REF[key];
    const scale = capHeightOfFont(font) / REF_CAP_HEIGHT;
    const height = (ref.above + ref.below) * scale;
    return {
        ink,
        height,
        width: (ink.w / ink.h) * height,
        above: ref.above * scale,
        below: ref.below * scale
    };
}

/**
 * Breite eines Textes inklusive Inline-Symbolen. `ctx.font` muss gesetzt sein.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @returns {number}
 */
export function measureInlineText(ctx, text) {
    const runs = parseInlineIcons(text);
    if (!runs.some(run => run.type === 'icon')) return ctx.measureText(text).width;

    const font = ctx.font;
    const gap = fontSizeOf(font) * ICON_GAP_RATIO;
    let width = 0;
    for (const run of runs) {
        if (run.type === 'text') {
            width += ctx.measureText(run.text).width;
        } else {
            width += iconLayoutFor(run.key, font).width + 2 * gap;
        }
    }
    return width;
}

/**
 * Grundlinie für die aktuell gesetzte `textBaseline` (analog zu `drawText`).
 * Aufrufer brauchen sie, um Clip-Rechtecke an den Symbolüberständen auszurichten.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} y
 * @param {string} text
 * @returns {number}
 */
export function resolveInlineBaseline(ctx, y, text) {
    const baseline = ctx.textBaseline;
    if (baseline === 'middle') return y + getVerticalCenterOffset(ctx, text);
    if (baseline === 'top') return y + getFontAscent(ctx, text);
    return y;
}

/**
 * Größter Überstand der Inline-Symbole eines Textes über/unter der
 * Grundlinie in px (0/0, wenn der Text keine Symbole enthält).
 *
 * @param {CanvasRenderingContext2D} ctx - `ctx.font` muss gesetzt sein
 * @param {string} text
 * @returns {{above: number, below: number}}
 */
export function getInlineIconExtent(ctx, text) {
    let above = 0;
    let below = 0;
    const font = ctx.font;
    for (const run of parseInlineIcons(text)) {
        if (run.type !== 'icon') continue;
        const layout = iconLayoutFor(run.key, font);
        above = Math.max(above, layout.above);
        below = Math.max(below, layout.below);
    }
    return { above, below };
}

/**
 * Zeichnet ein einzelnes Icon so, wie es die Symbolvorlage zur Grundlinie
 * vorgibt: Überstand `above` über, `below` unter der Grundlinie.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} key
 * @param {number} x - linke Kante
 * @param {number} baseline - Baseline in px
 * @param {string} color
 */
function drawInlineIcon(ctx, key, x, baseline, color) {
    const icon = ICONS[key];
    if (!icon) return;

    const layout = iconLayoutFor(key, ctx.font);
    const { ink } = layout;
    const scale = layout.height / ink.h;

    ctx.save();
    // x wie drawText auf ganze Pixel legen, damit Symbol und Text bündig sitzen
    ctx.translate(Math.round(x) - ink.x0 * scale, baseline - layout.above - ink.y0 * scale);
    ctx.scale(scale, scale);
    for (const el of icon.elements) {
        ctx.fillStyle = el.fill === 'currentColor' ? color : el.fill;
        ctx.fill(el.path, el.fillRule || 'nonzero');
    }
    ctx.restore();
}

/**
 * Zeichnet einen Text mit Inline-Symbolen. `ctx.font` muss gesetzt sein.
 * Vertikale Ausrichtung folgt der aktuellen `textBaseline` wie bei `drawText`.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} color
 * @param {'left'|'center'|'right'} [align='left']
 */
export function drawInlineText(ctx, text, x, y, color, align = 'left') {
    const runs = parseInlineIcons(text);
    if (!runs.some(run => run.type === 'icon')) {
        drawText(ctx, text, x, y, ctx.font, color, align);
        return;
    }

    const font = ctx.font;
    const gap = fontSizeOf(font) * ICON_GAP_RATIO;
    const total = measureInlineText(ctx, text);
    const startX = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    const baseline = resolveInlineBaseline(ctx, y, text);

    let cursor = startX;
    for (const run of runs) {
        if (run.type === 'text') {
            if (!run.text) continue;
            drawText(ctx, run.text, cursor, y, font, color, 'left');
            ctx.font = font;
            cursor += ctx.measureText(run.text).width;
        } else {
            const layout = iconLayoutFor(run.key, font);
            cursor += gap;
            drawInlineIcon(ctx, run.key, cursor, baseline, color);
            cursor += layout.width + gap;
        }
    }
}

/**
 * Baut Text mit Inline-Symbolen als DOM-Inhalt (für die HTML-Lauftexte).
 * Die Symbole werden als SVG eingebettet und richten sich per `em` an der
 * Schriftgröße des Overlays aus.
 *
 * @param {string} text
 * @param {string} color
 * @param {string} font - Canvas-Font-String der Zeile (bestimmt die Symbolgröße)
 * @returns {DocumentFragment}
 */
export function buildInlineIconFragment(text, color, font) {
    const fragment = document.createDocumentFragment();
    const gapPx = fontSizeOf(font) * ICON_GAP_RATIO;

    for (const run of parseInlineIcons(text)) {
        if (run.type === 'text') {
            if (run.text) fragment.appendChild(document.createTextNode(run.text));
            continue;
        }

        const icon = ICONS[run.key];
        if (!icon) continue;

        const layout = iconLayoutFor(run.key, font);
        const { ink } = layout;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // viewBox exakt auf die Tinte legen: dann entspricht die Box der Tinte
        // und `below` ist der Abstand der Unterkante zur Grundlinie.
        svg.setAttribute('viewBox', `${ink.x0} ${ink.y0} ${ink.w} ${ink.h}`);
        svg.setAttribute('aria-hidden', 'true');
        svg.style.height = `${layout.height}px`;
        svg.style.width = `${layout.width}px`;
        svg.style.margin = `0 ${gapPx}px`;
        svg.style.verticalAlign = `-${layout.below}px`;
        svg.style.fill = color;
        svg.style.flex = '0 0 auto';

        for (const el of icon.elements) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', el.d);
            path.setAttribute('fill-rule', el.fillRule || 'nonzero');
            // currentColor erbt `svg.style.fill`; feste Füllfarben werden gesetzt
            if (el.fill !== 'currentColor') path.setAttribute('fill', el.fill);
            svg.appendChild(path);
        }
        fragment.appendChild(svg);
    }

    return fragment;
}
