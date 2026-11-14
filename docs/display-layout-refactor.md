# Display-Layout-Refactor: Display ≠ Gehäuse

> Arbeitsdokument für die laufende Umstellung. **Kurz halten** – es ist der
> Einstiegspunkt für jede neue Session, damit der Chat-Verlauf nicht erneut
> gelesen werden muss.
>
> Stand: P1–P6 umgesetzt, Verifikation grün. Keine offenen Phasen.

---

## 1. Leitidee

Drei orthogonale Achsen statt einer Profil-Liste:

```
Display (Panel-Verbund)  ×  Gehäuse (Chassis)  ×  Anzeigetyp
  was ist zu sehen            wie sieht es aus        was steht drauf
```

Damit ist die **Vitrine** kein eigenes Display mehr, sondern ein Gehäuse um ein
1×-FullHD-Panel; die **Stele** ist dasselbe Panel im Hochformat mit Sockel.
Ein neues Gerät ist künftig eine Datenzeile, kein neuer `if`-Zweig.

Der **Steg** (50 px) gehört zum Gehäuse (`gapWidth`), nicht zum Display. Er ist
der einzige Punkt, an dem das Gehäuse die Display-Geometrie beeinflusst.

---

## 2. Datenmodell

`src/js/displays/core/displayLayoutService.js`

### 2.1 `DISPLAY_PROFILES` (nur Glas)

| ID | Segmente | Slots | Listen-Spalten/Segment |
|---|---|---|---|
| `fhd_1x1_landscape` | 1× 1920 | – | 1 |
| `fhd_2x1_landscape` | 2× 1920 | haupt + 2 Hälften | 1 |
| `fhd_3x1_landscape` | 3× 1920 | haupt + 5 Hälften | 1 |
| `fhd_1x1_portrait` | 1× 1080 (h = 1920) | – | 1 |
| `wide_1x1_landscape` | 1× 2560 | – | 2 |
| `ultrawide_1x1_landscape` | 1× 3840 | haupt + 2 Hälften (im selben Segment) | 2 |

Felder: `id`, `name`, `orientation`, `panelH`, `segments[{w}]`,
`slots[{id,type,segment,offset,w,trainIndex?}]`, `listColumnsPerSegment`,
optional `renderMode`, `legacyOverrides`.

### 2.2 `CHASSIS_PROFILES` (nur Rahmen)

| ID | style | padding | gapWidth | extraBottom |
|---|---|---|---|---|
| `overhead` | `standard` | 270 / 260 | **50** | 0 |
| `vitrine` | `vitrine` | 100 / 100 | 0 | **100** (Standfüße) |
| `stele` | `stele` | 80 / 100 | 0 | **100** (Sockel) |
| `bar` | `stretched` | 100 / 90 | 0 | 0 |
| `none` | `none` | 0 / 0 | 0 | 0 |

### 2.3 `MONITOR_PRESETS` (Legacy-Kombinationen)

`zim2x32`, `zim3x32`, `zim32_single`, `zimvitrine32`, `zimvitrine65h`,
`zimwide`, `zimultrawide` → jeweils `{displayId, chassisId}`.
Das ist die Quelle für das Dropdown und `zimsim_monitor_id`.
`MONITOR_PROFILES` ist ein Alias darauf (bestehende UI bleibt unverändert).

### 2.4 Ableitung (nicht mehr pflegen!)

```
segmentStarts[i] = Σ(seg.w, 0..i-1) + i · gapWidth
contentW         = Σ(seg.w) + (n-1) · gapWidth
hasBezelGap      = withBezel && gapWidth > 0 && n > 1
gapStarts        = segmentStarts[1..] - gapWidth
casingW          = contentW + 2 · padding.x
casingH          = panelH + 2 · padding.y + extraBottom
```

4K = alle Werte × `BOARD_VARIANTS[variant].scale` (Screens werden nach der
Generierung verdoppelt; Renderer zeichnen weiter logisch).

**Ausnahme `renderMode: 'stretch'` (wide/ultrawide, P6):** Die Segmentbreiten
sind hier bereits die physischen Panelbreiten. `scaleFactor` bleibt deshalb
`1` (keine 4K-Verdopplung); der Canvas ist z. B. beim Ultrawide immer
3840×1080. Die Renderer zeichnen weiter auf ihrer logischen Fläche
(`logicalWidth`/`logicalHeight` je Screen, 1920×1080 bzw. 960×1080), und
`canvasLayerService` skaliert diese pro Screen auf das physische Rechteck.
Die 4K-Variante steuert bei diesen Displays nur noch die Token-Overrides
(z. B. Zeilenzahl), nicht mehr die Canvas-Größe.

---

## 3. API

```js
// Kern
createLayout({ presetId, displayId, chassisId, layoutType, withBezel,
               variantId, chassisOverrides, targetScreen })

// Kompatibilität (displayConfigStore)
generateActiveLayout(monitorId, layoutType, withBezel, targetScreen, boardVariantId)

// Helfer
resolvePresetProfile(presetId) → { preset, display, chassis }
getDisplayOrientation(displayId)                          // Store nutzt diese
getMonitorOrientation(monitorId)                          // Legacy-Kompatibilität
getChassisOptions(orientation)                            // Dropdown-Datenquelle (P4)
isChassisCompatible(chassisId, orientation)               // Filterregel (P4)
getDefaultChassisForDisplay(displayId)                    // natürliches Gehäuse (P4)
getChassisGapWidth(chassisId)                             // Profil-Stegdicke (P4)
CHASSIS_GAP_RANGE                                          // { min: 0, max: 100 } (P4)
generateTargetScreenLayout(layoutType, screen, variant)  // unverändert
```

`chassisOverrides` ist seit P4 verdrahtet: Der Regler „Stegdicke“ schreibt
`{ gapWidth: 0…100 }`; `null` bedeutet „Vorgabe des Gehäuseprofils“.

Store (`displayConfigStore.svelte.js`): `displayId` und `chassisId` sind
`$state` (Quelle der Wahrheit), `monitorId` ist nur noch der abgeleitete
Preset-Name für ScreenSync/Dropdown-Legacy. Persistiert werden
`zimsim_display_id`, `zimsim_chassis_id` und `zimsim_chassis_gap`;
`zimsim_monitor_id` bleibt als Legacy-Key und wird beim Laden sowie bei jedem
Wechsel nachgezogen. `showBezel` ist seit P4 **abgeleitet** (`chassisId !==
'none'`); der Key `zimsim_show_bezel` ist nur noch ein Spiegel für alte
Clients. `setDisplayAndChassis(displayId, chassisId)` ist der Einstieg der
Zwei-Achsen-UI, `setChassisGap(value)` der des Reglers,
`setBezelEnabled(bool)`/`toggleBezel()` bilden die frühere Checkbox (Strg+B) ab.

---

## 4. Phasenplan

### P2 – Store auf zwei Achsen (UI bleibt Preset-basiert)
- [x] `displayId`/`chassisId` als `$state` statt derived; `monitorId` nur noch
      als abgeleiteter Preset-Name für die UI.
- [x] Migration: `zimsim_monitor_id` einmalig lesen → `zimsim_display_id` +
      `zimsim_chassis_id` schreiben; Legacy-Key weiter pflegen.
- [x] `currentLayout` direkt über `createLayout(...)` statt Adapter.
- [x] `getMonitorOrientation`-Aufrufe auf Display-Ausrichtung umstellen
      (`activeVariantId`, `getInitialBoardVariant`) — neuer Helfer
      `getDisplayOrientation(displayId)`.
- [x] Akzeptanz: Snapshot identisch zu P1 für alle 7 Presets.

### P3 – Altlasten & Bugs (bewusst verzögert, braucht Sichtprüfung)
- [x] `legacyGaps` bei `fhd_3x1_landscape` entfernen: Der zweite Steg saß
      auf 3940 statt 3890 (50 px zu weit rechts, im dritten Panel). `gaps`
      wird jetzt aus `gapStarts` abgeleitet.
- [x] Stele + `zuganzeiger`: **Entscheidung** — der Wagenstandsanzeiger
      bleibt. Ein echter Hochkant-Zuganzeiger scheitert aktuell an den festen
      1920×1080-Positionen des Renderers und wird ein eigener Schritt.
- [x] Stele + Zoom: **Entscheidung** — der 8-Zeilen-Fallback
      (`abfahrt_portrait`) bleibt. Der Zoom-Renderer nutzt feste
      Querformat-Spalten; ein echter Hochkant-Zoom wird ein eigener Schritt.
- [x] Ankunftstafel Hochformat: `maxRows` kommt aus der neuen
      `ankunftstafelTokens.js` (16 FHD / 20 4K, Querformat 7). Der redundante
      `maxRows: 20`-Override der Stele ist entfernt.
- [x] `isStretched` in `HardwareBezel.svelte` ist entfernt.

### P4 – Zwei-Achsen-UI
- [x] Zwei Selects (Display / Gehäuse) in `SettingsDisplaySystem.svelte`;
      `monitorOrientation` kommt jetzt aus `getDisplayOrientation(displayId)`.
- [x] Gehäuse nach `orientation` filtern (`any` immer erlaubt) über
      `getChassisOptions(orientation)`; `none` ist der Eintrag „Ohne Gehäuse“.
      **Entscheidung:** Die Checkbox „Gehäusesimulation“ ist entfernt – sie
      hätte die Gehäuse-Achse doppelt gesteuert. Strg+B (`toggleBezel`) schaltet
      weiterhin auf `none` und stellt das zuletzt aktive Gehäuse wieder her.
- [x] Regler „Stegdicke“ → `chassisOverrides.gapWidth` (0–100 px, Schritt 1,
      live). **Entscheidung:** kontinuierlich statt fester Stufen.
- [x] Persistenz `zimsim_display_id`, `zimsim_chassis_id`, `zimsim_chassis_gap`
      (`0` ist ein gültiger Wert; fehlender Key = Profilvorgabe).
- [x] Beim Wechsel zwischen **zwei echten Gehäusen** fällt die Stegdicke auf
      deren Profilwert zurück; der Umweg über „Ohne Gehäuse“ behält sie.
- [x] Migration: `zimsim_show_bezel === 'false'` wird beim Laden zu
      `chassisId = 'none'` (alte Installationen sehen kein Gehäuse auf einmal
      wieder); unbekannte oder zur Ausrichtung unpassende Kombinationen fallen
      auf das Legacy-Preset zurück.
- [x] Achtung: Stegdicke ändert `width`, Screen-X und `casingW` → alles
      reagiert bereits über `currentLayout`.

### P5 – Gehäuse-Komponente entkoppeln
- [x] `HardwareBezel.svelte` ist Chassis-getrieben; `layout.family` heißt jetzt
      `layout.chassisStyle` (Renderer lesen es nicht).
- [x] Styles als Registry (`components/chassis/chassisStyleRegistry.js`):
      `standard`, `vitrine`, `stele`, `stretched` → eigene SVG-Bausteine
      (`ChassisStandard`, `ChassisVitrine`, `ChassisStele`). `stretched`
      (Bar-Type) teilt bewusst die Standard-Optik; `none` wird nie gerendert,
      weil `HardwareBezel` nur bei aktivem Gehäuse montiert wird.

### P6 – wide/ultrawide (gestreckte Panels)
- [x] `renderMode: 'stretch'` wird ausgewertet: Der Canvas bleibt in nativer
      Panelbreite (2560 bzw. 3840 × 1080), `scaleFactor` ist dort immer 1.
      Renderer zeichnen unverändert auf 1920×1080 (Nebenmonitore 960×1080);
      `canvasLayerService` skaliert pro Screen über `logicalWidth/Height`.
      Die Token-Auflösung erhält damit wieder die 1920er-Breite.
- [x] Scroll-Overlays (`scrollManager`, Zugnummern, Lauftext) kompensieren die
      Streckung mit `scaleX`; Pixel-Scans (`textUtils`) rechnen zwischen
      logischen und physischen Koordinaten um. **Grenze:** Horizontale
      DOM-Texte werden gestreckt, nicht neu gesetzt – das ist bei den
      gestreckten Panels gewollt (das echte Gerät verzerrt 16:9-Inhalt genauso).
- [x] 21:9-Listenspalten (2× 1280 physisch) zeichnen das 1920er-Board
      gestaucht (`scaleX = 2/3`), 32:9-Spalten bleiben 1:1.

---

## 5. Verifikation (ohne Testframework)

Die Services sind reine ES-Module ohne DOM. Vor **jeder** Phase: Snapshot vom
committeten Stand erzeugen, danach vergleichen.

**`snapshot.mjs`** (`node snapshot.mjs before.json`):

```js
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SERVICE = 'C:/Users/<user>/Documents/ZIMSim/src/js/displays/core/displayLayoutService.js';
const mod = await import(pathToFileURL(SERVICE).href);
const PRESETS = ['zim2x32','zim3x32','zim32_single','zimvitrine32','zimvitrine65h','zimwide','zimultrawide'];
const LAYOUTS = ['zuganzeiger','anschlusstafel','ankunftstafel','wagenstand_gleis','anschlusstafel_zoom','anschlusstafel_zoom_icons'];
const VARIANTS = ['fhd_landscape','uhd_landscape'];

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = stable(v[k]);
    return o;
  }
  return v;
}

const out = {};
for (const p of PRESETS) for (const l of LAYOUTS) for (const v of VARIANTS) for (const b of [true,false]) {
  out[`${p}|${l}|${v}|${b ? 'bezel' : 'bare'}`] = stable(mod.generateActiveLayout(p, l, b, null, v));
}
for (const l of LAYOUTS) for (const s of ['1','2','3']) for (const v of ['fhd_landscape','uhd_landscape','fhd_portrait','uhd_portrait']) {
  out[`target|${s}|${l}|${v}`] = stable(mod.generateTargetScreenLayout(l, s, v));
}
for (const p of PRESETS) out[`orientation|${p}`] = mod.getMonitorOrientation(p);
writeFileSync(process.argv[2], JSON.stringify(out, null, 2), 'utf8');
```

**`compare.mjs`** (`node compare.mjs before.json after.json`): rekursiv alle
Pfade vergleichen und je Feld zählen. Erwartung nach P1:

| Bereich | Abweichungen |
|---|---|
| Gehäuse an + Pop-Outs (156 Einträge) | 0 |
| Gehäuse aus (84) | nur `casingWidth/Height/OffsetX/OffsetY`, `gapWidth` |

Grund: bei `withBezel === false` werden keine Gehäusewerte mehr emittiert
(`isCasingActive`/`hasBezelGap` sind dann false). **Kein anderes Feld** darf
abweichen – insbesondere nicht `width`, `screens`, `gaps`, `family`.

Zusätzlich: `npm run check` (0 Fehler), `npm run build`, Smoke-Test:

| Profil | Variante | Canvas | Wrapper |
|---|---|---|---|
| `zimvitrine65h` + Wagenstand | FHD hoch | 1080×1920 | 1240×2220 |
| `zim2x32` + Zuganzeiger | 4K quer | 7780×2160 | 8860×3200 |
| `zim2x32` ohne Gehäuse | 4K quer | 7680×2160 | 7680×2160 |
| `zim3x32` + Zuganzeiger | 4K quer | 11720×2160 | 12800×3200 |
| `zimvitrine32` + Anschluss | FHD quer | 1920×1080 | 2120×1380 |
| `zimultrawide` + Wagenstand | 4K quer | 3840×1080 | 4040×1260 |

> Die Ultrawide-Zeile gilt seit P6 für **beide** Varianten: Bei
> `renderMode: 'stretch'` entfällt die 4K-Verdopplung, `uhd_landscape` ändert
> nur noch die Token-Overrides. Vor P6 waren es 7680×2160 bzw. 8080×2520.

> P3-Erwartung: Gegenüber P2 ändert sich **nur** `gaps` bei `zim3x32`
> (zweiter Steg 50 px links: `[1920,3940]` → `[1920,3890]` FHD,
> `[3840,7880]` → `[3840,7780]` 4K; ohne Gehäuse `[1920,3840]`) sowie der
> entfernte `screens[].maxRows` bei `zimvitrine65h` + Ankunftstafel (die
> Zeilenzahl kommt jetzt aus den Tokens). Alle übrigen Felder bleiben
> identisch.

> P4-Erwartung: `generateActiveLayout`/`generateTargetScreenLayout` sind
> unverändert → Snapshot **0 Abweichungen** (247 Einträge). Die neuen Pfade
> deckt das Rezept nicht ab; dafür gilt die Zusatzprüfung:

| `createLayout(...)` | Erwartung (FHD) |
|---|---|
| `fhd_2x1_landscape` + `overhead`, Profilwert | `width` 3890, `gapWidth` 50, `gapX` 1920, `casingWidth` 4430 |
| … + `chassisOverrides {gapWidth:100}` | `width` 3940, `gapX` 1920, `casingWidth` 4480, Screens `[0,2020,2980]` |
| … + `chassisOverrides {gapWidth:0}` | `width` 3840, `hasBezelGap` false, Screens `[0,1920,2880]` |
| `fhd_3x1_landscape` + `overhead`, 100 px | `gaps` `[1920,3940]`, Screens `[0,2020,2980,4040,5000]` |
| dito in `uhd_landscape` | `width` 7880, `gapWidth` 200, `gapX` 3840, `casingWidth` 8960 |
| `fhd_2x1_landscape` + `none`, `withBezel:false` | identisch zu `generateActiveLayout(..., false)` (nur IDs abweichend) |
| `getChassisOptions('landscape'/'portrait')` | `overhead, vitrine, bar, none` / `overhead, stele, none` |

> P5-Erwartung: Snapshot **nur** `family` → `chassisStyle` (alle 247
> Einträge), sonst 0 Abweichungen.

> P6-Erwartung: zusätzlich `renderMode: 'native'` bei allen Einträgen; bei
> `zimwide`/`zimultrawide` ändern sich `width`, `height`, `scaleFactor`,
> `casing*` und die Screen-Geometrie (inkl. neuem `logicalWidth/Height`).
> Alle anderen Presets bleiben feldgleich.

P6-Zusatzprüfung (`createLayout`, FHD/4K):

| `createLayout(...)` | Erwartung |
|---|---|
| `zimwide` + Zuganzeiger, FHD + 4K | Canvas 2560×1080, Screen 2560 physisch / 1920 logisch |
| `zimwide` + Anschluss, FHD | 2 Screens à 1280 physisch / 1920 logisch |
| `zimultrawide` + Zuganzeiger, 4K | Canvas 3840×1080, Screens 1920/960/960 (1:1) |
| `zimultrawide` + Wagenstand, 4K | Canvas 3840×1080, Vitrine 3840/1920 |
| `zimultrawide` + Zoom, 4K | Canvas 3840×1080, Screen 3840/1920 (scaleX 2) |

> `zimwide`/`zimultrawide` sind ebenfalls im Snapshot-Rezept enthalten; die
> Abweichungen oben sind dort zu erwarten und dürfen sich nicht auf andere
> Presets ausweiten.

Smoke-Test im Dev-Server (P4, Klickpfad über die zwei Selects):

| Auswahl | Variante | Canvas | Wrapper |
|---|---|---|---|
| `fhd_1x1_portrait` + Stele + Wagenstand | FHD hoch | 1080×1920 | 1240×2220 |
| `fhd_2x1_landscape` + Überkopf + Zuganzeiger | 4K quer | 7780×2160 | 8860×3200 |
| `fhd_2x1_landscape` + „Ohne Gehäuse“ | 4K quer | 7680×2160 | 7680×2160 |
| `fhd_1x1_landscape` + Vitrine + Anschluss | FHD quer | 1920×1080 | 2120×1380 |
| `fhd_2x1_landscape` + Überkopf, Stegdicke 100 | FHD quer | 3940×1080 | 4480×1600 |
| `fhd_3x1_landscape` + Überkopf, Stegdicke 80 | FHD quer | 5920×1080 | 6460×1600 |

Zusätzlich geprüft: Stegdicke 80 überlebt Reload und den Strg+B-Umweg über
`none`, ein echter Gehäusewechsel setzt sie zurück, und beide Migrationen
(`zimsim_monitor_id` allein → Vitrine65h; `zimsim_show_bezel=false` →
„Ohne Gehäuse“) landen auf den erwarteten Achsen.

Smoke-Test im Dev-Server (P6, gesichtet ohne Konsolenfehler):

| Auswahl | Variante | Canvas | Wrapper |
|---|---|---|---|
| `wide_1x1_landscape` + Bar-Type + Zuganzeiger | FHD quer | 2560×1080 | 2760×1260 |
| `wide_1x1_landscape` + Bar-Type + Anschluss (2 Spalten) | FHD quer | 2560×1080 | 2760×1260 |
| `wide_1x1_landscape` + Bar-Type + Zoom | FHD quer | 2560×1080 | 2760×1260 |
| `ultrawide_1x1_landscape` + Bar-Type + Zuganzeiger | 4K quer | 3840×1080 | 4040×1260 |
| `ultrawide_1x1_landscape` + Bar-Type + Wagenstand | 4K quer | 3840×1080 | 4040×1260 |

`npm run check` (0 Fehler) und `npm run build` sind grün.

---

## 6. Offene Entscheidungen

1. **Stele + Zuganzeiger:** entschieden (P3) — der Wagenstandsanzeiger
   bleibt; ein echter Hochkant-Zuganzeiger wird ein eigener Schritt.
2. **Stegdicke-Regler:** entschieden (P4) — kontinuierlich 0–100 px in
   1-px-Schritten, live über `chassisOverrides.gapWidth`.
3. **Gehäuse-Checkbox vs. Chassis-Auswahl:** entschieden (P4) — die Checkbox
   ist entfernt; „Ohne Gehäuse“ im Gehäuse-Select und Strg+B sind die einzigen
   Steuerungen.

---

## 7. Token-Hygiene für Folge-Sessions

Lesen genügt: dieses Dokument → `displayLayoutService.js`.
**Nicht** nötig für Layout-Fragen: Renderer (`boards/*`), Tokens,
`screenAssignmentService.js`. Nur bei Darstellungsfragen der Gehäuse:
`HardwareBezel.svelte` + `components/chassis/*`; bei Canvas-/Overlay-Fragen
gestreckter Panels: `canvasLayerService.js`, `textUtils.js`,
`scrollManager.js`.

Kontext-Budget: P1 hat ~35k Tokens verbraucht (Analyse + Umbau + Verifikation).
Eine Phase pro Session ist realistisch. P5+P6 zusammen waren ~20k.
