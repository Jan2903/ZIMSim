<script>
    import { ICONS as DISPLAY_ICONS } from '../js/displays/core/icons.js';
    import { UI_ICONS } from '../js/core/icons/uiIcons.js';

    /**
     * @typedef {Object} Props
     * @property {string} name - Schlüssel des Icons in UI_ICONS oder ICONS
     * @property {number} [size=18] - Breite/Höhe des SVGs in Pixeln
     * @property {string} [color='currentColor'] - Füllfarbe für Pfade mit currentColor
     * @property {string} [class] - Optionale CSS-Klasse
     * @property {string} [style] - Optionale zusätzliche CSS-Styles
     */
    let {
        name,
        size = 18,
        color = 'currentColor',
        class: className = '',
        style: customStyle = ''
    } = $props();

    let icon = $derived(UI_ICONS[name] || DISPLAY_ICONS[name]);
</script>

{#if icon && icon.elements}
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 {icon.viewBox} {icon.viewBox}" 
        width={size} 
        height={size}
        class="zim-icon {className}"
        aria-hidden="true"
        style="display: inline-block; vertical-align: -0.15em; flex-shrink: 0; {customStyle}"
    >
        {#each icon.elements as el}
            <path 
                d={el.d} 
                fill={el.fill === 'currentColor' ? color : el.fill}
                fill-rule={el.fillRule || 'nonzero'} 
            />
        {/each}
    </svg>
{/if}

