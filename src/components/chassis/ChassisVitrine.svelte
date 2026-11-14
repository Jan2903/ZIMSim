<script>
    /**
     * @fileoverview Vitrinen-Chassis.
     * Gebürstetes Aluminium mit zwei Standfüßen unterhalb des Rahmens
     * (`extraBottom` des Gehäuseprofils). Steht immer an einem Querformat-
     * Display.
     */

    /**
     * @typedef {Object} Props
     * @property {number} vbWidth - Gehäusebreite in logischen Pixeln
     * @property {number} vbHeight - Gehäusehöhe in logischen Pixeln
     * @property {number} padX - Rahmenrand links/rechts
     * @property {number} padY - Rahmenrand oben/unten
     * @property {number} displayHeight - Höhe des Display-Ausschnitts
     */
    let { vbWidth, vbHeight, padX, padY, displayHeight } = $props();
</script>

<!-- Standfüße nach unten -->
<rect x="240" y={vbHeight - 180} width="70" height="180" fill="url(#bezel-alu-grad)" stroke="#334155" stroke-width="2" />
<rect x={vbWidth - 310} y={vbHeight - 180} width="70" height="180" fill="url(#bezel-alu-grad)" stroke="#334155" stroke-width="2" />

<!-- Vitrinen-Hauptrahmen -->
<rect
    x="0"
    y="0"
    width={vbWidth}
    height={vbHeight - 100}
    rx="12"
    fill="url(#bezel-alu-grad)"
    stroke="#334155"
    stroke-width="3"
/>

<!-- Display-Ausschnitt -->
<rect
    x={padX}
    y={padY}
    width={vbWidth - (padX * 2)}
    height={displayHeight}
    fill="#030814"
/>
