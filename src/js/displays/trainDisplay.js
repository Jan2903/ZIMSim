// js/displays/trainDisplay.js
// Orchestrator — delegiert an spezialisierte Renderer-Module
import { config } from '../core/utils/config.js';
import { COLORS } from './core/constants.js';
import { Journey } from '../features/journey/journey.svelte.js';
import { ScrollManager } from './core/scrollManager.js';
import { drawFormation } from './primitives/formationRenderer.js';
import { drawTrainInfo, shouldRenderFormation } from './boards/zuganzeigerRenderer.js';
import { drawListeRow, drawVoranzeigerBoard, drawAnschlusstafelBoard } from './boards/anschlusstafelRenderer.js';
import { drawVitrine32Wagenstand } from './boards/wagenstandGleisRenderer.js';
import { drawAnkunftBoard } from './boards/ankunftstafelRenderer.js';
import { drawWagenreihungPlan } from './boards/wagenreihungPlanRenderer.js';
import { drawAnschlusstafelZoomBoard } from './boards/anschlusstafelZoomRenderer.js';
import { displayConfigStore } from './core/displayConfigStore.svelte.js';
import { ScreenSyncService } from '../core/services/screenSyncService.js';
import { ScreenAssignmentService } from './core/screenAssignmentService.js';

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
        this._updateScheduled = false; // Koaleszierung geplanter Redraws
        this._baseCanvasRef = null;
        this._overlayCanvasRef = null;
        this._baseCtx = null;
        this._overlayCtx = null;
        this._overlayDirtyScreens = new Set();
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
     * Liefert das statische Basis-Canvas (zimCanvas).
     * @returns {HTMLCanvasElement|null}
     */
    _getBaseCanvas() {
        if (!this._baseCanvasRef || !this._baseCanvasRef.isConnected) {
            this._baseCanvasRef = document.getElementById('zimCanvas');
            this._baseCtx = null;
        }
        return this._baseCanvasRef;
    }

    /**
     * Liefert das dynamische Overlay-Canvas (zimDynamicCanvas).
     * @returns {HTMLCanvasElement|null}
     */
    _getOverlayCanvas() {
        if (!this._overlayCanvasRef || !this._overlayCanvasRef.isConnected) {
            this._overlayCanvasRef = document.getElementById('zimDynamicCanvas');
            this._overlayCtx = null;
        }
        return this._overlayCanvasRef;
    }

    /**
     * Liefert den 2D-Kontext des statischen Basis-Canvas.
     * `willReadFrequently` bleibt hier bewusst erhalten, da die Zugnummern-
     * Breite weiterhin per Pixel-Scan gemessen wird. Der Layer wird aber nur
     * bei Daten-/Layoutänderungen neu gezeichnet und nie pro Frame kopiert.
     * @param {HTMLCanvasElement} canvas
     * @returns {CanvasRenderingContext2D|null}
     */
    _getBaseCtx(canvas) {
        if (!this._baseCtx || this._baseCtx.canvas !== canvas) {
            this._baseCtx = canvas.getContext('2d', { willReadFrequently: true });
        }
        return this._baseCtx;
    }

    /**
     * Liefert den GPU-beschleunigten 2D-Kontext des dynamischen Overlays.
     * @returns {CanvasRenderingContext2D|null}
     */
    _getOverlayCtx() {
        const canvas = this._getOverlayCanvas();
        if (!canvas) return null;
        if (!this._overlayCtx || this._overlayCtx.canvas !== canvas) {
            this._overlayCtx = canvas.getContext('2d');
        }
        return this._overlayCtx;
    }

    /**
     * Setzt die Pixelmaße beider Canvas-Layer auf das aktuelle Layout.
     * Durch die Größenänderung werden beide Layer implizit geleert.
     * @returns {boolean} true, wenn mindestens ein Canvas angepasst wurde.
     */
    _resizeCanvases() {
        const width = this.currentLayout.width;
        const height = this.currentLayout.height;
        const base = this._getBaseCanvas();
        const overlay = this._getOverlayCanvas();
        let resized = false;

        if (base && (base.width !== width || base.height !== height)) {
            base.width = width;
            base.height = height;
            resized = true;
        }
        if (overlay && (overlay.width !== width || overlay.height !== height)) {
            overlay.width = width;
            overlay.height = height;
            resized = true;
        }
        if (resized) this._overlayDirtyScreens = new Set();

        return resized;
    }

    /**
     * Richtet den Canvas-Kontext für einen bestimmten Monitor-Bereich ein
     * (Clipping, Translation) und ruft die Zeichenfunktion auf.
     *
     * @param {object} screen - Bildschirmkonfiguration
     * @param {Function} drawFunction - Zeichenfunktion
     * @param {HTMLCanvasElement|null} [targetCanvas=null] - Ziel-Canvas (Basis oder Overlay)
     * @param {'opaque'|'transparent'|'none'} [clearMode='opaque'] - Art des Vorab-Löschens
     */
    drawOnScreen(screen, drawFunction, targetCanvas = null, clearMode = 'opaque') {
        this.currentScreen = screen;
        const canvas = targetCanvas || this._getBaseCanvas();
        if (!canvas) return;
        const isOverlay = canvas === this._getOverlayCanvas();
        const ctx = isOverlay ? this._getOverlayCtx() : this._getBaseCtx(canvas);
        if (!ctx || !screen) return;

        ctx.save();
        if (clearMode !== 'none') {
            ctx.clearRect(screen.x, screen.y, screen.w, screen.h);

            if (clearMode === 'opaque') {
                // Bereich des Monitors mit der Standard-Canvas-Farbe (navy) füllen
                ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
                ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
            }
        }

        ctx.translate(screen.x, screen.y);
        ctx.beginPath();
        ctx.rect(0, 0, screen.w, screen.h);
        ctx.clip();

        // Textzustand deterministisch zurücksetzen: save/restore isoliert bereits
        // pro Screen, dieser Reset hält den Startzustand zusätzlich explizit
        // fest (Renderer setzen textBaseline/textAlign unterschiedlich).
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';

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
                this.ctx.fillStyle = '#071328';
                this.ctx.fillRect(gapX, 0, gapW, canvas.height);

                // Subtiler metallischer 3D-Verlauf (RAL 5022 DB-Nachtblau seidenmatt)
                const grad = this.ctx.createLinearGradient(gapX, 0, gapX + gapW, 0);
                grad.addColorStop(0, '#040a14');
                grad.addColorStop(0.15, '#061224');
                grad.addColorStop(0.5, '#0a1a38');
                grad.addColorStop(0.85, '#061224');
                grad.addColorStop(1, '#040a14');
                this.ctx.fillStyle = grad;
                this.ctx.fillRect(gapX, 0, gapW, canvas.height);

                // Subtile Schattenfuge zum Panelrand
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                this.ctx.fillRect(gapX, 0, 3, canvas.height);
                this.ctx.fillRect(gapX + gapW - 3, 0, 3, canvas.height);

                // Feine 1px Lichtkanten
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                this.ctx.fillRect(gapX + 3, 0, 1, canvas.height);
                this.ctx.fillRect(gapX + gapW - 4, 0, 1, canvas.height);
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
        } else if (['zuganzeiger', 'anschlusstafel', 'anschlusstafel_zoom', 'anschlusstafel_zoom_icons', 'ankunftstafel', 'wagenreihungsplan', 'wagenstand_gleis'].includes(layoutName)) {
            displayConfigStore.setLayoutType(layoutName);
            this._customLayout = null;
        } else if (['zim2x32', 'zim3x32', 'zim32_single', 'zimvitrine32', 'zimvitrine65h', 'zimwide', 'zimultrawide'].includes(layoutName)) {
            displayConfigStore.setMonitorId(layoutName);
            this._customLayout = null;
        }

        // Canvas-Größe anpassen
        this._resizeCanvases();

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

        this._resizeCanvases();

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
                // Nur neu zeichnen, wenn sich Feature oder Alpha tatsächlich ändern.
                // In den Haltephasen bleibt das Bild identisch (bei der Vitrine
                // läuft dagegen der Fortschrittsbalken kontinuierlich weiter).
                if (isVitrine || newFeatureStr !== this.activeFeature || alpha !== this.featureAlpha) {
                    needsRender = true;
                }
                this.activeFeature = newFeatureStr;
                this.featureAlpha = alpha;
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
                const nextPageIndex = Math.floor(jCycle / journeyCycleDuration);
                
                const tJ = jCycle % journeyCycleDuration;
                let nextPageAlpha = 1.0;
                if (tJ < 800) nextPageAlpha = tJ / 800;
                else if (tJ > 4000) nextPageAlpha = 1.0 - ((tJ - 4000) / 800);
                
                if (nextPageIndex !== this.activePageIndex || nextPageAlpha !== this.pageAlpha) {
                    needsRender = true;
                }
                this.activePageIndex = nextPageIndex;
                this.pageAlpha = nextPageAlpha;
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
     * Koalesziert mehrere Update-Anforderungen in einen einzigen Redraw pro
     * Frame. Verhindert redundante Mehrfach-Redraws, wenn mehrere reaktive
     * Effekte im selben Tick auslösen.
     * @returns {void}
     */
    scheduleUpdateAll() {
        if (this._updateScheduled) return;
        this._updateScheduled = true;
        requestAnimationFrame(() => {
            this._updateScheduled = false;
            this.updateAll();
        });
    }

    /**
     * Zeichnet alle Monitore neu. Haupteinstieg nach Datenänderungen.
     * Der statische Basis-Layer wird vollständig aufgebaut, danach wird der
     * dynamische Overlay-Layer verworfen und neu befüllt.
     */
    updateAll() {
        if (this._isRendering) return;
        this._isRendering = true;

        try {
            const canvas = this._getBaseCanvas();
            if (!canvas) return;

            if (this._resizeCanvases()) {
                window.dispatchEvent(new Event('resize'));
            }

            this.ctx = this._getBaseCtx(canvas);
            this.drawFullBackground();

            this._renderDynamicScreens('static', canvas);

            // Dynamischen Layer vollständig verwerfen: Er wird direkt danach
            // aus den aktuellen Daten neu aufgebaut (kein Vollflächen-Blit).
            const overlay = this._getOverlayCanvas();
            const overlayCtx = this._getOverlayCtx();
            if (overlay && overlayCtx) {
                overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
            }
            this._overlayDirtyScreens = new Set();
        } catch (err) {
            console.error('Error in updateAll:', err);
        } finally {
            this._isRendering = false;
        }

        this._renderFrames();
    }

    /**
     * Zeichnet ausschließlich die animierten Inhalte auf den dynamischen Layer.
     * Der statische Basis-Layer bleibt dabei unangetastet.
     * @returns {void}
     */
    _renderFrames() {
        const canvas = this._getBaseCanvas();
        if (!canvas) return;

        const overlay = this._getOverlayCanvas();
        this._renderDynamicScreens('dynamic', overlay || canvas);
    }

    /**
     * Prüft, ob ein Screen im dynamischen Durchlauf tatsächlich animierte
     * Inhalte besitzt.
     * @param {object} screen
     * @param {Array} journeys
     * @returns {boolean}
     */
    _screenHasDynamicContent(screen, journeys) {
        switch (screen.type) {
            case 'haupt':
            case 'neben':
            case 'zuganzeiger_portrait':
                return shouldRenderFormation(journeys);
            case 'liste':
                return false;
            default:
                return true;
        }
    }

    _renderDynamicScreens(layer = 'all', layerCanvas = null) {
        try {
            const isStaticLayer = (layer === 'all' || layer === 'static');
            const baseCanvas = this._getBaseCanvas();
            const overlayCanvas = this._getOverlayCanvas();
            const defaultCanvas = layerCanvas || baseCanvas;
            if (!defaultCanvas) return;

            const container = baseCanvas ? baseCanvas.parentElement : defaultCanvas.parentElement;
            const cssScale = container ? (container.clientWidth / this.currentLayout.width) : 1;
            const screenAssignments = this._buildScreenAssignments();
            const drawnOverlayScreens = isStaticLayer ? null : new Set();

            this.currentLayout.screens.forEach(screen => {
                try {
                    const assignment = screenAssignments.get(screen.id) || { journeys: [], zugID: 1 };
                    const { journeys, journeyGroups, zugID } = assignment;
                    const isRotatingScreen = screen.type === 'neben_rotierend';

                    // Ziel-Layer bestimmen: Der rotierende Nebenmonitor wird
                    // weiterhin vollflächig (opak) neu gezeichnet, alle übrigen
                    // Animationen laufen auf dem transparenten Overlay.
                    let targetCanvas;
                    let clearMode;
                    if (isStaticLayer) {
                        targetCanvas = defaultCanvas;
                        clearMode = 'opaque';
                    } else if (isRotatingScreen) {
                        targetCanvas = baseCanvas || defaultCanvas;
                        clearMode = 'opaque';
                    } else if (overlayCanvas) {
                        targetCanvas = overlayCanvas;
                        clearMode = 'transparent';
                    } else {
                        // Fallback ohne Overlay: keine opake Fläche löschen
                        targetCanvas = baseCanvas || defaultCanvas;
                        clearMode = 'none';
                    }

                    if ((!journeys || journeys.length === 0) && (!journeyGroups || journeyGroups.length === 0)) {
                        if (isStaticLayer) {
                            this.drawOnScreen(screen, () => {}, targetCanvas, 'opaque');
                            this.scrollManager.clearForZug(zugID);
                        } else if (targetCanvas === overlayCanvas && this._overlayDirtyScreens.has(screen.id)) {
                            // Reste einer zuvor gezeichneten Animation entfernen
                            this.drawOnScreen(screen, () => {}, targetCanvas, 'transparent');
                        }
                        return;
                    }

                    const fullScreen = screen.type === 'haupt';
                    const renderCtx = this._createRenderContext(baseCanvas || targetCanvas, screen, zugID, fullScreen, cssScale);
                    
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

                    const isDynamicRotierend = (layer === 'dynamic' && isRotatingScreen);

                    // Auf dem Overlay nur Screens zeichnen, die wirklich
                    // animierte Inhalte haben (sonst bleibt der Layer leer).
                    if (!isStaticLayer && targetCanvas === overlayCanvas) {
                        if (!this._screenHasDynamicContent(screen, journeys)) {
                            if (this._overlayDirtyScreens.has(screen.id)) {
                                this.drawOnScreen(screen, () => {}, targetCanvas, 'transparent');
                            }
                            return;
                        }
                        drawnOverlayScreens.add(screen.id);
                    }

                    const trackScroll = isStaticLayer || isDynamicRotierend;
                    if (trackScroll) this.scrollManager.beginRender();

                    this.drawOnScreen(screen, (ctx, width, height) => {
                        this._renderScreenByType(ctx, screen, width, height, {
                            journeys,
                            journeyGroups,
                            renderCtx,
                            layer,
                            isDynamicRotierend,
                            fullScreen
                        });
                    }, targetCanvas, clearMode);

                    if (trackScroll) this.scrollManager.cleanupUnused(zugID);
                } catch (screenErr) {
                    console.error(`Error rendering screen ${screen.id}:`, screenErr);
                }
            });

            if (drawnOverlayScreens) this._overlayDirtyScreens = drawnOverlayScreens;
        } catch (err) {
            console.error('Error in _renderDynamicScreens:', err);
        }
    }

    /**
     * Delegiert das Zeichnen eines Screens an das entsprechende Board-Modul (Strategy-Pattern).
     * 
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D Kontext
     * @param {object} screen - Bildschirm-Konfigurationsobjekt
     * @param {number} width - Bildschirmbreite
     * @param {number} height - Bildschirmhöhe
     * @param {object} params - Render-Parameter
     * @param {import('../features/journey/journey.svelte.js').Journey[]} params.journeys - Fahrtenliste
     * @param {import('../features/journey/journey.svelte.js').Journey[][]} [params.journeyGroups] - Fahrtengruppen
     * @param {object} params.renderCtx - Render-Kontext mit Pagination- und Scroll-Daten
     * @param {string} params.layer - Zeichen-Ebene ('all' | 'static' | 'dynamic')
     * @param {boolean} params.isDynamicRotierend - Ob rotierender Nebenmonitor dynamisch gezeichnet wird
     * @param {boolean} params.fullScreen - Ob Hauptmonitor im Vollbildmodus ist
     * @returns {void}
     */
    _renderScreenByType(ctx, screen, width, height, { journeys, journeyGroups, renderCtx, layer, isDynamicRotierend, fullScreen }) {
        switch (screen.type) {
            case 'haupt':
            case 'neben':
            case 'neben_rotierend':
            case 'zuganzeiger_portrait':
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
                break;

            case 'abfahrt_zoom':
                drawAnschlusstafelZoomBoard(ctx, journeys, width, height, renderCtx, screen);
                break;

            case 'abfahrt':
            case 'abfahrt_portrait':
            case 'voranzeiger':
                drawVoranzeigerBoard(ctx, journeys, width, height, renderCtx, screen);
                break;

            case 'ankunft':
            case 'ankunft_portrait':
                drawAnkunftBoard(ctx, journeys, width, height, renderCtx, screen);
                break;

            case 'wagenreihung_plan':
                drawWagenreihungPlan(ctx, journeyGroups || [], this.journeyStore.platform, width, height, renderCtx, screen);
                break;

            case 'liste':
                if (layer === 'all' || layer === 'static') {
                    drawListeRow(ctx, journeys[0], width, height);
                }
                break;

            case 'vitrine32': {
                const trackNumber = document.getElementById('entry_gleis') ? document.getElementById('entry_gleis').value : '';
                drawVitrine32Wagenstand(ctx, journeyGroups || [], this.journeyStore.platform, width, height, trackNumber, {
                    activeFeatureIndex: this.activeFeatureIndex,
                    activeFeatureStr: this.activeFeature,
                    progress: this.vitrineProgress,
                    featureAlpha: this.featureAlpha,
                    drawLayer: layer
                });
                break;
            }

            default:
                console.warn(`[TrainDisplay] Unbekannter screen.type: ${screen.type}`);
                break;
        }
    }

    // ==========================================
    // Layout-spezifische Screen-Zuweisung
    // ==========================================

    /**
     * Baut die Journey-Zuweisungen für alle Screens des aktuellen Layouts auf.
     * Delegiert an den ScreenAssignmentService.
     *
     * @returns {Map<string, object>}
     */
    _buildScreenAssignments() {
        const { assignments, rotatingPages, activePageIndex } = ScreenAssignmentService.buildScreenAssignments({
            layout: this.currentLayout,
            journeyStore: this.journeyStore,
            activePageIndex: this.activePageIndex
        });

        this.rotatingPages = rotatingPages;
        this.activePageIndex = activePageIndex;
        return assignments;
    }

    /**
     * Gibt alle sichtbaren Journey-Gruppen zurück.
     * Gekoppelte Journeys werden als eine Gruppe zusammengefasst.
     *
     * @returns {Journey[][]} Array von Journey-Gruppen
     */
    _getVisibleJourneyGroups() {
        return ScreenAssignmentService.getVisibleJourneyGroups(this.journeyStore, this.currentLayout);
    }
}