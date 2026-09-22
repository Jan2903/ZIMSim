// js/features/journey/services/lineColorService.svelte.js
import { COLORS } from '../../../displays/core/constants.js';

/**
 * @typedef {Object} LineBadgeRule
 * @property {string} id - Eindeutige ID
 * @property {string} name - Bezeichnung der Regel (z.B. "Intercity", "Flixtrain")
 * @property {string} pattern - Suchmuster (z.B. "IC", "FLX", "S ", "RE 1")
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
 * @type {LineBadgeRule[]}
 */
export const DEFAULT_LINE_RULES = [
    {
        id: 'default-ic',
        name: 'Intercity / Eurocity (IC/EC/ECE)',
        pattern: 'IC',
        matchType: 'contains',
        backgroundColor: '#ffffff',
        textColor: COLORS.NAVY,
        shape: 'pill',
        cornerRadius: 15,
        hasInvertOverride: true,
        invertedBgColor: 'transparent',
        invertedTextColor: COLORS.NAVY,
        invertedBorderColor: COLORS.NAVY,
        invertedShape: 'outline',
        borderWidth: 4,
        isDefault: true
    },
    {
        id: 'default-ec',
        name: 'Eurocity (EC)',
        pattern: 'EC',
        matchType: 'startsWith',
        backgroundColor: '#ffffff',
        textColor: COLORS.NAVY,
        shape: 'pill',
        cornerRadius: 15,
        hasInvertOverride: true,
        invertedBgColor: 'transparent',
        invertedTextColor: COLORS.NAVY,
        invertedBorderColor: COLORS.NAVY,
        invertedShape: 'outline',
        borderWidth: 4,
        isDefault: true
    },
    {
        id: 'default-ece',
        name: 'Eurocity Express (ECE)',
        pattern: 'ECE',
        matchType: 'startsWith',
        backgroundColor: '#ffffff',
        textColor: COLORS.NAVY,
        shape: 'pill',
        cornerRadius: 15,
        hasInvertOverride: true,
        invertedBgColor: 'transparent',
        invertedTextColor: COLORS.NAVY,
        invertedBorderColor: COLORS.NAVY,
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
        pattern: 'S ',
        matchType: 'startsWith',
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

    constructor() {
        this.loadRules();
    }

    /**
     * Lädt die Regeln aus dem LocalStorage oder initialisiert mit den Standard-Presets.
     */
    loadRules() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.rules = parsed;
                    return;
                }
            }
        } catch (e) {
            console.warn('[LineColorService] Fehler beim Laden der Regeln:', e);
        }
        this.rules = JSON.parse(JSON.stringify(DEFAULT_LINE_RULES));
    }

    /**
     * Persistiert die aktuellen Regeln im LocalStorage.
     */
    saveRules() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.rules));
        } catch (e) {
            console.error('[LineColorService] Fehler beim Speichern der Regeln:', e);
        }
    }

    /**
     * Löst das Style-Objekt für einen gegebenen Zugnamen/Linientext auf.
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
     *   cornerRadius: number
     * }}
     */
    resolveStyle(trainName = '', context = {}) {
        const name = (trainName || '').trim();
        const isInverted = Boolean(context.isAusfall || context.inverted);

        // 1. Suche nach passender Regel (First-Match-Wins)
        let matchedRule = null;
        for (const rule of this.rules) {
            if (this.matchesRule(name, rule)) {
                matchedRule = rule;
                break;
            }
        }

        // 2. Regel anwenden falls gefunden
        if (matchedRule) {
            if (isInverted && matchedRule.hasInvertOverride) {
                const invShape = matchedRule.invertedShape || matchedRule.shape || 'rounded';
                const defaultInvBg = invShape === 'outline' ? 'transparent' : matchedRule.backgroundColor;
                return {
                    backgroundColor: matchedRule.invertedBgColor !== undefined && matchedRule.invertedBgColor !== '' ? matchedRule.invertedBgColor : defaultInvBg,
                    textColor: matchedRule.invertedTextColor || matchedRule.textColor,
                    borderColor: matchedRule.invertedBorderColor || matchedRule.borderColor || 'transparent',
                    borderWidth: matchedRule.borderWidth || 2,
                    shape: invShape,
                    cornerRadius: matchedRule.cornerRadius || 6,
                    hasMatchedRule: true,
                    rule: matchedRule
                };
            }

            // Wenn Zeile komplett weiß invertiert ist (Ausfall) und keine Invert-Regel vorliegt:
            if (context.isAusfall) {
                // Bei Ausfall im Zoom-Board: Kontrastfarbe sicherstellen
                return {
                    backgroundColor: matchedRule.backgroundColor || '#e2e8f0',
                    textColor: matchedRule.textColor || COLORS.NAVY,
                    borderColor: matchedRule.borderColor || 'rgba(0, 0, 0, 0.18)',
                    borderWidth: matchedRule.borderWidth || 1,
                    shape: matchedRule.shape || 'rounded',
                    cornerRadius: matchedRule.cornerRadius || 6,
                    hasMatchedRule: true,
                    rule: matchedRule
                };
            }

            return {
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

        // 3. Fallback-Verhalten (Standard ZIM)
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
        }

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

    /**
     * Prüft, ob ein Text ein Regel-Muster erfüllt.
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
                    const re = new RegExp(pat, 'i');
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
