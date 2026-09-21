// js/displays/trainDisplay.js
// Orchestrator — delegiert an spezialisierte Renderer-Module
import { config } from '../core/utils/config.js';
import { COLORS } from './core/constants.js';
import { Journey } from '../features/journey/journey.svelte.js';
import { ScrollManager } from './core/scrollManager.js';
import { drawFormation } from './components/formationRenderer.js';
import { drawTrainInfo, shouldRenderFormation } from './components/trainInfoRenderer.js';
import { drawListeRow, drawVoranzeigerBoard } from './components/listeRenderer.js';
import { drawVitrine32Wagenstand } from './components/vitrineRenderer.js';
import { drawAnkunftBoard } from './components/ankunftRenderer.js';
import { drawWagenreihungPlan } from './components/wagenreihungPlanRenderer.js';
import { drawAnschlusstafelZoomBoard } from './components/anschlusstafelZoomRenderer.js';
import { displayConfigStore } from './core/displayConfigStore.svelte.js';
import { ScreenSyncService } from '../core/services/screenSyncService.js';

export class TrainDisplay {
    constructor(journeyStore) {
        this.journeyStore = journeyStore;
        this.activeFeature = 'wagennummern'; // 'wagennummern', 'ausstattung', 'klasse'
        this.features = ['wagennummern', 'ausstattung', 'klasse'];
        this.rotationIndex = 0;
        this.rotating = false;
        this.scrollManager = new ScrollManager();
        this._customLayout = null;
        this._isRendering = false; // Re-entrance Guard
        this.featureAlpha = 1.0;
        this.vitrineProgress = 0.0;
        this.activeFeatureIndex = 0;
        this.rotatingPages = [];
        this.activePageIndex = 0;
        this.pageAlpha = 1.0;

        this.departurePageIndex = 0;
        this.departurePageAlpha = 1.0;
        this.disruptionPageIndex = 0;
        this.disruptionPageAlpha = 1.0;
        this.tickerOffset = 0;

        this._startAnimationLoop();
    }

    get currentLayout() {
        return this._customLayout || displayConfigStore.currentLayout;
    }

    set currentLayout(val) {
        this._customLayout = val;
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
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!screen) return;

        ctx.save();
        if (clearBackground) {
            ctx.clearRect(screen.x, screen.y, screen.w, screen.h);

            // Bereich des Monitors mit der Standard-Canvas-Farbe (navy) füllen
            ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
            ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
        }

        ctx.translate(screen.x, screen.y);
        ctx.beginPath();
        ctx.rect(0, 0, screen.w, screen.h);
        ctx.clip();

        // HiDPI / 4K Vektor-Skalierung falls im Layout definiert
        const scaleFactor = this.currentLayout.scaleFactor || 1;
        if (scaleFactor !== 1) {
            ctx.scale(scaleFactor, scaleFactor);
            drawFunction(ctx, screen.w / scaleFactor, screen.h / scaleFactor);
        } else {
            drawFunction(ctx, screen.w, screen.h);
        }
        ctx.restore();
    }

    /**
     * Füllt den gesamten Canvas-Hintergrund mit der Standardfarbe.
     * Bei Layouts mit hasBezelGap (z.B. Standard mit 50px Gehäusesteg)
     * wird der 50px Steg in DB-Dunkelblau (RAL 5022 Nachtblau) gerendert.
     */
    drawFullBackground() {
        if (!this.ctx || !this.currentLayout) return;
        const canvas = this.ctx.canvas;
        this.ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Trennsteg(e) in authentischem DB-Dunkelblau zeichnen, falls im Layout definiert
        if (this.currentLayout.hasBezelGap && this.currentLayout.gapWidth) {
            const gapW = this.currentLayout.gapWidth;
            const gaps = this.currentLayout.width >= 5800
                ? [1920, 1920 + gapW + 1920]
                : [this.currentLayout.gapX !== undefined ? this.currentLayout.gapX : 1920];

            for (const gapX of gaps) {
                // DB Dunkelblau Grundfläche für den Steg (RAL 5022 Nachtblau / #08152b)
                this.ctx.fillStyle = '#08152b';
                this.ctx.fillRect(gapX, 0, gapW, canvas.height);

                // Subtiler metallischer 3D-Verlauf
                const grad = this.ctx.createLinearGradient(gapX, 0, gapX + gapW, 0);
                grad.addColorStop(0, '#040b17');
                grad.addColorStop(0.15, '#091833');
                grad.addColorStop(0.5, '#102a57');
                grad.addColorStop(0.85, '#091833');
                grad.addColorStop(1, '#040b17');
                this.ctx.fillStyle = grad;
                this.ctx.fillRect(gapX, 0, gapW, canvas.height);

                // Vertikale Akzentfuge im Steg
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                this.ctx.fillRect(gapX + 24, 0, 2, canvas.height);
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
                this.ctx.fillRect(gapX + 26, 0, 1, canvas.height);
            }
        }
    }

    // ==========================================
    // Layout & Feature-Steuerung
    // ==========================================

    /**
     * Wechselt das Layout (z.B. Standard ↔ Voranzeiger).
     * @param {string} layoutName
     */
    switchLayout(layoutName) {
        if (!layoutName) return;

        // Legacy & Named Layout / Monitor Mapping
        if (layoutName === 'standard') {
            displayConfigStore.setMonitorId('zim2x32');
            displayConfigStore.setLayoutType('zuganzeiger');
            displayConfigStore.showBezel = true;
            this._customLayout = null;
        } else if (layoutName === 'standard_frameless') {
            displayConfigStore.setMonitorId('zim2x32');
            displayConfigStore.setLayoutType('zuganzeiger');
            displayConfigStore.showBezel = false;
            this._customLayout = null;
        } else if (layoutName === 'standard_3screen') {
            displayConfigStore.setMonitorId('zim3x32');
            displayConfigStore.setLayoutType('zuganzeiger');
            displayConfigStore.showBezel = true;
            this._customLayout = null;
        } else if (layoutName === 'standard_3screen_frameless') {
            displayConfigStore.setMonitorId('zim3x32');
            displayConfigStore.setLayoutType('zuganzeiger');
            displayConfigStore.showBezel = false;
            this._customLayout = null;
        } else if (layoutName === 'voranzeiger') {
            displayConfigStore.setLayoutType('anschlusstafel');
            this._customLayout = null;
        } else if (layoutName === 'voranzeiger_and_formation') {
            displayConfigStore.setMonitorId('zim2x32');
            displayConfigStore.setLayoutType('wagenstand_gleis');
            this._customLayout = null;
        } else if (layoutName === 'zimvitrine32wagenstand') {
            displayConfigStore.setMonitorId('zimvitrine32');
            displayConfigStore.setLayoutType('wagenstand_gleis');
            this._customLayout = null;
        } else if (layoutName === 'zimvitrine65h') {
            displayConfigStore.setMonitorId('zimvitrine65h');
            this._customLayout = null;
        } else if (layoutName === 'zimwide') {
            displayConfigStore.setMonitorId('zimwide');
            this._customLayout = null;
        } else if (layoutName === 'zimultrawide') {
            displayConfigStore.setMonitorId('zimultrawide');
            this._customLayout = null;
        } else if (['zuganzeiger', 'anschlusstafel', 'anschlusstafel_zoom', 'ankunftstafel', 'wagenreihungsplan', 'wagenstand_gleis'].includes(layoutName)) {
            displayConfigStore.setLayoutType(layoutName);
            this._customLayout = null;
        } else if (['zim2x32', 'zim3x32', 'zim32_single', 'zimvitrine32', 'zimvitrine65h', 'zimwide', 'zimultrawide'].includes(layoutName)) {
            displayConfigStore.setMonitorId(layoutName);
            this._customLayout = null;
        }

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
     * Setzt einen spezifischen Zielmonitor für Multi-Monitor / Kiosk-Modus.
     * @param {string|number|null} screenNumber - '1', '2', '3' oder null für Gesamtansicht
     * @param {boolean} [is4k=false] - Ob 4K-Auflösung aktiviert werden soll
     * @param {boolean} [withBezel=false] - Ob Gehäuse-Modus gewünscht ist
     */
    setTargetScreen(screenNumber, is4k = false, withBezel = false) {
        displayConfigStore.setTargetScreen(screenNumber === 'all' ? null : screenNumber, is4k);
        if (withBezel !== undefined && (!screenNumber || screenNumber === 'all')) {
            displayConfigStore.showBezel = withBezel;
        }
        this._customLayout = null;

        const canvas = document.getElementById('zimCanvas');
        if (canvas) {
            canvas.width = this.currentLayout.width;
            canvas.height = this.currentLayout.height;
        }

        this.scrollManager.clearAll();
        this.updateAll();
        window.dispatchEvent(new Event('resize'));
    }

    _startAnimationLoop() {
        if (this._animId) return;
        const loop = () => {
            const isVitrine = this.currentLayout?.layoutType === 'wagenstand_gleis' || 
                              this.currentLayout?.screens?.some(s => s.type === 'vitrine32') ||
                              this.currentLayout?.layoutType === 'wagenreihungsplan';
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

            // 3. Voranzeiger Pagination & Ticker Loop (aktiv wenn Layout einen Abfahrts-/Voranzeiger-Screen hat)
            const hasVoranzeiger = this.currentLayout && this.currentLayout.screens && this.currentLayout.screens.some(s => s.type === 'voranzeiger' || s.type === 'abfahrt' || s.type === 'abfahrt_zoom' || s.type === 'abfahrt_portrait');
            if (hasVoranzeiger) {
                // Ticker kontinuierlich scrollen
                this.tickerOffset += 1.8;

                // Störungs-Pagination (6 Sekunden Verweildauer)
                const dCycle = now % 6000;
                this.disruptionPageIndex = Math.floor(now / 6000);
                if (dCycle < 500) {
                    this.disruptionPageAlpha = dCycle / 500;
                } else if (dCycle > 5500) {
                    this.disruptionPageAlpha = 1.0 - ((dCycle - 5500) / 500);
                } else {
                    this.disruptionPageAlpha = 1.0;
                }

                // Abfahrts-Pagination (10 Sekunden Verweildauer)
                const depCycle = now % 10000;
                this.departurePageIndex = Math.floor(now / 10000);
                if (depCycle < 800) {
                    this.departurePageAlpha = depCycle / 800;
                } else if (depCycle > 9200) {
                    this.departurePageAlpha = 1.0 - ((depCycle - 9200) / 800);
                } else {
                    this.departurePageAlpha = 1.0;
                }

                needsRender = true;
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
        ScreenSyncService.broadcastDisplayConfig({ activeFeature: this.activeFeature });
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
            journeyStore: this.journeyStore,
            departurePageIndex: this.departurePageIndex,
            departurePageAlpha: this.departurePageAlpha,
            disruptionPageIndex: this.disruptionPageIndex,
            disruptionPageAlpha: this.disruptionPageAlpha,
            tickerOffset: this.tickerOffset,
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

        const options = { boardType: this.currentLayout.boardType || 'default' };

        let journeys;
        if (screen.type === 'neben_rotierend') {
            journeys = this.journeyStore.getJourneysForSlot(3, options);
        } else {
            journeys = this.journeyStore.getJourneysForSlot(slot, options);
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

            this.ctx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
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
        
        const mainCtx = canvas.getContext('2d', { willReadFrequently: true });
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
                        if (screen.type === 'haupt' || screen.type === 'neben' || screen.type === 'neben_rotierend' || screen.type === 'zuganzeiger_portrait') {
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
                        } else if (screen.type === 'abfahrt_zoom') {
                            drawAnschlusstafelZoomBoard(ctx, journeys, width, height, renderCtx, screen);
                        } else if (screen.type === 'abfahrt' || screen.type === 'abfahrt_portrait' || screen.type === 'voranzeiger') {
                            drawVoranzeigerBoard(ctx, journeys, width, height, renderCtx, screen);
                        } else if (screen.type === 'ankunft' || screen.type === 'ankunft_portrait') {
                            drawAnkunftBoard(ctx, journeys, width, height, renderCtx, screen);
                        } else if (screen.type === 'wagenreihung_plan') {
                            drawWagenreihungPlan(ctx, journeyGroups || [], this.journeyStore.platform, width, height, renderCtx, screen);
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
        const screens = layout?.screens || [];

        const hasAnkunft = screens.some(s => s.type === 'ankunft' || s.type === 'ankunft_portrait');
        const hasAbfahrt = screens.some(s => s.type === 'abfahrt' || s.type === 'abfahrt_portrait' || s.type === 'voranzeiger' || s.type === 'abfahrt_zoom');
        const hasWagenreihungPlan = screens.some(s => s.type === 'wagenreihung_plan');

        if (hasAnkunft) {
            this._assignAnkunft(assignments);
        } else if (hasAbfahrt) {
            this._assignVoranzeiger(assignments);
        } else if (hasWagenreihungPlan) {
            this._assignWagenreihungPlan(assignments);
        } else {
            this._assignStandard(assignments);
        }

        // Falls vitrine32 Screens im Layout vorhanden sind (z.B. Wagenstandsanzeiger-Kombi), diese mit JourneyGroups versorgen
        const vitrineScreens = screens.filter(s => s.type === 'vitrine32');
        if (vitrineScreens.length > 0) {
            const groups = this._getVisibleJourneyGroups();
            vitrineScreens.forEach(screen => {
                assignments.set(screen.id, {
                    journeyGroups: groups.slice(0, 3),
                    zugID: 1,
                });
            });
        }

        return assignments;
    }

    /**
     * Standard-Layout (2×32" Doppelmonitor, Einzelschirme oder 4K):
     * - Hauptmonitor: Erste normale Journey-Gruppe
     * - Nebenmonitor(e): Weitere normale Journey-Gruppen
     * - Nebenmonitor (rotierend): Gestörte Journeys (Vorrang), sonst nachfolgende Gruppen
     *
     * @param {Map<string, {journeys: Journey[], zugID: number}>} assignments
     */
    _assignStandard(assignments) {
        const groups = this._getVisibleJourneyGroups();

        // Trennung in normale und gestörte Gruppen
        const normal = groups.filter(g => !g[0].isDisrupted);
        const disrupted = groups.filter(g => g[0].isDisrupted);

        const screens = this.currentLayout.screens;
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
        if (rotierend) {
            let normalStartIndex = 2;
            if (!haupt && nebens.length > 0) {
                const maxIndex = Math.max(...nebens.map(s => (s.trainIndex !== undefined ? s.trainIndex : 1)));
                normalStartIndex = maxIndex + 1;
            } else if (!haupt && nebens.length === 0) {
                normalStartIndex = 0;
            }

            const groupsToRotate = [...disrupted, ...normal.slice(normalStartIndex)];
            this.rotatingPages = [];
            
            for (const group of groupsToRotate) {
                const primary = group[0];
                let visibleTexts = primary.infoTexts ? [...primary.infoTexts.filter(t => t.visible)] : [];
                
                // Ankunftstext und Schwächungstext sind nun nativ als Bausteine in `infoTexts` vorhanden.
                // Es ist kein manuelles Hinzufügen für die Rotation mehr nötig.
                
                // Bei Gleiswechsel sollen laut Nutzer-Anforderung KEINE Infotexte rotieren/angezeigt werden,
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
                    // Keine Rotation von Infotexten: Fallback auf Standard-Darstellung (Vias)
                    this.rotatingPages.push({
                        journeys: group,
                        infoText: null
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

            const rotZugId = nebens.length > 0
                ? (Math.max(...nebens.map(s => (s.trainIndex !== undefined ? s.trainIndex : 1))) + 2)
                : (haupt ? 3 : 1);

            assignments.set(rotierend.id, {
                journeys: currentJourneys,
                zugID: rotZugId,
            });
        } else {
            this.rotatingPages = [];
        }
    }

    /**
     * Voranzeiger-Layout (Dynamische Abfahrtstafel):
     * Bildschirme vom Typ 'voranzeiger' erhalten alle sichtbaren Journeys für
     * dynamische Berechnung von Abfahrten, Störungsbox unten und Pagination.
     */
    _assignVoranzeiger(assignments) {
        const groups = this._getVisibleJourneyGroups();
        const allVisibleJourneys = this.journeyStore.journeys.filter(j => j.visible);

        for (const screen of this.currentLayout.screens) {
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

    _assignAnkunft(assignments) {
        const allVisibleJourneys = this.journeyStore.journeys.filter(j => j.visible);
        for (const screen of this.currentLayout.screens) {
            assignments.set(screen.id, {
                journeys: allVisibleJourneys,
                zugID: 1,
            });
        }
    }

    _assignWagenreihungPlan(assignments) {
        const groups = this._getVisibleJourneyGroups();
        for (const screen of this.currentLayout.screens) {
            assignments.set(screen.id, {
                journeyGroups: groups,
                zugID: 1,
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
        const options = { boardType: this.currentLayout.boardType || 'default' };
        for (const screen of this.currentLayout.screens) {
            let slot;
            if (screen.type === 'haupt') slot = 1;
            else if (screen.type === 'neben') slot = 2;
            else if (screen.type === 'neben_rotierend') slot = 3;
            else slot = (screen.trainIndex || 0) + 1;

            assignments.set(screen.id, {
                journeys: this.journeyStore.getJourneysForSlot(slot, options),
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
        const options = { boardType: this.currentLayout.boardType || 'default' };
        return this.journeyStore.getVisibleJourneyGroups(options);
    }
}