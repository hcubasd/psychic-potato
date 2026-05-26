# psychic-potato

A single browser function that fits text inside containers by finding the largest font size where every span stays within its parent div.

## Install

```sh
npm install psychic-potato
```

## API

```ts
import { squeezeText } from "psychic-potato";

squeezeText(roots: HTMLDivElement[]): void
```

Pass an array of root divs. The function walks each root recursively, finds every div that directly contains a span, and adjusts a single shared font size so all spans fit inside their containers.

```ts
const roots = Array.from(document.querySelectorAll<HTMLDivElement>(".label-container"));
squeezeText(roots);
```

The font size is set as an inline style on both the container div and its span. Call `squeezeText` again on resize.

## DOM structure

Each container div must have exactly one direct span child:

```html
<div class="label-container">
  <span>Some text</span>
</div>
```

Container divs can be anywhere in the subtree of a root — they do not have to be the root itself:

```html
<div id="root">
  <div><span>January</span></div>
  <div><span>February</span></div>
</div>
```

```ts
squeezeText([document.getElementById("root")]);
```

## Behaviour

- Measures `getBoundingClientRect()` on divs and spans
- Fitting target is each div's content box (padding and borders reduce usable space)
- A single font size scalar is applied to all container divs and their spans
- The binding constraint is the pair whose span is closest to or furthest past its edge — all other pairs get the same scalar and will fit with slack
- Dimensions that change with font size are excluded from fitting; if all dimensions of a div become unstable the function throws
- Font sizes are restored to their original values if the function throws

## Throws

| Condition | Message |
|---|---|
| Empty roots array | `squeezeText requires at least one root div.` |
| Root not connected to document | `squeezeText requires div N to be connected.` |
| No div-span pair found in any root | `squeezeText: no div containing a span was found.` |
| A div has more than one span | `squeezeText: a div contains more than one span.` |
| No span renders measurable text | `squeezeText requires at least one span to render measurable text.` |
| A div loses all stable dimensions | `squeezeText: a div lost all stable dimensions.` |
| Sweep cannot bracket a fit | `squeezeText: could not bracket a fit during the sweep.` |
