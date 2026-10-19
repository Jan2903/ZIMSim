// js/core/utils/screenshot.js

/**
 * Zentrale Screenshot-Hilfen für das ZIM-Display.
 *
 * Nutzt `canvas.toBlob()` statt des blockierenden, speicherintensiven
 * `toDataURL()`. Unterstützt optional das Komponieren mit dem Vektor-Gehäuse
 * (HardwareBezel-SVG), sodass die Display-Fläche exakt an der Offset-Position
 * eingebettet wird.
 */

/**
 * Wandelt ein Canvas in einen PNG-Blob um.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas konnte nicht in einen Blob umgewandelt werden.'));
        }, 'image/png');
    });
}

/**
 * Lädt ein Bild über eine URL und wartet auf das Laden.
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('SVG-Gehäuse konnte nicht geladen werden.'));
        img.src = url;
    });
}

/**
 * Stößt einen Browser-Download eines Blobs an.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {void}
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Erzeugt einen zeitgestempelten PNG-Dateinamen.
 * @param {string} [prefix='zim_screenshot']
 * @returns {string}
 */
export function timestampedFilename(prefix = 'zim_screenshot') {
    return `${prefix}_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
}

/**
 * Rendert das Display-Canvas – optional inklusive Gehäuse – und lädt es als PNG
 * herunter.
 *
 * @param {object} options
 * @param {HTMLCanvasElement} options.canvas - Das Display-Canvas
 * @param {{svgElement: SVGElement|null, width: number, height: number, offsetX: number, offsetY: number}|null} [options.casing]
 *        Gehäuse-Informationen; null für einen randlosen Canvas-Export
 * @param {string} [options.filename] - Ziel-Dateiname
 * @returns {Promise<void>}
 */
export async function downloadDisplayScreenshot({ canvas, casing = null, filename } = {}) {
    if (!canvas) return;
    const name = filename || timestampedFilename();

    // Randloser Export oder kein SVG verfügbar
    if (!casing || !casing.svgElement) {
        downloadBlob(await canvasToBlob(canvas), name);
        return;
    }

    try {
        const { svgElement, width, height, offsetX, offsetY } = casing;
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const svgUrl = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }));

        let img;
        try {
            img = await loadImage(svgUrl);
        } finally {
            URL.revokeObjectURL(svgUrl);
        }

        const composed = document.createElement('canvas');
        composed.width = width;
        composed.height = height;
        const ctx = composed.getContext('2d');

        // 1. Vektor-Gehäuse zeichnen
        ctx.drawImage(img, 0, 0, width, height);
        // 2. Display-Canvas an exakter Offset-Position einbetten
        ctx.drawImage(canvas, offsetX, offsetY);

        downloadBlob(await canvasToBlob(composed), name);
    } catch (err) {
        console.warn('[Screenshot] Composing mit Gehäuse fehlgeschlagen, Fallback:', err);
        downloadBlob(await canvasToBlob(canvas), name);
    }
}
