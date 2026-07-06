// js/displays/trainDisplay.js
// Orchestrator — delegiert an spezialisierte Renderer-Module
import { config } from '../utils/config.js';
import { LAYOUTS } from './layouts.js';
import { COLORS } from './constants.js';
import { ScrollManager } from './scrollManager.js';
import { drawFormation } from './formationRenderer.js';
import { drawTrainInfo, shouldRenderFormation } from './trainInfoRenderer.js';
import { drawListeRow } from './listeRenderer.js';
import { drawVitrine32Wagenstand } from './vitrineRenderer.js';

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
        this.featureAlpha = 1.0;
        this.vitrineProgress = 0.0;
        this.activeFeatureIndex = 0;
        this.rotatingPages = [];
        this.activePageIndex = 0;
        this.pageAlpha = 1.0;
        this._startAnimationLoop();
    }

    // ==========================================
    // Canvas-Verwaltung
    // ==========================================

    /**
     * Richtet den Canvas-Kontext für einen bestimmten Monitor-Bereich ein
     * (Clipping, Translation) und ruft die Zeichenfunktion auf.
     */
    drawOnScreen(screen, drawFunction, targetCanvas = null, clearBackground = true) {
        this.currentScreen = screen;
        const canvas = targetCanvas || document.getElementById('zimCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!screen) return;

        ctx.save();
        if (clearBackground) {
            ctx.clearRect(screen.x, screen.y, screen.w, screen.h);

            // Bereich des Monitors mit der Standard-Canvas-Farbe (navy) füllen,
            // damit das Hintergrundbild nur außerhalb der Displays sichtbar bleibt
            ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
            ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
        }

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

    _startAnimationLoop() {
        if (this._animId) return;
        const loop = () => {
            const isVitrine = this.currentLayout === LAYOUTS.zimvitrine32wagenstand;
            const now = Date.now();
            let needsRender = false;
            
            // 1. Formation Feature Rotation (only if rotating or vitrine)
            if (isVitrine || this.rotating) {
                const cycle = now % 12000;
                
                let newFeatureStr;
                let featureIndex;
                if (cycle < 4000) { newFeatureStr = 'klasse'; featureIndex = 2; }
                else if (cycle < 8000) { newFeatureStr = 'ausstattung'; featureIndex = 1; }
                else { newFeatureStr = 'wagennummern'; featureIndex = 0; }
                
                const t = cycle % 4000;
                let alpha = 1.0;
                if (t < 1000) alpha = t / 1000;
                else if (t > 3000) alpha = 1.0 - ((t - 3000) / 1000);
                
                this.vitrineProgress = cycle / 12000;
                this.activeFeatureIndex = featureIndex;
                this.activeFeature = newFeatureStr;
                this.featureAlpha = alpha;
                needsRender = true;
            } else {
                if (this.featureAlpha !== 1.0) {
                    this.featureAlpha = 1.0;
                    needsRender = true;
                }
            }

            // 2. Journey/InfoText Rotation (Always runs if we have multiple pages)
            const pagesCount = this.rotatingPages ? this.rotatingPages.length : 0;
            if (pagesCount > 1) {
                const journeyCycleDuration = 4800;
                const totalJourneyCycle = pagesCount * journeyCycleDuration;
                const jCycle = now % totalJourneyCycle;
                this.activePageIndex = Math.floor(jCycle / journeyCycleDuration);
                
                const tJ = jCycle % journeyCycleDuration;
                if (tJ < 800) this.pageAlpha = tJ / 800;
                else if (tJ > 4000) this.pageAlpha = 1.0 - ((tJ - 4000) / 800);
                else this.pageAlpha = 1.0;
                needsRender = true;
            } else {
                if (this.pageAlpha !== 1.0 || this.activePageIndex !== 0) {
                    this.activePageIndex = 0;
                    this.pageAlpha = 1.0;
                    needsRender = true;
                }
            }
            
            if (needsRender) {
                if (config.performance_mode) {
                    if (now - (this.lastRenderTime || 0) < 33) {
                        this._animId = requestAnimationFrame(loop);
                        return;
                    }
                }
                this.lastRenderTime = now;
                
                if (!this._isRendering) {
                    this._renderFrames();
                }
            }
            this._animId = requestAnimationFrame(loop);
        };
        this._animId = requestAnimationFrame(loop);
    }

    /**
     * Reagiert auf Feature-Radio-Button-Änderungen.
     * @param {string} value - 'rotierend', 'wagennummern', 'ausstattung' oder 'klasse'.
     */
    onFeatureButtonChange(value) {
        if (value === "rotierend") {
            this.rotating = true;
        } else {
            this.rotating = false;
            this.activeFeature = value;
            this.featureAlpha = 1.0;
            this.updateAll();
        }
    }

    /**
     * Obsolet: startFeatureRotation wird vom neuen AnimationLoop übernommen.
     */
    startFeatureRotation() {
        // Nothing to do
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
            platform: this.journeyStore.platform,
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
        this.updateAll();
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
        if (this._isRendering) return;
        this._isRendering = true;

        try {
            const canvas = document.getElementById('zimCanvas');
            if (!canvas) return;

            if (canvas.width !== this.currentLayout.width || canvas.height !== this.currentLayout.height) {
                canvas.width = this.currentLayout.width;
                canvas.height = this.currentLayout.height;
                window.dispatchEvent(new Event('resize'));
            }

            if (!this.offscreenCanvas) {
                this.offscreenCanvas = document.createElement('canvas');
            }
            if (this.offscreenCanvas.width !== this.currentLayout.width || this.offscreenCanvas.height !== this.currentLayout.height) {
                this.offscreenCanvas.width = this.currentLayout.width;
                this.offscreenCanvas.height = this.currentLayout.height;
            }

            this.ctx = this.offscreenCanvas.getContext('2d');
            this.drawFullBackground();

            this._renderDynamicScreens('static', this.offscreenCanvas);
        } catch (err) {
            console.error('Error in updateAll:', err);
        } finally {
            this._isRendering = false;
        }

        this._renderFrames();
    }

    _renderFrames() {
        if (!this.offscreenCanvas) return;
        const canvas = document.getElementById('zimCanvas');
        if (!canvas) return;
        
        const mainCtx = canvas.getContext('2d');
        mainCtx.clearRect(0, 0, canvas.width, canvas.height);
        mainCtx.drawImage(this.offscreenCanvas, 0, 0);

        this._renderDynamicScreens('dynamic', canvas);
    }

    _renderDynamicScreens(layer = 'all', targetCanvas = null) {
        try {
            const canvas = targetCanvas || document.getElementById('zimCanvas');
            if (!canvas) return;

            const mainCanvas = document.getElementById('zimCanvas');
            const container = mainCanvas ? mainCanvas.parentElement : null;
            const cssScale = container ? (container.clientWidth / this.currentLayout.width) : 1;
            const screenAssignments = this._buildScreenAssignments();

            this.currentLayout.screens.forEach(screen => {
                try {
                    const assignment = screenAssignments.get(screen.id) || { journeys: [], zugID: 1 };
                    const { journeys, journeyGroups, zugID } = assignment;

                    if ((!journeys || journeys.length === 0) && (!journeyGroups || journeyGroups.length === 0)) {
                        if (layer === 'all' || layer === 'static') {
                            this.drawOnScreen(screen, () => {}, canvas);
                        }
                        if (layer === 'all' || layer === 'static') this.scrollManager.clearForZug(zugID);
                        return;
                    }

                    const fullScreen = screen.type === 'haupt';
                    const renderCtx = this._createRenderContext(mainCanvas, screen, zugID, fullScreen, cssScale);
                    
                    if (screen.type === 'neben_rotierend') {
                        renderCtx.pageAlpha = this.pageAlpha;
                        renderCtx.totalPages = this.rotatingPages ? this.rotatingPages.length : 0;
                        renderCtx.activePageIndex = this.activePageIndex;
                        if (this.rotatingPages && this.rotatingPages[this.activePageIndex]) {
                            renderCtx.activeInfoText = this.rotatingPages[this.activePageIndex].infoText;
                        }
                    } else {
                        renderCtx.pageAlpha = 1.0;
                    }

                    const isDynamicRotierend = (layer === 'dynamic' && screen.type === 'neben_rotierend');
                    if (layer === 'all' || layer === 'static' || isDynamicRotierend) this.scrollManager.beginRender();

                    const clearBg = (layer === 'all' || layer === 'static' || isDynamicRotierend);
                    this.drawOnScreen(screen, (ctx, width, height) => {
                        if (screen.type === 'haupt' || screen.type === 'neben' || screen.type === 'neben_rotierend') {
                            if (layer === 'all' || layer === 'static' || isDynamicRotierend) {
                                drawTrainInfo(ctx, journeys, width, height, renderCtx);
                            }
                            if (shouldRenderFormation(journeys)) {
                                ctx.save();
                                ctx.translate(0, 820);
                                if (isDynamicRotierend) {
                                    ctx.globalAlpha = this.pageAlpha;
                                }
                                drawFormation(ctx, journeys, this.journeyStore.platform, {
                                    fullScreen,
                                    activeFeature: this.activeFeature,
                                    featureAlpha: this.featureAlpha,
                                    drawLayer: isDynamicRotierend ? 'all' : layer
                                });
                                ctx.restore();
                            }
                        } else if (screen.type === 'liste') {
                            if (layer === 'all' || layer === 'static') {
                                drawListeRow(ctx, journeys[0], width, height);
                            }
                        } else if (screen.type === 'vitrine32') {
                            const trackNumber = document.getElementById('entry_gleis') ? document.getElementById('entry_gleis').value : '';
                            drawVitrine32Wagenstand(ctx, journeyGroups || [], this.journeyStore.platform, width, height, trackNumber, {
                                activeFeatureIndex: this.activeFeatureIndex,
                                activeFeatureStr: this.activeFeature,
                                progress: this.vitrineProgress,
                                featureAlpha: this.featureAlpha,
                                drawLayer: layer
                            });
                        }
                    }, canvas, clearBg);

                    if (layer === 'all' || layer === 'static' || isDynamicRotierend) this.scrollManager.cleanupUnused(zugID);
                } catch (screenErr) {
                    console.error(`Error rendering screen ${screen.id}:`, screenErr);
                }
            });
        } catch (err) {
            console.error('Error in _renderDynamicScreens:', err);
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
        } else if (layout === LAYOUTS.zimvitrine32wagenstand) {
            this._assignVitrine(assignments);
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

        // Nebenmonitor 2 (rotierend): Gestörte Journeys + normale ab Index 2
        if (rotierend) {
            const groupsToRotate = [...disrupted, ...normal.slice(2)];
            this.rotatingPages = [];
            
            for (const group of groupsToRotate) {
                const primary = group[0];
                const visibleTexts = primary.infoTexts ? primary.infoTexts.filter(t => t.visible) : [];
                const isDisrupted = primary.isDisrupted;

                // Basis-Seite wird NUR bei "Verkehrt ab" (und nicht Ausfall/Infoscreen) vorangestellt.
                // Bei Gleiswechsel etc. wollen wir keine Rotation zwischen Basis-Route und dem Infotext.
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
                        this.rotatingPages.push({
                            journeys: group,
                            infoText: null
                        });
                    }
                    // Seite 2 bis N: Die dynamischen Infotexte
                    for (let i = 0; i < infoTextPages; i++) {
                        this.rotatingPages.push({
                            journeys: group,
                            infoText: visibleTexts[i]
                        });
                    }
                } else {
                    // Keine Rotation von Infotexten: Fallback auf ersten Text (oder null)
                    this.rotatingPages.push({
                        journeys: group,
                        infoText: visibleTexts[0] || null
                    });
                }
            }

            let currentJourneys = [];
            if (this.rotatingPages.length > 0) {
                if (this.activePageIndex >= this.rotatingPages.length) {
                    this.activePageIndex = 0;
                }
                currentJourneys = this.rotatingPages[this.activePageIndex].journeys;
            }

            assignments.set(rotierend.id, {
                journeys: currentJourneys,
                zugID: 3,
            });
        } else {
            this.rotatingPages = [];
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

    _assignVitrine(assignments) {
        const groups = this._getVisibleJourneyGroups();
        for (const screen of this.currentLayout.screens) {
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