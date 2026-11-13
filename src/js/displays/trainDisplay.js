// js/displays/trainDisplay.js
// Orchestrator — delegiert an spezialisierte Renderer-Module
import { config } from '../core/utils/config.js';
import { ScrollManager } from './core/scrollManager.js';
import { drawFormation } from './primitives/formationRenderer.js';
import { drawTrainInfo, shouldRenderFormation } from './boards/zuganzeigerRenderer.js';
import { drawListeRow, drawVoranzeigerBoard } from './boards/anschlusstafelRenderer.js';
import { drawVitrine32Wagenstand } from './boards/wagenstandGleisRenderer.js';
import { drawAnkunftBoard } from './boards/ankunftstafelRenderer.js';
import { drawAnschlusstafelZoomBoard } from './boards/anschlusstafelZoomRenderer.js';
import { displayConfigStore } from './core/displayConfigStore.svelte.js';
import { InfoTextVisibilityService } from '../features/journey/services/infoTextVisibilityService.js';
import { ScreenSyncService } from '../core/services/screenSyncService.js';
import { ScreenAssignmentService } from './core/screenAssignmentService.js';
import { CanvasLayerService } from './core/canvasLayerService.js';
import { createAnimationState, computeAnimationFrame } from './core/animationClock.js';

export class TrainDisplay {
    constructor(journeyStore) {
        this.journeyStore = journeyStore;
        this.rotating = false; // Feature-Rotation aktiv ('rotierend')
        this.scrollManager = new ScrollManager();
        this._customLayout = null;
        this._isRendering = false; // Re-entrance Guard
        this._updateScheduled = false; // Koaleszierung geplanter Redraws
        this._overlayDirtyScreens = new Set();
        this.anim = createAnimationState();
        this.rotatingPages = [];
        this._lastLayoutType = null;
        this._layoutSignature = null;
        this.lastRenderTime = 0;
        this._animId = null;

        // Canvas-Layer und Zeichenzustand sind ausgelagert; das Layout wird
        // über einen Getter bezogen, damit Umschaltungen sofort greifen.
        this.layers = new CanvasLayerService(() => this.currentLayout);

        this._startAnimationLoop();
    }

    get currentLayout() {
        return displayConfigStore.currentLayout || this._customLayout;
    }

    set currentLayout(val) {
        this._customLayout = val;
    }

    // ==========================================
    // Canvas-Verwaltung
    // ==========================================

    /**
     * Passt beide Canvas-Layer an das aktuelle Layout an. Bei einer
     * Größenänderung werden die als „dirty" markierten Overlay-Screens
     * verworfen, weil ihre Flächen beim Resize geleert wurden.
     * @returns {boolean} true, wenn mindestens ein Canvas angepasst wurde.
     */
    _resizeLayers() {
        if (!this.layers.resize()) return false;
        this._overlayDirtyScreens = new Set();
        return true;
    }

    /**
     * Liest die aktuell eingegebene Gleisnummer für den Wagenstandsanzeiger.
     * Der Wert wird einmal pro Zeichendurchlauf ermittelt und über den
     * RenderContext an die Renderer weitergereicht, damit im Renderpfad kein
     * DOM-Zugriff nötig ist.
     * @returns {string}
     */
    _readTrackNumber() {
        const input = document.getElementById('entry_gleis');
        return input ? input.value : '';
    }

    // ==========================================
    // Layout & Feature-Steuerung
    // ==========================================

    /**
     * Prüft, ob das aktuelle Layout Bildschirme mit Voranzeiger-/Anschlusstafel-Typ enthält.
     * @returns {boolean}
     */
    hasDeparturePagingLayout() {
        return Boolean(
            this.currentLayout && this.currentLayout.screens && this.currentLayout.screens.some(
                s => s.type === 'voranzeiger' || s.type === 'abfahrt' || s.type === 'abfahrt_zoom' || s.type === 'abfahrt_portrait'
            )
        );
    }

    /**
     * Synchronisiert das aktive Layout mit dem TrainDisplay.
     * Wird von der UI aufgerufen, wenn sich Monitor, Anzeigetyp oder Gehäuse
     * ändern. Bei einem echten Layoutwechsel werden alle Scroll-Overlays
     * verworfen, weil ihre Positionen und Zug-IDs an das alte Layout gebunden
     * sind und sonst als Geistertexte über der neuen Anzeige stehen bleiben.
     *
     * @param {object} layout - Das neue Layout-Objekt aus dem DisplayConfigStore.
     * @returns {void}
     */
    setLayout(layout) {
        if (!layout) return;

        // Layouttyp-Wechsel erkennen (nicht die vollständige Signatur): ein
        // Monitorwechsel bei gleichem Anzeigetyp darf die Sichtbarkeit nicht zurücksetzen.
        const nextLayoutType = layout.layoutType;
        if (nextLayoutType !== this._lastLayoutType) {
            this._lastLayoutType = nextLayoutType;
            displayConfigStore.setDeparturePage(0);

            // 1. Auto-Texte aktualisieren, damit neue Typen existieren.
            //    syncDynamicTexts() wendet danach bereits die Layout-Regel an.
            this.journeyStore.syncDynamicTexts();

            // 2. Sichtbarkeit gemäß neuem Layout setzen (auch beim ersten Aufruf).
            InfoTextVisibilityService.applyForLayoutType(
                this.journeyStore.journeys,
                nextLayoutType
            );
        }

        // Layout-Objekte werden vom Store bei jeder Änderung neu erzeugt.
        // Über einen Vergleich der serialisierten Daten erkennen wir, ob sich
        // wirklich etwas geändert hat (Skalierungsmodus-Wechsel o.ä. sollen
        // laufende Scrolltexte nicht neu starten).
        const signature = JSON.stringify(layout);
        if (signature === this._layoutSignature) return;
        this._layoutSignature = signature;

        this._customLayout = layout;
        this._resizeLayers();
        this.scrollManager.clearAll();
        this._overlayDirtyScreens = new Set();

        this.updateAll();
        window.dispatchEvent(new Event('resize'));
    }

    /**
     * Setzt einen spezifischen Zielmonitor für Multi-Monitor / Kiosk-Modus.
     * @param {string|number|null} screenNumber - '1', '2', '3' oder null für Gesamtansicht
     * @param {boolean} [is4k=false] - Ob 4K-Auflösung aktiviert werden soll
     * @param {boolean} [withBezel=false] - Ob Gehäuse-Modus gewünscht wird
     */
    setTargetScreen(screenNumber, is4k = false, withBezel = false) {
        displayConfigStore.setTargetScreen(screenNumber === 'all' ? null : screenNumber, is4k);
        if (withBezel !== undefined && (!screenNumber || screenNumber === 'all')) {
            displayConfigStore.showBezel = withBezel;
        }
        this._customLayout = null;

        this._resizeLayers();

        this.scrollManager.clearAll();
        this.updateAll();
        window.dispatchEvent(new Event('resize'));
    }

    // ==========================================
    // Animations-Loop
    // ==========================================

    /**
     * Startet die Frame-Schleife. Die Zeitlogik selbst liegt in
     * `animationClock.js`; hier werden nur Umgebung, Store-Schreibzugriffe
     * und die Drosselung im Performance-Modus abgewickelt.
     */
    _startAnimationLoop() {
        if (this._animId) return;
        const loop = () => {
            const layout = this.currentLayout;
            const isVitrine = layout?.layoutType === 'wagenstand_gleis' ||
                              layout?.screens?.some(s => s.type === 'vitrine32');
            const now = Date.now();

            const frame = computeAnimationFrame(this.anim, now, {
                isVitrine,
                rotating: this.rotating,
                pageCount: this.rotatingPages ? this.rotatingPages.length : 0,
                departurePaging: this.hasDeparturePagingLayout(),
                autoDeparturePage: config.voranzeigerAutoPage,
                manualDeparturePageIndex: displayConfigStore.departurePageIndex,
            });

            // Auto-Paging der Abfahrtstafel wird im Store gespiegelt, damit die
            // Seitenanzeige in der UI reaktiv mitläuft.
            if (frame.autoDeparturePageIndex !== null) {
                displayConfigStore.setDeparturePage(frame.autoDeparturePageIndex);
            }

            if (frame.needsRender) {
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
            this.anim.activeFeature = value;
            this.anim.featureAlpha = 1.0;
            this.updateAll();
        }
        ScreenSyncService.broadcastDisplayConfig({ activeFeature: this.anim.activeFeature });
    }

    // ==========================================
    // Render-Methoden
    // ==========================================

    /**
     * Erstellt den RenderContext, der an die Renderer-Module weitergegeben wird.
     * Enthält alle Referenzen, die die Module für Scrolling und Layout benötigen.
     */
    _createRenderContext(canvas, screen, zugID, fullScreen, cssScale = 1, trackNumber = '') {
        return {
            fullScreen,
            screen,
            scrollManager: this.scrollManager,
            zugID,
            canvas,
            cssScale,
            trackNumber,
            platform: this.journeyStore.platform,
            journeyStore: this.journeyStore,
            departurePageIndex: this.anim.departurePageIndex,
            departurePageAlpha: this.anim.departurePageAlpha,
            disruptionPageIndex: this.anim.disruptionPageIndex,
            disruptionPageAlpha: this.anim.disruptionPageAlpha,
            tickerOffset: this.anim.tickerOffset,
        };
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
            const canvas = this.layers.getBaseCanvas();
            if (!canvas) return;

            if (this._resizeLayers()) {
                window.dispatchEvent(new Event('resize'));
            }

            this.layers.drawBackground();

            this._renderDynamicScreens('static', canvas);

            // Dynamischen Layer vollständig verwerfen: Er wird direkt danach
            // aus den aktuellen Daten neu aufgebaut (kein Vollflächen-Blit).
            const overlay = this.layers.getOverlayCanvas();
            const overlayCtx = this.layers.getOverlayCtx();
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
        const canvas = this.layers.getBaseCanvas();
        if (!canvas) return;

        const overlay = this.layers.getOverlayCanvas();
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

    /**
     * Zeichnet die Screens eines Layers auf den zugehörigen Canvas.
     *
     * @param {'all'|'static'|'dynamic'} [layer='all'] - Zu zeichnende Ebene
     * @param {HTMLCanvasElement|null} [layerCanvas=null] - Ziel-Canvas des Durchlaufs
     * @returns {void}
     */
    _renderDynamicScreens(layer = 'all', layerCanvas = null) {
        try {
            const isStaticLayer = (layer === 'all' || layer === 'static');
            const baseCanvas = this.layers.getBaseCanvas();
            const overlayCanvas = this.layers.getOverlayCanvas();
            const defaultCanvas = layerCanvas || baseCanvas;
            if (!defaultCanvas) return;

            const container = baseCanvas ? baseCanvas.parentElement : defaultCanvas.parentElement;
            const cssScale = container ? (container.clientWidth / this.currentLayout.width) : 1;
            const screenAssignments = this._buildScreenAssignments();
            const drawnOverlayScreens = isStaticLayer ? null : new Set();
            // Zug-IDs des aktuellen Layouts sammeln, um am Ende des statischen
            // Durchlaufs Overlays aus einem vorherigen Layout zu entfernen.
            const activeZugIDs = isStaticLayer ? new Set() : null;
            // Gleisnummer einmal pro Durchlauf lesen (Renderer bekommen sie über den Context).
            const trackNumber = this._readTrackNumber();

            this.currentLayout.screens.forEach(screen => {
                try {
                    const assignment = screenAssignments.get(screen.id);
                    if (!assignment) {
                        // Screen ohne Zuweisung: Fläche nur leeren. Auf keinen
                        // Fall eine Fallback-Zug-ID verwenden – deren Cleanup
                        // würde sonst die Scroll-Overlays eines anderen Screens
                        // (z.B. des Hauptmonitors) entfernen.
                        if (isStaticLayer) {
                            this.layers.drawOnScreen(screen, () => {}, defaultCanvas, 'opaque');
                        }
                        return;
                    }
                    const { journeys, journeyGroups, zugID } = assignment;
                    if (activeZugIDs) activeZugIDs.add(zugID);
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
                        // Fallback ohne Overlay: Der dynamische Layer wird direkt
                        // auf den Basis-Layer gezeichnet. Vorher wird der statische
                        // Layer des Screens neu aufgebaut, damit sich die Frames
                        // nicht aufsummieren (Alpha-Blending).
                        targetCanvas = baseCanvas || defaultCanvas;
                        clearMode = 'none';
                    }

                    if ((!journeys || journeys.length === 0) && (!journeyGroups || journeyGroups.length === 0)) {
                        if (isStaticLayer) {
                            this.layers.drawOnScreen(screen, () => {}, targetCanvas, 'opaque');
                            this.scrollManager.clearForZug(zugID);
                        } else if (targetCanvas === overlayCanvas && this._overlayDirtyScreens.has(screen.id)) {
                            // Reste einer zuvor gezeichneten Animation entfernen
                            this.layers.drawOnScreen(screen, () => {}, targetCanvas, 'transparent');
                        }
                        return;
                    }

                    const fullScreen = screen.type === 'haupt';
                    const renderCtx = this._createRenderContext(
                        baseCanvas || targetCanvas,
                        screen,
                        zugID,
                        fullScreen,
                        cssScale,
                        trackNumber
                    );

                    if (screen.type === 'neben_rotierend') {
                        renderCtx.pageAlpha = this.anim.pageAlpha;
                        renderCtx.totalPages = this.rotatingPages ? this.rotatingPages.length : 0;
                        renderCtx.activePageIndex = this.anim.activePageIndex;
                        if (this.rotatingPages && this.rotatingPages[this.anim.activePageIndex]) {
                            renderCtx.activeInfoText = this.rotatingPages[this.anim.activePageIndex].infoText;
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
                                this.layers.drawOnScreen(screen, () => {}, targetCanvas, 'transparent');
                            }
                            return;
                        }
                        drawnOverlayScreens.add(screen.id);
                    }

                    const trackScroll = isStaticLayer || isDynamicRotierend;
                    if (trackScroll) this.scrollManager.beginRender();

                    // Fallback ohne Overlay-Canvas: statischen Layer des Screens
                    // erneut aufbauen, damit der dynamische Layer sauber auf der
                    // statischen Grundlage liegt (kein Aufsummieren über Frames).
                    if (!isStaticLayer && !isRotatingScreen && targetCanvas === baseCanvas) {
                        this.layers.drawOnScreen(screen, (ctx, width, height) => {
                            this._renderScreenByType(ctx, screen, width, height, {
                                journeys,
                                journeyGroups,
                                renderCtx,
                                layer: 'static',
                                isDynamicRotierend: false,
                                fullScreen
                            });
                        }, targetCanvas, 'opaque');
                    }

                    this.layers.drawOnScreen(screen, (ctx, width, height) => {
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

            if (activeZugIDs) {
                this.scrollManager.cleanupInactiveZugIDs(activeZugIDs);
            }

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
                        ctx.globalAlpha = this.anim.pageAlpha;
                    }
                    drawFormation(ctx, journeys, this.journeyStore.platform, {
                        fullScreen,
                        activeFeature: this.anim.activeFeature,
                        featureAlpha: this.anim.featureAlpha,
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

            case 'liste':
                if (layer === 'all' || layer === 'static') {
                    drawListeRow(ctx, journeys[0], width, height);
                }
                break;

            case 'vitrine32': {
                // Gleisnummer kommt aus dem RenderContext (einmal pro Durchlauf gelesen).
                drawVitrine32Wagenstand(ctx, journeyGroups || [], this.journeyStore.platform, width, height, renderCtx.trackNumber, {
                    activeFeatureIndex: this.anim.activeFeatureIndex,
                    activeFeatureStr: this.anim.activeFeature,
                    progress: this.anim.vitrineProgress,
                    featureAlpha: this.anim.featureAlpha,
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
            activePageIndex: this.anim.activePageIndex
        });

        this.rotatingPages = rotatingPages;
        this.anim.activePageIndex = activePageIndex;
        return assignments;
    }
}
