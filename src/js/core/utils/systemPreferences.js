/**
 * Systemeinstellungen (Barrierefreiheit) als reine Browser-Utilities.
 * Ersetzt die frühere Tauri-Abfrage `check_reduce_transparency`, die nur auf macOS
 * funktionierte und deren Event (`reduce-transparency-changed`) im Frontend nie ankam.
 */

/**
 * Beobachtet die Systemeinstellung "Transparenz reduzieren".
 * Nutzt die CSS-Media-Query `prefers-reduced-transparency`, die von WebKit
 * (macOS-WebView) direkt aus den Systemeinstellungen gespeist wird.
 * Auf Plattformen ohne Unterstützung bleibt der Wert dauerhaft `false`.
 * @param {(reduceTransparency: boolean) => void} onChange - Callback bei Änderung (und einmalig initial)
 * @returns {() => void} Aufräumfunktion zum Entfernen des Listeners
 */
export function watchReducedTransparency(onChange) {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        onChange(false);
        return () => {};
    }

    const query = window.matchMedia('(prefers-reduced-transparency: reduce)');
    onChange(query.matches);

    /**
     * Reicht Änderungen der Systemeinstellung an den Aufrufer weiter.
     * @param {MediaQueryListEvent} event
     * @returns {void}
     */
    const handleChange = (event) => onChange(event.matches);
    query.addEventListener('change', handleChange);

    return () => query.removeEventListener('change', handleChange);
}
