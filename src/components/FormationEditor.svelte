<script>
    import { dndzone } from 'svelte-dnd-action';
    import { safeFlip as flip } from '../js/core/utils/animationUtils.js';
    import { moveItemUp, moveItemDown } from '../js/core/utils/arrayUtils.js';
    import { uiState } from '../js/core/state/uiState.svelte.js';
    import { trainDisplay, journeyStore } from '../js/core/state/stores.js';
    import { Formation } from '../js/features/formation/formationModel.svelte.js';
    import { FormationService } from '../js/features/formation/formationService.js';
    import CoachEditorRow from './CoachEditorRow.svelte';
    import StationPicker from './StationPicker.svelte';

    let { journey = $bindable() } = $props();

    const flipDurationMs = 200;
    let fileInputRef = $state();

    function triggerUpdate() {
        trainDisplay.updateAll();
    }

    // Expand / Collapse State pro Gruppe
    function isGroupExpanded(groupId) {
        // Wenn die Gruppe noch nie getoggelt wurde, ist sie standardmäßig geöffnet
        if (!uiState.expandedGroups.includes(`closed_${groupId}`)) {
            return true;
        }
        return false;
    }

    function toggleGroupExpand(groupId) {
        const closedKey = `closed_${groupId}`;
        if (uiState.expandedGroups.includes(closedKey)) {
            uiState.expandedGroups = uiState.expandedGroups.filter(k => k !== closedKey);
        } else {
            uiState.expandedGroups = [...uiState.expandedGroups, closedKey];
        }
    }

    // === Formation-Level Actions ===

    function addGroup() {
        if (!journey.formation) {
            journey.formation = new Formation();
        }
        const newGroup = FormationService.createDefaultGroup(journey);
        journey.formation.groups.push(newGroup);
        triggerUpdate();
    }

    function reverseEntireFormation() {
        if (!journey.formation) return;
        FormationService.reverseFormation(journey.formation);
        triggerUpdate();
    }

    function exportEntireFormation() {
        FormationService.exportFormation(journey);
    }

    function triggerFileInput() {
        if (fileInputRef) fileInputRef.click();
    }

    function handleFileImport(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                const success = FormationService.applyFormationData(
                    journey, 
                    data, 
                    journeyStore.platforms, 
                    journeyStore.stationContext
                );
                if (success) {
                    triggerUpdate();
                } else {
                    alert('Das Dateiformat konnte nicht als Formation oder Zugteil erkannt werden.');
                }
            } catch (err) {
                console.error('Fehler beim Importieren der Formation:', err);
                alert('Fehler beim Einlesen der Datei: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    }

    // === Group-Level Actions ===

    function moveGroupUp(group) {
        const idx = journey.formation.groups.indexOf(group);
        if (moveItemUp(journey.formation.groups, idx)) {
            FormationService.cleanPlatformPositions(journey.formation);
            triggerUpdate();
        }
    }

    function moveGroupDown(group) {
        const idx = journey.formation.groups.indexOf(group);
        if (moveItemDown(journey.formation.groups, idx)) {
            FormationService.cleanPlatformPositions(journey.formation);
            triggerUpdate();
        }
    }

    function reverseGroup(group) {
        FormationService.reverseGroup(group);
        triggerUpdate();
    }

    function exportGroup(group) {
        FormationService.exportGroup(group);
    }

    function removeGroup(group) {
        journey.formation.groups = journey.formation.groups.filter(g => g !== group);
        triggerUpdate();
    }

    function addCoachToGroup(group) {
        const newCoach = FormationService.createDefaultCoach('middle_car');
        group.coaches.push(newCoach);
        FormationService.cleanPlatformPositions(group);
        triggerUpdate();
    }

    // === Coach-Level Actions ===

    function moveCoachUp(group, coach) {
        const idx = group.coaches.indexOf(coach);
        if (moveItemUp(group.coaches, idx)) {
            FormationService.cleanPlatformPositions(group);
            triggerUpdate();
        }
    }

    function moveCoachDown(group, coach) {
        const idx = group.coaches.indexOf(coach);
        if (moveItemDown(group.coaches, idx)) {
            FormationService.cleanPlatformPositions(group);
            triggerUpdate();
        }
    }

    function removeCoach(group, coach) {
        group.coaches = group.coaches.filter(c => c !== coach);
        FormationService.cleanPlatformPositions(group);
        triggerUpdate();
    }

    // === Drag and Drop Handlers ===

    function handleGroupDndConsider(e) {
        journey.formation.groups = e.detail.items;
    }

    function handleGroupDndFinalize(e) {
        journey.formation.groups = e.detail.items;
        FormationService.cleanPlatformPositions(journey.formation);
        triggerUpdate();
    }

    function handleCoachDndConsider(group, e) {
        group.coaches = e.detail.items;
    }

    function handleCoachDndFinalize(group, e) {
        group.coaches = e.detail.items;
        FormationService.cleanPlatformPositions(group);
        triggerUpdate();
    }
</script>

<div class="formation-editor-root">
    <!-- Action Bar oben -->
    <div class="formation-header-actions">
        <h4>Wagenreihung</h4>
        <div class="actions-buttons-wrap">
            <button type="button" class="btn-secondary btn-sm" onclick={triggerFileInput} title="Wagenreihung aus JSON importieren">
                📥 Import
            </button>
            <input 
                type="file" 
                bind:this={fileInputRef} 
                style="display: none;" 
                accept=".json" 
                onchange={handleFileImport}
            >
            <button type="button" class="btn-secondary btn-sm" onclick={exportEntireFormation} title="Gesamte Formation als JSON herunterladen">
                📤 Export
            </button>
            <button type="button" class="btn-secondary btn-sm" onclick={reverseEntireFormation} title="Dreht die Reihenfolge aller Gruppen und Wagen um">
                🔁 Komplett drehen
            </button>
            <button type="button" class="btn-primary btn-sm" onclick={addGroup} title="Neuen Zugteil / Gruppe anlegen">
                + Neue Gruppe
            </button>
        </div>
    </div>

    {#if !journey.formation || journey.formation.groups.length === 0}
        <div class="formation-empty-card">
            <div class="empty-icon">🚆</div>
            <p>Keine Wagenreihung für diese Fahrt vorhanden.</p>
            <button type="button" class="btn-secondary" onclick={addGroup}>+ Erste Gruppe anlegen</button>
        </div>
    {:else}
        <!-- Gruppen-Liste mit dndzone (Gruppe gegen Gruppe verschiebbar) -->
        <div 
            class="groups-container"
            use:dndzone={{
                items: journey.formation.groups,
                flipDurationMs,
                type: 'formation-group',
                dragDisabled: !uiState.enableDragAndDrop
            }}
            onconsider={handleGroupDndConsider}
            onfinalize={handleGroupDndFinalize}
        >
            {#each journey.formation.groups as group, gIdx (group.id)}
                {@const expanded = isGroupExpanded(group.id)}
                <div animate:flip={{ duration: flipDurationMs }} class="formation-group-card">
                    <!-- Gruppen-Header -->
                    <div class="group-header">
                        <div class="group-header-left">
                            <div class="group-reorder">
                                {#if uiState.enableDragAndDrop}
                                    <span class="group-drag-handle" title="Gruppe verschieben">⠿</span>
                                {/if}
                                <div class="group-arrows">
                                    <button type="button" class="btn-icon arrow-btn" onclick={() => moveGroupUp(group)} title="Gruppe nach oben verschieben">↑</button>
                                    <button type="button" class="btn-icon arrow-btn" onclick={() => moveGroupDown(group)} title="Gruppe nach unten verschieben">↓</button>
                                </div>
                            </div>

                            <button 
                                type="button" 
                                class="btn-icon expand-chevron" 
                                onclick={() => toggleGroupExpand(group.id)}
                                title={expanded ? 'Zugteil einklappen' : 'Zugteil ausklappen'}
                            >
                                {expanded ? '▾' : '▸'}
                            </button>

                            <span class="group-badge">Zugteil {gIdx + 1}</span>

                            <div class="group-prop-inputs">
                                <input 
                                    type="text" 
                                    class="group-field cat-input" 
                                    bind:value={group.transport.category} 
                                    oninput={triggerUpdate} 
                                    placeholder="Gattung (ICE)" 
                                    title="Zuggattung (z.B. ICE, RE, S)"
                                >
                                <input 
                                    type="number" 
                                    class="group-field num-input" 
                                    bind:value={group.transport.number} 
                                    oninput={triggerUpdate} 
                                    placeholder="Nr" 
                                    title="Zugnummer (z.B. 1545)"
                                >
                                <div class="dest-picker-wrap" title="Zielbahnhof dieses Zugteils">
                                    <StationPicker 
                                        bind:value={group.destination} 
                                        placeholder="Zielbahnhof des Zugteils" 
                                        onSelect={() => triggerUpdate()}
                                        onInput={() => triggerUpdate()}
                                    />
                                </div>
                                <input 
                                    type="text" 
                                    class="group-field name-input" 
                                    bind:value={group.name} 
                                    oninput={triggerUpdate} 
                                    placeholder="Triebzug (z.B. ICE 1130)" 
                                    title="Triebzugname"
                                >
                            </div>
                        </div>

                        <!-- Gruppen-Aktionen -->
                        <div class="group-header-right">
                            <button type="button" class="btn-icon action-btn" onclick={() => reverseGroup(group)} title="Reihenfolge der Wagen in diesem Zugteil umkehren">
                                🔁
                            </button>
                            <button type="button" class="btn-icon action-btn" onclick={() => exportGroup(group)} title="Diesen Zugteil als JSON exportieren">
                                📤
                            </button>
                            <button type="button" class="btn-secondary btn-sm" onclick={() => addCoachToGroup(group)} title="Wagen hinzufügen">
                                + Wagen
                            </button>
                            <button type="button" class="btn-icon remove-group-btn" onclick={() => removeGroup(group)} title="Diesen Zugteil löschen">
                                🗑️
                            </button>
                        </div>
                    </div>

                    <!-- Gruppen-Inhalt: Wagen-Liste (Akkordeon) -->
                    {#if expanded}
                        <div class="group-body">
                            {#if group.coaches.length === 0}
                                <div class="empty-coaches">
                                    <span>Keine Wagen vorhanden.</span>
                                    <button type="button" class="btn-secondary btn-sm" onclick={() => addCoachToGroup(group)}>+ Wagen hinzufügen</button>
                                </div>
                            {:else}
                                <div 
                                    class="coaches-list"
                                    use:dndzone={{
                                        items: group.coaches,
                                        flipDurationMs,
                                        type: `coach-${group.id}`,
                                        dragDisabled: !uiState.enableDragAndDrop
                                    }}
                                    onconsider={(e) => handleCoachDndConsider(group, e)}
                                    onfinalize={(e) => handleCoachDndFinalize(group, e)}
                                >
                                    {#each group.coaches as coach, cIdx (coach.id)}
                                        <div animate:flip={{ duration: flipDurationMs }}>
                                            <CoachEditorRow 
                                                bind:coach={group.coaches[cIdx]}
                                                onMoveUp={() => moveCoachUp(group, coach)}
                                                onMoveDown={() => moveCoachDown(group, coach)}
                                                onRemove={() => removeCoach(group, coach)}
                                                onChange={triggerUpdate}
                                            />
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .formation-editor-root {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 5px;
    }

    .formation-header-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 5px;
    }
    .formation-header-actions h4 {
        margin: 0;
        color: var(--text-muted, #aaa);
        font-size: 0.85em;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .actions-buttons-wrap {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .formation-empty-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 30px 20px;
        background: rgba(0, 0, 0, 0.15);
        border: 1px dashed var(--border, #444);
        border-radius: 8px;
        text-align: center;
        gap: 12px;
        color: var(--text-muted, #888);
    }
    .empty-icon {
        font-size: 2rem;
    }

    .groups-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .formation-group-card {
        background: var(--bg-input, #1e1e1e);
        border: 1px solid var(--border, #444);
        border-radius: 8px;
        overflow: hidden;
        transition: border-color 0.2s;
    }
    .formation-group-card:hover {
        border-color: var(--text-muted, #666);
    }

    .group-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.25);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        flex-wrap: wrap;
        gap: 10px;
    }

    .group-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        flex-wrap: wrap;
        min-width: 0;
    }

    .group-reorder {
        display: flex;
        align-items: center;
        gap: 2px;
    }
    .group-drag-handle {
        cursor: grab;
        font-size: 16px;
        color: var(--text-muted, #888);
        user-select: none;
    }
    .group-arrows {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .expand-chevron {
        font-size: 1rem;
        font-weight: bold;
        color: var(--text-muted, #aaa);
        padding: 2px 4px;
    }

    .group-badge {
        background: var(--accent, #e2001a);
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: bold;
        white-space: nowrap;
    }

    .group-prop-inputs {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
        flex-wrap: wrap;
        min-width: 260px;
    }

    .group-field {
        background: var(--bg-card, #2b2b2b);
        color: var(--text-main, #fff);
        border: 1px solid var(--border, #444);
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 0.85rem;
        outline: none;
    }
    .group-field:focus {
        border-color: var(--accent, #e2001a);
    }
    .cat-input {
        width: 60px;
    }
    .num-input {
        width: 70px;
    }
    .dest-picker-wrap {
        flex: 1;
        min-width: 140px;
    }
    .name-input {
        width: 120px;
    }

    .group-header-right {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .action-btn {
        padding: 4px 6px;
        font-size: 1rem;
        border-radius: 4px;
    }
    .action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .remove-group-btn {
        padding: 4px 6px;
        font-size: 1rem;
        border-radius: 4px;
    }
    .remove-group-btn:hover {
        background: rgba(255, 107, 107, 0.2);
    }

    .group-body {
        padding: 10px;
        background: rgba(0, 0, 0, 0.1);
    }

    .empty-coaches {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 16px;
        color: var(--text-muted, #888);
        font-size: 0.9rem;
    }

    .coaches-list {
        display: flex;
        flex-direction: column;
        min-height: 20px;
    }

    /* Responsive Anpassung (< 768px) */
    @media (max-width: 768px) {
        .formation-header-actions {
            flex-direction: column;
            align-items: stretch;
        }
        .actions-buttons-wrap {
            width: 100%;
            justify-content: space-between;
        }
        .actions-buttons-wrap button {
            flex: 1;
            min-height: 40px;
        }
        .group-header {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
        }
        .group-header-left {
            width: 100%;
        }
        .group-prop-inputs {
            width: 100%;
            min-width: 100%;
        }
        .group-field {
            min-height: 38px;
        }
        .dest-picker-wrap {
            width: 100%;
            flex: 1 1 100%;
        }
        .group-header-right {
            justify-content: flex-end;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: 8px;
        }
        .group-header-right button {
            min-height: 38px;
        }
    }
</style>
