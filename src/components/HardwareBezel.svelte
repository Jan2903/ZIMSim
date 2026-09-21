<script>
    /**
     * @fileoverview HardwareBezel.svelte
     * Prozedurales, vektorbasiertes DB-Gehäuse für ZIM-Displays.
     * Erzeugt das authentische Gehäuse in DB-Nachtblau (RAL 5022) mit 
     * symmetrischen Rändern (270px links/rechts, 260px oben/unten),
     * Deckenhalterungen und 50px-Mittelstegen. 100% ohne Bitmap-Bilder.
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

    // Berechnung der Positionen für die Deckenabhänger (Stahlrohrhalterungen)
    let hanger1X = $derived(Math.round(width * 0.28));
    let hanger2X = $derived(Math.round(width * 0.72));

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
            <!-- Haupt-Gehäusefarbverlauf DB-Nachtblau RAL 5022 -->
            <linearGradient id="bezel-bg-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#0b1e3e" />
                <stop offset="15%" stop-color="#091833" />
                <stop offset="85%" stop-color="#071328" />
                <stop offset="100%" stop-color="#040b17" />
            </linearGradient>

            <!-- Metallischer Glanzverlauf für den horizontalen Querträger -->
            <linearGradient id="metal-accent" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#061224" />
                <stop offset="20%" stop-color="#0c234a" />
                <stop offset="50%" stop-color="#143670" />
                <stop offset="80%" stop-color="#0c234a" />
                <stop offset="100%" stop-color="#061224" />
            </linearGradient>

            <!-- Deckenabhängung Rohr-Farbverlauf -->
            <linearGradient id="hanger-rod" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#18181c" />
                <stop offset="30%" stop-color="#3c3f4a" />
                <stop offset="70%" stop-color="#2a2c34" />
                <stop offset="100%" stop-color="#121316" />
            </linearGradient>

            <!-- Weicher Display-Einbauschatten -->
            <filter id="screen-shadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.8" />
            </filter>
        </defs>

        <!-- 1. Deckenabhängungs-Rohre oben (ragen zur Decke) -->
        <!-- Linker Deckenhänger -->
        <rect x="{hanger1X - 22}" y="0" width="44" height="{paddingY - 40}" fill="url(#hanger-rod)" />
        <rect x="{hanger1X - 32}" y="{paddingY - 50}" width="64" height="16" rx="3" fill="#1e2026" stroke="#2c303a" stroke-width="2" />
        <circle cx="{hanger1X - 20}" cy="{paddingY - 42}" r="3.5" fill="#444854" />
        <circle cx="{hanger1X + 20}" cy="{paddingY - 42}" r="3.5" fill="#444854" />

        <!-- Rechter Deckenhänger -->
        <rect x="{hanger2X - 22}" y="0" width="44" height="{paddingY - 40}" fill="url(#hanger-rod)" />
        <rect x="{hanger2X - 32}" y="{paddingY - 50}" width="64" height="16" rx="3" fill="#1e2026" stroke="#2c303a" stroke-width="2" />
        <circle cx="{hanger2X - 20}" cy="{paddingY - 42}" r="3.5" fill="#444854" />
        <circle cx="{hanger2X + 20}" cy="{paddingY - 42}" r="3.5" fill="#444854" />

        <!-- 2. Hauptgehäuse-Körper (Symmetrischer dunkelblauer Kasten RAL 5022) -->
        <rect 
            x="0" 
            y="{paddingY - 40}" 
            width="{width}" 
            height="{height - (paddingY - 40)}" 
            rx="12" 
            fill="url(#bezel-bg-grad)" 
            stroke="#0e2852" 
            stroke-width="2"
        />

        <!-- Oberer Zierstreifen / Deckenkante mit subtilem Glanz -->
        <rect 
            x="10" 
            y="{paddingY - 34}" 
            width="{width - 20}" 
            height="8" 
            rx="2" 
            fill="rgba(255, 255, 255, 0.14)" 
        />

        <!-- 3. Aussparung für die Monitore (Bildschirmbereich) -->
        <!-- Der Hintergrund hinter dem Display wird dunkles Marineblau (#000080 / MidnightBlue) -->
        <rect 
            x="{paddingX}" 
            y="{paddingY}" 
            width="{width - (paddingX * 2)}" 
            height="1080" 
            fill="#030814" 
            filter="url(#screen-shadow)"
        />

        <!-- 4. Innere Gehäusefasen um das Display (Tiefe & Schatten) -->
        <!-- Oberer Innenschatten -->
        <rect x="{paddingX}" y="{paddingY}" width="{width - (paddingX * 2)}" height="6" fill="rgba(0, 0, 0, 0.8)" />
        <!-- Linker Innenschatten -->
        <rect x="{paddingX}" y="{paddingY}" width="6" height="1080" fill="rgba(0, 0, 0, 0.8)" />
        <!-- Untere Innenlichtkante -->
        <rect x="{paddingX}" y="{paddingY + 1076}" width="{width - (paddingX * 2)}" height="4" fill="rgba(255, 255, 255, 0.08)" />
        <!-- Rechte Innenlichtkante -->
        <rect x="{paddingX + width - (paddingX * 2) - 4}" y="{paddingY}" width="4" height="1080" fill="rgba(255, 255, 255, 0.08)" />

        <!-- 5. Vertikale 50px-Trennstege zwischen den Monitoren -->
        {#each gapXPositions as gapX}
            <g class="bezel-post">
                <!-- Steg-Körper in DB-Dunkelblau mit metallischem 3D-Verlauf -->
                <rect x="{gapX}" y="{paddingY - 10}" width="50" height="1100" fill="url(#metal-accent)" />
                <!-- Linker Steg-Schatten -->
                <rect x="{gapX}" y="{paddingY}" width="4" height="1080" fill="rgba(0, 0, 0, 0.7)" />
                <!-- Rechter Steg-Schatten -->
                <rect x="{gapX + 46}" y="{paddingY}" width="4" height="1080" fill="rgba(0, 0, 0, 0.7)" />
                <!-- Zentrierte 2px-Montagefuge mit Lichtreflex -->
                <rect x="{gapX + 24}" y="{paddingY - 6}" width="2" height="1092" fill="rgba(0, 0, 0, 0.9)" />
                <rect x="{gapX + 26}" y="{paddingY - 6}" width="1" height="1092" fill="rgba(255, 255, 255, 0.16)" />
            </g>
        {/each}

        <!-- 6. Untere Gehäuseblende mit Dehnungsfugen & Logo-Bereich -->
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
