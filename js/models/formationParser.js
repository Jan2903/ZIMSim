// js/models/formationParser.js

export class FormationParser {
    /**
     * Parst Rohdaten (Web oder App API) und wendet Spiegelungs- und Fahrtrichtungslogik an.
     * @param {object} rawData 
     * @returns {object} Normalisiertes Objekt für den Formation-Konstruktor
     */
    static parse(rawData) {
        let isAppFormat = !!rawData.fahrzeuggruppen;
        
        let groups = [];
        let platform = null;
        let physicalDirectionRight = true; // Default

        if (isAppFormat) {
            // --- DB Navigator App Format ---
            groups = rawData.fahrzeuggruppen.map(g => {
                return {
                    name: g.bezeichnung || '',
                    transport: {
                        category: g.fahrtreferenz?.gattung || '',
                        destination: { name: g.fahrtreferenz?.ziel?.bezeichnung || '' },
                        number: g.fahrtreferenz?.fahrtnummer || 0,
                        type: g.fahrtreferenz?.typ || 'UNKNOWN',
                        line: g.fahrtreferenz?.linie || ''
                    },
                    vehicles: (g.fahrzeuge || []).map(v => {
                        // TODO: Kurze Ordnungsnummer extrahieren (falls aus zukünftigen API-Daten bekannt)
                        let coachNumber = ''; 
                        
                        return {
                            type: v.fahrzeugtyp ? {
                                category: v.fahrzeugtyp.fahrzeugkategorie,
                                constructionType: v.fahrzeugtyp.baureihe,
                                hasEconomyClass: v.fahrzeugtyp.zweiteKlasse,
                                hasFirstClass: v.fahrzeugtyp.ersteKlasse
                            } : {},
                            amenities: (v.ausstattungsmerkmale || []).map(a => ({ type: a.art, status: a.status })),
                            status: v.status,
                            orientation: v.orientierung,
                            coachNumber: coachNumber,
                            vehicleID: '', // App liefert oft keine UIC
                            platformPosition: v.positionAmGleis ? {
                                start: v.positionAmGleis.start?.position || 0,
                                end: v.positionAmGleis.ende?.position || 0,
                                sector: v.positionAmGleis.sektor || ''
                            } : null
                        };
                    })
                };
            });

            if (rawData.gleis) {
                platform = {
                    start: rawData.gleis.start?.position || 0,
                    end: rawData.gleis.ende?.position || 0,
                    name: rawData.gleis.bezeichnung || '',
                    sectors: (rawData.gleis.sektoren || []).map(s => ({
                        name: s.bezeichnung,
                        start: s.start?.position || 0,
                        end: s.ende?.position || 0,
                        cubePosition: s.gleisabschnittswuerfelPosition !== undefined ? s.gleisabschnittswuerfelPosition : null
                    }))
                };
            }

            if (rawData.fahrtrichtung) {
                physicalDirectionRight = (rawData.fahrtrichtung === 'RECHTS');
            } else {
                physicalDirectionRight = this.calculateDirection(groups);
            }

        } else {
            // --- bahn.de Web Format ---
            // rawData ist entweder direkt das groups array oder { groups: [], platform: {} }
            const root = Array.isArray(rawData) ? { groups: rawData } : rawData;
            
            groups = (root.groups || []).map(g => {
                return {
                    ...g,
                    vehicles: (g.vehicles || g.coaches || []).map(v => {
                        // TODO: Kurze Ordnungsnummer extrahieren (falls im vehicle-Objekt vorhanden)
                        // Bisherige Felder 1:1 übernehmen
                        return v;
                    })
                };
            });
            
            platform = root.platform || null;
            physicalDirectionRight = this.calculateDirection(groups);
        }

        // --- Geometrie & Spiegelung ---
        let needsMirroring = false;
        if (platform && platform.sectors && platform.sectors.length > 0) {
            // Sektor mit dem kleinsten Start-Wert finden
            const leftMostSector = platform.sectors.reduce((min, s) => s.start < min.start ? s : min, platform.sectors[0]);
            if (leftMostSector.name !== 'A') {
                needsMirroring = true;
            }
        }

        if (needsMirroring && platform) {
            const platLen = platform.end - platform.start;
            
            // Sektoren spiegeln
            platform.sectors = platform.sectors.map(s => {
                const newStart = platLen - s.end;
                const newEnd = platLen - s.start;
                const mirroredSector = { ...s, start: newStart, end: newEnd };
                if (s.cubePosition !== undefined && s.cubePosition !== null) {
                    mirroredSector.cubePosition = platLen - s.cubePosition;
                }
                return mirroredSector;
            });

            // Wagen spiegeln
            groups.forEach(g => {
                g.vehicles.forEach(v => {
                    if (v.platformPosition) {
                        const oldStart = v.platformPosition.start;
                        const oldEnd = v.platformPosition.end;
                        v.platformPosition.start = platLen - oldEnd;
                        v.platformPosition.end = platLen - oldStart;
                    }
                });
            });
        }

        // --- XOR UI Direction ---
        // Wenn Fahrt physisch nach rechts fährt (true) und NICHT gespiegelt wurde (false) -> UI Pfeil Rechts (true)
        // Wenn Fahrt nach rechts (true) und gespiegelt (true) -> UI Pfeil Links (false)
        const uiDirectionRight = physicalDirectionRight !== needsMirroring;

        return {
            groups: groups,
            platform: platform,
            uiDirection: uiDirectionRight ? 1 : 0
        };
    }

    /**
     * Errechnet die Fahrtrichtung anhand der Startpositionen der ersten beiden Wagen.
     * @param {Array} groups 
     * @returns {boolean} true = RECHTS, false = LINKS
     */
    static calculateDirection(groups) {
        if (!groups || groups.length === 0) return true;
        const firstGroup = groups[0];
        if (!firstGroup || !firstGroup.vehicles || firstGroup.vehicles.length < 2) return true;

        const firstCoach = firstGroup.vehicles[0];
        const secondCoach = firstGroup.vehicles[1];

        if (firstCoach.platformPosition && secondCoach.platformPosition) {
            // Wenn der erste Wagen (Spitze) eine größere Start-Position als der zweite hat,
            // zeigt die Zugspitze nach rechts.
            return firstCoach.platformPosition.start > secondCoach.platformPosition.start;
        }

        return true;
    }
}
