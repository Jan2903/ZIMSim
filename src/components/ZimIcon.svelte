<script>
    import { ICONS } from '../js/displays/core/icons.js';

    /**
     * @typedef {Object} Props
     * @property {string} name - Schlüssel des Icons in ICONS (z. B. 'fahrrad', 'gastronomie', etc.)
     * @property {number} [size=18] - Breite/Höhe des SVGs in Pixeln
     * @property {string} [color='currentColor'] - Füllfarbe für Pfade mit currentColor
     * @property {string} [class] - Optionale CSS-Klasse
     */
    let {
        name,
        size = 18,
        color = 'currentColor',
        class: className = ''
    } = $props();

    let icon = $derived(ICONS[name]);
</script>

{#if icon}
    {#if icon.elements}
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 {icon.viewBox} {icon.viewBox}" 
            width={size} 
            height={size}
            class="zim-icon {className}"
            aria-hidden="true"
            style="display: inline-block; vertical-align: middle; flex-shrink: 0;"
        >
            {#each icon.elements as el}
                <path 
                    d={el.d} 
                    fill={el.fill === 'currentColor' ? color : el.fill}
                    fill-rule={el.fillRule || 'nonzero'} 
                />
            {/each}
        </svg>
    {:else if name === 'mehrzweck'}
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 100 100" 
            width={size} 
            height={size}
            class="zim-icon {className}"
            aria-hidden="true"
            style="display: inline-block; vertical-align: middle; flex-shrink: 0;"
        >
            <g transform="translate(0, 24) scale(2.0833)">
                {#each ICONS.fahrrad.elements as el}
                    <path d={el.d} fill={el.fill === 'currentColor' ? color : el.fill} />
                {/each}
            </g>
            <g transform="translate(50, 24) scale(2.0833)">
                {#each ICONS.rollstuhl.elements as el}
                    <path d={el.d} fill={el.fill === 'currentColor' ? color : el.fill} />
                {/each}
            </g>
        </svg>
    {/if}
{/if}
