/**
 * Gibt den JavaScript-Event-Loop frei, damit Browser-Events (Klicks, Tasten, Render-Frames)
 * ohne Einfrieren oder Warnungen verarbeitet werden können.
 * Nutzt scheduler.yield() wenn verfügbar (Chromium), sonst MessageChannel (Firefox/Safari) ohne 4ms-Timeout-Clamp.
 * @param {AbortSignal} [signal=null]
 * @returns {Promise<void>}
 */
export async function yieldToMain(signal = null) {
    if (signal && signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }
    if (typeof window !== 'undefined' && window.scheduler && typeof window.scheduler.yield === 'function') {
        await window.scheduler.yield();
    } else if (typeof MessageChannel !== 'undefined') {
        await new Promise(resolve => {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => resolve();
            channel.port2.postMessage(null);
        });
    } else {
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (signal && signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }
}
