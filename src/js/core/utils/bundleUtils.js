// js/core/utils/bundleUtils.js

/**
 * Erzeugt einen standardisierten ZIMSim-Export-Container mit Metadaten.
 * 
 * @param {'zimsim-line-colors' | 'zimsim-formation-rules' | 'zimsim-custom-stations' | 'zimsim-full-backup' | string} type 
 * @param {Array | object} payload 
 * @param {object} [metadata={}] 
 * @returns {object} Der serialisierbare Export-Container
 */
export function createBundle(type, payload, metadata = {}) {
    const count = Array.isArray(payload) 
        ? payload.length 
        : (payload && typeof payload === 'object' ? Object.keys(payload).length : 0);

    return {
        $schema: 'https://zimsim.app/schemas/bundle-v1.json',
        zimsim: {
            type,
            version: 1,
            exportedAt: new Date().toISOString(),
            appVersion: '1.0.0',
            itemCount: count,
            ...metadata
        },
        payload
    };
}

/**
 * Parst und validiert einen importierten ZIMSim-Container.
 * Unterstützt rückwärtskompatibel auch unversionierte Roh-Arrays älterer Versionen.
 * 
 * @param {string | object} rawData - JSON-String oder bereits geparstes Objekt
 * @param {string} [expectedType] - Optionaler erwarteter Paket-Typ (z.B. 'zimsim-line-colors')
 * @returns {{ success: boolean, type: string, version: number, payload: any, error?: string, isLegacy?: boolean, metadata?: object }}
 */
export function parseBundle(rawData, expectedType = null) {
    let data;
    try {
        data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch (e) {
        return {
            success: false,
            type: 'unknown',
            version: 0,
            payload: null,
            error: 'Die Datei enthält kein gültiges JSON-Format: ' + (e?.message || e)
        };
    }

    if (!data) {
        return {
            success: false,
            type: 'unknown',
            version: 0,
            payload: null,
            error: 'Die Datei ist leer oder ungültig.'
        };
    }

    // 1. Neuer Standard-Container mit Metadaten (ZimSimEnvelope)
    if (data.zimsim && typeof data.zimsim === 'object' && data.payload !== undefined) {
        const bundleType = data.zimsim.type || 'unknown';
        const bundleVersion = data.zimsim.version || 1;

        // Erlaubt das Extrahieren von Sub-Regeln aus einem Voll-Backup in spezifischen Editoren
        if (expectedType && bundleType !== expectedType) {
            if (bundleType === 'zimsim-full-backup') {
                if (expectedType === 'zimsim-line-colors') {
                    if (Array.isArray(data.payload?.lineColorRules)) {
                        return {
                            success: true,
                            type: expectedType,
                            version: bundleVersion,
                            payload: data.payload.lineColorRules,
                            metadata: data.zimsim,
                            isLegacy: false
                        };
                    }
                    return {
                        success: false,
                        type: bundleType,
                        version: bundleVersion,
                        payload: null,
                        error: 'Das ausgewählte Szenario-Backup enthält keine Linienfarb-Regeln.'
                    };
                }

                if (expectedType === 'zimsim-formation-rules') {
                    if (Array.isArray(data.payload?.formationRules)) {
                        return {
                            success: true,
                            type: expectedType,
                            version: bundleVersion,
                            payload: data.payload.formationRules,
                            metadata: data.zimsim,
                            isLegacy: false
                        };
                    }
                    return {
                        success: false,
                        type: bundleType,
                        version: bundleVersion,
                        payload: null,
                        error: 'Das ausgewählte Szenario-Backup enthält keine Wagenreihungs-Regeln.'
                    };
                }
            }

            return {
                success: false,
                type: bundleType,
                version: bundleVersion,
                payload: data.payload,
                error: `Falscher Dateityp: Die Datei enthält '${bundleType}', für diesen Dialog wird jedoch '${expectedType}' benötigt.`
            };
        }

        return {
            success: true,
            type: bundleType,
            version: bundleVersion,
            payload: data.payload,
            metadata: data.zimsim,
            isLegacy: false
        };
    }

    // 2. Rückwärtskompatibilität: Unversioniertes Legacy-Array (z.B. [{ id: '...', ... }])
    if (Array.isArray(data)) {
        if (expectedType === 'zimsim-full-backup') {
            return {
                success: false,
                type: 'legacy-array',
                version: 0,
                payload: null,
                error: 'Die Datei enthält eine Regelliste (Array), aber kein gültiges Szenario-Backup.'
            };
        }

        return {
            success: true,
            type: expectedType || 'legacy-array',
            version: 0,
            payload: data,
            isLegacy: true
        };
    }

    // 3. Fallback für sonstiges valides JSON-Objekt (z.B. altes unversioniertes Szenario-Backup)
    if (typeof data === 'object') {
        if (expectedType && expectedType !== 'zimsim-full-backup') {
            if (expectedType === 'zimsim-line-colors' && Array.isArray(data.lineColorRules)) {
                return {
                    success: true,
                    type: expectedType,
                    version: 0,
                    payload: data.lineColorRules,
                    isLegacy: true
                };
            }
            if (expectedType === 'zimsim-formation-rules' && Array.isArray(data.formationRules)) {
                return {
                    success: true,
                    type: expectedType,
                    version: 0,
                    payload: data.formationRules,
                    isLegacy: true
                };
            }
            return {
                success: false,
                type: 'generic-object',
                version: 0,
                payload: data,
                error: `Falsches Datenformat: Für diesen Dialog wird eine Regelliste erwartet, aber ein Objekt übergeben.`
            };
        }

        return {
            success: true,
            type: expectedType || 'generic-object',
            version: 0,
            payload: data,
            isLegacy: true
        };
    }
}

/**
 * Führt zwei Regellisten intelligent zusammen (Merge-Algorithmus).
 * Bestehende Einträge mit gleichem Match-Kriterium werden aktualisiert,
 * neue Einträge werden mit einer kollisionsfreien UUID angefügt.
 * 
 * @template T
 * @param {T[]} existingList - Bisherige Regeln
 * @param {T[]} incomingList - Zu importierende Regeln
 * @param {(item: T) => string} [keySelector] - Funktion zur Identifikation von Duplikaten
 * @returns {T[]} Zusammengeführte Liste
 */
export function mergeRuleList(existingList, incomingList, keySelector = null) {
    if (!Array.isArray(incomingList)) return existingList || [];
    if (!Array.isArray(existingList) || existingList.length === 0) {
        return incomingList.map(item => ({
            ...item,
            id: item.id || crypto.randomUUID()
        }));
    }

    const defaultSelector = (item) => {
        if (!item) return '';
        // Bevorzuge ID, oder Suchmuster bei Linien/Wagenreihungen
        return item.id || item.pattern || item.linePattern || item.name || '';
    };

    const getKey = keySelector || defaultSelector;
    const result = [...existingList];
    const indexByKey = new Map();

    // Index der bestehenden Einträge aufbauen
    result.forEach((item, idx) => {
        const key = getKey(item);
        if (key) {
            indexByKey.set(key, idx);
        }
    });

    // Eingehende Einträge zusammenführen
    for (const incoming of incomingList) {
        if (!incoming) continue;
        const key = getKey(incoming);
        if (key && indexByKey.has(key)) {
            // Update existierender Eintrag
            const targetIdx = indexByKey.get(key);
            result[targetIdx] = {
                ...result[targetIdx],
                ...incoming,
                id: result[targetIdx].id || incoming.id || crypto.randomUUID()
            };
        } else {
            // Neuer Eintrag: Sicherstellen, dass die ID eindeutig ist
            const newItem = {
                ...incoming,
                id: incoming.id || crypto.randomUUID()
            };
            // Kollisionsprüfung für IDs
            if (result.some(r => r.id === newItem.id)) {
                newItem.id = crypto.randomUUID();
            }
            result.push(newItem);
            if (key) {
                indexByKey.set(key, result.length - 1);
            }
        }
    }

    return result;
}

/**
 * Löst einen sauberen Datei-Download im Browser aus.
 * 
 * @param {string | object} content - JSON-String oder Objekt
 * @param {string} filename - Dateiname für den Download
 */
export function downloadJsonFile(content, filename) {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
