<script>
    /**
     * @fileoverview HardwareBezel.svelte
     * Chassis-getriebenes, vektorbasiertes DB-Gehäuse für ZIM-Displays.
     *
     * Die Komponente kennt nur noch den gemeinsamen Rahmen (Wrapper, SVG,
     * Farbverläufe) und wählt die Optik über `layout.chassisStyle` aus der
     * Registry (`chassisStyleRegistry.js`). Die eigentlichen Bauformen
     * (Standard/Überkopf, Vitrine, Stele) liegen als eigene SVG-Bausteine in
     * `components/chassis/` und werden hier nicht mehr unterschieden.
     */

    import { CHASSIS_STYLES, DEFAULT_CHASSIS_STYLE } from './chassis/chassisStyleRegistry.js';

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

    // Optik des Gehäuses (P5): 'standard' | 'vitrine' | 'stele' | 'stretched'.
    // Unbekannte Werte fallen auf die Standard-Optik zurück.
    const chassisStyle = $derived(layout.chassisStyle || DEFAULT_CHASSIS_STYLE);
    const ChassisView = $derived(CHASSIS_STYLES[chassisStyle] || CHASSIS_STYLES[DEFAULT_CHASSIS_STYLE]);

    // 4K-Gehäuse sind physikalisch doppelt so groß. Die SVG-Geometrie ist in
    // logischen Pixeln definiert; die Ansicht wird entsprechend
    // herunterskaliert, damit Rahmen, Stege und Sockel proportional exakt
    // identisch zum Full-HD-Gehäuse bleiben (4K = ×2 des FHD-Gehäuses).
    const scaleFactor = $derived(layout.scaleFactor && layout.scaleFactor > 0 ? layout.scaleFactor : 1);
    const vbWidth = $derived(width / scaleFactor);
    const vbHeight = $derived(height / scaleFactor);
    const padX = $derived(paddingX / scaleFactor);
    const padY = $derived(paddingY / scaleFactor);
    const displayHeight = $derived((layout.height || (chassisStyle === 'stele' ? 1920 : 1080)) / scaleFactor);
    const gapWidth = $derived((layout.gapWidth || 50) / scaleFactor);

    // Berechnung der X-Positionen der Mittelstege relativ zum Gehäuse.
    // Die Positionen stammen aus dem Layout (dort bereits 4K-skaliert) und
    // liegen im Canvas-Raum; das Gehäuse ist um paddingX (= casingOffsetX)
    // verschoben. Für die logische SVG-Ansicht werden beide Werte durch den
    // Skalierungsfaktor geteilt.
    let gapXPositions = $derived.by(() => {
        if (!layout.hasBezelGap || !layout.gapWidth) return [];
        const gaps = Array.isArray(layout.gaps) && layout.gaps.length
            ? layout.gaps
            : (layout.gapX !== undefined ? [layout.gapX] : []);
        return gaps.map(gapX => (paddingX + gapX) / scaleFactor);
    });
</script>

<div 
    class="hardware-bezel-wrapper" 
    style="width: {width}px; height: {height}px;"
    aria-hidden="true"
>
    <svg 
        class="hardware-bezel-svg" 
        viewBox="0 0 {vbWidth} {vbHeight}" 
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

        <ChassisView 
            {vbWidth} 
            {vbHeight} 
            {padX} 
            {padY} 
            {displayHeight} 
            {gapWidth} 
            {gapXPositions} 
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
        /* Bewusst ohne Filter, Box-Shadow und border-radius: Jede dieser
           Eigenschaften legt auf dem Gehäuse-Element (bis 6400x1600 px) einen
           zusätzlichen Rasterpuffer/Maske in voller Elementgröße an. Chromium
           begrenzt solche Puffer (v.a. Android/GPU) auf ca. 4096 px und
           schneidet dann den rechten Gehäuseteil ab. Die abgerundeten Ecken
           zeichnet bereits der SVG-Korpus (rx), der Schatten entfällt – auf dem
           dunklen Seitenhintergrund war er ohnehin kaum sichtbar. Der Wrapper
           bleibt transparent, damit keine eckige Hintergrundfläche die
           Rundungen des SVG-Korpus überdeckt. */
    }
    .hardware-bezel-svg {
        display: block;
        width: 100%;
        height: 100%;
    }
</style>
