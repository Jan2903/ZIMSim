// js/displays/boards/ankunftstafelTokens.js

/**
 * Geometrie-Tokens der Ankunftstafel.
 *
 * P3: Die Zeilenzahl war zuvor im Renderer hartcodiert (Hochformat 20,
 * Querformat 7). Sie wird jetzt – wie bei der Anschlusstafel – über den
 * Token-Service aufgelöst. Die übrigen Kopf- und Zeilenmaße bleiben vorerst
 * im Renderer, weil sie dort direkt aus Ausrichtung und Breite berechnet
 * werden.
 *
 * Alle Werte sind logische Pixel der jeweiligen Ausrichtung:
 *   landscape -> 1920×1080 logische Fläche
 *   portrait  -> 1080×1920 logische Fläche
 * Die 4K-Varianten nutzen dieselbe logische Fläche mit canvas-weitem
 * ctx.scale(2) und überschreiben nur die Zeilenzahl.
 */
export const ANKUNFTSTAFEL_TOKENS = {
    // Querformat 1920×1080 (Basis für fhd_landscape und uhd_landscape)
    landscape: {
        meta: { maxRows: 7 }
    },

    // Hochformat 1080×1920 (Basis für fhd_portrait und uhd_portrait)
    portrait: {
        meta: { maxRows: 16 }
    },

    // 4K-Overrides: nur die Werte, die vom hochskalierten Basisdesign abweichen.
    overrides: {
        uhd_portrait: {
            meta: { maxRows: 20 }
        }
    }
};
