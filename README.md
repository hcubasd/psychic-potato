# psychic-potato

`psychic-potato` exports a single browser function, `squeezeText`, that mutates matching `div` / `span` pairs in place so the rendered span boxes fit inside their corresponding div content boxes.

## Contract

- pass `HTMLDivElement[]` and `HTMLSpanElement[]` of the same length
- each span must be inside its matching div
- the library measures spans with `getBoundingClientRect()`
- the fitting target is each div's content box, so padding and borders reduce usable space
- the same scalar font-size multiplier is applied to both every div and every span
- fitting defaults to both axes, but you can set `axis: "width"` or `axis: "height"`
- during the exponential sweep, the divs must stay size-stable on the measured axis or the function throws

## Intended usage

This is designed for UI resize flows where the spans are already laid out how you want them. If you want tighter or looser fitting, control that through your own span/div CSS; `squeezeText` fits the rendered DOM boxes it sees.

```ts
import { squeezeText } from "psychic-potato";

const divs = Array.from(document.querySelectorAll("div.fit-target"));
const spans = Array.from(document.querySelectorAll("div.fit-target > span"));

squeezeText(divs, spans);
squeezeText(divs, spans, { axis: "width" });
```
