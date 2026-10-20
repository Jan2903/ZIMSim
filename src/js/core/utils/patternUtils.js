// src/js/core/utils/patternUtils.js

/**
 * Bereits gemeldete Muster - verhindert eine Warnungs-Flut, da das Matching
 * bei 60 FPS mehrfach pro Sekunde mit demselben Muster läuft.
 * @type {Set<string>}
 */
const _warnedPatterns = new Set();

/**
 * Prüft einen Text gegen ein String- oder Regex-Muster.
 * Gemeinsame Implementierung für Linien-Badge-Regeln (lineColorService)
 * und Wagenreihungs-Regeln (formationRuleService).
 *
 * Hinweis zur Semantik bei leerem Muster: Die Aufrufer entscheiden selbst,
 * ob ein leeres Muster als Treffer gilt (Formation: true) oder nicht (Linien: false).
 *
 * @param {string} text - Der zu prüfende Text
 * @param {string} pattern - Das Suchmuster (z.B. "^IC(?:\\s|\\d|$)")
 * @param {'startsWith' | 'contains' | 'exact' | 'regex'} matchType - Art des Abgleichs
 * @param {Map<string, RegExp>} [regexCache=null] - Optionaler Cache für vorkompilierte Regex-Instanzen
 * @returns {boolean} true, wenn der Text auf das Muster passt
 */
export function matchesTextPattern(text, pattern, matchType, regexCache = null) {
    if (!pattern) return false;

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
                let re = regexCache ? regexCache.get(pat) : null;
                if (!re) {
                    re = new RegExp(pat, 'i');
                    if (regexCache) regexCache.set(pat, re);
                }
                return re.test(t);
            } catch (e) {
                // Ungültiges Muster trifft auf keinen Text - einmalig melden statt still zu scheitern
                if (!_warnedPatterns.has(pat)) {
                    _warnedPatterns.add(pat);
                    console.warn(`[patternUtils] Ungültiger regulärer Ausdruck '${pat}' - die Regel passt auf keinen Text:`, e);
                }
                return false;
            }
        default:
            return t.toLowerCase().startsWith(pat.toLowerCase());
    }
}

/**
 * Prüft, ob ein Muster der angegebenen Abgleichsart technisch verwendbar ist.
 * @param {string} pattern - Das Suchmuster
 * @param {'startsWith' | 'contains' | 'exact' | 'regex'} matchType - Art des Abgleichs
 * @returns {boolean} true, wenn das Muster gültig ist
 */
export function isValidPattern(pattern, matchType) {
    if (!pattern || !pattern.trim()) return false;
    if (matchType !== 'regex') return true;
    try {
        new RegExp(pattern.trim(), 'i');
        return true;
    } catch {
        return false;
    }
}
