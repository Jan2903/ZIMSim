<script>
    /**
     * @fileoverview Standard-Chassis (Überkopf, Bar-Type).
     * DB-Nachtblau RAL 5022 mit Blendenfugen, Display-Ausschnitt und
     * vertikalen Trennstegen zwischen den Panels. Wird von den Styles
     * `standard` (Überkopf) und `stretched` (Bar-Type) geteilt; der
     * Unterschied liegt allein in den Gehäusemaßen (padding).
     */

    /**
     * @typedef {Object} Props
     * @property {number} vbWidth - Gehäusebreite in logischen Pixeln
     * @property {number} vbHeight - Gehäusehöhe in logischen Pixeln
     * @property {number} padX - Rahmenrand links/rechts
     * @property {number} padY - Rahmenrand oben/unten
     * @property {number} displayHeight - Höhe des Display-Ausschnitts
     * @property {number} gapWidth - Breite eines Trennstegs
     * @property {number[]} gapXPositions - X-Positionen der Trennstege
     */
    let {
        vbWidth,
        vbHeight,
        padX,
        padY,
        displayHeight,
        gapWidth = 50,
        gapXPositions = []
    } = $props();
</script>

<rect
    x="0"
    y="0"
    width={vbWidth}
    height={vbHeight}
    rx="16"
    fill="url(#bezel-bg-grad)"
    stroke="#0e2852"
    stroke-width="2"
/>

<!-- Obere Gehäuseblende mit Fuge -->
<rect x="20" y="20" width={vbWidth - 40} height="3" fill="rgba(0, 0, 0, 0.8)" />
<rect x="20" y="23" width={vbWidth - 40} height="1" fill="rgba(255, 255, 255, 0.12)" />

<!-- Aussparung für die Monitore -->
<!-- Bewusst ohne SVG-Filter: Chromium (v.a. Android/GPU) begrenzt
     Filter-Puffer und schneidet bei breiten Gehäusen (2+ Monitore,
     > 4096 px) den rechten Teil der Fläche ab. Der Einbauschatten
     wird stattdessen als Box-Shadow am Bezel-Lip gezeichnet. -->
<rect
    x={padX}
    y={padY}
    width={vbWidth - (padX * 2)}
    height={displayHeight}
    fill="#030814"
/>

<!-- Innere Gehäusefasen um das Display -->
<rect x={padX} y={padY} width={vbWidth - (padX * 2)} height="6" fill="rgba(0, 0, 0, 0.8)" />
<rect x={padX} y={padY} width="6" height={displayHeight} fill="rgba(0, 0, 0, 0.8)" />
<rect x={padX} y={padY + displayHeight - 6} width={vbWidth - (padX * 2)} height="6" fill="rgba(0, 0, 0, 0.8)" />
<rect x={padX + vbWidth - (padX * 2) - 6} y={padY} width="6" height={displayHeight} fill="rgba(0, 0, 0, 0.8)" />

<!-- Vertikale Trennstege zwischen Monitoren -->
{#each gapXPositions as gapX}
    {@const gapW = gapWidth}
    <g class="bezel-post">
        <rect x={gapX} y={padY} width={gapW} height={displayHeight} fill="url(#metal-accent)" />
        <rect x={gapX} y={padY} width="3" height={displayHeight} fill="rgba(0, 0, 0, 0.45)" />
        <rect x={gapX + gapW - 3} y={padY} width="3" height={displayHeight} fill="rgba(0, 0, 0, 0.45)" />
        <rect x={gapX + 3} y={padY} width="1" height={displayHeight} fill="rgba(255, 255, 255, 0.05)" />
        <rect x={gapX + gapW - 4} y={padY} width="1" height={displayHeight} fill="rgba(255, 255, 255, 0.05)" />
    </g>
{/each}

<!-- Untere Gehäuseblende mit Fuge -->
<rect x="20" y={vbHeight - 23} width={vbWidth - 40} height="1" fill="rgba(255, 255, 255, 0.12)" />
<rect x="20" y={vbHeight - 20} width={vbWidth - 40} height="3" fill="rgba(0, 0, 0, 0.8)" />
