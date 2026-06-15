// js/displays/trainDisplay.js
// Orchestrator — delegiert an spezialisierte Renderer-Module
import { config } from '../utils/config.js';
import { LAYOUTS } from './layouts.js';
import { COLORS } from './constants.js';
import { ScrollManager } from './scrollManager.js';
import { drawFormation } from './formationRenderer.js';
import { drawTrainInfo } from './trainInfoRenderer.js';
import { drawListeRow } from './listeRenderer.js';

export class TrainDisplay {
    constructor(journeyStore) {
        this.journeyStore = journeyStore;
        this.activeFeature = 'wagennummern'; // 'wagennummern', 'ausstattung', 'klasse'
        this.features = ['wagennummern', 'ausstattung', 'klasse'];
        this.rotationIndex = 0;
        this.rotating = false;
        this.scrollManager = new ScrollManager();
        this.currentLayout = LAYOUTS.standard;
        this._isRendering = false; // Re-entrance Guard
    }

    // ==========================================
    // Canvas-Verwaltung
    // ==========================================

    /**
     * Richtet den Canvas-Kontext für einen bestimmten Monitor-Bereich ein
     * (Clipping, Translation) und ruft die Zeichenfunktion auf.
     */
    drawOnScreen(screen, drawFunction) {
        this.currentScreen = screen;
        const canvas = document.getElementById('zimCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!screen) return;

        ctx.save();
        ctx.clearRect(screen.x, screen.y, screen.w, screen.h);

        // Bereich des Monitors mit der Standard-Canvas-Farbe (navy) füllen,
        // damit das Hintergrundbild nur außerhalb der Displays sichtbar bleibt
        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.fillRect(screen.x, screen.y, screen.w, screen.h);

        ctx.translate(screen.x, screen.y);
        ctx.beginPath();
        ctx.rect(0, 0, screen.w, screen.h);
        ctx.clip();
        drawFunction(ctx, screen.w, screen.h);
        ctx.restore();
    }

    /**
     * Zeichnet das Hintergrundbild (z.B. die Hardware-Einfassung) auf das gesamte Canvas.
     */
    drawFullBackground() {
        if (!this.ctx || !this.currentLayout) return;
        const canvas = this.ctx.canvas;

        if (this.currentLayout.backgroundUrl) {
            if (!this.currentLayout.bgImageObj) {
                const img = new Image();
                img.src = this.currentLayout.backgroundUrl;
                img.onload = () => {
                    this.currentLayout.bgImageLoaded = true;
                    // Verzögerter Re-Render statt sofortigem rekursiven Aufruf
                    requestAnimationFrame(() => this.updateAll());
                };
                img.onerror = () => {
                    this.currentLayout.bgImageBroken = true;
                };
                this.currentLayout.bgImageObj = img;
            }

            if (this.currentLayout.bgImageLoaded) {
                this.ctx.drawImage(this.currentLayout.bgImageObj, 0, 0, canvas.width, canvas.height);
            } else {
                this.ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        } else {
            this.ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    // ==========================================
    // Layout & Feature-Steuerung
    // ==========================================

    /**
     * Wechselt das Layout (z.B. Standard ↔ Voranzeiger).
     */
    switchLayout(layoutName) {
        if (!LAYOUTS[layoutName]) return;

        this.currentLayout = LAYOUTS[layoutName];

        // Canvas-Größe anpassen
        const canvas = document.getElementById('zimCanvas');
        if (canvas) {
            canvas.width = this.currentLayout.width;
            canvas.height = this.currentLayout.height;
        }

        // Alte Scrolling-Divs aufräumen
        this.scrollManager.clearAll();

        this.updateAll();

        // Skalierung neu triggern, damit sich die Anzeige visuell anpasst
        window.dispatchEvent(new Event('resize'));
    }

    /**
     * Reagiert auf Feature-Radio-Button-Änderungen.
     * @param {string} value - 'rotierend', 'wagennummern', 'ausstattung' oder 'klasse'.
     */
    onFeatureButtonChange(value) {
        if (value === "rotierend") {
            this.rotating = true;
            if (config.feature_rotation_timer) clearTimeout(config.feature_rotation_timer);
            this.startFeatureRotation();
        } else {
            this.rotating = false;
            if (config.feature_rotation_timer) clearTimeout(config.feature_rotation_timer);
            this.activeFeature = value;
            this.updateAll();
        }
    }

    /**
     * Rotiert automatisch zwischen den drei Features alle 3 Sekunden.
     */
    startFeatureRotation() {
        if (!this.rotating) return;
        this.activeFeature = this.features[this.rotationIndex];
        this.rotationIndex = (this.rotationIndex + 1) % this.features.length;
        this.updateAll();
        config.feature_rotation_timer = setTimeout(() => this.startFeatureRotation(), 3000);
    }

    // ==========================================
    // Render-Methoden
    // ==========================================

    /**
     * Erstellt den RenderContext, der an die Renderer-Module weitergegeben wird.
     * Enthält alle Referenzen, die die Module für Scrolling und Layout benötigen.
     */
    _createRenderContext(canvas, screen, zugID, fullScreen, cssScale = 1) {
        return {
            fullScreen,
            screen,
            scrollManager: this.scrollManager,
            zugID,
            canvas,
            cssScale,
        };
    }

    /**
     * Aktualisiert einen einzelnen Monitor mit den gegebenen Journeys.
     *
     * @param {import('../models/journey.js').Journey[]} journeys - Die Journeys für diesen Screen.
     * @param {object} screen - Das Screen-Objekt aus dem Layout.
     * @param {number} zugID - Zug-ID für Scrolling (1, 2, 3).
     */
    update(journeys, screen, zugID) {
        try {
            const fullScreen = screen.type === 'haupt';

            if (!journeys || journeys.length === 0) {
                this.drawOnScreen(screen, (ctx, width, height) => {
                    ctx.clearRect(0, 0, width, height);
                });
                this.scrollManager.clearForZug(zugID);
                return;
            }

            const canvas = document.getElementById('zimCanvas');
            const renderCtx = this._createRenderContext(canvas, screen, zugID, fullScreen);

            this.scrollManager.beginRender();

            this.drawOnScreen(screen, (ctx, width, height) => {
                drawTrainInfo(ctx, journeys, width, renderCtx);
                ctx.save();
                ctx.translate(0, 800);
                drawFormation(ctx, journeys, this.journeyStore.platform, {
                    fullScreen,
                    activeFeature: this.activeFeature,
                });
                ctx.restore();
            });

            // Räume alle Scroll-Divs auf, die im aktuellen Render-Tick nicht mehr benötigt wurden
            this.scrollManager.cleanupUnused(zugID);

        } catch (err) {
            console.error(`Error in update for zugID ${zugID}:`, err);
        }
    }

    /**
     * Aktualisiert einen einzelnen Screen anhand seiner Screen-ID.
     * @param {string} screenId - Die ID des Screens (z.B. 'hauptmonitor', 'nebenmonitor_1').
     */
    updateScreen(screenId) {
        const screen = this.currentLayout.screens.find(s => s.id === screenId);
        if (!screen) return;

        const slot = screen.type === 'haupt' ? 1
                   : screen.type === 'neben' ? 2
                   : 3;

        let journeys;
        if (screen.type === 'neben_rotierend') {
            journeys = this.journeyStore.getJourneysForSlot(3);
        } else {
            journeys = this.journeyStore.getJourneysForSlot(slot);
        }

        this.update(journeys, screen, slot);
    }

    /**
     * Zeichnet alle Monitore neu. Haupteinstieg nach Datenänderungen.
     */
    updateAll() {
        // Re-entrance Guard: Verhindere gleichzeitige Render-Durchläufe
        if (this._isRendering) return;
        this._isRendering = true;

        try {
            const canvas = document.getElementById('zimCanvas');
            if (!canvas) return;

            // Stelle sicher, dass das Canvas immer die tatsächlichen Maße des aktuellen Layouts hat
            if (canvas.width !== this.currentLayout.width || canvas.height !== this.currentLayout.height) {
                canvas.width = this.currentLayout.width;
                canvas.height = this.currentLayout.height;
                window.dispatchEvent(new Event('resize'));
            }

            this.ctx = canvas.getContext('2d');
            this.drawFullBackground();

            // CSS-Skalierungsfaktor ermitteln (für Scroll-Div-Positionierung)
            const container = canvas.parentElement;
            const cssScale = container ? (container.clientWidth / this.currentLayout.width) : 1;

            // Journey-Gruppen einmalig aufbauen (layout-spezifisch)
            const screenAssignments = this._buildScreenAssignments();

            this.currentLayout.screens.forEach(screen => {
                try {
                    const assignment = screenAssignments.get(screen.id) || { journeys: [], zugID: 1 };
                    const { journeys, zugID } = assignment;

                    // Leere Screens: mit Midnight Blue füllen und Scroll-Divs aufräumen
                    if (!journeys || journeys.length === 0) {
                        this.drawOnScreen(screen, () => {}); // Füllt mit MIDNIGHT_BLUE
                        this.scrollManager.clearForZug(zugID);
                        return;
                    }

                    const fullScreen = screen.type === 'haupt';
                    const renderCtx = this._createRenderContext(canvas, screen, zugID, fullScreen, cssScale);

                    this.scrollManager.beginRender();

                    this.drawOnScreen(screen, (ctx, width, height) => {
                        if (screen.type === 'haupt' || screen.type === 'neben' || screen.type === 'neben_rotierend') {
                            drawTrainInfo(ctx, journeys, width, renderCtx);
                            ctx.save();
                            ctx.translate(0, 800);
                            drawFormation(ctx, journeys, this.journeyStore.platform, {
                                fullScreen,
                                activeFeature: this.activeFeature,
                            });
                            ctx.restore();
                        } else if (screen.type === 'liste') {
                            drawListeRow(ctx, journeys[0], width, height);
                        }
                    });

                    this.scrollManager.cleanupUnused(zugID);
                } catch (screenErr) {
                    console.error(`Error rendering screen ${screen.id}:`, screenErr);
                }
            });
        } catch (err) {
            console.error('Error in updateAll:', err);
        } finally {
            this._isRendering = false;
        }
    }

    // ==========================================
    // Layout-spezifische Screen-Zuweisung
    // ==========================================

    /**
     * Baut die Journey-Zuweisungen für alle Screens des aktuellen Layouts auf.
     * Layout-spezifische Regeln (z.B. Störungen auf den rotierenden Monitor)
     * werden hier zentral umgesetzt.
     *
     * @returns {Map<string, {journeys: Journey[], zugID: number}>}
     */
    _buildScreenAssignments() {
        const assignments = new Map();
        const layout = this.currentLayout;

        if (layout === LAYOUTS.standard) {
            this._assignStandard(assignments);
        } else if (layout === LAYOUTS.voranzeiger) {
            this._assignVoranzeiger(assignments);
        } else {
            // Fallback: einfache Slot-basierte Zuweisung
            this._assignGeneric(assignments);
        }

        return assignments;
    }

    /**
     * Standard-Layout (2×32" Doppelmonitor):
     * - Hauptmonitor: Erste nicht-gestörte Journey-Gruppe
     * - Nebenmonitor 1: Zweite nicht-gestörte Journey-Gruppe
     * - Nebenmonitor 2 (rotierend): Gestörte Journeys (Vorrang), sonst dritte Gruppe
     */
    _assignStandard(assignments) {
        const groups = this._getVisibleJourneyGroups();

        // Trennung in normale und gestörte Gruppen
        const normal = groups.filter(g => !g[0].isDisrupted);
        const disrupted = groups.filter(g => g[0].isDisrupted);

        const screens = this.currentLayout.screens;
        const haupt = screens.find(s => s.type === 'haupt');
        const neben = screens.find(s => s.type === 'neben');
        const rotierend = screens.find(s => s.type === 'neben_rotierend');

        // Hauptmonitor: 1. normale Gruppe
        if (haupt) {
            assignments.set(haupt.id, {
                journeys: normal[0] || [],
                zugID: 1,
            });
        }

        // Nebenmonitor 1: 2. normale Gruppe
        if (neben) {
            assignments.set(neben.id, {
                journeys: normal[1] || [],
                zugID: 2,
            });
        }

        // Nebenmonitor 2 (rotierend): Gestörte Journeys haben Vorrang
        if (rotierend) {
            let rotatingJourneys = [];
            if (disrupted.length > 0) {
                // Gestörte Journeys anzeigen (TODO: Rotation bei mehreren)
                rotatingJourneys = disrupted[0];
            } else if (normal.length > 2) {
                // Keine Störungen: 3. normale Gruppe
                rotatingJourneys = normal[2];
            }
            assignments.set(rotierend.id, {
                journeys: rotatingJourneys,
                zugID: 3,
            });
        }
    }

    /**
     * Voranzeiger-Layout (Listen-Zeilen):
     * Einfache Reihung, jede Zeile bekommt die n-te Gruppe.
     */
    _assignVoranzeiger(assignments) {
        const groups = this._getVisibleJourneyGroups();
        for (const screen of this.currentLayout.screens) {
            const index = screen.trainIndex || 0;
            assignments.set(screen.id, {
                journeys: groups[index] || [],
                zugID: index + 1,
            });
        }
    }

    /**
     * Generische Zuweisung für unbekannte Layouts: Slot-basiert via JourneyStore.
     */
    _assignGeneric(assignments) {
        for (const screen of this.currentLayout.screens) {
            let slot;
            if (screen.type === 'haupt') slot = 1;
            else if (screen.type === 'neben') slot = 2;
            else if (screen.type === 'neben_rotierend') slot = 3;
            else slot = (screen.trainIndex || 0) + 1;

            assignments.set(screen.id, {
                journeys: this.journeyStore.getJourneysForSlot(slot),
                zugID: slot,
            });
        }
    }

    /**
     * Gibt alle sichtbaren Journey-Gruppen zurück.
     * Gekoppelte Journeys werden als eine Gruppe zusammengefasst.
     *
     * @returns {Journey[][]} Array von Journey-Gruppen
     */
    _getVisibleJourneyGroups() {
        const visible = this.journeyStore.getVisibleJourneys();
        const groups = [];
        const seenCouplings = new Set();

        for (const j of visible) {
            if (j.couplingGroupId) {
                if (seenCouplings.has(j.couplingGroupId)) continue;
                seenCouplings.add(j.couplingGroupId);
                groups.push(this.journeyStore._expandCoupling(j));
            } else {
                groups.push([j]);
            }
        }

        return groups;
    }
}