<script>
    /**
     * @fileoverview Stelen-Chassis.
     * Hochformat-Gehäuse (9:16) mit massivem Sockel unterhalb des Rahmens
     * (`extraBottom` des Gehäuseprofils).
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

<!-- Massiver Sockel unten -->
<rect
    x="120"
    y={vbHeight - 180}
    width={vbWidth - 240}
    height="180"
    fill="#1e293b"
    stroke="#334155"
    stroke-width="3"
/>
<rect
    x="140"
    y={vbHeight - 30}
    width={vbWidth - 280}
    height="20"
    fill="#0f172a"
/>

<!-- Stelen-Körper -->
<rect
    x="0"
    y="0"
    width={vbWidth}
    height={vbHeight - 140}
    rx="14"
    fill="url(#bezel-bg-grad)"
    stroke="#0e2852"
    stroke-width="3"
/>

<!-- Display-Ausschnitt 1080x1920 -->
<rect
    x={padX}
    y={padY}
    width={vbWidth - (padX * 2)}
    height={displayHeight}
    fill="#030814"
/>
