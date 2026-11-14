// src/components/chassis/chassisStyleRegistry.js
import ChassisStandard from './ChassisStandard.svelte';
import ChassisStele from './ChassisStele.svelte';
import ChassisVitrine from './ChassisVitrine.svelte';

/**
 * Registry der Gehäuse-Optiken (P5).
 *
 * Der Schlüssel ist der Wert aus `CHASSIS_PROFILES[*].style` bzw.
 * `layout.chassisStyle`. Eine Optik ist eine reine Darstellungsfrage: Rahmen,
 * Sockel, Füße und Stege. Die Geometrie (padding, gapWidth, extraBottom)
 * kommt weiterhin aus dem Gehäuseprofil, die Maße aus dem Layout.
 *
 * `stretched` (Bar-Type) teilt die Standard-Optik; unterschieden wird nur
 * über die Gehäusemaße. Ein neues Gehäuse braucht damit keine neue
 * Verzweigung in `HardwareBezel.svelte`, sondern nur einen Eintrag hier und
 * in `CHASSIS_PROFILES`.
 *
 * @type {Record<string, import('svelte').Component>}
 */
export const CHASSIS_STYLES = {
    standard: ChassisStandard,
    vitrine: ChassisVitrine,
    stele: ChassisStele,
    stretched: ChassisStandard
};

/** Fallback, wenn ein Layout keine (bekannte) Optik mitbringt. */
export const DEFAULT_CHASSIS_STYLE = 'standard';
