import { colorBg, squeezeFg } from "https://esm.sh/psychic-potato";
import { matchColors, matchGrays } from "https://esm.sh/miniature-waffle";

// Tango/xterm 16 ANSI colors in canonical order (0–15)
const ANSI_HEX = [
  '#000000', '#CC0000', '#4E9A06', '#C4A000',
  '#3465A4', '#75507B', '#06989A', '#D3D7CF',
  '#555753', '#EF2929', '#8AE234', '#FCE94F',
  '#729FCF', '#AD7FA8', '#34E2E2', '#EEEEEC',
];

// Indices 0, 7, 8, 15 are grays — keep their raw value in matchColors rows
const GRAY_INDICES = new Set([0, 7, 8, 15]);

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');
}

// Rows 1–2: match all 12 chromatic ANSI colors together as one 12-gon so the
// Hungarian algorithm finds the globally optimal assignment, not 12 independent
// closest-point lookups. Grays (0, 7, 8, 15) keep their raw ANSI value.
const CHROMATIC_INDICES = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14];
const matched12 = matchColors(CHROMATIC_INDICES.map(i => hexToRgb(ANSI_HEX[i])), 75);
const matchedByIndex = new Map(CHROMATIC_INDICES.map((ansiIdx, k) => [ansiIdx, rgbToHex(matched12[k])]));

const row1 = ANSI_HEX.slice(0, 8).map((hex, i) =>
  GRAY_INDICES.has(i) ? hex : matchedByIndex.get(i)
);
const row2 = ANSI_HEX.slice(8).map((hex, i) =>
  GRAY_INDICES.has(i + 8) ? hex : matchedByIndex.get(i + 8)
);

// Rows 3–4: matchGrays(startL=50, endL=0) for all 16 including grays
const row3 = ANSI_HEX.slice(0, 8).map(hex => rgbToHex(matchGrays([hexToRgb(hex)], 50, 0)[0]));
const row4 = ANSI_HEX.slice(8).map(hex => rgbToHex(matchGrays([hexToRgb(hex)], 50, 0)[0]));

const ansiColors = [...row1, ...row2, ...row3, ...row4]; // 32 hex strings

// 256-color grid: random rotation of matchColors(256, 75)
const rotation = Math.floor(Math.random() * 256);
const gridColors = matchColors(256, 75)[rotation].map(rgbToHex); // 256 hex strings

// Build a cell: div.bg > div.fg with hex text colored in its own color
function makeCell(hex) {
  const bg = document.createElement('div');
  bg.className = 'bg';
  const fg = document.createElement('div');
  fg.className = 'fg';
  fg.textContent = hex;
  fg.style.color = hex;
  bg.appendChild(fg);
  return bg;
}

const root = document.getElementById('root');

const ansiSection = document.createElement('div');
ansiSection.className = 'bg';
ansiSection.id = 'ansi-section';
for (const hex of ansiColors) ansiSection.appendChild(makeCell(hex));
root.appendChild(ansiSection);

const gridSection = document.createElement('div');
gridSection.className = 'bg';
gridSection.id = 'grid-section';
for (const hex of gridColors) gridSection.appendChild(makeCell(hex));
root.appendChild(gridSection);

// colorBg: depth 0 (root) → white, depth 1 (sections) → mid-gray, depth 2 (cells) → black
colorBg(root, { from: 1, to: 0 });

// squeezeFg: one shared font size across all 288 cells, re-fit on resize
squeezeFg(root);
window.addEventListener('resize', () => squeezeFg(root));
