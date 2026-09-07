import { flip as originalFlip } from 'svelte/animate';

/**
 * Ein Wrapper um Svelte's `flip` Animation, der NaN-Werte (Division durch 0 bei 0-Höhe)
 * aus den Keyframes entfernt, um Warnungen im Browser zu vermeiden.
 */
export function safeFlip(node, animation, params) {
    const r = originalFlip(node, animation, params);
    if (r && r.css) {
        const originalCss = r.css;
        r.css = (t, u) => {
            const cssStr = originalCss(t, u);
            if (cssStr.includes('NaN')) {
                return ''; // Leerer CSS-String, um den ungültigen Transform zu verwerfen
            }
            return cssStr;
        };
    }
    return r;
}
