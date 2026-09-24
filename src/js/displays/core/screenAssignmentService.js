// src/js/displays/core/screenAssignmentService.js

/**
 * @fileoverview Zustandslose Service-Klasse für die layout-spezifische
 * Zuordnung von Fahrten und Gruppen zu Bildschirmen/Slots.
 */
export class ScreenAssignmentService {
    /**
     * Baut die Zuweisungen für alle Monitore des aktuellen Layouts auf.
     * Layout-spezifische Regeln (z.B. Störungen auf den rotierenden Monitor)
     * werden hier zentral ermittelt.
     *
     * @param {object} params
     * @param {object} params.layout - Das aktuelle Display-Layout mit .screens und .boardType
     * @param {import('../../features/journey/journeyStore.svelte.js').JourneyStore} params.journeyStore - Der globale Journey-Store
     * @param {number} [params.activePageIndex=0] - Der aktuelle Rotations-Seitenindex
     * @returns {{ assignments: Map<string, object>, rotatingPages: Array<object>, activePageIndex: number }}
     */
    static buildScreenAssignments({ layout, journeyStore, activePageIndex = 0 }) {
        const assignments = new Map();
        const screens = layout?.screens || [];
        let rotatingPages = [];
        let nextActivePageIndex = activePageIndex;

        const hasAnkunft = screens.some(s => s.type === 'ankunft' || s.type === 'ankunft_portrait');
        const hasAbfahrt = screens.some(s => s.type === 'abfahrt' || s.type === 'abfahrt_portrait' || s.type === 'voranzeiger' || s.type === 'abfahrt_zoom');
        const hasWagenreihungPlan = screens.some(s => s.type === 'wagenreihung_plan');

        if (hasAnkunft) {
            this._assignAnkunft(assignments, screens, journeyStore);
        } else if (hasAbfahrt) {
            this._assignVoranzeiger(assignments, layout, journeyStore);
        } else if (hasWagenreihungPlan) {
            this._assignWagenreihungPlan(assignments, layout, journeyStore);
        } else {
            const rotResult = this._assignStandard(assignments, layout, journeyStore, activePageIndex);
            rotatingPages = rotResult.rotatingPages;
            nextActivePageIndex = rotResult.activePageIndex;
        }

        // Falls vitrine32 Screens im Layout vorhanden sind (z.B. Wagenstandsanzeiger-Kombi), diese mit JourneyGroups versorgen
        const vitrineScreens = screens.filter(s => s.type === 'vitrine32');
        if (vitrineScreens.length > 0) {
            const groups = this.getVisibleJourneyGroups(journeyStore, layout);
            vitrineScreens.forEach(screen => {
                assignments.set(screen.id, {
                    journeyGroups: groups.slice(0, 3),
                    zugID: 1,
                });
            });
        }

        return { assignments, rotatingPages, activePageIndex: nextActivePageIndex };
    }

    /**
     * Standard-Layout (2×32" Doppelmonitor, Einzelschirme oder 4K):
     * - Hauptmonitor: Erste normale Journey-Gruppe
     * - Nebenmonitor(e): Weitere normale Journey-Gruppen
     * - Nebenmonitor (rotierend): Gestörte Journeys (Vorrang), sonst nachfolgende Gruppen
     *
     * @param {Map<string, object>} assignments
     * @param {object} layout
     * @param {object} journeyStore
     * @param {number} activePageIndex
     * @returns {{ rotatingPages: Array<object>, activePageIndex: number }}
     */
    static _assignStandard(assignments, layout, journeyStore, activePageIndex) {
        const groups = this.getVisibleJourneyGroups(journeyStore, layout);

        // Trennung in normale und gestörte Gruppen
        const normal = groups.filter(g => !g[0].isDisrupted);
        const disrupted = groups.filter(g => g[0].isDisrupted);

        const screens = layout?.screens || [];
        const haupt = screens.find(s => s.type === 'haupt');
        const nebens = screens.filter(s => s.type === 'neben');
        const rotierend = screens.find(s => s.type === 'neben_rotierend');

        // Hauptmonitor
        if (haupt) {
            const hIndex = haupt.trainIndex !== undefined ? haupt.trainIndex : 0;
            assignments.set(haupt.id, {
                journeys: normal[hIndex] || [],
                zugID: hIndex + 1,
            });
        }

        // Feste Nebenmonitore
        nebens.forEach(neben => {
            const nIndex = neben.trainIndex !== undefined ? neben.trainIndex : 1;
            assignments.set(neben.id, {
                journeys: normal[nIndex] || [],
                zugID: nIndex + 1,
            });
        });

        // Nebenmonitor 2 (rotierend): Gestörte Journeys + normale ab normalStartIndex
        const rotatingPages = [];
        let nextPageIndex = activePageIndex;

        if (rotierend) {
            let normalStartIndex = 2;
            if (!haupt && nebens.length > 0) {
                const maxIndex = Math.max(...nebens.map(s => (s.trainIndex !== undefined ? s.trainIndex : 1)));
                normalStartIndex = maxIndex + 1;
            } else if (!haupt && nebens.length === 0) {
                normalStartIndex = 0;
            }

            const groupsToRotate = [...disrupted, ...normal.slice(normalStartIndex)];

            for (const group of groupsToRotate) {
                const primary = group[0];
                let visibleTexts = primary.infoTexts ? [...primary.infoTexts.filter(t => t.visible)] : [];

                // Bei Gleiswechsel sollen laut Anforderung KEINE Infotexte rotieren/angezeigt werden,
                // sondern dauerhaft die Vias (wie auf Display 2).
                if (primary.hasTrackChange) {
                    visibleTexts = [];
                }

                const isDisrupted = primary.isDisrupted;

                // Basis-Seite wird NUR bei "Verkehrt ab" (und nicht Ausfall/Infoscreen) vorangestellt.
                let hasBaseText = !primary.ausfall && !primary.infoscreen && primary.verkehrtAb !== '0';
                let infoTextPages = visibleTexts.length;
                let rotateInfos = false;

                if (isDisrupted && infoTextPages > 0) {
                    rotateInfos = true;
                } else if (!isDisrupted && primary.infoscreen && infoTextPages > 0) {
                    rotateInfos = true;
                }

                if (rotateInfos) {
                    if (hasBaseText) {
                        // Seite 1: Basis-Text (Verkehrt ab oder reguläre vias)
                        rotatingPages.push({
                            journeys: group,
                            infoText: null
                        });
                    }
                    // Seite 2 bis N: Die dynamischen Infotexte
                    for (let i = 0; i < infoTextPages; i++) {
                        rotatingPages.push({
                            journeys: group,
                            infoText: visibleTexts[i]
                        });
                    }
                } else {
                    // Keine Rotation von Infotexten: Fallback auf Standard-Darstellung (Vias)
                    rotatingPages.push({
                        journeys: group,
                        infoText: null
                    });
                }
            }

            let currentJourneys = [];
            if (rotatingPages.length > 0) {
                if (nextPageIndex >= rotatingPages.length) {
                    nextPageIndex = 0;
                }
                currentJourneys = rotatingPages[nextPageIndex].journeys;
            }

            const rotZugId = nebens.length > 0
                ? (Math.max(...nebens.map(s => (s.trainIndex !== undefined ? s.trainIndex : 1))) + 2)
                : (haupt ? 3 : 1);

            assignments.set(rotierend.id, {
                journeys: currentJourneys,
                zugID: rotZugId,
            });
        }

        return { rotatingPages, activePageIndex: nextPageIndex };
    }

    /**
     * Voranzeiger-Layout (Dynamische Abfahrtstafel):
     * Bildschirme vom Typ 'voranzeiger' erhalten alle sichtbaren Journeys für
     * dynamische Berechnung von Abfahrten, Störungsbox unten und Pagination.
     *
     * @param {Map<string, object>} assignments
     * @param {object} layout
     * @param {object} journeyStore
     */
    static _assignVoranzeiger(assignments, layout, journeyStore) {
        const groups = this.getVisibleJourneyGroups(journeyStore, layout);
        const allVisibleJourneys = journeyStore.journeys.filter(j => j.visible);

        for (const screen of (layout?.screens || [])) {
            if (screen.type === 'voranzeiger' || screen.type === 'abfahrt' || screen.type === 'abfahrt_portrait' || screen.type === 'abfahrt_zoom') {
                assignments.set(screen.id, {
                    journeys: allVisibleJourneys,
                    zugID: 1,
                });
            } else if (screen.type === 'vitrine32') {
                assignments.set(screen.id, {
                    journeyGroups: groups.slice(0, 3),
                    zugID: 1,
                });
            } else {
                const index = screen.trainIndex || 0;
                assignments.set(screen.id, {
                    journeys: groups[index] || [],
                    zugID: index + 1,
                });
            }
        }
    }

    /**
     * Ankunftstafel-Layout: Alle Monitore erhalten die gefilterten sichtbaren Ankünfte.
     *
     * @param {Map<string, object>} assignments
     * @param {Array<object>} screens
     * @param {object} journeyStore
     */
    static _assignAnkunft(assignments, screens, journeyStore) {
        const allVisibleJourneys = journeyStore.journeys.filter(j => j.visible);
        for (const screen of screens) {
            assignments.set(screen.id, {
                journeys: allVisibleJourneys,
                zugID: 1,
            });
        }
    }

    /**
     * Wagenreihungsplan-Layout: Bildschirme erhalten alle Journey-Gruppen.
     *
     * @param {Map<string, object>} assignments
     * @param {object} layout
     * @param {object} journeyStore
     */
    static _assignWagenreihungPlan(assignments, layout, journeyStore) {
        const groups = this.getVisibleJourneyGroups(journeyStore, layout);
        for (const screen of (layout?.screens || [])) {
            assignments.set(screen.id, {
                journeyGroups: groups,
                zugID: 1,
            });
        }
    }

    /**
     * Vitrinen-Layout (Wagenstandsanzeiger).
     *
     * @param {Map<string, object>} assignments
     * @param {object} layout
     * @param {object} journeyStore
     */
    static _assignVitrine(assignments, layout, journeyStore) {
        const groups = this.getVisibleJourneyGroups(journeyStore, layout);
        for (const screen of (layout?.screens || [])) {
            if (screen.type === 'vitrine32') {
                assignments.set(screen.id, {
                    journeyGroups: groups.slice(0, 3),
                    zugID: 1,
                });
            }
        }
    }

    /**
     * Generische Zuweisung für unbekannte Layouts: Slot-basiert via JourneyStore.
     *
     * @param {Map<string, object>} assignments
     * @param {object} layout
     * @param {object} journeyStore
     */
    static _assignGeneric(assignments, layout, journeyStore) {
        const options = { boardType: layout?.boardType || 'default' };
        for (const screen of (layout?.screens || [])) {
            let slot;
            if (screen.type === 'haupt') slot = 1;
            else if (screen.type === 'neben') slot = 2;
            else if (screen.type === 'neben_rotierend') slot = 3;
            else slot = (screen.trainIndex || 0) + 1;

            assignments.set(screen.id, {
                journeys: journeyStore.getJourneysForSlot(slot, options),
                zugID: slot,
            });
        }
    }

    /**
     * Gibt alle sichtbaren Journey-Gruppen zurück.
     * Gekoppelte Journeys werden als eine Gruppe zusammengefasst.
     *
     * @param {object} journeyStore
     * @param {object} layout
     * @returns {import('../../features/journey/journey.svelte.js').Journey[][]} Array von Journey-Gruppen
     */
    static getVisibleJourneyGroups(journeyStore, layout) {
        const options = { boardType: layout?.boardType || 'default' };
        return journeyStore.getVisibleJourneyGroups(options);
    }
}
