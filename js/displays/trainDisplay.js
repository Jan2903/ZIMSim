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
    constructor(trainData) {
        this.trainData = trainData;
        this.activeFeature = 'wagennummern'; // 'wagennummern', 'ausstattung', 'klasse'
        this.features = ['wagennummern', 'ausstattung', 'klasse'];
        this.rotationIndex = 0;
        this.rotating = false;
        this.scrollManager = new ScrollManager();
        this.currentLayout = LAYOUTS.standard;
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
                    this.updateAll(); // Neu zeichnen sobald geladen
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
    _createRenderContext(canvas, screen, zugID, fullScreen) {
        return {
            fullScreen,
            screen,
            scrollManager: this.scrollManager,
            zugID,
            canvas,
        };
    }

    /**
     * Aktualisiert einen einzelnen Monitor.
     * Wird von der Zug-Rotation in utils.js aufgerufen.
     *
     * @param {number} departureIndex - Index der Abfahrt (0-basiert).
     * @param {string} info_canvas_id - Legacy-Canvas-ID für Screen-Mapping.
     * @param {string} wagen_canvas_id - Legacy-Canvas-ID (nicht mehr direkt verwendet).
     * @param {boolean} fullScreen - Ob der Hauptmonitor gezeichnet wird.
     */
    update(departureIndex, info_canvas_id, wagen_canvas_id, fullScreen) {
        try {
            const departure = this.trainData.departures[departureIndex];

            // Altes Screen-Mapping beibehalten für Rückwärtskompatibilität
            let screenName = 'hauptmonitor';
            if (info_canvas_id === 'display2_zug1') screenName = 'nebenmonitor_1';
            else if (info_canvas_id === 'display2_zug2') screenName = 'nebenmonitor_2';

            const screen = this.currentLayout.screens.find(s => s.id === screenName);
            const zugID = fullScreen ? 1 : (screenName === 'nebenmonitor_1' ? 2 : 3);

            if (!departure) {
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
                drawTrainInfo(ctx, departure, width, renderCtx);
                ctx.save();
                ctx.translate(0, 800);
                drawFormation(ctx, departure, this.trainData, {
                    fullScreen,
                    activeFeature: this.activeFeature,
                });
                ctx.restore();
            });

            // Räume alle Scroll-Divs auf, die im aktuellen Render-Tick nicht mehr benötigt wurden
            this.scrollManager.cleanupUnused(zugID);

        } catch (err) {
            console.error(`Error in update for departure index ${departureIndex}:`, err);
        }
    }

    /**
     * Zeichnet alle Monitore neu. Haupteinstieg nach Datenänderungen.
     */
    updateAll() {
        const canvas = document.getElementById('zimCanvas');
        if (!canvas) return;

        // Stelle sicher, dass das Canvas immer die tatsächlichen Maße des aktuellen Layouts hat,
        // insbesondere wichtig direkt nach dem initialen Neuladen der Seite
        if (canvas.width !== this.currentLayout.width || canvas.height !== this.currentLayout.height) {
            canvas.width = this.currentLayout.width;
            canvas.height = this.currentLayout.height;
            window.dispatchEvent(new Event('resize')); // Zwinge events.js, die UI-Skalierung zu aktualisieren
        }

        this.ctx = canvas.getContext('2d');
        this.drawFullBackground();

        this.currentLayout.screens.forEach(screen => {
            let depIndex = screen.trainIndex;

            // Sonderlogik für den rotierenden Monitor
            if (screen.type === 'neben_rotierend') {
                depIndex = config.rotate_3_6 ? (config.current_rotating_zug - 1) : (config.current_display3_zug - 1);
            }

            const departure = this.trainData.departures[depIndex];
            if (!departure) return;

            const zugID = depIndex + 1;
            const fullScreen = screen.type === 'haupt';
            const renderCtx = this._createRenderContext(canvas, screen, zugID, fullScreen);

            this.scrollManager.beginRender();

            this.drawOnScreen(screen, (ctx, width, height) => {
                if (screen.type === 'haupt' || screen.type === 'neben' || screen.type === 'neben_rotierend') {
                    drawTrainInfo(ctx, departure, width, renderCtx);
                    ctx.save();
                    ctx.translate(0, 800);
                    drawFormation(ctx, departure, this.trainData, {
                        fullScreen,
                        activeFeature: this.activeFeature,
                    });
                    ctx.restore();
                } else if (screen.type === 'liste') {
                    drawListeRow(ctx, departure, width, height);
                }
            });

            // Räume alle Scroll-Divs auf, die im aktuellen Render-Tick nicht mehr benötigt wurden
            this.scrollManager.cleanupUnused(zugID);
        });
    }
}