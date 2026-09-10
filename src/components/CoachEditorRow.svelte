<script>
    import { uiState } from '../js/core/state/uiState.svelte.js';
    import { trainDisplay } from '../js/core/state/stores.js';

    /**
     * @typedef {Object} Props
     * @property {import('../js/features/formation/coachModel.svelte.js').Coach} coach
     * @property {() => void} onMoveUp
     * @property {() => void} onMoveDown
     * @property {() => void} onRemove
     * @property {() => void} [onChange]
     */
    let {
        coach = $bindable(),
        onMoveUp,
        onMoveDown,
        onRemove,
        onChange
    } = $props();

    const AVAILABLE_AMENITIES = [
        { key: 'BIKE_SPACE', label: '🚲', title: 'Fahrradstellplätze' },
        { key: 'WHEELCHAIR_SPACE', label: '♿', title: 'Rollstuhlplätze' },
        { key: 'BOARD_RESTAURANT', label: '🍽️', title: 'Bordrestaurant' },
        { key: 'BISTRO', label: '☕', title: 'Bordbistro' },
        { key: 'SLEEPER', label: '🛏️', title: 'Schlafwagen' },
        { key: 'COUCHETTE', label: '🛋️', title: 'Liegewagen' }
    ];

    function triggerUpdate() {
        trainDisplay.updateAll();
        if (onChange) onChange();
    }

    function onTypeChange(e) {
        const newType = e.target.value;
        coach.type = newType;
        if (newType === 'locomotive') {
            coach.coachClass = null;
            if (!coach.length || coach.length === 26) coach.length = 19;
        } else {
            if (coach.coachClass === null) coach.coachClass = 2;
            if (!coach.length || coach.length === 19) coach.length = 26;
        }
        coach.platformPosition = null; // Bereinigen bei Typ-Wechsel
        triggerUpdate();
    }

    function onClassChange(e) {
        const val = e.target.value;
        coach.coachClass = val === 'null' ? null : Number(val);
        triggerUpdate();
    }

    function onLengthChange(e) {
        const val = Number(e.target.value);
        coach.length = isNaN(val) || val <= 0 ? 26 : val;
        coach.platformPosition = null; // Bereinigen bei manueller Längenänderung (Entscheidung #4)
        triggerUpdate();
    }

    function toggleAmenity(key) {
        if (!Array.isArray(coach.amenities)) {
            coach.amenities = [];
        }
        if (coach.amenities.includes(key)) {
            coach.amenities = coach.amenities.filter(a => a !== key);
            if (key === 'BOARD_RESTAURANT') {
                coach.amenities = coach.amenities.filter(a => a !== 'DINING');
            }
        } else {
            coach.amenities = [...coach.amenities, key];
        }
        triggerUpdate();
    }

    function toggleOpen() {
        coach.open = !coach.open;
        triggerUpdate();
    }
</script>

<div class="coach-row-container" class:is-closed={!coach.open}>
    <!-- Linker Bereich: Reorder & Typ & Basisdaten -->
    <div class="coach-main-controls">
        <div class="reorder-controls">
            {#if uiState.enableDragAndDrop}
                <span class="coach-drag-handle" title="Drag & Drop">⠿</span>
            {/if}
            <div class="arrow-buttons">
                <button type="button" class="btn-icon arrow-btn" onclick={onMoveUp} title="Wagen nach links / oben verschieben">↑</button>
                <button type="button" class="btn-icon arrow-btn" onclick={onMoveDown} title="Wagen nach rechts / unten verschieben">↓</button>
            </div>
        </div>

        <select class="coach-select coach-type-select" value={coach.type} onchange={onTypeChange} title="Fahrzeugtyp">
            <option value="middle_car">Mittelwagen</option>
            <option value="control_car">Steuerwagen</option>
            <option value="locomotive">Lok</option>
        </select>

        <input 
            type="text" 
            class="coach-input wagon-num-input" 
            bind:value={coach.wagonIdentificationNumber} 
            oninput={triggerUpdate} 
            placeholder="Nr" 
            title="Wagennummer (z.B. 21)"
        >

        <select class="coach-select coach-class-select" value={coach.coachClass === null ? 'null' : coach.coachClass} onchange={onClassChange} title="Wagenklasse">
            <option value="2">2. Kl.</option>
            <option value="1">1. Kl.</option>
            <option value="null">—</option>
        </select>

        <div class="length-wrapper" title="Wagenlänge in Metern">
            <input 
                type="number" 
                class="coach-input length-input" 
                value={coach.length} 
                oninput={onLengthChange} 
                min="5" 
                max="60" 
                step="1"
            >
            <span class="unit">m</span>
        </div>
    </div>

    <!-- Rechter Bereich: Amenities, Offen-Status, Löschen -->
    <div class="coach-feature-controls">
        <div class="amenity-badges" title="Ausstattung (Mehrzweckbereich ergibt sich automatisch aus 🚲 + ♿)">
            {#each AVAILABLE_AMENITIES as amenity}
                {@const isActive = coach.amenities && (coach.amenities.includes(amenity.key) || (amenity.key === 'BOARD_RESTAURANT' && coach.amenities.includes('DINING')))}
                <button
                    type="button"
                    class="amenity-chip"
                    class:active={isActive}
                    onclick={() => toggleAmenity(amenity.key)}
                    title="{amenity.title} ({isActive ? 'aktiviert' : 'deaktiviert'})"
                >
                    {amenity.label}
                </button>
            {/each}
        </div>

        <button 
            type="button" 
            class="status-toggle-btn" 
            class:is-open={coach.open} 
            onclick={toggleOpen}
            title={coach.open ? 'Wagen ist offen für Fahrgäste' : 'Wagen ist gesperrt / geschlossen (X auf Monitor)'}
        >
            {coach.open ? '✓ Offen' : '✕ Zu'}
        </button>

        <button 
            type="button" 
            class="btn-icon remove-coach-btn" 
            onclick={onRemove} 
            title="Wagen entfernen"
        >
            ✕
        </button>
    </div>
</div>

<style>
    .coach-row-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 10px;
        margin-bottom: 6px;
        background: var(--bg-card, #242424);
        border: 1px solid var(--border, #444);
        border-radius: 6px;
        transition: border-color 0.15s, opacity 0.15s;
    }
    .coach-row-container:hover {
        border-color: var(--text-muted, #777);
    }
    .coach-row-container.is-closed {
        opacity: 0.7;
        background: rgba(255, 107, 107, 0.05);
        border-color: rgba(255, 107, 107, 0.3);
    }

    .coach-main-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .reorder-controls {
        display: flex;
        align-items: center;
        gap: 2px;
        min-width: 32px;
    }
    .coach-drag-handle {
        cursor: grab;
        font-size: 16px;
        color: var(--text-muted, #888);
        user-select: none;
        padding: 0 2px;
    }
    .coach-drag-handle:active {
        cursor: grabbing;
    }
    .arrow-buttons {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }
    .arrow-btn {
        padding: 0 3px;
        font-size: 0.7em;
        line-height: 1;
        color: var(--text-muted, #888);
    }
    .arrow-btn:hover {
        color: var(--text-main, #fff);
    }

    .coach-select, .coach-input {
        background: var(--bg-input, #1a1a1a);
        color: var(--text-main, #fff);
        border: 1px solid var(--border, #444);
        border-radius: 4px;
        padding: 4px 6px;
        font-size: 0.85rem;
        outline: none;
        box-sizing: border-box;
    }
    .coach-select:focus, .coach-input:focus {
        border-color: var(--accent, #e2001a);
    }

    .coach-type-select {
        min-width: 105px;
    }
    .wagon-num-input {
        width: 50px;
        min-width: 45px;
        text-align: center;
        font-weight: bold;
    }
    .coach-class-select {
        width: 65px;
        min-width: 60px;
    }

    .length-wrapper {
        display: flex;
        align-items: center;
        gap: 3px;
    }
    .length-input {
        width: 48px;
        min-width: 45px;
        text-align: right;
    }
    .unit {
        font-size: 0.8rem;
        color: var(--text-muted, #888);
    }

    .coach-feature-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .amenity-badges {
        display: flex;
        align-items: center;
        gap: 4px;
        background: rgba(0, 0, 0, 0.2);
        padding: 2px 4px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .amenity-chip {
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 2px 5px;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.15s ease;
        opacity: 0.35;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    .amenity-chip:hover {
        opacity: 0.75;
        background: rgba(255, 255, 255, 0.1);
    }
    .amenity-chip.active {
        opacity: 1;
        background: rgba(226, 0, 26, 0.2);
        border-color: var(--accent, #e2001a);
    }

    .status-toggle-btn {
        background: rgba(255, 107, 107, 0.15);
        color: #ff6b6b;
        border: 1px solid rgba(255, 107, 107, 0.3);
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
    }
    .status-toggle-btn.is-open {
        background: rgba(34, 197, 94, 0.15);
        color: #22c55e;
        border-color: rgba(34, 197, 94, 0.3);
    }

    .remove-coach-btn {
        color: var(--text-muted, #888);
        font-size: 1.1rem;
        padding: 2px 6px;
        border-radius: 4px;
    }
    .remove-coach-btn:hover {
        color: #ff6b6b;
        background: rgba(255, 107, 107, 0.15);
    }

    /* Mobile-Optimierung (< 768px) */
    @media (max-width: 768px) {
        .coach-row-container {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            padding: 10px;
        }
        .coach-main-controls {
            justify-content: space-between;
            width: 100%;
        }
        .coach-feature-controls {
            justify-content: space-between;
            width: 100%;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: 8px;
        }
        .amenity-chip {
            min-width: 38px;
            min-height: 38px;
            font-size: 1.2rem;
        }
        .status-toggle-btn {
            min-height: 38px;
            padding: 6px 12px;
        }
        .remove-coach-btn {
            min-height: 38px;
            min-width: 38px;
        }
        .coach-type-select, .wagon-num-input, .coach-class-select, .length-input {
            min-height: 38px;
        }
    }
</style>
