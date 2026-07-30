// js/models/formationParser.js

export class FormationParser {
    /**
     * Parst Rohdaten (Web oder App API) und wendet Spiegelungs- und Fahrtrichtungslogik an.
     * @param {object} rawData 
     * @returns {object} Normalisiertes Objekt für den Formation-Konstruktor
     */
    static parse(rawData) {
        const isAppFormat = !!rawData.fahrzeuggruppen;
        
        const parseResult = isAppFormat 
            ? this._parseAppFormat(rawData)
            : this._parseWebFormat(rawData);

        // Geometrie & Spiegelung
        const { needsMirroring, platform } = this._applyMirroring(parseResult.groups, parseResult.platform);
        
        // Sektoren alphabetisch sortieren und zu sections mappen
        if (platform && platform.sectors) {
            platform.sectors.sort((a, b) => a.name.localeCompare(b.name));
            
            platform.sections = platform.sectors.map(s => ({
                name: s.name,
                startMeter: s.start,
                endMeter: s.end,
                cubePosition: s.cubePosition
            }));
            platform.length = platform.end - platform.start;
            delete platform.sectors;
        }

        // XOR UI Direction
        const uiDirectionRight = this._calculateUIDirection(parseResult.physicalDirectionRight, needsMirroring);

        this._ensureLeftToRightOrder(parseResult.groups);

        return {
            groups: parseResult.groups,
            platform: platform,
            uiDirection: uiDirectionRight ? 1 : 0
        };
    }

    /**
     * Parst die Daten im DB Navigator App Format.
     */
    static _parseAppFormat(rawData) {
        let groups = rawData.fahrzeuggruppen.map(g => this._mapAppGroup(g));
        let platform = null;

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

        let physicalDirectionRight = true;
        if (rawData.fahrtrichtung) {
            physicalDirectionRight = (rawData.fahrtrichtung === 'RECHTS');
        } else {
            physicalDirectionRight = this._calculateDirection(groups);
        }

        return { groups, platform, physicalDirectionRight };
    }

    /**
     * Mappt eine Fahrzeuggruppe (App Format)
     */
    static _mapAppGroup(g) {
        return {
            name: g.bezeichnung || '',
            transport: {
                category: g.fahrtreferenz?.gattung || '',
                destination: { name: g.fahrtreferenz?.ziel?.bezeichnung || '' },
                number: g.fahrtreferenz?.fahrtnummer || 0,
                type: g.fahrtreferenz?.typ || 'UNKNOWN',
                line: g.fahrtreferenz?.linie || ''
            },
            vehicles: (g.fahrzeuge || []).map(v => this._mapAppVehicle(v))
        };
    }

    /**
     * Mappt ein einzelnes Fahrzeug (App Format)
     */
    static _mapAppVehicle(v) {
        // Ordnungsnummer extrahieren (als Number, Fallback null)
        let wagonIdentificationNumber = v.ordnungsnummer != null ? Number(v.ordnungsnummer) : null;
        
        return {
            type: v.fahrzeugtyp ? {
                category: v.fahrzeugtyp.fahrzeugkategorie,
                constructionType: v.fahrzeugtyp.baureihe,
                hasEconomyClass: v.fahrzeugtyp.zweiteKlasse,
                hasFirstClass: v.fahrzeugtyp.ersteKlasse
            } : {},
            amenities: (v.ausstattungsmerkmale || []).map(a => ({ type: a.art, status: a.status })),
            status: v.status,

            wagonIdentificationNumber: wagonIdentificationNumber,
            vehicleID: '', // App liefert oft keine UIC
            platformPosition: v.positionAmGleis ? {
                start: v.positionAmGleis.start?.position || 0,
                end: v.positionAmGleis.ende?.position || 0,
                sector: v.positionAmGleis.sektor || ''
            } : null
        };
    }

    /**
     * Parst die Daten im bahn.de Web Format.
     */
    static _parseWebFormat(rawData) {
        const root = Array.isArray(rawData) ? { groups: rawData } : rawData;
        
        let groups = (root.groups || []).map(g => this._mapWebGroup(g));
        
        let platform = root.platform || null;
        let physicalDirectionRight = this._calculateDirection(groups);

        return { groups, platform, physicalDirectionRight };
    }

    /**
     * Mappt eine Fahrzeuggruppe (Web Format)
     */
    static _mapWebGroup(g) {
        return {
            ...g,
            vehicles: (g.vehicles || g.coaches || []).map(v => this._mapWebVehicle(v))
        };
    }

    /**
     * Mappt ein einzelnes Fahrzeug (Web Format)
     */
    static _mapWebVehicle(v) {
        // wagonIdentificationNumber sicherstellen (als Number)
        let wagonIdentificationNumber = v.wagonIdentificationNumber != null ? Number(v.wagonIdentificationNumber) : null;
        return { ...v, wagonIdentificationNumber };
    }

    /**
     * Prüft, ob der linkeste Sektor nicht 'A' ist und spiegelt in diesem Fall
     * alle Geometriedaten der Wagen und des Bahnsteigs.
     */
    static _applyMirroring(groups, platform) {
        let needsMirroring = false;

        if (platform && platform.sectors && platform.sectors.length > 0) {
            // Sektor mit dem kleinsten Start-Wert finden
            const leftMostSector = platform.sectors.reduce((min, s) => s.start < min.start ? s : min, platform.sectors[0]);
            
            // Konvention: Wenn der linkeste Sektor nicht 'A' ist, wird das Array visuell von rechts nach links gelesen 
            // (z.B. F E D C B A). In unserer Darstellung spiegeln wir dies, sodass A immer rechts ist (bzw umgekehrt).
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

        return { needsMirroring, platform };
    }

    /**
     * Errechnet die finale UI Fahrtrichtung basierend auf physischer Richtung und Spiegelung (XOR).
     */
    static _calculateUIDirection(physicalDirectionRight, needsMirroring) {
        // Wenn Fahrt physisch nach rechts fährt (true) und NICHT gespiegelt wurde (false) -> UI Pfeil Rechts (true)
        // Wenn Fahrt nach rechts (true) und gespiegelt (true) -> UI Pfeil Links (false)
        return physicalDirectionRight !== needsMirroring;
    }

    /**
     * Stellt sicher, dass das Array von Wagen (und Gruppen) strikt von links nach rechts geordnet ist.
     * Dies ist notwendig für den Renderer, der sich blind auf eine aufsteigende Array-Reihenfolge verlässt.
     */
    static _ensureLeftToRightOrder(groups) {
        if (!groups) return;

        groups.forEach(g => {
            if (!g.vehicles || g.vehicles.length < 2) return;
            
            // Finde den ersten und letzten Wagen, die eine platformPosition haben
            const firstWithPos = g.vehicles.find(v => v.platformPosition);
            const lastWithPos = g.vehicles.slice().reverse().find(v => v.platformPosition);
            
            if (firstWithPos && lastWithPos && firstWithPos !== lastWithPos) {
                if (firstWithPos.platformPosition.start > lastWithPos.platformPosition.start) {
                    // Array ist absteigend sortiert (von rechts nach links). Wir drehen es um!
                    g.vehicles.reverse();
                }
            }
        });
        
        // Jetzt Gruppen-Reihenfolge prüfen
        if (groups.length > 1) {
            const firstGroupPos = groups[0].vehicles.find(v => v.platformPosition);
            const lastGroupPos = groups[groups.length - 1].vehicles.find(v => v.platformPosition);
            
            if (firstGroupPos && lastGroupPos) {
                if (firstGroupPos.platformPosition.start > lastGroupPos.platformPosition.start) {
                    groups.reverse();
                }
            }
        }
    }

    /**
     * Errechnet die Fahrtrichtung anhand der Startpositionen der ersten beiden Wagen.
     * @param {Array} groups 
     * @returns {boolean} true = RECHTS, false = LINKS
     */
    static _calculateDirection(groups) {
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
