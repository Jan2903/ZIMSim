// js/features/journey/services/lineColorService.svelte.js
import { COLORS } from '../../../displays/core/constants.js';
import { journeyStore, trainDisplay } from '../../../core/state/stores.js';

/**
 * @typedef {Object} LineBadgeRule
 * @property {string} id - Eindeutige ID
 * @property {string} name - Bezeichnung der Regel (z.B. "Intercity", "Flixtrain")
 * @property {string} pattern - Suchmuster (z.B. "^IC(?:\\s|\\d|$)", "FLX", "RE 1")
 * @property {'startsWith' | 'contains' | 'exact' | 'regex'} matchType - Art des Abgleichs
 * @property {string} backgroundColor - Hintergrundfarbe (z.B. "#ffffff")
 * @property {string} textColor - Textfarbe (z.B. "#000080")
 * @property {string} [borderColor] - Optionale Rahmenfarbe
 * @property {number} [borderWidth] - Optionale Rahmenbreite
 * @property {'pill' | 'rounded' | 'rectangle' | 'outline'} shape - Form des Badges
 * @property {number} [cornerRadius] - Radius bei 'rounded' (Standard: 6)
 * @property {boolean} [hasInvertOverride] - Ob bei Invertierung/Ausfall abweichende Styles gelten
 * @property {string} [invertedBgColor] - Invertierte Hintergrundfarbe
 * @property {string} [invertedTextColor] - Invertierte Textfarbe
 * @property {string} [invertedBorderColor] - Invertierte Rahmenfarbe
 * @property {'pill' | 'rounded' | 'rectangle' | 'outline'} [invertedShape] - Invertierte Form
 * @property {boolean} [isDefault] - Ob es sich um eine System-Standardregel handelt
 */

/**
 * Vordefinierte Standard-Regeln nach offiziellen DB ZIM Vorgaben.
 * Farben nutzen standardisierte Hex-Codes für zuverlässige HTML5-Color-Picker Kompatibilität.
 * @type {LineBadgeRule[]}
 */
export const DEFAULT_LINE_RULES = [
    {
        id: 'default-ic',
        name: 'Intercity (IC)',
        pattern: '^IC(?:\\s|\\d|$)',
        matchType: 'regex',
        backgroundColor: '#ffffff',
        textColor: '#000080',
        shape: 'pill',
        cornerRadius: 15,
        hasInvertOverride: true,
        invertedBgColor: 'transparent',
        invertedTextColor: '#000080',
        invertedBorderColor: '#000080',
        invertedShape: 'outline',
        borderWidth: 4,
        isDefault: true
    },
    {
        id: 'default-ece',
        name: 'Eurocity Express (ECE)',
        pattern: '^ECE(?:\\s|\\d|$)',
        matchType: 'regex',
        backgroundColor: '#ffffff',
        textColor: '#000080',
        shape: 'pill',
        cornerRadius: 15,
        hasInvertOverride: true,
        invertedBgColor: 'transparent',
        invertedTextColor: '#000080',
        invertedBorderColor: '#000080',
        invertedShape: 'outline',
        borderWidth: 4,
        isDefault: true
    },
    {
        id: 'default-ec',
        name: 'Eurocity (EC)',
        pattern: '^EC(?:\\s|\\d|$)',
        matchType: 'regex',
        backgroundColor: '#ffffff',
        textColor: '#000080',
        shape: 'pill',
        cornerRadius: 15,
        hasInvertOverride: true,
        invertedBgColor: 'transparent',
        invertedTextColor: '#000080',
        invertedBorderColor: '#000080',
        invertedShape: 'outline',
        borderWidth: 4,
        isDefault: true
    },
    {
        id: 'default-flx',
        name: 'Flixtrain (FLX)',
        pattern: 'FLX',
        matchType: 'contains',
        backgroundColor: '#73d000',
        textColor: '#ffffff',
        shape: 'rounded',
        cornerRadius: 6,
        hasInvertOverride: false,
        isDefault: true
    },
    {
        id: 'default-sbahn',
        name: 'S-Bahn (S)',
        pattern: '^S(?:\\s*\\d|\\s|$)',
        matchType: 'regex',
        backgroundColor: '#15803d',
        textColor: '#ffffff',
        shape: 'pill',
        cornerRadius: 15,
        hasInvertOverride: false,
        isDefault: true
    }
];

const STORAGE_KEY = 'zimsim_line_badge_rules';
const AUTO_COLORS_ENABLED_KEY = 'zimsim_auto_line_colors_enabled';

/**
 * Zentraler reaktiver Svelte 5 Service für Linienfarben und Badge-Formen.
 */
class LineColorService {
    /** @type {LineBadgeRule[]} */
    rules = $state([]);

    /** @type {boolean} Ob automatische Linienfarben aus der Traewelling-Datenbank aktiv sind */
    autoColorsEnabled = $state(true);

    /** @type {boolean} Ob die Traewelling-Datenbank erfolgreich geladen wurde */
    isAutoColorsLoaded = $state(false);

    /** @type {object|null} Rohdaten aus line-colors.json */
    _autoData = null;

    /** @type {Map<string, object>} Interner Cache für aufgelöste Styles (60 FPS Performance) */
    _resolveCache = new Map();

    /** @type {Map<string, RegExp>} Interner Cache für vorkompilierte Regex-Instanzen */
    _regexCache = new Map();

    constructor() {
        this.loadRules();
        this.loadAutoColorsSettings();
        this.loadAutoColors();
    }

    /**
     * Lädt die Einstellung für automatische Linienfarben aus dem LocalStorage.
     */
    loadAutoColorsSettings() {
        try {
            const raw = localStorage.getItem(AUTO_COLORS_ENABLED_KEY);
            if (raw !== null) {
                this.autoColorsEnabled = raw === 'true';
            }
        } catch (e) {
            console.warn('[LineColorService] Fehler beim Laden der Auto-Farben-Einstellung:', e);
        }
    }

    /**
     * Aktiviert oder deaktiviert automatische Linienfarben.
     * @param {boolean} enabled
     */
    setAutoColorsEnabled(enabled) {
        this.autoColorsEnabled = Boolean(enabled);
        try {
            localStorage.setItem(AUTO_COLORS_ENABLED_KEY, String(this.autoColorsEnabled));
        } catch (e) {
            console.warn('[LineColorService] Fehler beim Speichern der Auto-Farben-Einstellung:', e);
        }
        this.clearCache();
        if (typeof trainDisplay !== 'undefined' && trainDisplay?.updateAll) {
            trainDisplay.updateAll();
        }
    }

    /**
     * Lädt die aufbereiteten Linienfarben aus public/data/line-colors.json (Non-Blocking).
     */
    async loadAutoColors() {
        if (this.isAutoColorsLoaded) return;
        try {
            const baseUrl = import.meta.env.BASE_URL || './';
            const url = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}data/line-colors.json`;
            const res = await fetch(url);
            if (res.ok) {
                this._autoData = await res.json();
                this.isAutoColorsLoaded = true;
                this.clearCache();
                if (typeof trainDisplay !== 'undefined' && trainDisplay?.updateAll) {
                    trainDisplay.updateAll();
                }
            }
        } catch (e) {
            console.warn('[LineColorService] Konnte line-colors.json nicht laden:', e);
        }
    }

    /**
     * Leert den internen Style- und Regex-Cache bei Regeländerungen.
     */
    clearCache() {
        this._resolveCache.clear();
        this._regexCache.clear();
    }

    /**
     * Lädt die Regeln aus dem LocalStorage oder initialisiert mit den Standard-Presets.
     * Führt eine sanfte Migration veralteter Default-Regeln durch.
     */
    loadRules() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Sanfte Migration: Veraltete fehlerhafte Standardregeln (z.B. contains: 'IC') heilen
                    this.rules = parsed.map(rule => {
                        if (rule.id === 'default-ic' && rule.matchType === 'contains' && rule.pattern === 'IC') {
                            return {
                                ...rule,
                                name: 'Intercity (IC)',
                                pattern: '^IC(?:\\s|\\d|$)',
                                matchType: 'regex',
                                textColor: '#000080',
                                invertedTextColor: '#000080',
                                invertedBorderColor: '#000080'
                            };
                        }
                        if (rule.id === 'default-ec' && rule.pattern === 'EC' && rule.matchType === 'startsWith') {
                            return {
                                ...rule,
                                pattern: '^EC(?:\\s|\\d|$)',
                                matchType: 'regex',
                                textColor: '#000080',
                                invertedTextColor: '#000080',
                                invertedBorderColor: '#000080'
                            };
                        }
                        if (rule.id === 'default-sbahn' && rule.pattern === 'S ') {
                            return {
                                ...rule,
                                pattern: '^S(?:\\s*\\d|\\s|$)',
                                matchType: 'regex'
                            };
                        }
                        return rule;
                    });
                    this.saveRules();
                    return;
                }
            }
        } catch (e) {
            console.warn('[LineColorService] Fehler beim Laden der Regeln:', e);
        }
        this.rules = JSON.parse(JSON.stringify(DEFAULT_LINE_RULES));
    }

    /**
     * Persistiert die aktuellen Regeln im LocalStorage und leert den Cache.
     */
    saveRules() {
        this.clearCache();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.rules));
        } catch (e) {
            console.error('[LineColorService] Fehler beim Speichern der Regeln:', e);
        }
    }

    /**
     * Konvertiert benannte Farben oder unvollständige Hex-Werte in einen validen 7-stelligen Hex-Code für HTML5 <input type="color">.
     * @param {string} color
     * @param {string} [fallback='#ffffff']
     * @returns {string}
     */
    toHexColor(color, fallback = '#ffffff') {
        if (!color || typeof color !== 'string') return fallback;
        const c = color.trim().toLowerCase();
        if (c === 'navy') return '#000080';
        if (c === 'white') return '#ffffff';
        if (c === 'black') return '#000000';
        if (c === 'transparent') return fallback;
        if (/^#[0-9a-f]{6}$/i.test(c)) return c;
        if (/^#[0-9a-f]{3}$/i.test(c)) {
            return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
        }
        return fallback;
    }

    /**
     * Berechnet den CSS-Border-Radius für ein Badge basierend auf Form und Höhe.
     * @param {'pill' | 'rounded' | 'rectangle' | 'outline' | string} shape
     * @param {number} [cornerRadius=6]
     * @param {number} [height=36]
     * @returns {string}
     */
    getCssBorderRadius(shape, cornerRadius = 6, height = 36) {
        if (shape === 'pill') return `${Math.round(height / 2)}px`;
        if (shape === 'rectangle') return '0px';
        return `${cornerRadius || 6}px`;
    }

    /**
     * Erzeugt einen fertigen CSS-Style-String für HTML/Svelte-Badges.
     * @param {object} badgeStyle - Vom Service aufgelöster Stil
     * @param {number} [height=26] - Bezugshöhe für gerundete Ecken
     * @returns {string}
     */
    getCssStyle(badgeStyle, height = 26) {
        if (!badgeStyle) return '';
        const bg = badgeStyle.shape === 'outline' ? 'transparent' : (badgeStyle.backgroundColor || 'transparent');
        const hasBorder = badgeStyle.shape === 'outline' || (badgeStyle.borderColor && badgeStyle.borderColor !== 'transparent');
        const borderColor = badgeStyle.borderColor || badgeStyle.textColor || 'rgba(255, 255, 255, 0.2)';
        const borderWidth = badgeStyle.borderWidth || (badgeStyle.shape === 'outline' ? 2 : 1);
        const border = hasBorder ? `${borderWidth}px solid ${borderColor}` : 'none';
        const radius = this.getCssBorderRadius(badgeStyle.shape, badgeStyle.cornerRadius, height);
        return `background-color: ${bg}; color: ${badgeStyle.textColor || '#ffffff'}; border: ${border}; border-radius: ${radius}; padding: 1px 7px;`;
    }

    /**
     * Löst das Style-Objekt für einen gegebenen Zugnamen/Linientext auf.
     * Nutzt internen Cache zur Schonung der Render-Performance bei 60 FPS.
     *
     * @param {string} trainName - Formatierter Zugname (z.B. "ICE 543", "IC 2441", "FLX 10", "RE 1")
     * @param {object} [context={}] - Kontext-Optionen
     * @param {boolean} [context.isAusfall=false] - Ob ein Ausfall (Zeilen-Inversion) vorliegt
     * @param {boolean} [context.inverted=false] - Ob Nebenmonitor-Invertierung aktiv ist
     * @param {boolean} [context.fullScreen=false] - Ob Hauptmonitor gezeichnet wird
     * @param {string} [context.defaultBgColor] - Fallback-Hintergrundfarbe
     * @param {string} [context.defaultTextColor] - Fallback-Textfarbe
     * @returns {{
     *   backgroundColor: string,
     *   textColor: string,
     *   borderColor: string,
     *   borderWidth: number,
     *   shape: 'pill' | 'rounded' | 'rectangle' | 'outline',
     *   cornerRadius: number,
     *   hasMatchedRule: boolean,
     *   rule: LineBadgeRule | null
     * }}
     */
    /**
     * Normalisiert eine Linienbezeichnung in Varianten mit und ohne Leerzeichen (z.B. "S 5" und "S5").
     * @private
     * @param {string} line
     * @returns {string[]}
     */
    _normalizeLineVariants(line) {
        const cleaned = (line || '').trim();
        if (!cleaned) return [];
        const variants = [cleaned];
        const m1 = cleaned.match(/^([A-Za-z]+)(\d+.*)$/);
        if (m1) {
            const spaced = `${m1[1]} ${m1[2]}`;
            if (!variants.includes(spaced)) variants.push(spaced);
        }
        const m2 = cleaned.match(/^([A-Za-z]+)\s+(\d+.*)$/);
        if (m2) {
            const unspaced = `${m2[1]}${m2[2]}`;
            if (!variants.includes(unspaced)) variants.push(unspaced);
        }
        return variants;
    }

    /**
     * Versucht, eine automatische Linienfarbe aus der Traewelling-Datenbank aufzulösen.
     * @param {string} trainName - Formatierter Zugname oder Linienname (z.B. "S 5 / 34533", "S5", "RE 70", "MEX 13")
     * @param {object} [context={}] - Kontext-Optionen inklusive operator und stationContext
     * @returns {{ bg: string, fg: string, shape: string, border?: string } | null}
     */
    getAutoColor(trainName, context = {}) {
        if (!this._autoData || !this.autoColorsEnabled) return null;

        const raw = (trainName || '').trim();
        if (!raw) return null;

        // Linienteil vor dem Schrägstrich nehmen (z.B. "S 5 / 34533" -> "S 5")
        const linePart = raw.split('/')[0].trim();
        const lineVariants = this._normalizeLineVariants(linePart);

        // 1. Betreiber-Ermittlung
        let op = (context.operator || '').trim();
        let matchedOp = null;

        // A. IRIS Alias Prüfung (EVU-Kürzel oder Zuggattung)
        if (op && this._autoData.irisAliases && this._autoData.irisAliases[op]) {
            matchedOp = this._autoData.irisAliases[op];
        } else if (op && this._autoData.operators && this._autoData.operators[op]) {
            matchedOp = op;
        }

        // B. Falls Betreiber noch unbekannt: Prüfe Präfix des Linientextes (z.B. "SBH 5", "ENO 83506")
        if (!matchedOp && this._autoData.irisAliases) {
            const prefixMatch = linePart.match(/^([A-Za-z]+)\b/);
            if (prefixMatch && this._autoData.irisAliases[prefixMatch[1]]) {
                matchedOp = this._autoData.irisAliases[prefixMatch[1]];
            }
        }

        // C. S-Bahn ohne expliziten Betreiber: Über DS100-Regionskürzel ermitteln
        const isSbahn = /^S\s*\d+/i.test(linePart);
        const ds100 = (context.stationContext?.ds100 || journeyStore?.stationContext?.ds100 || '').trim().toUpperCase();
        if (!matchedOp && isSbahn && ds100) {
            const prefix = ds100[0];
            if (this._autoData.sbahnNetworksByDs100Prefix && this._autoData.sbahnNetworksByDs100Prefix[prefix]) {
                matchedOp = this._autoData.sbahnNetworksByDs100Prefix[prefix];
            }
        }

        // 2. Suche im ermittelten Betreiber-Katalog
        if (matchedOp && this._autoData.operators && this._autoData.operators[matchedOp]) {
            const opCatalog = this._autoData.operators[matchedOp];
            for (const variant of lineVariants) {
                if (opCatalog[variant]) {
                    return opCatalog[variant];
                }
            }
        }

        // 3. Suche in uniqueLines (bundesweit eindeutige Linien wie MEX 13, RE 90 etc.)
        if (this._autoData.uniqueLines) {
            for (const variant of lineVariants) {
                if (this._autoData.uniqueLines[variant]) {
                    return this._autoData.uniqueLines[variant];
                }
            }
        }

        return null;
    }

    /**
     * Löst das Style-Objekt für einen gegebenen Zugnamen/Linientext auf.
     * Nutzt internen Cache zur Schonung der Render-Performance bei 60 FPS.
     *
     * @param {string} trainName - Formatierter Zugname (z.B. "ICE 543", "IC 2441", "FLX 10", "RE 1")
     * @param {object} [context={}] - Kontext-Optionen
     * @param {boolean} [context.isAusfall=false] - Ob ein Ausfall (Zeilen-Inversion) vorliegt
     * @param {boolean} [context.inverted=false] - Ob Nebenmonitor-Invertierung aktiv ist
     * @param {boolean} [context.fullScreen=false] - Ob Hauptmonitor gezeichnet wird
     * @param {string} [context.defaultBgColor] - Fallback-Hintergrundfarbe
     * @param {string} [context.defaultTextColor] - Fallback-Textfarbe
     * @param {string} [context.operator] - Optionaler Betreiber-Code (z.B. "TDHS", "W3", "ag")
     * @param {object} [context.stationContext] - Optionaler Stationskontext mit ds100
     * @returns {{
     *   backgroundColor: string,
     *   textColor: string,
     *   borderColor: string,
     *   borderWidth: number,
     *   shape: 'pill' | 'rounded' | 'rectangle' | 'outline',
     *   cornerRadius: number,
     *   hasMatchedRule: boolean,
     *   rule: LineBadgeRule | null
     * }}
     */
    resolveStyle(trainName = '', context = {}) {
        const name = (trainName || '').trim();
        const isInverted = Boolean(context.isAusfall || context.inverted);
        const opKey = context.operator || '';
        const dsKey = context.stationContext?.ds100 || journeyStore?.stationContext?.ds100 || '';

        const cacheKey = `${name}|${isInverted}|${Boolean(context.isAusfall)}|${opKey}|${dsKey}|${context.defaultBgColor || ''}|${context.defaultTextColor || ''}`;
        if (this._resolveCache.has(cacheKey)) {
            return this._resolveCache.get(cacheKey);
        }

        // 1. Suche nach passender Regel (Custom-Regeln haben Vorrang vor Automatik)
        let matchedCustomRule = null;
        let matchedDefaultRule = null;
        for (const rule of this.rules) {
            if (this.matchesRule(name, rule)) {
                if (rule.isDefault) {
                    if (!matchedDefaultRule) matchedDefaultRule = rule;
                } else {
                    matchedCustomRule = rule;
                    break;
                }
            }
        }

        let result;

        if (matchedCustomRule) {
            result = this._formatRuleResult(matchedCustomRule, context, isInverted);
        } else {
            // 2. Traewelling Auto-Linienfarben (z.B. S-Bahnen, MEX, FLX)
            const autoColor = this.getAutoColor(name, context);
            if (autoColor) {
                result = this._formatAutoColorResult(autoColor, context, isInverted);
            } else if (matchedDefaultRule) {
                // 3. System-Standardregeln (IC-Pille, FlixTrain, generischer S-Bahn-Fallback)
                result = this._formatRuleResult(matchedDefaultRule, context, isInverted);
            } else {
                // 4. Fallback-Verhalten (Standard ZIM)
                result = this._formatFallbackResult(context);
            }
        }

        this._resolveCache.set(cacheKey, result);
        return result;
    }

    /**
     * @private
     */
    _formatRuleResult(rule, context, isInverted) {
        if (isInverted && rule.hasInvertOverride) {
            const invShape = rule.invertedShape || rule.shape || 'rounded';
            const defaultInvBg = invShape === 'outline' ? 'transparent' : rule.backgroundColor;
            return {
                backgroundColor: rule.invertedBgColor !== undefined && rule.invertedBgColor !== '' ? rule.invertedBgColor : defaultInvBg,
                textColor: rule.invertedTextColor || rule.textColor,
                borderColor: rule.invertedBorderColor || rule.borderColor || 'transparent',
                borderWidth: rule.borderWidth || 2,
                shape: invShape,
                cornerRadius: rule.cornerRadius || 6,
                hasMatchedRule: true,
                rule
            };
        } else if (context.isAusfall) {
            return {
                backgroundColor: rule.backgroundColor || '#e2e8f0',
                textColor: rule.textColor || COLORS.NAVY,
                borderColor: rule.borderColor || 'rgba(0, 0, 0, 0.18)',
                borderWidth: rule.borderWidth || 1,
                shape: rule.shape || 'rounded',
                cornerRadius: rule.cornerRadius || 6,
                hasMatchedRule: true,
                rule
            };
        } else {
            return {
                backgroundColor: rule.backgroundColor,
                textColor: rule.textColor,
                borderColor: rule.borderColor || 'transparent',
                borderWidth: rule.borderWidth || 1,
                shape: rule.shape || 'rounded',
                cornerRadius: rule.cornerRadius || 6,
                hasMatchedRule: true,
                rule
            };
        }
    }

    /**
     * @private
     */
    _formatAutoColorResult(autoColor, context, isInverted) {
        const shape = autoColor.shape || 'rounded';
        const cornerRadius = shape === 'pill' ? 15 : (shape === 'rectangle' ? 0 : 6);
        const hasBorder = Boolean(autoColor.border && autoColor.border !== 'transparent');

        if (isInverted) {
            const invShape = shape === 'pill' ? 'pill' : 'outline';
            return {
                backgroundColor: invShape === 'outline' ? 'transparent' : autoColor.bg,
                textColor: autoColor.fg,
                borderColor: autoColor.border || autoColor.fg || 'transparent',
                borderWidth: hasBorder ? 2 : 1,
                shape: invShape,
                cornerRadius,
                hasMatchedRule: true,
                rule: null
            };
        } else if (context.isAusfall) {
            return {
                backgroundColor: '#e2e8f0',
                textColor: autoColor.bg || COLORS.NAVY,
                borderColor: 'rgba(0, 0, 0, 0.18)',
                borderWidth: 1,
                shape,
                cornerRadius,
                hasMatchedRule: true,
                rule: null
            };
        } else {
            return {
                backgroundColor: autoColor.bg,
                textColor: autoColor.fg,
                borderColor: autoColor.border || 'transparent',
                borderWidth: hasBorder ? 2 : 1,
                shape,
                cornerRadius,
                hasMatchedRule: true,
                rule: null
            };
        }
    }

    /**
     * @private
     */
    _formatFallbackResult(context) {
        if (context.isAusfall) {
            return {
                backgroundColor: '#e2e8f0',
                textColor: COLORS.NAVY,
                borderColor: 'rgba(0, 0, 0, 0.18)',
                borderWidth: 1,
                shape: 'rounded',
                cornerRadius: 6,
                hasMatchedRule: false,
                rule: null
            };
        } else {
            const fallbackBg = context.defaultBgColor || '#1f3d47';
            const fallbackText = context.defaultTextColor || COLORS.WHITE;

            return {
                backgroundColor: fallbackBg,
                textColor: fallbackText,
                borderColor: 'rgba(255, 255, 255, 0.18)',
                borderWidth: 1,
                shape: 'rounded',
                cornerRadius: 6,
                hasMatchedRule: false,
                rule: null
            };
        }
    }

    /**
     * Prüft, ob ein Text ein Regel-Muster erfüllt.
     * Nutzt Regex-Caching für optimale Ausführungsgeschwindigkeit.
     * @param {string} text 
     * @param {LineBadgeRule} rule 
     * @returns {boolean}
     */
    matchesRule(text, rule) {
        if (!text || !rule || !rule.pattern) return false;
        const pat = rule.pattern.trim();
        const t = text.trim();

        switch (rule.matchType) {
            case 'startsWith':
                return t.toLowerCase().startsWith(pat.toLowerCase());
            case 'contains':
                return t.toLowerCase().includes(pat.toLowerCase());
            case 'exact':
                return t.toLowerCase() === pat.toLowerCase();
            case 'regex':
                try {
                    let re = this._regexCache.get(pat);
                    if (!re) {
                        re = new RegExp(pat, 'i');
                        this._regexCache.set(pat, re);
                    }
                    return re.test(t);
                } catch {
                    return false;
                }
            default:
                return t.toLowerCase().startsWith(pat.toLowerCase());
        }
    }

    /**
     * Fügt eine neue Regel oben in die Liste ein.
     * @param {Partial<LineBadgeRule>} ruleData
     * @returns {LineBadgeRule}
     */
    addRule(ruleData = {}) {
        const newRule = {
            id: crypto.randomUUID(),
            name: ruleData.name || 'Neue Linien-Regel',
            pattern: ruleData.pattern || 'RE',
            matchType: ruleData.matchType || 'startsWith',
            backgroundColor: ruleData.backgroundColor || '#1e3a8a',
            textColor: ruleData.textColor || '#ffffff',
            borderColor: ruleData.borderColor || 'transparent',
            borderWidth: ruleData.borderWidth || 1,
            shape: ruleData.shape || 'rounded',
            cornerRadius: ruleData.cornerRadius || 6,
            hasInvertOverride: Boolean(ruleData.hasInvertOverride),
            invertedBgColor: ruleData.invertedBgColor || '',
            invertedTextColor: ruleData.invertedTextColor || '',
            invertedBorderColor: ruleData.invertedBorderColor || '',
            invertedShape: ruleData.invertedShape || 'rounded',
            isDefault: false
        };

        this.rules = [newRule, ...this.rules];
        this.saveRules();
        return newRule;
    }

    /**
     * Aktualisiert eine Regel anhand ihrer ID.
     * @param {string} id 
     * @param {Partial<LineBadgeRule>} updates 
     */
    updateRule(id, updates) {
        const idx = this.rules.findIndex(r => r.id === id);
        if (idx >= 0) {
            this.rules[idx] = { ...this.rules[idx], ...updates };
            this.saveRules();
        }
    }

    /**
     * Löscht eine Regel anhand ihrer ID.
     * @param {string} id 
     */
    deleteRule(id) {
        this.rules = this.rules.filter(r => r.id !== id);
        this.saveRules();
    }

    /**
     * Verschiebt eine Regel in der Prioritätsliste nach oben oder unten.
     * @param {string} id 
     * @param {'up' | 'down'} direction 
     */
    moveRule(id, direction) {
        const idx = this.rules.findIndex(r => r.id === id);
        if (idx < 0) return;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= this.rules.length) return;

        const newRules = [...this.rules];
        const [moved] = newRules.splice(idx, 1);
        newRules.splice(targetIdx, 0, moved);

        this.rules = newRules;
        this.saveRules();
    }

    /**
     * Exportiert alle Regeln als JSON-String.
     * @returns {string}
     */
    exportRules() {
        return JSON.stringify(this.rules, null, 2);
    }

    /**
     * Importiert Regeln aus einem JSON-String oder Array.
     * @param {string | LineBadgeRule[]} jsonOrArray 
     * @returns {boolean} true bei Erfolg
     */
    importRules(jsonOrArray) {
        try {
            const data = typeof jsonOrArray === 'string' ? JSON.parse(jsonOrArray) : jsonOrArray;
            if (Array.isArray(data) && data.length > 0) {
                this.rules = data.map(r => ({
                    ...r,
                    id: r.id || crypto.randomUUID()
                }));
                this.saveRules();
                return true;
            }
        } catch (e) {
            console.error('[LineColorService] Import fehlgeschlagen:', e);
        }
        return false;
    }

    /**
     * Setzt alle Regeln auf die DB-Standardpresets zurück.
     */
    resetToDefaults() {
        this.rules = JSON.parse(JSON.stringify(DEFAULT_LINE_RULES));
        this.saveRules();
    }
}

export const lineColorService = new LineColorService();
