// js/features/journey/services/lineColorService.svelte.js
import { COLORS } from '../../../displays/core/constants.js';

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

/**
 * Zentraler reaktiver Svelte 5 Service für Linienfarben und Badge-Formen.
 */
class LineColorService {
    /** @type {LineBadgeRule[]} */
    rules = $state([]);

    /** @type {Map<string, object>} Interner Cache für aufgelöste Styles (60 FPS Performance) */
    _resolveCache = new Map();

    /** @type {Map<string, RegExp>} Interner Cache für vorkompilierte Regex-Instanzen */
    _regexCache = new Map();

    constructor() {
        this.loadRules();
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
    resolveStyle(trainName = '', context = {}) {
        const name = (trainName || '').trim();
        const isInverted = Boolean(context.isAusfall || context.inverted);

        const cacheKey = `${name}|${isInverted}|${Boolean(context.isAusfall)}|${context.defaultBgColor || ''}|${context.defaultTextColor || ''}`;
        if (this._resolveCache.has(cacheKey)) {
            return this._resolveCache.get(cacheKey);
        }

        // 1. Suche nach passender Regel (First-Match-Wins)
        let matchedRule = null;
        for (const rule of this.rules) {
            if (this.matchesRule(name, rule)) {
                matchedRule = rule;
                break;
            }
        }

        let result;

        // 2. Regel anwenden falls gefunden
        if (matchedRule) {
            if (isInverted && matchedRule.hasInvertOverride) {
                const invShape = matchedRule.invertedShape || matchedRule.shape || 'rounded';
                const defaultInvBg = invShape === 'outline' ? 'transparent' : matchedRule.backgroundColor;
                result = {
                    backgroundColor: matchedRule.invertedBgColor !== undefined && matchedRule.invertedBgColor !== '' ? matchedRule.invertedBgColor : defaultInvBg,
                    textColor: matchedRule.invertedTextColor || matchedRule.textColor,
                    borderColor: matchedRule.invertedBorderColor || matchedRule.borderColor || 'transparent',
                    borderWidth: matchedRule.borderWidth || 2,
                    shape: invShape,
                    cornerRadius: matchedRule.cornerRadius || 6,
                    hasMatchedRule: true,
                    rule: matchedRule
                };
            } else if (context.isAusfall) {
                // Bei Ausfall im Zoom-Board: Kontrastfarbe sicherstellen
                result = {
                    backgroundColor: matchedRule.backgroundColor || '#e2e8f0',
                    textColor: matchedRule.textColor || COLORS.NAVY,
                    borderColor: matchedRule.borderColor || 'rgba(0, 0, 0, 0.18)',
                    borderWidth: matchedRule.borderWidth || 1,
                    shape: matchedRule.shape || 'rounded',
                    cornerRadius: matchedRule.cornerRadius || 6,
                    hasMatchedRule: true,
                    rule: matchedRule
                };
            } else {
                result = {
                    backgroundColor: matchedRule.backgroundColor,
                    textColor: matchedRule.textColor,
                    borderColor: matchedRule.borderColor || 'transparent',
                    borderWidth: matchedRule.borderWidth || 1,
                    shape: matchedRule.shape || 'rounded',
                    cornerRadius: matchedRule.cornerRadius || 6,
                    hasMatchedRule: true,
                    rule: matchedRule
                };
            }
        } else {
            // 3. Fallback-Verhalten (Standard ZIM)
            if (context.isAusfall) {
                result = {
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

                result = {
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

        this._resolveCache.set(cacheKey, result);
        return result;
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
