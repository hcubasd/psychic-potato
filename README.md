# psychic-potato

Two browser functions for building simple, self-contained UIs from nested
`div`s of just two kinds:

- **background** (`class="bg"`) — containers that nest to any depth; their
  nesting depth drives a perceptually-even color ramp
- **foreground** (`class="fg"`) — leaf containers holding the actual UI content
  (text, buttons, whatever); their text is auto-sized to fit

`colorBg` paints the background layers; `squeezeFg` fits the foreground text.
They are independent — call either, both, or neither.

## Install

```sh
npm install psychic-potato
```

Colors come from [miniature-waffle](https://github.com/hcubasd/miniature-waffle),
which is pulled in automatically.

## API

```ts
import { colorBg, squeezeFg } from "psychic-potato";
```

---

### `colorBg(root, config?)`

```ts
colorBg(root: HTMLDivElement, config?: { startL?: number; endL?: number }): void
```

Walks `root`, finds every `div.bg`, and sets each one's `backgroundColor` from a
gray ramp keyed to its nesting depth. The outermost background layer gets
`startL`, the innermost gets `endL`, and miniature-waffle fills the
evenly-spaced CIE Lab grays in between. Siblings at the same depth get the same
color. Non-`bg` divs don't count toward depth.

- `startL` — lightness of the outermost layer, `[0, 100]`, default `0`
- `endL` — lightness of the innermost layer, `[0, 100]`, default `100`

```html
<div class="bg">           <!-- depth 0 → startL -->
  <div class="bg">         <!-- depth 1 -->
    <div class="bg">…</div> <!-- depth 2 → endL -->
  </div>
</div>
```

```ts
colorBg(document.getElementById("root"));              // 0 → 100
colorBg(document.getElementById("root"), { startL: 15, endL: 85 });
```

---

### `squeezeFg(root)`

```ts
squeezeFg(root: HTMLDivElement): number
```

Walks `root`, finds every `div.bg` that has a direct `div.fg` child, and applies
a single shared font size — the largest at which every `fg` fits inside its `bg`
container. Returns that font size in pixels. Set the font on a `fg` and it
cascades to everything inside, so the content scales as a whole. Call again on
resize.

Each `bg` that contains an `fg` must have **exactly one direct `fg` child**. The
`fg` can hold arbitrary content; it is measured as a whole against its parent
`bg`'s content box.

```html
<div class="bg">     <!-- container: sized by the layout -->
  <div class="fg">   <!-- content: squeezed to fit inside bg -->
    <span>January</span>
  </div>
</div>
```

```ts
squeezeFg(document.getElementById("root"));
```

## How `squeezeFg` fits

- Measures `getBoundingClientRect()` of each `fg` against its parent `bg`'s
  content box (padding and borders reduce the usable space).
- One shared font size is applied to all `fg`s; the most-constrained pair
  determines it, so the rest fit with slack.
- An **exponential sweep** (≤16 steps) brackets the answer — it grows the font
  while everything fits and shrinks it while anything overflows, until the fit
  state flips.
- A **binary search** refines within the bracket. The sampled font size is
  tracked with a running mean and variance (Welford); the search stops once the
  standard deviation falls below a pixel. The largest font that fit is applied.
- An axis where the `bg` grows with its `fg` (hugs it) never triggers a
  crossing, so the fixed axis constrains the fit on its own — no configuration
  needed.
- Font sizes are restored to their original inline values if the function throws.

## Throws

| Function | Condition | Message |
|---|---|---|
| `colorBg` | No `bg` div found | `colorBg: no element with class "bg" was found.` |
| `squeezeFg` | Root not connected | `squeezeFg requires a connected root div.` |
| `squeezeFg` | No `bg` with a direct `fg` child found | `squeezeFg: no bg element with a direct fg child was found.` |
| `squeezeFg` | A `bg` has more than one direct `fg` child | `squeezeFg: each bg div must contain exactly one direct fg child.` |
| `squeezeFg` | No content renders | `squeezeFg requires at least one fg child with measurable content.` |
| `squeezeFg` | Sweep cannot bracket a fit | `squeezeFg: could not bracket a fit during the sweep.` |
