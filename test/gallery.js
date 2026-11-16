import { TILES } from '../src/engine/tiles.js';
import { tileSvg } from '../src/ui/tileface.js';
document.body.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:#1d1f3d">${[...TILES.map((t) => tileSvg({ id: t.id }, 170)), tileSvg({ id: 'office', inv: true }, 170), tileSvg({ id: 'x', lake: true }, 170)].join('')}</div>`;
