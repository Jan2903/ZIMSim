<script>
    /**
     * @fileoverview HardwareBezel.svelte
     * Prozedurales, vektorbasiertes DB-Gehäuse für ZIM-Displays.
     * Erzeugt das authentische Gehäuse in DB-Nachtblau (RAL 5022) mit 
     * vollständig symmetrischen Rändern (270px links/rechts, 260px oben/unten)
     * und 50px-Mittelstegen. 100% ohne Bitmap-Bilder.
     */

    /**
     * @typedef {Object} Props
     * @property {number} width - Gesamte Gehäusebreite in Pixeln (z. B. 4430 bei 2 Screens, 6400 bei 3 Screens)
     * @property {number} height - Gesamte Gehäusehöhe in Pixeln (Standard: 1600)
     * @property {number} paddingX - Symmetrischer Rand links und rechts (Standard: 270)
     * @property {number} paddingY - Symmetrischer Rand oben und unten (Standard: 260)
     * @property {object} layout - Das aktuelle Layout-Objekt
     */
    let { 
        width = 4430, 
        height = 1600, 
        paddingX = 270, 
        paddingY = 260,
        layout = {}
    } = $props();

    // Berechnung der X-Positionen der 50px-Mittelstege relativ zum Gehäuse
    let gapXPositions = $derived.by(() => {
        if (!layout.hasBezelGap || !layout.gapWidth) return [];
        // Bei 2 Monitoren: 1 Steg bei 1920
        // Bei 3 Monitoren: 2 Stege bei 1920 und 3890
        if (layout.width >= 5800) {
            return [paddingX + 1920, paddingX + 1920 + 50 + 1920];
        }
        return [paddingX + (layout.gapX !== undefined ? layout.gapX : 1920)];
    });
</script>

<div 
    class="hardware-bezel-wrapper" 
    style="width: {width}px; height: {height}px;"
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
            <!-- Haupt-Gehäusefarbverlauf DB-Nachtblau RAL 5022 (symmetrisch oben/unten) -->
            <linearGradient id="bezel-bg-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#091833" />
                <stop offset="10%" stop-color="#071328" />
                <stop offset="50%" stop-color="#050e1c" />
                <stop offset="90%" stop-color="#071328" />
                <stop offset="100%" stop-color="#091833" />
            </linearGradient>

            <!-- Metallischer Glanzverlauf für den Mittelsteg (100% harmonisiert mit trainDisplay.js) -->
            <linearGradient id="metal-accent" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#040b17" />
                <stop offset="15%" stop-color="#091833" />
                <stop offset="50%" stop-color="#102a57" />
                <stop offset="85%" stop-color="#091833" />
                <stop offset="100%" stop-color="#040b17" />
            </linearGradient>

            <!-- Weicher Display-Einbauschatten -->
            <filter id="screen-shadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.8" />
            </filter>
        </defs>

        <!-- 1. Hauptgehäuse-Körper (Symmetrischer dunkelblauer Kasten RAL 5022, 260px oben & 260px unten) -->
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

        <!-- 2. Obere Gehäuseblende (Spiegelbildlich zur unteren Blende mit Dehnungsfuge) -->
        <rect 
            x="20" 
            y="20" 
            width="{width - 40}" 
            height="3" 
            fill="rgba(0, 0, 0, 0.8)" 
        />
        <rect 
            x="20" 
            y="23" 
            width="{width - 40}" 
            height="1" 
            fill="rgba(255, 255, 255, 0.12)" 
        />

        <!-- 3. Aussparung für die Monitore (Bildschirmbereich) -->
        <rect 
            x="{paddingX}" 
            y="{paddingY}" 
            width="{width - (paddingX * 2)}" 
            height="1080" 
            fill="#030814" 
            filter="url(#screen-shadow)"
        />

        <!-- 4. Innere Gehäusefasen um das Display (Symmetrische Tiefe & Schatten) -->
        <rect x="{paddingX}" y="{paddingY}" width="{width - (paddingX * 2)}" height="6" fill="rgba(0, 0, 0, 0.8)" />
        <rect x="{paddingX}" y="{paddingY}" width="6" height="1080" fill="rgba(0, 0, 0, 0.8)" />
        <rect x="{paddingX}" y="{paddingY + 1074}" width="{width - (paddingX * 2)}" height="6" fill="rgba(0, 0, 0, 0.8)" />
        <rect x="{paddingX + width - (paddingX * 2) - 6}" y="{paddingY}" width="6" height="1080" fill="rgba(0, 0, 0, 0.8)" />
        <!-- Subtile Innenlichtkanten -->
        <rect x="{paddingX}" y="{paddingY + 1078}" width="{width - (paddingX * 2)}" height="2" fill="rgba(255, 255, 255, 0.08)" />
        <rect x="{paddingX + width - (paddingX * 2) - 2}" y="{paddingY}" width="2" height="1080" fill="rgba(255, 255, 255, 0.08)" />

        <!-- 5. Vertikale 50px-Trennstege zwischen den Monitoren (Verankerung oben & unten) -->
        {#each gapXPositions as gapX}
            <g class="bezel-post">
                <!-- Steg-Körper in DB-Dunkelblau mit metallischem 3D-Verlauf -->
                <rect x="{gapX}" y="{paddingY - 12}" width="50" height="1104" fill="url(#metal-accent)" />
                <!-- Linker Steg-Schatten -->
                <rect x="{gapX}" y="{paddingY - 12}" width="4" height="1104" fill="rgba(0, 0, 0, 0.7)" />
                <!-- Rechter Steg-Schatten -->
                <rect x="{gapX + 46}" y="{paddingY - 12}" width="4" height="1104" fill="rgba(0, 0, 0, 0.7)" />
                <!-- Zentrierte 2px-Montagefuge mit Lichtreflex -->
                <rect x="{gapX + 24}" y="{paddingY - 12}" width="2" height="1104" fill="rgba(0, 0, 0, 0.9)" />
                <rect x="{gapX + 26}" y="{paddingY - 12}" width="1" height="1104" fill="rgba(255, 255, 255, 0.16)" />
            </g>
        {/each}

        <!-- 6. Untere Gehäuseblende mit Dehnungsfugen -->
        <rect 
            x="20" 
            y="{height - 23}" 
            width="{width - 40}" 
            height="1" 
            fill="rgba(255, 255, 255, 0.12)" 
        />
        <rect 
            x="20" 
            y="{height - 20}" 
            width="{width - 40}" 
            height="3" 
            fill="rgba(0, 0, 0, 0.8)" 
        />
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
    }
    .hardware-bezel-svg {
        display: block;
        width: 100%;
        height: 100%;
        filter: drop-shadow(0 16px 36px rgba(0, 0, 0, 0.7));
    }
</style>
