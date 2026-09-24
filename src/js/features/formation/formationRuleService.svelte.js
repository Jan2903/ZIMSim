// js/features/formation/formationRuleService.svelte.js
import { FormationPresetService } from './formationPresetService.js';
import { getSimulatedTime } from '../../core/utils/config.js';

/**
 * @typedef {Object} FormationRule
 * @property {string} id - Eindeutige ID
 * @property {string} name - Bezeichnung der Regel (z.B. "RE 1 RRX Doppeltraktion")
 * @property {boolean} enabled - Ob die Regel aktiv ist
 * @property {string} presetId - ID des anzuwendenden Presets
 * @property {string} linePattern - Suchmuster für Zugname / Linie (z.B. "^RE\\s*1$", "S 3")
 * @property {'startsWith' | 'contains' | 'exact' | 'regex'} matchType - Art des Abgleichs
 * @property {string} [category] - Optionale Zuggattungs-Einschränkung (z.B. "ICE", "RE", "S")
 * @property {number | null} [trainNumberMin] - Optionale Mindestzugnummer
 * @property {number | null} [trainNumberMax] - Optionale Höchstzugnummer
 * @property {string} [destinationPattern] - Optionales Zielbahnhofsmuster
 * @property {boolean} [cadenceEnabled] - Takt-Filterung aktivieren
 * @property {number} [cadenceInterval=2] - Taktintervall in Stunden (z.B. 2 für alle 2 Stunden)
 * @property {number} [cadenceOffset=0] - Offset der Stunde: 0 = gerade Stunden, 1 = ungerade Stunden
 * @property {boolean} [timeRangeEnabled] - Zeitfenster aktivieren
 * @property {string} [timeRangeFrom='06:00'] - Zeitfenster Beginn (HH:MM)
 * @property {string} [timeRangeTo='09:00'] - Zeitfenster Ende (HH:MM)
 * @property {number[]} [daysOfWeek] - Erlaubte Wochentage (1=Mo..5=Fr, 6=Sa, 0=So; leer = täglich)
 * @property {number} [traction=1] - Traktionsfaktor (1 = Einzel, 2 = Doppel, 3 = Dreifach)
 * @property {boolean} [reverse=false] - Reihung umkehren
 * @property {boolean} [offsetWagons=true] - Wagennummern-Versatz für Folgeeinheiten
 * @property {boolean} [isDefault=false] - Ob es sich um eine Systemstandardregel handelt
 */

/**
 * Vordefinierte Standardregeln für gängige Zugkategorien.
 * @type {FormationRule[]}
 */
export const DEFAULT_FORMATION_RULES = [
    {
        id: 'default-ice-main',
        name: 'ICE Fernverkehr (Standard)',
        enabled: true,
        presetId: 'ice4_12',
        linePattern: '^ICE(?:\\s|\\d|$)',
        matchType: 'regex',
        category: 'ICE',
        trainNumberMin: null,
        trainNumberMax: null,
        destinationPattern: '',
        cadenceEnabled: false,
        cadenceInterval: 2,
        cadenceOffset: 0,
        timeRangeEnabled: false,
        timeRangeFrom: '06:00',
        timeRangeTo: '22:00',
        daysOfWeek: [],
        traction: 1,
        reverse: false,
        offsetWagons: true,
        isDefault: true
    },
    {
        id: 'default-re1-rrx',
        name: 'RE 1 (RRX Desiro HC Doppeltraktion)',
        enabled: true,
        presetId: 'desiro_hc_4',
        linePattern: '^RE\\s*1(?:\\s|$)',
        matchType: 'regex',
        category: 'RE',
        trainNumberMin: null,
        trainNumberMax: null,
        destinationPattern: '',
        cadenceEnabled: false,
        cadenceInterval: 2,
        cadenceOffset: 0,
        timeRangeEnabled: false,
        timeRangeFrom: '06:00',
        timeRangeTo: '22:00',
        daysOfWeek: [],
        traction: 2,
        reverse: false,
        offsetWagons: true,
        isDefault: true
    },
    {
        id: 'default-re-dosto',
        name: 'Regional-Express (Dosto 5 Wagen + Lok)',
        enabled: true,
        presetId: 're_dosto_5',
        linePattern: '^RE(?:\\s|\\d|$)',
        matchType: 'regex',
        category: 'RE',
        trainNumberMin: null,
        trainNumberMax: null,
        destinationPattern: '',
        cadenceEnabled: false,
        cadenceInterval: 2,
        cadenceOffset: 0,
        timeRangeEnabled: false,
        timeRangeFrom: '06:00',
        timeRangeTo: '22:00',
        daysOfWeek: [],
        traction: 1,
        reverse: false,
        offsetWagons: true,
        isDefault: true
    },
    {
        id: 'default-sbahn-vollzug',
        name: 'S-Bahn (BR 423 Vollzug)',
        enabled: true,
        presetId: 'sbahn_423_4',
        linePattern: '^S(?:\\s*\\d|\\s|$)',
        matchType: 'regex',
        category: 'S',
        trainNumberMin: null,
        trainNumberMax: null,
        destinationPattern: '',
        cadenceEnabled: false,
        cadenceInterval: 2,
        cadenceOffset: 0,
        timeRangeEnabled: false,
        timeRangeFrom: '06:00',
        timeRangeTo: '22:00',
        daysOfWeek: [],
        traction: 2,
        reverse: false,
        offsetWagons: false,
        isDefault: true
    }
];

const STORAGE_KEY = 'zimsim_formation_assignment_rules';
const STORAGE_AUTO_KEY = 'zimsim_formation_auto_assign_enabled';

/**
 * Zentraler reaktiver Svelte 5 Service für automatische Wagenreihungs-Zuweisungsregeln.
 */
class FormationRuleService {
    /** @type {FormationRule[]} */
    rules = $state([]);

    /** @type {boolean} Globaler Toggle für automatische Zuweisung */
    autoAssign = $state(true);

    /** @type {Map<string, RegExp>} Cache für kompilierte reguläre Ausdrücke */
    _regexCache = new Map();

    constructor() {
        this.loadSettings();
        this.loadRules();
    }

    /**
     * Lädt den globalen Auto-Assign-Toggle.
     */
    loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_AUTO_KEY);
            if (raw !== null) {
                this.autoAssign = raw === 'true';
            }
        } catch {
            this.autoAssign = true;
        }
    }

    /**
     * Speichert den globalen Auto-Assign-Toggle.
     * @param {boolean} val
     */
    setAutoAssign(val) {
        this.autoAssign = Boolean(val);
        try {
            localStorage.setItem(STORAGE_AUTO_KEY, String(this.autoAssign));
        } catch (e) {
            console.warn('[FormationRuleService] Fehler beim Speichern des Toggles:', e);
        }
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
            console.warn('[FormationRuleService] Fehler beim Laden der Regeln:', e);
        }
        this.rules = JSON.parse(JSON.stringify(DEFAULT_FORMATION_RULES));
    }

    /**
     * Speichert die Regeln im LocalStorage.
     */
    saveRules() {
        this._regexCache.clear();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.rules));
        } catch (e) {
            console.error('[FormationRuleService] Fehler beim Speichern der Regeln:', e);
        }
    }

    /**
     * Prüft, ob eine Journey einer bestimmten Regel entspricht.
     *
     * @param {import('../journey/journey.svelte.js').Journey} journey
     * @param {FormationRule} rule
     * @param {Date} [referenceDate] - Optionales Bezugsdatum (Standard: simulatedTime)
     * @returns {boolean} true bei Übereinstimmung
     */
    matchesRule(journey, rule, referenceDate = null) {
        if (!journey || !rule || !rule.enabled) return false;

        // 1. Zuggattungs-Filter (sofern spezifiziert)
        if (rule.category && rule.category.trim()) {
            const reqCat = rule.category.trim().toLowerCase();
            const jCat = (journey.produktGattung || '').trim().toLowerCase();
            if (jCat && jCat !== reqCat) {
                return false;
            }
        }

        // 2. Linien- / Namensmuster abgleichen
        const trainName = (journey.effectiveDisplayName || journey.name || '').trim();
        if (!this.matchesTextPattern(trainName, rule.linePattern, rule.matchType)) {
            return false;
        }

        // 3. Zugnummern-Bereich abgleichen (optional)
        if (rule.trainNumberMin !== null && rule.trainNumberMin !== undefined) {
            const num = this.extractTrainNumber(journey);
            if (num === null || num < rule.trainNumberMin) return false;
        }
        if (rule.trainNumberMax !== null && rule.trainNumberMax !== undefined) {
            const num = this.extractTrainNumber(journey);
            if (num === null || num > rule.trainNumberMax) return false;
        }

        // 4. Zielbahnhof abgleichen (optional)
        if (rule.destinationPattern && rule.destinationPattern.trim()) {
            const dest = (journey.effectiveDestination || journey.destination || '').trim();
            if (!dest.toLowerCase().includes(rule.destinationPattern.trim().toLowerCase())) {
                return false;
            }
        }

        // 5. Zeit- und Taktlogik
        const now = referenceDate || (typeof getSimulatedTime === 'function' ? getSimulatedTime() : new Date());
        const timeStr = journey.scheduledTime || journey.expectedTime || '';
        let hour = now.getHours();
        let minute = now.getMinutes();

        if (timeStr && timeStr.includes(':')) {
            const [h, m] = timeStr.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) {
                hour = h;
                minute = m;
            }
        }

        // 5a. Takt-Filter (z.B. alle 2 Stunden: gerade vs. ungerade)
        if (rule.cadenceEnabled) {
            const interval = Math.max(1, Number(rule.cadenceInterval) || 1);
            const offset = Math.max(0, Number(rule.cadenceOffset) || 0);
            if ((hour % interval) !== (offset % interval)) {
                return false;
            }
        }

        // 5b. Zeitfenster-Filter (z.B. HVZ 06:00 bis 09:00)
        if (rule.timeRangeEnabled && rule.timeRangeFrom && rule.timeRangeTo) {
            const currentHm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            const from = rule.timeRangeFrom;
            const to = rule.timeRangeTo;

            if (from <= to) {
                if (currentHm < from || currentHm > to) return false;
            } else {
                // Über Mitternacht (z.B. 22:00 bis 04:00)
                if (currentHm < from && currentHm > to) return false;
            }
        }

        // 5c. Wochentags-Filter (1=Mo..5=Fr, 6=Sa, 0=So)
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
            const currentDay = now.getDay();
            if (!rule.daysOfWeek.includes(currentDay)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Findet die erste zutreffende Regel für eine Journey (First-Match-Wins).
     * @param {import('../journey/journey.svelte.js').Journey} journey
     * @returns {FormationRule | null}
     */
    findMatchingRule(journey) {
        if (!journey) return null;
        for (const rule of this.rules) {
            if (this.matchesRule(journey, rule)) {
                return rule;
            }
        }
        return null;
    }

    /**
     * Wendet die zutreffende Regel auf eine Journey an.
     *
     * @param {import('../journey/journey.svelte.js').Journey} journey
     * @param {boolean} [overwriteExisting=false] - Ob eine bereits bestehende Wagenreihung überschrieben werden soll
     * @returns {boolean} true, wenn eine Regel gematcht und erfolgreich angewendet wurde
     */
    applyRulesToJourney(journey, overwriteExisting = false) {
        if (!journey) return false;

        // Wenn bereits Wagen existieren und nicht überschrieben werden soll -> abbrechen
        if (!overwriteExisting && journey.formation && !journey.formation.isEmpty) {
            return false;
        }

        const matchedRule = this.findMatchingRule(journey);
        if (!matchedRule) return false;

        const preset = FormationPresetService.getPresetById(matchedRule.presetId);
        if (!preset) return false;

        return FormationPresetService.applyPresetToJourney(journey, preset, {
            traction: matchedRule.traction || 1,
            reverse: Boolean(matchedRule.reverse),
            offsetWagons: matchedRule.offsetWagons !== false
        });
    }

    /**
     * Wendet die Regeln auf alle Fahrten eines JourneyStores an.
     * @param {import('../journey/journeyStore.svelte.js').JourneyStore} store
     * @param {boolean} [overwriteExisting=false]
     * @returns {number} Anzahl veränderter Fahrten
     */
    applyRulesToAllJourneys(store, overwriteExisting = false) {
        if (!store || !Array.isArray(store.journeys)) return 0;
        let count = 0;
        for (const j of store.journeys) {
            if (this.applyRulesToJourney(j, overwriteExisting)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Prüft Text gegen ein String- oder Regex-Muster.
     * @param {string} text
     * @param {string} pattern
     * @param {'startsWith' | 'contains' | 'exact' | 'regex'} matchType
     * @returns {boolean}
     */
    matchesTextPattern(text, pattern, matchType) {
        if (!pattern) return true;
        const pat = pattern.trim();
        const t = (text || '').trim();

        switch (matchType) {
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
     * Extrahiert die numerische Zugnummer aus dem Namen oder Objekt.
     * @param {import('../journey/journey.svelte.js').Journey} journey
     * @returns {number | null}
     */
    extractTrainNumber(journey) {
        if (!journey) return null;
        if (journey.trainNumber && !isNaN(Number(journey.trainNumber))) {
            return Number(journey.trainNumber);
        }
        const name = (journey.name || '').trim();
        const match = name.match(/(\d{2,6})/);
        return match ? Number(match[1]) : null;
    }

    /**
     * Fügt eine neue Regel am Anfang der Liste ein.
     * @param {Partial<FormationRule>} ruleData
     * @returns {FormationRule}
     */
    addRule(ruleData = {}) {
        const newRule = {
            id: crypto.randomUUID(),
            name: ruleData.name || 'Neue Wagenreihungs-Regel',
            enabled: true,
            presetId: ruleData.presetId || 'ice4_12',
            linePattern: ruleData.linePattern || 'RE',
            matchType: ruleData.matchType || 'startsWith',
            category: ruleData.category || '',
            trainNumberMin: ruleData.trainNumberMin ?? null,
            trainNumberMax: ruleData.trainNumberMax ?? null,
            destinationPattern: ruleData.destinationPattern || '',
            cadenceEnabled: Boolean(ruleData.cadenceEnabled),
            cadenceInterval: Number(ruleData.cadenceInterval) || 2,
            cadenceOffset: Number(ruleData.cadenceOffset) || 0,
            timeRangeEnabled: Boolean(ruleData.timeRangeEnabled),
            timeRangeFrom: ruleData.timeRangeFrom || '06:00',
            timeRangeTo: ruleData.timeRangeTo || '22:00',
            daysOfWeek: ruleData.daysOfWeek || [],
            traction: ruleData.traction || 1,
            reverse: Boolean(ruleData.reverse),
            offsetWagons: ruleData.offsetWagons !== false,
            isDefault: false
        };

        this.rules = [newRule, ...this.rules];
        this.saveRules();
        return newRule;
    }

    /**
     * Aktualisiert eine Regel anhand ihrer ID.
     * @param {string} id
     * @param {Partial<FormationRule>} updates
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
     * @param {string | FormationRule[]} jsonOrArray
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
            console.error('[FormationRuleService] Import fehlgeschlagen:', e);
        }
        return false;
    }

    /**
     * Setzt alle Regeln auf die Standardpresets zurück.
     */
    resetToDefaults() {
        this.rules = JSON.parse(JSON.stringify(DEFAULT_FORMATION_RULES));
        this.saveRules();
    }
}

export const formationRuleService = new FormationRuleService();
