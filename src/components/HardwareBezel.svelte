<script>
    /**
     * @fileoverview HardwareBezel.svelte
     * Prozedurales, vektorbasiertes DB-Gehäuse für ZIM-Displays.
     * Unterstützt Überkopf-Gehäuse (RAL 5022 Nachtblau mit Deckenrohren & Mittelstegen),
     * Vitrinen mit Aluminium-Standfüßen und Stelen mit massivem Sockel.
     */

    /**
     * @typedef {Object} Props
     * @property {number} width - Gesamte Gehäusebreite in Pixeln
     * @property {number} height - Gesamte Gehäusehöhe in Pixeln
     * @property {number} paddingX - Rand links und rechts
     * @property {number} paddingY - Rand oben und unten
     * @property {object} layout - Das aktuelle Layout-Objekt
     */
    let { 
        width = 4430, 
        height = 1600, 
        paddingX = 270, 
        paddingY = 260,
        layout = {}
    } = $props();

    const family = $derived(layout.family || 'standard');
    const isVitrine = $derived(family === 'vitrine');
    const isStele = $derived(family === 'stele');
    const isStretched = $derived(family === 'stretched');
    // Nur Standard-/Überkopf-/Stretched-Gehäuse haben einen durchgehend
    // deckenden Korpus. Vitrine und Stele lassen Flächen transparent.
    const hasSolidBody = $derived(!isVitrine && !isStele);

    // Berechnung der X-Positionen der 50px-Mittelstege relativ zum Gehäuse.
    // Die Positionen stammen aus dem Layout (dort bereits 4K-skaliert) und
    // liegen im Canvas-Raum; das Gehäuse ist um paddingX (= casingOffsetX)
    // verschoben.
    let gapXPositions = $derived.by(() => {
        if (!layout.hasBezelGap || !layout.gapWidth) return [];
        const gaps = Array.isArray(layout.gaps) && layout.gaps.length
            ? layout.gaps
            : (layout.gapX !== undefined ? [layout.gapX] : []);
        return gaps.map(gapX => paddingX + gapX);
    });
</script>

<div 
    class="hardware-bezel-wrapper" 
    style="width: {width}px; height: {height}px; background-color: {hasSolidBody ? '#050e1c' : 'transparent'};"
    aria-hidden="true"
>
    <svg 
        class="hardware-bezel-svg" 
        viewBox="0 0 {width} {height}" 
        width="{width}" 
        height="{height}"
        preserveAspectRatio="none"
    >
        <defs>
            <!-- Haupt-Gehäusefarbverlauf DB-Nachtblau RAL 5022 -->
            <linearGradient id="bezel-bg-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#091833" />
                <stop offset="10%" stop-color="#071328" />
                <stop offset="50%" stop-color="#050e1c" />
                <stop offset="90%" stop-color="#071328" />
                <stop offset="100%" stop-color="#091833" />
            </linearGradient>

            <!-- Gebürstetes Aluminium für Vitrinen-Gehäuse -->
            <linearGradient id="bezel-alu-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#94a3b8" />
                <stop offset="25%" stop-color="#64748b" />
                <stop offset="50%" stop-color="#cbd5e1" />
                <stop offset="75%" stop-color="#475569" />
                <stop offset="100%" stop-color="#64748b" />
            </linearGradient>

            <!-- Metallischer Glanzverlauf für den Mittelsteg -->
            <linearGradient id="metal-accent" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#040a14" />
                <stop offset="15%" stop-color="#061224" />
                <stop offset="50%" stop-color="#0a1a38" />
                <stop offset="85%" stop-color="#061224" />
                <stop offset="100%" stop-color="#040a14" />
            </linearGradient>
        </defs>

        {#if isVitrine}
            <!-- VITRINEN-BAUFORM: Standfüße nach unten -->
            <rect x="240" y="{height - 180}" width="70" height="180" fill="url(#bezel-alu-grad)" stroke="#334155" stroke-width="2" />
            <rect x="{width - 310}" y="{height - 180}" width="70" height="180" fill="url(#bezel-alu-grad)" stroke="#334155" stroke-width="2" />
            
            <!-- Vitrinen-Hauptrahmen -->
            <rect 
                x="0" 
                y="0" 
                width="{width}" 
                height="{height - 100}" 
                rx="12" 
                fill="url(#bezel-alu-grad)" 
                stroke="#334155" 
                stroke-width="3" 
            />
            <!-- Display-Ausschnitt -->
            <rect 
                x="{paddingX}" 
                y="{paddingY}" 
                width="{width - (paddingX * 2)}" 
                height="{layout.height || 1080}" 
                fill="#030814" 
            />
        {:else if isStele}
            <!-- STELE-BAUFORM (Portrait 9:16 mit massivem Sockel unten) -->
            <rect 
                x="120" 
                y="{height - 180}" 
                width="{width - 240}" 
                height="180" 
                fill="#1e293b" 
                stroke="#334155" 
                stroke-width="3" 
            />
            <rect 
                x="140" 
                y="{height - 30}" 
                width="{width - 280}" 
                height="20" 
                fill="#0f172a" 
            />
            <!-- Stelen-Körper -->
            <rect 
                x="0" 
                y="0" 
                width="{width}" 
                height="{height - 140}" 
                rx="14" 
                fill="url(#bezel-bg-grad)" 
                stroke="#0e2852" 
                stroke-width="3" 
            />
            <!-- Display-Ausschnitt 1080x1920 -->
            <rect 
                x="{paddingX}" 
                y="{paddingY}" 
                width="{width - (paddingX * 2)}" 
                height="{layout.height || 1920}" 
                fill="#030814" 
            />
        {:else}
            <!-- STANDARD / ÜBERKOPF / STRETCHED: DB Nachtblau RAL 5022 Gehäuse -->
            <rect 
                x="0" 
                y="0" 
                width="{width}" 
                height="{height}" 
                rx="16" 
                fill="url(#bezel-bg-grad)" 
                stroke="#0e2852" 
                stroke-width="2" 
            />

            <!-- Obere Gehäuseblende mit Fuge -->
            <rect x="20" y="20" width="{width - 40}" height="3" fill="rgba(0, 0, 0, 0.8)" />
            <rect x="20" y="23" width="{width - 40}" height="1" fill="rgba(255, 255, 255, 0.12)" />

            <!-- Aussparung für die Monitore -->
            <!-- Bewusst ohne SVG-Filter: Chromium (v.a. Android/GPU) begrenzt
                 Filter-Puffer und schneidet bei breiten Gehäusen (2+ Monitore,
                 > 4096 px) den rechten Teil der Fläche ab. Der Einbauschatten
                 wird stattdessen als Box-Shadow am Bezel-Lip gezeichnet. -->
            <rect 
                x="{paddingX}" 
                y="{paddingY}" 
                width="{width - (paddingX * 2)}" 
                height="{layout.height || 1080}" 
                fill="#030814" 
            />

            <!-- Innere Gehäusefasen um das Display -->
            <rect x="{paddingX}" y="{paddingY}" width="{width - (paddingX * 2)}" height="6" fill="rgba(0, 0, 0, 0.8)" />
            <rect x="{paddingX}" y="{paddingY}" width="6" height="{layout.height || 1080}" fill="rgba(0, 0, 0, 0.8)" />
            <rect x="{paddingX}" y="{paddingY + (layout.height || 1080) - 6}" width="{width - (paddingX * 2)}" height="6" fill="rgba(0, 0, 0, 0.8)" />
            <rect x="{paddingX + width - (paddingX * 2) - 6}" y="{paddingY}" width="6" height="{layout.height || 1080}" fill="rgba(0, 0, 0, 0.8)" />

            <!-- Vertikale Trennstege zwischen Monitoren -->
            {#each gapXPositions as gapX}
                {@const gapW = layout.gapWidth || 50}
                <g class="bezel-post">
                    <rect x="{gapX}" y="{paddingY}" width="{gapW}" height="{layout.height || 1080}" fill="url(#metal-accent)" />
                    <rect x="{gapX}" y="{paddingY}" width="3" height="{layout.height || 1080}" fill="rgba(0, 0, 0, 0.45)" />
                    <rect x="{gapX + gapW - 3}" y="{paddingY}" width="3" height="{layout.height || 1080}" fill="rgba(0, 0, 0, 0.45)" />
                    <rect x="{gapX + 3}" y="{paddingY}" width="1" height="{layout.height || 1080}" fill="rgba(255, 255, 255, 0.05)" />
                    <rect x="{gapX + gapW - 4}" y="{paddingY}" width="1" height="{layout.height || 1080}" fill="rgba(255, 255, 255, 0.05)" />
                </g>
            {/each}

            <!-- Untere Gehäuseblende mit Fuge -->
            <rect x="20" y="{height - 23}" width="{width - 40}" height="1" fill="rgba(255, 255, 255, 0.12)" />
            <rect x="20" y="{height - 20}" width="{width - 40}" height="3" fill="rgba(0, 0, 0, 0.8)" />
        {/if}
    </svg>
</div>

<style>
    .hardware-bezel-wrapper {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 5;
        overflow: visible;
        box-sizing: border-box;
        /* Bewusst ohne Filter, Box-Shadow und border-radius: Jede dieser
           Eigenschaften legt auf dem Gehäuse-Element (bis 6400x1600 px) einen
           zusätzlichen Rasterpuffer/Maske in voller Elementgröße an. Chromium
           begrenzt solche Puffer (v.a. Android/GPU) auf ca. 4096 px und
           schneidet dann den rechten Gehäuseteil ab. Die abgerundeten Ecken
           zeichnet bereits der SVG-Korpus (rx), der Schatten entfällt – auf dem
           dunklen Seitenhintergrund war er ohnehin kaum sichtbar. */
    }
    .hardware-bezel-svg {
        display: block;
        width: 100%;
        height: 100%;
    }
</style>
