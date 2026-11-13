// js/displays/core/canvasLayerService.js
// Kapselt die beiden Canvas-Layer (statisch/dynamisch), ihre 2D-Kontexte und
// das Vorbereiten des Zeichenzustands (Clipping, Translation, HiDPI-Skalierung).
import { COLORS } from '../../core/constants/theme.js';

export class CanvasLayerService {
    /**
     * @param {() => object|null} getLayout - Liefert das aktuell aktive Layout-Objekt.
     */
    constructor(getLayout) {
        this._getLayout = getLayout;
        this._baseCanvasRef = null;
        this._overlayCanvasRef = null;
        this._baseCtx = null;
        this._overlayCtx = null;
    }

    // ==========================================
    // Canvas-Verwaltung
    // ==========================================

    /**
     * Liefert das statische Basis-Canvas (zimCanvas).
     * @returns {HTMLCanvasElement|null}
     */
    getBaseCanvas() {
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
    getOverlayCanvas() {
        if (!this._overlayCanvasRef || !this._overlayCanvasRef.isConnected) {
            this._overlayCanvasRef = document.getElementById('zimDynamicCanvas');
            this._overlayCtx = null;
        }
        return this._overlayCanvasRef;
    }

    /**
     * Liefert den 2D-Kontext des statischen Basis-Canvas.
     * `willReadFrequently` bleibt hier bewusst erhalten, da die Zugnummern-
     * Breite weiterhin per Pixel-Scan gemessen wird – dieser Scan läuft auch
     * im dynamischen Durchlauf des rotierenden Nebenmonitors, der auf diesem
     * Layer gezeichnet wird. Der Basis-Layer wird dadurch nur bei Daten-/
     * Layoutänderungen neu aufgebaut und nicht pro Frame kopiert.
     * @param {HTMLCanvasElement} canvas
     * @returns {CanvasRenderingContext2D|null}
     */
    getBaseCtx(canvas) {
        if (!this._baseCtx || this._baseCtx.canvas !== canvas) {
            this._baseCtx = canvas.getContext('2d', { willReadFrequently: true });
        }
        return this._baseCtx;
    }

    /**
     * Liefert den GPU-beschleunigten 2D-Kontext des dynamischen Overlays.
     * @returns {CanvasRenderingContext2D|null}
     */
    getOverlayCtx() {
        const canvas = this.getOverlayCanvas();
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
    resize() {
        const layout = this._getLayout();
        if (!layout) return false;

        const width = layout.width;
        const height = layout.height;
        const base = this.getBaseCanvas();
        const overlay = this.getOverlayCanvas();
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

        return resized;
    }

    // ==========================================
    // Zeichenzustand
    // ==========================================

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
        const canvas = targetCanvas || this.getBaseCanvas();
        if (!canvas) return;
        const isOverlay = canvas === this.getOverlayCanvas();
        const ctx = isOverlay ? this.getOverlayCtx() : this.getBaseCtx(canvas);
        if (!ctx || !screen) return;

        ctx.save();
        try {
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
            const scaleFactor = this._getLayout()?.scaleFactor || 1;
            if (scaleFactor !== 1) {
                ctx.scale(scaleFactor, scaleFactor);
                drawFunction(ctx, screen.w / scaleFactor, screen.h / scaleFactor);
            } else {
                drawFunction(ctx, screen.w, screen.h);
            }
        } finally {
            // Auch bei einem Renderer-Fehler zurücksetzen: sonst bleiben Translate,
            // Clip-Region und ggf. Skalierung aktiv und blockieren alle folgenden
            // Screens desselben Frames (und der State-Stack wächst pro Frame).
            ctx.restore();
        }
    }

    /**
     * Füllt den gesamten Canvas-Hintergrund mit der Standardfarbe.
     * Bei Layouts mit hasBezelGap (z.B. Standard mit 50px Gehäusesteg)
     * wird der 50px Steg in DB-Dunkelblau (RAL 5022 Nachtblau) gerendert.
     */
    drawBackground() {
        const layout = this._getLayout();
        const canvas = this.getBaseCanvas();
        if (!canvas || !layout) return;
        const ctx = this.getBaseCtx(canvas);
        if (!ctx) return;

        ctx.fillStyle = COLORS.MIDNIGHT_BLUE;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Trennsteg(e) in authentischem DB-Dunkelblau zeichnen, falls im Layout definiert
        if (layout.hasBezelGap && layout.gapWidth) {
            const gapW = layout.gapWidth;
            // Positionen kommen aus dem Layout (dort bereits 4K-skaliert):
            // `gaps` für Triple-Gehäuse, `gapX` für Doppel-Gehäuse.
            const gaps = Array.isArray(layout.gaps) && layout.gaps.length
                ? layout.gaps
                : [layout.gapX !== undefined ? layout.gapX : 1920];

            for (const gapX of gaps) {
                // DB Dunkelblau Grundfläche für den Steg (RAL 5022 Nachtblau / #08152b)
                ctx.fillStyle = '#071328';
                ctx.fillRect(gapX, 0, gapW, canvas.height);

                // Subtiler metallischer 3D-Verlauf (RAL 5022 DB-Nachtblau seidenmatt)
                const grad = ctx.createLinearGradient(gapX, 0, gapX + gapW, 0);
                grad.addColorStop(0, '#040a14');
                grad.addColorStop(0.15, '#061224');
                grad.addColorStop(0.5, '#0a1a38');
                grad.addColorStop(0.85, '#061224');
                grad.addColorStop(1, '#040a14');
                ctx.fillStyle = grad;
                ctx.fillRect(gapX, 0, gapW, canvas.height);

                // Subtile Schattenfuge zum Panelrand
                ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                ctx.fillRect(gapX, 0, 3, canvas.height);
                ctx.fillRect(gapX + gapW - 3, 0, 3, canvas.height);

                // Feine 1px Lichtkanten
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fillRect(gapX + 3, 0, 1, canvas.height);
                ctx.fillRect(gapX + gapW - 4, 0, 1, canvas.height);
            }
        }
    }
}
