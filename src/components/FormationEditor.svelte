<!-- src/components/FormationEditor.svelte -->
<script>
    import { trainDisplay } from '../js/stores.js';
    import { Formation, FormationGroup } from '../js/models/formation.svelte.js';
    import { Coach } from '../js/models/coach.svelte.js';

    let { journey = $bindable() } = $props();

    // Sicherstellen, dass eine Formation existiert
    if (!journey.formation) {
        journey.formation = new Formation();
    }

    function triggerUpdate() {
        trainDisplay.updateAll();
    }

    function addGroup() {
        if (!journey.formation) {
            journey.formation = new Formation();
        }
        const defaultDest = journey.destination || '';
        const group = new FormationGroup({
            name: `Gruppe ${journey.formation.groups.length + 1}`,
            transport: {
                category: journey.produktGattung || 'ICE',
                destination: { name: defaultDest },
                number: 0
            },
            coaches: [
                new Coach({ type: 'control_car', coachClass: 2, wagonIdentificationNumber: 1, length: 25, open: true }),
                new Coach({ type: 'middle_car', coachClass: 2, wagonIdentificationNumber: 2, length: 25, open: true }),
                new Coach({ type: 'control_car', coachClass: 1, wagonIdentificationNumber: 3, length: 25, open: true })
            ]
        });
        journey.formation.groups.push(group);
        triggerUpdate();
    }

    function removeGroup(groupIndex) {
        journey.formation.groups.splice(groupIndex, 1);
        triggerUpdate();
    }

    function reverseAll() {
        if (!journey.formation || journey.formation.groups.length === 0) return;

        // Gruppen umkehren
        journey.formation.groups.reverse();

        // Innerhalb jeder Gruppe Wagen umkehren
        journey.formation.groups.forEach(group => {
            group.coaches.reverse();
        });

        triggerUpdate();
    }

    function clearFormation() {
        if (confirm('Möchtest du wirklich alle Wagen dieser Formation löschen?')) {
            journey.formation.groups = [];
            triggerUpdate();
        }
    }

    function addCoach(group) {
        let nextWagonNum = 1;
        if (group.coaches.length > 0) {
            const lastNum = group.coaches[group.coaches.length - 1].wagonIdentificationNumber;
            if (typeof lastNum === 'number') {
                nextWagonNum = lastNum + 1;
            }
        }

        const newCoach = new Coach({
            type: 'middle_car',
            coachClass: 2,
            wagonIdentificationNumber: nextWagonNum,
            length: 25,
            open: true,
            amenities: []
        });

        group.coaches.push(newCoach);
        triggerUpdate();
    }

    function duplicateCoach(group, coachIndex) {
        const source = group.coaches[coachIndex];
        const newCoach = new Coach({
            type: source.type,
            coachClass: source.coachClass,
            wagonIdentificationNumber: source.wagonIdentificationNumber ? source.wagonIdentificationNumber + 1 : null,
            length: source.length,
            open: source.open,
            amenities: [...source.amenities]
        });
        group.coaches.splice(coachIndex + 1, 0, newCoach);
        triggerUpdate();
    }

    function removeCoach(group, coachIndex) {
        group.coaches.splice(coachIndex, 1);
        triggerUpdate();
    }

    function moveCoach(group, fromIndex, toIndex) {
        if (toIndex < 0 || toIndex >= group.coaches.length) return;
        const item = group.coaches.splice(fromIndex, 1)[0];
        group.coaches.splice(toIndex, 0, item);
        triggerUpdate();
    }

    function toggleAmenity(coach, amenityKey) {
        if (coach.amenities.includes(amenityKey)) {
            coach.amenities = coach.amenities.filter(a => a !== amenityKey);
        } else {
            coach.amenities = [...coach.amenities, amenityKey];
        }
        triggerUpdate();
    }

    function applyPreset(presetType) {
        if (!journey.formation) {
            journey.formation = new Formation();
        }

        if (presetType === 'ice_kurz') {
            journey.formation.groups = [
                new FormationGroup({
                    name: journey.name || 'ICE',
                    transport: {
                        category: 'ICE',
                        destination: { name: journey.destination || 'München Hbf' },
                        number: 1
                    },
                    coaches: [
                        new Coach({ type: 'control_car', length: 25, coachClass: 1, wagonIdentificationNumber: 38, amenities: [], open: true }),
                        new Coach({ type: 'middle_car',  length: 25, coachClass: 1, wagonIdentificationNumber: 37, amenities: [], open: true }),
                        new Coach({ type: 'middle_car',  length: 25, coachClass: 2, wagonIdentificationNumber: 36, amenities: ['BOARD_RESTAURANT'], open: true }),
                        new Coach({ type: 'middle_car',  length: 25, coachClass: 2, wagonIdentificationNumber: 35, amenities: ['WHEELCHAIR_SPACE'], open: true }),
                        new Coach({ type: 'middle_car',  length: 25, coachClass: 2, wagonIdentificationNumber: 34, amenities: [], open: true }),
                        new Coach({ type: 'middle_car',  length: 25, coachClass: 2, wagonIdentificationNumber: 32, amenities: [], open: true }),
                        new Coach({ type: 'control_car', length: 25, coachClass: 2, wagonIdentificationNumber: 31, amenities: ['BIKE_SPACE'], open: true })
                    ]
                })
            ];
        } else if (presetType === 'regional_dosto') {
            journey.formation.groups = [
                new FormationGroup({
                    name: journey.name || 'RE',
                    transport: {
                        category: 'RE',
                        destination: { name: journey.destination || 'Köln Hbf' },
                        number: 1
                    },
                    coaches: [
                        new Coach({ type: 'locomotive', length: 19, coachClass: null, wagonIdentificationNumber: null, amenities: [], open: true }),
                        new Coach({ type: 'middle_car', length: 26, coachClass: 1, wagonIdentificationNumber: 1, amenities: [], open: true }),
                        new Coach({ type: 'middle_car', length: 26, coachClass: 2, wagonIdentificationNumber: 2, amenities: ['WHEELCHAIR_SPACE'], open: true }),
                        new Coach({ type: 'middle_car', length: 26, coachClass: 2, wagonIdentificationNumber: 3, amenities: [], open: true }),
                        new Coach({ type: 'control_car', length: 27, coachClass: 2, wagonIdentificationNumber: 4, amenities: ['BIKE_SPACE'], open: true })
                    ]
                })
            ];
        }
        triggerUpdate();
    }
</script>

<div class="formation-editor-container">
    <div class="formation-toolbar">
        <div class="preset-buttons">
            <button class="btn-secondary btn-sm" onclick={() => applyPreset('ice_kurz')}>⚡ ICE Preset</button>
            <button class="btn-secondary btn-sm" onclick={() => applyPreset('regional_dosto')}>⚡ Dosto Preset</button>
        </div>
        <div class="action-buttons">
            <button class="btn-secondary btn-sm" onclick={reverseAll} title="Dreht alle Gruppen und Wagen um">🔁 Komplett drehen</button>
            <button class="btn-primary btn-sm" onclick={addGroup}>+ Neuer Zugteil (Gruppe)</button>
            <button class="btn-danger btn-sm" onclick={clearFormation} title="Alle Wagen löschen">🗑️ Leeren</button>
        </div>
    </div>

    {#if !journey.formation || journey.formation.groups.length === 0}
        <div class="formation-empty">
            Keine Wagenreihung vorhanden. Füge eine Gruppe oder ein Preset hinzu.
        </div>
    {:else}
        {#each journey.formation.groups as group, gIdx}
            <div class="formation-group-card">
                <div class="group-header">
                    <div class="group-title-fields">
                        <span class="group-badge">Zugteil {gIdx + 1}</span>
                        <input type="text" class="jfield short-input" style="width: 140px;" bind:value={group.name} oninput={triggerUpdate} placeholder="Name (z.B. ICE 543)">
                        <input type="text" class="jfield short-input" style="flex: 1; min-width: 150px;" bind:value={group.transport.destination.name} oninput={triggerUpdate} placeholder="Ziel dieses Zugteils (optional)">
                    </div>
                    <div class="group-actions">
                        <button class="btn-secondary btn-sm" onclick={() => addCoach(group)}>+ Wagen</button>
                        <button class="btn-danger btn-sm" onclick={() => removeGroup(gIdx)} title="Diesen Zugteil löschen">✕ Gruppe</button>
                    </div>
                </div>

                <div class="coaches-list">
                    {#if group.coaches.length === 0}
                        <div class="coaches-empty">Keine Wagen in dieser Gruppe. Klicke auf "+ Wagen".</div>
                    {:else}
                        {#each group.coaches as coach, cIdx}
                            <div class="coach-row {coach.open ? '' : 'coach-closed'}">
                                <!-- Reorder Buttons -->
                                <div class="coach-reorder">
                                    <button class="btn-icon-tiny" disabled={cIdx === 0} onclick={() => moveCoach(group, cIdx, cIdx - 1)} title="Nach links">◀</button>
                                    <span class="coach-index">{cIdx + 1}</span>
                                    <button class="btn-icon-tiny" disabled={cIdx === group.coaches.length - 1} onclick={() => moveCoach(group, cIdx, cIdx + 1)} title="Nach rechts">▶</button>
                                </div>

                                <!-- Typ -->
                                <div class="coach-field-group">
                                    <label class="field-label">Typ</label>
                                    <select class="jfield short-input" bind:value={coach.type} onchange={triggerUpdate} style="width: 110px;">
                                        <option value="control_car">Steuerwagen</option>
                                        <option value="middle_car">Mittelwagen</option>
                                        <option value="locomotive">Lokomotive</option>
                                    </select>
                                </div>

                                <!-- Klasse -->
                                <div class="coach-field-group">
                                    <label class="field-label">Klasse</label>
                                    <select class="jfield short-input" bind:value={coach.coachClass} onchange={triggerUpdate} style="width: 80px;">
                                        <option value={1}>1. Klasse</option>
                                        <option value={2}>2. Klasse</option>
                                        <option value={null}>Keine</option>
                                    </select>
                                </div>

                                <!-- Wagennummer -->
                                <div class="coach-field-group">
                                    <label class="field-label">Wg-Nr.</label>
                                    <input type="number" class="jfield short-input" bind:value={coach.wagonIdentificationNumber} oninput={triggerUpdate} placeholder="-" style="width: 60px; text-align: center;">
                                </div>

                                <!-- Länge (m) -->
                                <div class="coach-field-group">
                                    <label class="field-label">Länge (m)</label>
                                    <input type="number" step="0.5" class="jfield short-input" bind:value={coach.length} oninput={triggerUpdate} style="width: 60px; text-align: center;">
                                </div>

                                <!-- Status Offen / Geschlossen -->
                                <div class="coach-field-group">
                                    <label class="field-label">Status</label>
                                    <button class="btn-status-toggle {coach.open ? 'status-open' : 'status-closed'}" 
                                            onclick={() => { coach.open = !coach.open; triggerUpdate(); }}
                                            title={coach.open ? 'Wagen geöffnet' : 'Wagen verschlossen (X)'}>
                                        {coach.open ? 'Geöffnet' : 'X Gesperrt'}
                                    </button>
                                </div>

                                <!-- Ausstattungs-Merkmale (Toggles) -->
                                <div class="coach-amenities-group">
                                    <label class="field-label">Ausstattung</label>
                                    <div class="amenity-badges">
                                        <button class="badge-toggle {coach.amenities.includes('BOARD_RESTAURANT') ? 'active' : ''}" 
                                                onclick={() => toggleAmenity(coach, 'BOARD_RESTAURANT')} 
                                                title="Bordrestaurant">🍽️</button>
                                        <button class="badge-toggle {coach.amenities.includes('BISTRO') ? 'active' : ''}" 
                                                onclick={() => toggleAmenity(coach, 'BISTRO')} 
                                                title="Bistro">☕</button>
                                        <button class="badge-toggle {coach.amenities.includes('BIKE_SPACE') ? 'active' : ''}" 
                                                onclick={() => toggleAmenity(coach, 'BIKE_SPACE')} 
                                                title="Fahrradmitnahme">🚲</button>
                                        <button class="badge-toggle {coach.amenities.includes('WHEELCHAIR_SPACE') ? 'active' : ''}" 
                                                onclick={() => toggleAmenity(coach, 'WHEELCHAIR_SPACE')} 
                                                title="Rollstuhlstellplatz">♿</button>
                                        <button class="badge-toggle {coach.amenities.includes('SLEEPER') ? 'active' : ''}" 
                                                onclick={() => toggleAmenity(coach, 'SLEEPER')} 
                                                title="Schlafwagen">🛌</button>
                                        <button class="badge-toggle {coach.amenities.includes('COUCHETTE') ? 'active' : ''}" 
                                                onclick={() => toggleAmenity(coach, 'COUCHETTE')} 
                                                title="Liegewagen">🛋️</button>
                                    </div>
                                </div>

                                <!-- Aktionen -->
                                <div class="coach-actions">
                                    <button class="btn-icon" onclick={() => duplicateCoach(group, cIdx)} title="Wagen duplizieren">📋</button>
                                    <button class="btn-icon" onclick={() => removeCoach(group, cIdx)} title="Wagen entfernen">✕</button>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>
        {/each}
    {/if}
</div>

<style>
    .formation-editor-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .formation-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        background: rgba(0,0,0,0.15);
        padding: 8px 12px;
        border-radius: 6px;
    }

    .preset-buttons, .action-buttons {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .formation-empty {
        padding: 20px;
        text-align: center;
        color: #888;
        background: rgba(0,0,0,0.1);
        border: 1px dashed var(--border-color, #444);
        border-radius: 6px;
        font-style: italic;
    }

    .formation-group-card {
        background: rgba(0,0,0,0.12);
        border: 1px solid var(--border-color, #444);
        border-radius: 6px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .group-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding-bottom: 8px;
    }

    .group-title-fields {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
    }

    .group-badge {
        font-size: 0.85em;
        font-weight: bold;
        background: #4dabf7;
        color: white;
        padding: 3px 8px;
        border-radius: 4px;
        white-space: nowrap;
    }

    .group-actions {
        display: flex;
        gap: 8px;
    }

    .coaches-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .coaches-empty {
        padding: 10px;
        color: #888;
        font-style: italic;
        font-size: 0.9em;
    }

    .coach-row {
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--bg-input, #1e1e1e);
        border: 1px solid var(--border-color, #333);
        border-radius: 4px;
        padding: 6px 10px;
        transition: 0.15s ease;
    }

    .coach-row:hover {
        border-color: #555;
    }

    .coach-closed {
        opacity: 0.75;
        border-left: 3px solid #ff6b6b;
    }

    .coach-reorder {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .btn-icon-tiny {
        background: transparent;
        border: 1px solid rgba(255,255,255,0.15);
        color: #ccc;
        cursor: pointer;
        padding: 2px 5px;
        font-size: 0.75em;
        border-radius: 3px;
    }

    .btn-icon-tiny:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .coach-index {
        font-size: 0.85em;
        font-weight: bold;
        min-width: 16px;
        text-align: center;
        color: #aaa;
    }

    .coach-field-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .field-label {
        font-size: 0.7em;
        color: var(--text-muted, #888);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .btn-status-toggle {
        font-size: 0.8em;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        border: none;
    }

    .status-open {
        background: rgba(40, 167, 69, 0.2);
        color: #4CAF50;
        border: 1px solid rgba(40, 167, 69, 0.4);
    }

    .status-closed {
        background: rgba(255, 107, 107, 0.2);
        color: #ff6b6b;
        border: 1px solid rgba(255, 107, 107, 0.4);
    }

    .coach-amenities-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
    }

    .amenity-badges {
        display: flex;
        gap: 4px;
        align-items: center;
        flex-wrap: wrap;
    }

    .badge-toggle {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 4px;
        padding: 3px 6px;
        font-size: 0.9em;
        cursor: pointer;
        opacity: 0.4;
        transition: 0.15s ease;
    }

    .badge-toggle.active {
        opacity: 1;
        background: rgba(77, 171, 247, 0.25);
        border-color: #4dabf7;
    }

    .coach-actions {
        display: flex;
        gap: 4px;
        align-items: center;
    }
</style>
