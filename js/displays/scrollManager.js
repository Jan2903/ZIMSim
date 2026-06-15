// js/displays/scrollManager.js

/**
 * Verwaltet alle scrollenden Text-Overlays, die als HTML-Elemente über dem Canvas liegen.
 * Verwendet eine Klasse, da eigener DOM-State (scrollDivs) verwaltet werden muss.
 */
export class ScrollManager {
    constructor() {
        /** @type {Object.<number, Object.<string, HTMLDivElement>>} */
        this.scrollDivs = {};
        /** @type {Set<string>|null} Tracking aktiver IDs während eines Render-Durchlaufs */
        this._activeIDs = null;
    }

    /**
     * Startet einen neuen Render-Durchlauf. Alle createOrUpdate-Aufrufe danach
     * werden getrackt, um am Ende nicht mehr benötigte Divs aufzuräumen.
     */
    beginRender() {
        this._activeIDs = new Set();
    }

    /**
     * Erstellt oder aktualisiert ein scrollendes Text-Overlay.
     * Wenn sich nichts geändert hat, wird das bestehende Div beibehalten,
     * um den weichen Scrollfluss nicht zu unterbrechen.
     *
     * @param {HTMLCanvasElement} canvas - Das Canvas-Element (Parent für die Overlays).
     * @param {number} zugID - Die 1-basierte Zug-ID.
     * @param {string} scrollingID - Eindeutige ID für dieses Scroll-Element.
     * @param {string} text - Der anzuzeigende Text (leer = Element entfernen).
     * @param {string} left - CSS-Wert für left.
     * @param {string} top - CSS-Wert für top.
     * @param {string} width - CSS-Wert für width.
     * @param {string} height - CSS-Wert für height.
     * @param {string} color - Textfarbe.
     * @param {string} font - CSS font-Wert.
     */
    createOrUpdate(canvas, zugID, scrollingID, text, left, top, width, height, color, font) {
        // Stelle sicher, dass das Objekt für diesen Zug existiert
        if (!this.scrollDivs[zugID]) {
            this.scrollDivs[zugID] = {};
        }

        // Tracke aktive IDs für späteres Cleanup
        if (this._activeIDs) {
            this._activeIDs.add(scrollingID);
        }

        if (text === "") {
            this.scrollDivs[zugID][scrollingID]?.remove();
            delete this.scrollDivs[zugID][scrollingID];
            return null;
        }

        const existingDiv = this.scrollDivs[zugID][scrollingID];

        // Wenn alles exakt gleich bleibt, tun wir nichts, um den weichen Scrollfluss nicht zu unterbrechen
        if (existingDiv &&
            existingDiv.dataset.left === left &&
            existingDiv.dataset.top === top &&
            existingDiv.dataset.width === width &&
            existingDiv.dataset.height === height &&
            existingDiv.dataset.text === text &&
            existingDiv.dataset.color === color &&
            existingDiv.dataset.font === font) {
            return;
        }

        // Ansonsten entfernen wir das alte und rendern neu
        existingDiv?.remove();

        const scrollDiv = document.createElement('div');
        scrollDiv.classList.add('scroll-container');
        scrollDiv.style.left = left;
        scrollDiv.style.top = top;
        scrollDiv.style.width = width;
        scrollDiv.style.height = height;
        scrollDiv.style.zIndex = '15'; // Wichtig: Zwischen Canvas(10) und Hardware-Bezel(20)

        // Properties hinterlegen, um Repaints auf das Nötigste zu beschränken
        scrollDiv.dataset.left = left;
        scrollDiv.dataset.top = top;
        scrollDiv.dataset.width = width;
        scrollDiv.dataset.height = height;
        scrollDiv.dataset.text = text;
        scrollDiv.dataset.color = color;
        scrollDiv.dataset.font = font;

        canvas.parentElement.appendChild(scrollDiv);

        const inner = document.createElement('div');
        inner.classList.add('scroll-text');
        inner.style.color = color;
        inner.style.font = font;
        inner.style.lineHeight = height;

        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.font = font;
        const textWidth = tempCtx.measureText(text).width;
        const scrollWidth = parseInt(width);

        if ((textWidth > scrollWidth) || scrollingID === 'ankunft' || scrollingID === 'arrival') {
            let connect = ' +++ ';
            if (scrollingID === 'ankunft' || scrollingID === 'arrival') connect = ' ';
            let result = text + connect + text + connect;
            for (let i = 0; i < Math.ceil((scrollWidth * 10) / textWidth); i++) {
                result += text + connect;
            }
            inner.textContent = result;
            const totalWidth = tempCtx.measureText(result).width;
            inner.style.setProperty('--scroll-duration', `${totalWidth / 100}s`);
        } else {
            inner.textContent = text;
            inner.style.animation = 'none';
            inner.style.paddingLeft = '10px';
        }

        scrollDiv.appendChild(inner);
        this.scrollDivs[zugID][scrollingID] = scrollDiv;
    }

    /**
     * Räumt alle Scroll-Divs auf, die im aktuellen Render-Tick nicht mehr benötigt wurden.
     * @param {number} zugID - Die 1-basierte Zug-ID.
     */
    cleanupUnused(zugID) {
        if (this.scrollDivs[zugID] && this._activeIDs) {
            for (const [id, div] of Object.entries(this.scrollDivs[zugID])) {
                if (!this._activeIDs.has(id)) {
                    div.remove();
                    delete this.scrollDivs[zugID][id];
                }
            }
        }
        this._activeIDs = null;
    }

    /**
     * Entfernt alle Scroll-Divs eines bestimmten Zuges.
     * @param {number} zugID - Die 1-basierte Zug-ID.
     */
    clearForZug(zugID) {
        if (this.scrollDivs[zugID]) {
            Object.values(this.scrollDivs[zugID]).forEach(div => div?.remove());
            this.scrollDivs[zugID] = {};
        }
    }

    /**
     * Entfernt alle Scroll-Divs komplett (z.B. bei Layout-Wechsel).
     */
    clearAll() {
        document.querySelectorAll('.scroll-container').forEach(el => el.remove());
        this.scrollDivs = {};
    }
}
