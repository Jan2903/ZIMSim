// js/displays/core/boardTokenService.js
// Zentrale Auflösung der Board-Tokens: Ausrichtung + Darstellungsvariante
// bestimmen, Basis-Tokens mit Varianten-Overrides mischen und breitenrelative
// Spalten in absolute Pixel umrechnen.
import { ANSCHLUSSTAFEL_TOKENS } from '../boards/anschlusstafelTokens.js';
import { WAGENSTAND_GLEIS_TOKENS } from '../boards/wagenstandGleisTokens.js';

/**
 * Verfügbare Darstellungsvarianten einer Anzeigetafel.
 *
 * `panelW`/`panelH` sind die logischen Maße eines Panels, `scale` ist der
 * Canvas-Skalierungsfaktor (4K zeichnet dieselbe logische Fläche mit
 * ctx.scale(2)). Die Tokens selbst bleiben immer in logischen Pixeln.
 */
export const BOARD_VARIANTS = {
    fhd_landscape: { id: 'fhd_landscape', orientation: 'landscape', scale: 1, panelW: 1920, panelH: 1080 },
    fhd_portrait: { id: 'fhd_portrait', orientation: 'portrait', scale: 1, panelW: 1080, panelH: 1920 },
    uhd_landscape: { id: 'uhd_landscape', orientation: 'landscape', scale: 2, panelW: 1920, panelH: 1080 },
    uhd_portrait: { id: 'uhd_portrait', orientation: 'portrait', scale: 2, panelW: 1080, panelH: 1920 }
};

/** Token-Sets je Board. Weitere Boards werden hier ergänzt. */
export const BOARD_TOKEN_SETS = {
    anschlusstafel: ANSCHLUSSTAFEL_TOKENS,
    wagenstand_gleis: WAGENSTAND_GLEIS_TOKENS
};

/** Kleiner Cache: Tokens werden pro Frame und Screen mehrfach benötigt. */
const TOKEN_CACHE = new Map();
const TOKEN_CACHE_LIMIT = 32;

/**
 * Bestimmt die Darstellungsvariante aus einer expliziten ID oder – als
 * Rückfall für bestehende Aufrufer – aus den logischen Bildschirmmaßen.
 *
 * @param {number} width - Logische Breite des Screens
 * @param {number} height - Logische Höhe des Screens
 * @param {string|null} [variantId=null] - Optionale Varianten-ID
 * @returns {object} Eintrag aus BOARD_VARIANTS
 */
export function resolveBoardVariant(width, height, variantId = null) {
    if (variantId && BOARD_VARIANTS[variantId]) {
        return BOARD_VARIANTS[variantId];
    }
    return height > width ? BOARD_VARIANTS.fhd_portrait : BOARD_VARIANTS.fhd_landscape;
}

/**
 * Liefert die Varianten-ID für eine Ausrichtung und Auflösungsklasse.
 *
 * @param {'landscape'|'portrait'} orientation - Ausrichtung des Displays
 * @param {boolean} [uhd=false] - Ob die 4K-Variante gewählt ist
 * @returns {string} Gültige Varianten-ID
 */
export function getVariantId(orientation, uhd = false) {
    const id = `${uhd ? 'uhd' : 'fhd'}_${orientation === 'portrait' ? 'portrait' : 'landscape'}`;
    return BOARD_VARIANTS[id] ? id : 'fhd_landscape';
}

/**
 * Prüft, ob eine Varianten-ID zur 4K-Auflösungsklasse gehört.
 *
 * @param {string|null} variantId - Zu prüfende Varianten-ID
 * @returns {boolean} true bei uhd_*
 */
export function isUhdVariant(variantId) {
    return Boolean(variantId && BOARD_VARIANTS[variantId]) && variantId.startsWith('uhd_');
}

/**
 * Liefert die Ausrichtung einer Varianten-ID.
 *
 * @param {string|null} variantId - Varianten-ID
 * @returns {'landscape'|'portrait'} Ausrichtung
 */
export function getVariantOrientation(variantId) {
    return variantId && variantId.endsWith('_portrait') ? 'portrait' : 'landscape';
}

/**
 * Erzwingt eine Ausrichtung, behält aber die Auflösungsklasse bei.
 * Wird beim Wechsel des Hardware-Monitors genutzt, damit eine 4K-Auswahl
 * beim Wechsel auf die Stele als 4K-Hochformat erhalten bleibt.
 *
 * @param {string|null} variantId - Bisherige Varianten-ID
 * @param {'landscape'|'portrait'} orientation - Ziel-Ausrichtung
 * @returns {string} Angepasste Varianten-ID
 */
export function adaptVariantOrientation(variantId, orientation) {
    return getVariantId(orientation, isUhdVariant(variantId));
}

/**
 * Löst breitenrelative Spaltenangaben (`xFromRight`/`wFromRight`) in
 * absolute Pixel auf. Absolute Angaben bleiben unverändert.
 *
 * @param {object} columns - Spaltendefinition aus den Board-Tokens
 * @param {number} width - Logische Breite des Screens
 * @returns {{[key: string]: {x: number, w: number}}} Aufgelöste Spalten
 */
function resolveColumns(columns, width) {
    const resolved = {};
    for (const [key, column] of Object.entries(columns || {})) {
        const x = column.xFromRight !== undefined ? width - column.xFromRight : column.x;
        const w = column.wFromRight !== undefined ? width - x - column.wFromRight : column.w;
        resolved[key] = { x, w };
    }
    return resolved;
}

/**
 * Kopiert einen Token-Teilbaum (nur Plain Objects/Arrays).
 *
 * @param {*} value - Zu kopierender Wert
 * @returns {*} Tiefe Kopie
 */
function cloneTokens(value) {
    if (Array.isArray(value)) return value.map(cloneTokens);
    if (value && typeof value === 'object') {
        const copy = {};
        for (const [key, entry] of Object.entries(value)) {
            copy[key] = cloneTokens(entry);
        }
        return copy;
    }
    return value;
}

/**
 * Mischt Varianten-Overrides über die Basis-Tokens, ohne die Basis zu mutieren.
 *
 * @param {object} base - Basis-Tokens der Ausrichtung
 * @param {object|null} [override=null] - Varianten-Overrides
 * @returns {object} Gemischte Tokens
 */
export function mergeTokens(base, override = null) {
    if (!override) return cloneTokens(base);

    const result = cloneTokens(base);
    for (const [key, value] of Object.entries(override)) {
        const baseValue = result[key];
        if (
            value && typeof value === 'object' && !Array.isArray(value)
            && baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)
        ) {
            result[key] = mergeTokens(baseValue, value);
        } else {
            result[key] = cloneTokens(value);
        }
    }
    return result;
}

/**
 * Liefert die aufgelösten Tokens eines Boards für die aktive Variante.
 *
 * @param {string} boardId - z. B. 'anschlusstafel'
 * @param {object} [options={}] - Auflösungsoptionen
 * @param {string|null} [options.variantId=null] - 'fhd_landscape' | 'fhd_portrait' | 'uhd_landscape' | 'uhd_portrait'
 * @param {number} [options.width=1920] - Logische Breite
 * @param {number} [options.height=1080] - Logische Höhe
 * @returns {object} Aufgelöste Tokens inkl. `variant` und absoluter `columns`
 */
export function getBoardTokens(boardId, { variantId = null, width = 1920, height = 1080 } = {}) {
    const variant = resolveBoardVariant(width, height, variantId);
    const cacheKey = `${boardId}|${variant.id}|${width}x${height}`;

    const cached = TOKEN_CACHE.get(cacheKey);
    if (cached) return cached;

    const definition = BOARD_TOKEN_SETS[boardId];
    if (!definition) {
        throw new Error(`[boardTokenService] Unbekanntes Board: ${boardId}`);
    }

    const merged = mergeTokens(definition[variant.orientation], definition.overrides?.[variant.id]);
    const tokens = {
        ...merged,
        variant,
        columns: resolveColumns(merged.columns, width)
    };

    if (TOKEN_CACHE.size >= TOKEN_CACHE_LIMIT) {
        const oldestKey = TOKEN_CACHE.keys().next().value;
        TOKEN_CACHE.delete(oldestKey);
    }
    TOKEN_CACHE.set(cacheKey, tokens);

    return tokens;
}