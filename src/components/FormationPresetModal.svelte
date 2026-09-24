<script>
    import { FORMATION_PRESETS, getPresetCategories } from '../js/features/formation/formationPresets.js';
    import { FormationPresetService } from '../js/features/formation/formationPresetService.js';
    import { trainDisplay } from '../js/core/state/stores.js';
    import FormationRuleEditorModal from './FormationRuleEditorModal.svelte';
    import ZimIcon from './ZimIcon.svelte';

    /**
     * @typedef {Object} Props
     * @property {boolean} isOpen
     * @property {import('../js/features/journey/journey.svelte.js').Journey} journey
     * @property {() => void} [onApplied]
     */
    let {
        isOpen = $bindable(false),
        journey = $bindable(),
        onApplied
    } = $props();

    const categories = getPresetCategories();
    let selectedCategory = $state('Alle');
    let selectedPresetId = $state(FORMATION_PRESETS[0]?.id || '');
    let traction = $state(1);
    let reverse = $state(false);
    let offsetWagons = $state(true);
    let isRulesModalOpen = $state(false);

    let filteredPresets = $derived.by(() => {
        if (selectedCategory === 'Alle') return FORMATION_PRESETS;
        return FORMATION_PRESETS.filter(p => p.category === selectedCategory);
    });

    let selectedPreset = $derived(
        FORMATION_PRESETS.find(p => p.id === selectedPresetId) || FORMATION_PRESETS[0] || null
    );

    // Bei Preset-Wechsel sicherstellen, dass Traktion gültig ist
    $effect(() => {
        if (selectedPreset && !selectedPreset.supportedTractions.includes(traction)) {
            traction = selectedPreset.supportedTractions[0] || 1;
        }
    });

    function selectPreset(id) {
        selectedPresetId = id;
    }

    function closeModal() {
        isOpen = false;
    }

    function applyPreset() {
        if (!journey || !selectedPreset) return;

        FormationPresetService.applyPresetToJourney(journey, selectedPreset, {
            traction,
            reverse,
            offsetWagons
        });

        trainDisplay.updateAll();
        if (onApplied) onApplied();
        closeModal();
    }

    function calculateTotalLength(preset, trac) {
        if (!preset || !preset.coaches) return 0;
        const singleLen = preset.coaches.reduce((sum, c) => sum + (c.length || 26), 0);
        return singleLen * trac;
    }

    function getAmenityLabel(amenity) {
        switch (amenity) {
            case 'BOARD_RESTAURANT': return 'Restaurant';
            case 'BISTRO': return 'Bistro';
            case 'BIKE_SPACE': return 'Fahrrad';
            case 'WHEELCHAIR_SPACE': return 'Rollstuhl';
            case 'FAMILY': return 'Familie';
            case 'QUIET': return 'Ruhe';
            default: return amenity;
        }
    }
</script>

{#if isOpen}
<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }} role="presentation">
    <div class="modal-content modal-extra-wide">
        <!-- Header -->
        <div class="modal-header">
            <div class="header-title-wrap">
                <ZimIcon name="copy" size={20} color="var(--accent, #e2001a)" />
                <h3>Wagenreihungs-Vorlagen (Presets)</h3>
            </div>
            <button class="modal-close" onclick={closeModal} title="Schließen">
                <ZimIcon name="close" size={18} />
            </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
            <!-- Kategorien-Filter -->
            <div class="category-tabs">
                {#each categories as cat}
                    <button 
                        type="button" 
                        class="tab-btn {selectedCategory === cat ? 'active' : ''}" 
                        onclick={() => selectedCategory = cat}
                    >
                        {cat}
                    </button>
                {/each}
            </div>

            <div class="preset-layout-grid">
                <!-- Linke Spalte: Preset-Katalog -->
                <div class="preset-list-pane">
                    <div class="pane-title">Verfügbare Zugkompositionen</div>
                    <div class="preset-cards-list">
                        {#each filteredPresets as preset (preset.id)}
                            {@const isSelected = preset.id === selectedPresetId}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <div 
                                class="preset-card {isSelected ? 'selected' : ''}" 
                                onclick={() => selectPreset(preset.id)}
                                role="button"
                                tabindex="0"
                            >
                                <div class="card-header">
                                    <span class="gattung-badge {preset.subCategory.toLowerCase()}">{preset.subCategory}</span>
                                    <span class="preset-name">{preset.name}</span>
                                </div>
                                <div class="preset-desc">{preset.description}</div>
                                <div class="preset-meta">
                                    <span>{preset.coaches.length} Wagen ({preset.coaches.reduce((s, c) => s + (c.length || 26), 0)} m)</span>
                                    {#if preset.supportedTractions.length > 1}
                                        <span class="traction-tag">Bis zu {Math.max(...preset.supportedTractions)}x Traktion</span>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- Rechte Spalte: Konfiguration & Vorschau -->
                {#if selectedPreset}
                    <div class="preset-detail-pane">
                        <div class="pane-title">Konfiguration & Vorschau</div>
                        
                        <div class="detail-content">
                            <!-- Vorschau-Sektion -->
                            <div class="formation-preview-box">
                                <div class="preview-header">
                                    <span class="preview-title">{selectedPreset.name}</span>
                                    <span class="preview-stats">
                                        {selectedPreset.coaches.length * traction} Wagen &bull; ca. {calculateTotalLength(selectedPreset, traction)} m
                                    </span>
                                </div>

                                <!-- Schematische Mini-Wagen-Vorschau -->
                                <div class="coaches-preview-strip {reverse ? 'is-reversed' : ''}">
                                    {#each Array(traction) as _, unitIdx}
                                        {@const unitOffset = offsetWagons ? unitIdx * (selectedPreset.wagonNumberOffset || 10) : 0}
                                        <div class="unit-group">
                                            {#if traction > 1}
                                                <div class="unit-indicator">Zugteil {unitIdx + 1}</div>
                                            {/if}
                                            <div class="unit-coaches">
                                                {#each selectedPreset.coaches as c, cIdx}
                                                    {@const wNum = c.wagonNumber !== null && c.wagonNumber !== undefined ? (c.wagonNumber + unitOffset) : null}
                                                    <div 
                                                        class="mini-coach {c.type} class-{c.coachClass ?? 'loco'}" 
                                                        title="{c.type === 'locomotive' ? 'Lokomotive' : `Wagen ${wNum || ''} (${c.coachClass}. Kl.)`} - {c.length}m"
                                                    >
                                                        <div class="mini-coach-roof"></div>
                                                        <div class="mini-coach-body">
                                                            {#if c.type === 'locomotive'}
                                                                <span class="coach-label">LOK</span>
                                                            {:else}
                                                                {#if wNum !== null}
                                                                    <span class="wagon-num">{wNum}</span>
                                                                {/if}
                                                                <span class="class-num">{c.coachClass}</span>
                                                            {/if}
                                                        </div>
                                                        {#if c.amenities && c.amenities.length > 0}
                                                            <div class="mini-amenity-dots">
                                                                {#each c.amenities as a}
                                                                    <span class="amenity-dot {a.toLowerCase()}" title={getAmenityLabel(a)}></span>
                                                                {/each}
                                                            </div>
                                                        {/if}
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>

                            <!-- Optionen -->
                            <div class="options-group">
                                <label class="option-label">Traktion (Zugverband):</label>
                                <div class="tractions-selector">
                                    {#each [1, 2, 3] as tVal}
                                        {@const isSupported = selectedPreset.supportedTractions.includes(tVal)}
                                        <button 
                                            type="button" 
                                            class="traction-btn {traction === tVal ? 'active' : ''}" 
                                            disabled={!isSupported}
                                            onclick={() => traction = tVal}
                                        >
                                            {#if tVal === 1}
                                                1x Einzeltraktion
                                            {:else if tVal === 2}
                                                2x Doppeltraktion
                                            {:else}
                                                3x Dreifachtraktion
                                            {/if}
                                        </button>
                                    {/each}
                                </div>
                            </div>

                            <div class="options-group">
                                <label class="checkbox-option">
                                    <input type="checkbox" bind:checked={reverse} />
                                    <span>Wagenreihung umkehren (gespiegelt / andere Fahrtrichtung)</span>
                                </label>
                            </div>

                            {#if traction > 1}
                                <div class="options-group">
                                    <label class="checkbox-option">
                                        <input type="checkbox" bind:checked={offsetWagons} />
                                        <span>Wagennummern für Folgeeinheit anpassen (+{selectedPreset.wagonNumberOffset || 10})</span>
                                    </label>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
            <div class="footer-left" style="display: flex; gap: 8px;">
                <button type="button" class="btn-secondary" onclick={closeModal}>Abbrechen</button>
                <button type="button" class="btn-secondary" onclick={() => isRulesModalOpen = true} style="display: inline-flex; align-items: center; gap: 6px;">
                    <ZimIcon name="settings" size={14} />
                    <span>Auto-Regeln...</span>
                </button>
            </div>
            <button type="button" class="btn-primary" onclick={applyPreset} style="display: inline-flex; align-items: center; gap: 6px;">
                <ZimIcon name="check" size={16} />
                <span>Wagenreihung übernehmen</span>
            </button>
        </div>
    </div>
</div>

<FormationRuleEditorModal bind:isOpen={isRulesModalOpen} />
{/if}

<style>
.modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1050;
    padding: 16px;
    box-sizing: border-box;
}

.modal-content {
    background: var(--bg-card, #202020);
    border: 1px solid var(--border, #444);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: 90vh;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    overflow: hidden;
}

.modal-extra-wide {
    max-width: 950px;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border, #444);
    background: rgba(0, 0, 0, 0.2);
}

.header-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
}

.header-title-wrap h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-main, #fff);
}

.modal-close {
    background: none;
    border: none;
    color: var(--text-muted, #aaa);
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
}
.modal-close:hover {
    color: var(--text-main, #fff);
    background: rgba(255, 255, 255, 0.08);
}

.modal-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

/* Category Tabs */
.category-tabs {
    display: flex;
    gap: 6px;
    border-bottom: 1px solid var(--border, #444);
    padding-bottom: 8px;
    flex-wrap: wrap;
}

.tab-btn {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--text-muted, #aaa);
    padding: 6px 14px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
}

.tab-btn:hover {
    color: var(--text-main, #fff);
    background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
    background: var(--accent, #e2001a);
    color: #ffffff;
}

/* 2-Column Grid Layout */
.preset-layout-grid {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 16px;
    min-height: 380px;
}

.pane-title {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #888);
    margin-bottom: 10px;
}

.preset-cards-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 480px;
    overflow-y: auto;
    padding-right: 4px;
}

.preset-card {
    background: var(--bg-input, #181818);
    border: 1px solid var(--border, #3a3a3a);
    border-radius: 8px;
    padding: 10px 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
}

.preset-card:hover {
    border-color: var(--text-muted, #888);
    background: rgba(255, 255, 255, 0.04);
}

.preset-card.selected {
    border-color: var(--accent, #e2001a);
    background: rgba(226, 0, 26, 0.08);
}

.card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.gattung-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: bold;
    color: white;
}
.gattung-badge.ice { background: #d92323; }
.gattung-badge.re { background: #c20018; }
.gattung-badge.s { background: #008754; }

.preset-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-main, #fff);
}

.preset-desc {
    font-size: 0.78rem;
    color: var(--text-muted, #999);
    margin-bottom: 6px;
    line-height: 1.3;
}

.preset-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-muted, #777);
}

.traction-tag {
    color: #4ade80;
    font-weight: 500;
}

/* Detail & Preview Pane */
.preset-detail-pane {
    background: var(--bg-input, #181818);
    border: 1px solid var(--border, #3a3a3a);
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-direction: column;
}

.formation-preview-box {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
}

.preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

.preview-title {
    font-weight: 700;
    font-size: 0.95rem;
    color: #f8fafc;
}

.preview-stats {
    font-size: 0.8rem;
    color: #94a3b8;
}

/* Coaches Strip Preview */
.coaches-preview-strip {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding: 8px 4px;
}

.coaches-preview-strip.is-reversed {
    flex-direction: row-reverse;
}

.unit-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.unit-indicator {
    font-size: 0.7rem;
    color: #64748b;
    text-transform: uppercase;
    font-weight: 600;
}

.unit-coaches {
    display: flex;
    gap: 3px;
    align-items: flex-end;
}

.mini-coach {
    width: 24px;
    height: 38px;
    border-radius: 3px;
    border: 1px solid #334155;
    background: #1e293b;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 2px;
    box-sizing: border-box;
    position: relative;
    user-select: none;
}

.mini-coach.class-1 {
    background: #1e3a8a;
    border-color: #3b82f6;
}

.mini-coach.class-2 {
    background: #1e293b;
    border-color: #475569;
}

.mini-coach.class-loco {
    background: #334155;
    border-color: #64748b;
    width: 20px;
    height: 32px;
}

.mini-coach.control_car {
    border-top-left-radius: 8px;
}

.mini-coach-roof {
    height: 4px;
    border-radius: 2px 2px 0 0;
}
.mini-coach.class-1 .mini-coach-roof {
    background: #fbbf24;
}

.mini-coach-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 0.65rem;
    font-weight: bold;
    color: #e2e8f0;
}

.wagon-num {
    font-size: 0.65rem;
    color: #38bdf8;
    line-height: 1;
}

.class-num {
    font-size: 0.6rem;
    color: #94a3b8;
    line-height: 1;
}

.coach-label {
    font-size: 0.55rem;
    color: #f1f5f9;
}

.mini-amenity-dots {
    display: flex;
    gap: 2px;
    justify-content: center;
}

.amenity-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #94a3b8;
}
.amenity-dot.board_restaurant, .amenity-dot.bistro { background: #ef4444; }
.amenity-dot.bike_space { background: #22c55e; }
.amenity-dot.wheelchair_space { background: #38bdf8; }

/* Options Styling */
.options-group {
    margin-bottom: 14px;
}

.option-label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-main, #fff);
    margin-bottom: 6px;
}

.tractions-selector {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.traction-btn {
    flex: 1;
    background: var(--bg-card, #2b2b2b);
    border: 1px solid var(--border, #444);
    border-radius: 6px;
    color: var(--text-main, #fff);
    padding: 8px 10px;
    font-size: 0.82rem;
    cursor: pointer;
    transition: all 0.15s ease;
}

.traction-btn:hover:not(:disabled) {
    border-color: var(--accent, #e2001a);
}

.traction-btn.active {
    background: var(--accent, #e2001a);
    border-color: var(--accent, #e2001a);
    color: #fff;
    font-weight: bold;
}

.traction-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.checkbox-option {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--text-main, #ddd);
    cursor: pointer;
}

.checkbox-option input[type="checkbox"] {
    cursor: pointer;
}

/* Modal Footer */
.modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 18px;
    border-top: 1px solid var(--border, #444);
    background: rgba(0, 0, 0, 0.2);
}

@media (max-width: 768px) {
    .preset-layout-grid {
        grid-template-columns: 1fr;
    }
}
</style>
