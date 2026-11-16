import { TILES } from '../src/engine/tiles.js';
import { tileSvg } from '../src/ui/tileface.js';
const list = TILES.filter((t) => ['five', 'night', 'promo'].includes(t.exp));
document.body.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:#1d1f3d">${list.map((t) => tileSvg({ id: t.id }, 150)).join('')}</div>`;
