<script>
    import { StationService } from '../js/utils/stationService.js';
    import { journeyStore } from '../js/main.js';
    import { portalDropdown } from '../js/utils/portal.js';

    let { value = $bindable(), onSelect = null, onInput = null, placeholder = "Station suchen", cssClass = "jfield" } = $props();

    let searchText = $state(value || '');
    let showDropdown = $state(false);
    
    let searchResults = $derived.by(() => {
        if (searchText.length >= 2 && showDropdown) {
            return StationService.searchStations(searchText, 20);
        }
        return [];
    });

    let inputRef = $state();
    let wrapperRef = $state();

    $effect(() => {
        // Sync incoming value to local state if changed from outside
        if (value !== undefined && value !== searchText && !showDropdown) {
            searchText = value;
        }
    });

    function handleInput() {
        value = searchText; // sync up
        if (onInput) onInput(searchText);
    }

    function selectStation(station) {
        searchText = station.name;
        value = station.name;
        showDropdown = false;
        if (onSelect) {
            onSelect(station);
        }
    }

    function addCustomStation() {
        if (!searchText.trim()) return;
        const newStation = journeyStore.addCustomStation(searchText.trim());
        selectStation(newStation);
    }

    function onFocus() {
        showDropdown = true;
    }

    function onBlur() {
        setTimeout(() => {
            showDropdown = false;
        }, 200);
    }
</script>

<div bind:this={wrapperRef} class="station-picker-wrapper" style="position: relative; display: inline-block; width: 100%;">
    <input type="text"
           class={cssClass}
           bind:this={inputRef}
           bind:value={searchText}
           {placeholder}
           oninput={handleInput}
           onfocus={onFocus}
           onblur={onBlur}
           onkeydown={(e) => {
               if (e.key === 'Enter') {
                   e.preventDefault();
                   if (searchResults.length > 0) {
                       selectStation(searchResults[0]);
                   } else if (searchText.trim() && searchText.length > 2) {
                       addCustomStation();
                   }
               }
           }}
           style="width: 100%; margin: 0; padding-right: 25px;">
           
    <button class="btn-icon" tabindex="-1"
            onmousedown={(e) => {
                e.preventDefault();
                if (showDropdown) { showDropdown = false; }
                else { showDropdown = true; inputRef?.focus(); }
            }}
            style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); cursor: pointer; background: none; border: none; font-size: 12px; color: var(--text-muted);">
        ▼
    </button>

    {#if showDropdown && searchText.length >= 2}
        <ul use:portalDropdown={wrapperRef} class="autocomplete-list active" style="max-height: 250px; overflow-y: auto; background-color: var(--bg-panel, #2b2b2b); border: 1px solid var(--border-color, #444); list-style: none; padding: 0; margin: 0; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
            {#if searchResults.length > 0}
                {#each searchResults as station}
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <li class="autocomplete-item" style="padding: 6px 10px; cursor: pointer; border-bottom: 1px solid var(--border-color, #444); font-size: 0.9em;"
                        onmousedown={(e) => { e.preventDefault(); selectStation(station); }}>
                        <div style="font-weight: 500; color: var(--text-primary);">{station.name}</div>
                        <div style="font-size: 0.85em; color: var(--text-muted); display: flex; gap: 10px;">
                            <span>{station.nameKurz}</span>
                            <span>Kat: {station.kategorie}</span>
                        </div>
                    </li>
                {/each}
            {/if}
            <!-- Option to create a new custom station -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <li class="autocomplete-item custom-add" style="padding: 8px 10px; cursor: pointer; border-top: 1px solid var(--primary-color); background-color: rgba(40, 167, 69, 0.15); color: var(--primary-color, #4dabf7); font-weight: bold;"
                onmousedown={(e) => { e.preventDefault(); addCustomStation(); }}>
                + "{searchText}" als neue Station anlegen
            </li>
        </ul>
    {/if}
</div>
