import { RisTextService } from './risTextService.js';
import { StationService } from '../../features/station/stationService.js';

export class IrisDataMapper {
    /**
     * Mappt das interne Map-Format in die Struktur für das ZIMSim-UI.
     * Filtert Züge heraus, deren Abfahrt/Ankunft zu weit in der Vergangenheit oder Zukunft liegt.
     * 
     * @param {Map} journeysMap Die Map mit den Rohdaten der Fahrplan-Fahrten
     * @param {string} eva Die Bahnhofs-ID
     * @param {Date} simulatedTime Die aktuelle simulierte Zeit
     * @param {number} futureWindowHours Das Vorhersagefenster in Stunden
     * @returns {Array} Array der gemappten Zug-Objekte
     */
    static mapToZimsimFormat(journeysMap, eva, simulatedTime, futureWindowHours = 2) {
        const results = [];
        const simTimeMs = simulatedTime ? simulatedTime.getTime() : Date.now();
        const pastThreshold = simTimeMs - (3 * 60 * 1000); // 3 Minuten in der Vergangenheit
        const futureThreshold = simTimeMs + (futureWindowHours * 60 * 60 * 1000); // X Stunden in der Zukunft

        for (const raw of journeysMap.values()) {
            if (raw.ar) {
                const mappedAr = this._mapSingleNode(raw, 'ar', pastThreshold, futureThreshold);
                if (mappedAr) results.push(mappedAr);
            }
            if (raw.dp) {
                const mappedDp = this._mapSingleNode(raw, 'dp', pastThreshold, futureThreshold);
                if (mappedDp) results.push(mappedDp);
            }
        }
        return results;
    }

    /**
     * Mappt einen spezifischen IRIS-Knoten (ar oder dp) in das ZIMSim Format.
     * @param {Object} raw Das rohe Zug-Objekt
     * @param {string} nodeType 'ar' oder 'dp'
     * @param {number} pastThreshold Timestamp Grenze Vergangenheit
     * @param {number} futureThreshold Timestamp Grenze Zukunft
     * @returns {Object|null} Gemapptes Objekt oder null, falls außerhalb des Fensters
     */
    static _mapSingleNode(raw, nodeType, pastThreshold, futureThreshold) {
        const isArrival = nodeType === 'ar';
        const primaryNode = isArrival ? raw.ar : raw.dp;
        if (!primaryNode) return null;
        
        let rtNode = isArrival ? raw.rt.ar : raw.rt.dp;
        
        // Fallback für Echtzeit-Daten: Wenn fchg unvollständige rt-Daten schickt,
        // kann bei dp einiges aus ar übernommen werden (z.B. Gleis), wenn vorhanden.
        if (!isArrival && raw.rt.ar) {
            if (!rtNode) {
                rtNode = raw.rt.ar;
            } else {
                if (!rtNode.cp && raw.rt.ar.cp) rtNode.cp = raw.rt.ar.cp;
                if (!rtNode.ct && raw.rt.ar.ct) rtNode.ct = raw.rt.ar.ct;
                if (!rtNode.pp && raw.rt.ar.pp) rtNode.pp = raw.rt.ar.pp;
                if (!rtNode.cs && raw.rt.ar.cs) rtNode.cs = raw.rt.ar.cs;
            }
        }

        const scheduledTime = this._parseIrisTime(primaryNode.pt);
        const expectedTime = (rtNode && rtNode.ct) ? this._parseIrisTime(rtNode.ct) : '';
        
        // Sliding Window Check
        const effectiveTimeStr = (rtNode && rtNode.ct) ? rtNode.ct : primaryNode.pt;
        const effectiveTimeMs = this._parseIrisDateTime(effectiveTimeStr);
        if (effectiveTimeMs) {
            if (effectiveTimeMs < pastThreshold || effectiveTimeMs > futureThreshold) {
                return null; // Außerhalb des Sichtbarkeitsfensters
            }
        }

        const delayReason = this._getDelayReason(raw.rt.messages);
        
        // Haltepunkte (Vias) anreichern
        const stops = primaryNode.ppth ? primaryNode.ppth.split('|').map((s, i) => {
            const stopData = { name: s, showAsVia: true, routeIndex: i, nameKurz: s };
            if (StationService.isLoaded) {
                const st = StationService.getStationByIdOrName(null, s);
                if (st) {
                    stopData.name = st.name;
                    stopData.nameKurz = st.nameKurz || st.name;
                }
            }
            return stopData;
        }) : [];

        // Ziel (bzw. Herkunft bei Ankünften) ermitteln
        let destName = primaryNode.pde || '';
        if (!destName && stops.length > 0) {
            if (isArrival) {
                destName = stops[0].name;
            } else {
                destName = stops[stops.length - 1].name;
            }
        }

        let destLang = destName;
        let destKurz = destName;
        if (destName && StationService.isLoaded) {
            const destSt = StationService.getStationByIdOrName(null, destName);
            if (destSt) {
                destName = destSt.name;
                destLang = destSt.name;
                destKurz = destSt.nameKurz || destSt.name;
            }
        }

        // Zugnamen formatieren
        let formattedName = `${raw.type || ''} ${raw.number || ''}`.trim();
        if (primaryNode.l) {
            let lineStr = primaryNode.l;
            // Add space between letters and numbers (e.g. 'RE6' -> 'RE 6')
            lineStr = lineStr.replace(/^([A-Za-z]+)(\d+)$/, '$1 $2');
            
            if (!lineStr.toUpperCase().includes((raw.type || '').toUpperCase()) && /^\d+$/.test(lineStr)) {
                lineStr = `${raw.type} ${lineStr}`.trim();
            }
            formattedName = `${lineStr} / ${raw.number}`;
        }

        // Gleislogik: Plan- und Echtzeitgleis ermitteln
        let planGleis = primaryNode.pp || '';
        if (!planGleis && !isArrival && raw.ar && raw.ar.pp) {
            planGleis = raw.ar.pp; // Fallback auf ar
        }
        if (!planGleis && rtNode && rtNode.pp) {
            planGleis = rtNode.pp; // Manchmal kommt das Plangleis erst im Echtzeit-Feed
        }

        let echtzeitGleis = (rtNode && rtNode.cp) ? rtNode.cp : '';

        if (!planGleis && echtzeitGleis) {
            planGleis = echtzeitGleis;
            echtzeitGleis = '';
        }
        
        if (planGleis === echtzeitGleis) {
            echtzeitGleis = '';
        }

        return {
            journeyId: raw.id,
            name: formattedName,
            produktGattung: raw.class,
            operator: raw.operator,
            destination: destName,
            destinationLang: destLang,
            destinationKurz: destKurz,
            scheduledTime: scheduledTime,
            expectedTime: expectedTime,
            platform: planGleis,
            ezGleis: echtzeitGleis,
            ausfall: (rtNode && rtNode.cs === 'c'),
            ankunft: isArrival,
            stops: stops,
            delayReason: delayReason,
            couplingGroupId: primaryNode.wings || null,
            _effectiveTimeMs: effectiveTimeMs // Für internen Gebrauch (Autoplay Ticker)
        };
    }

    /**
     * Parst den Iris Zeit-String (YYMMDDHHMM) in das Format "HH:mm".
     * @param {string} irisTimeStr 
     * @returns {string} Formatierte Uhrzeit
     */
    static _parseIrisTime(irisTimeStr) {
        if (!irisTimeStr || irisTimeStr.length !== 10) return '';
        const hh = irisTimeStr.slice(6, 8);
        const min = irisTimeStr.slice(8, 10);
        return `${hh}:${min}`;
    }

    /**
     * Parst den Iris Zeit-String in einen JS-Timestamp.
     * @param {string} irisTimeStr 
     * @returns {number|null} Timestamp in Millisekunden
     */
    static _parseIrisDateTime(irisTimeStr) {
        if (!irisTimeStr || irisTimeStr.length !== 10) return null;
        const yy = 2000 + parseInt(irisTimeStr.slice(0, 2), 10);
        const mm = parseInt(irisTimeStr.slice(2, 4), 10) - 1;
        const dd = parseInt(irisTimeStr.slice(4, 6), 10);
        const hh = parseInt(irisTimeStr.slice(6, 8), 10);
        const min = parseInt(irisTimeStr.slice(8, 10), 10);
        return new Date(yy, mm, dd, hh, min).getTime();
    }

    /**
     * Ermittelt den Verspätungsgrund anhand der übergebenen Message-Codes.
     * @param {Array<string>} messageCodes 
     * @returns {string} Der Text des Verspätungsgrunds
     */
    static _getDelayReason(messageCodes) {
        if (!messageCodes || messageCodes.length === 0) return '';
        if (!RisTextService.isLoaded) return '';
        
        for (const code of messageCodes) {
            const preset = RisTextService.presets.find(p => p.code === code);
            if (preset) return preset.text;
        }
        return '';
    }
}
