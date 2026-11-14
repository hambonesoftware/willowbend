import { itemNames } from './rebuild.js';

const art = {
  wood: ['#e9c49d', 'Seasoned branches for the workbench.', [
    ['M13 35 34 19Q42 15 48 24L51 30 28 47Z', '#af6941'],
    ['M15 34Q24 30 29 40Q33 49 24 51Q15 53 11 44Q8 38 15 34Z', '#f4bd77'],
    ['M22 37Q15 36 16 43Q18 49 24 45', null],
    ['M29 32 43 23M34 39 47 29', null],
  ]],
  planks: ['#eed1ac', 'Cut timber for building and repairs.', [
    ['M7 37 42 15 55 23 55 30 20 53 7 45Z', '#b57549'],
    ['M7 37 42 15 55 23 20 45Z', '#f1bb7b'],
    ['M23 28 33 34M20 41 45 25M20 45V53', null],
  ]],
  stone: ['#dadce9', 'Sturdy stone for foundations and the beacon.', [
    ['M9 42 18 23 31 17 47 23 56 43 43 51 21 52Z', '#8e9fb1'],
    ['M9 42 18 23 31 17 47 23 38 35 24 38Z', '#c7d5dc'],
    ['M24 38 21 52M38 35 43 51M38 35 56 43', null],
  ]],
  apples: ['#f6c7bf', 'Orchard fruit for baking or sharing with a neighbor.', [
    ['M33 24Q25 12 15 22Q4 32 16 49Q24 58 33 52Q44 58 51 45Q61 27 49 21Q40 16 33 24Z', '#df6757'],
    ['M33 24 34 14', null],
    ['M35 18Q37 7 50 10Q48 21 35 18Z', '#77a15c'],
    ['M17 34Q17 26 23 26', '#fff2ce'],
  ]],
  copper: ['#f0ccba', 'Two pieces make a lantern at the workbench.', [
    ['M7 41 18 24 28 26 37 17 53 24 57 39 47 50 19 53Z', '#b97658'],
    ['M18 24 28 26 37 17 53 24 41 35 28 33 19 43 7 41Z', '#e9a976'],
    ['M37 17 41 35 47 50M28 33 30 44', null],
  ]],
  lantern: ['#f5dcad', 'A copper lantern for the watchtower beacon.', [
    ['M25 22V16Q25 9 32 9Q39 9 39 16V22', null],
    ['M18 24 24 19H40L46 24Z', '#628771'],
    ['M21 24H43L46 46H18Z', '#ffd463'],
    ['M18 46H46L49 51H15Z', '#628771'],
    ['M27 43 29 28M37 43 35 28', null],
  ]],
  bread: ['#efd6b4', 'A bakery treat to share.', [
    ['M9 37Q15 23 38 20Q54 18 56 33Q57 46 29 51Q8 55 9 37Z', '#d99354'],
    ['M12 37Q19 29 32 26Q53 21 54 32Q46 43 20 45Z', '#f5c67f'],
    ['M22 30 27 37M31 26 36 34M40 23 45 30', null],
  ]],
  cider: ['#f1d7ac', 'Sweet cider from Clover’s orchard.', [
    ['M21 24H43L46 32V49Q32 54 18 49V32Z', '#e9ae57'],
    ['M23 17H41V25H23Z', '#966344'],
    ['M22 35H42V44H22Z', '#fff2c6'],
    ['M32 37V42', null],
  ]],
  pebble: ['#dce6cd', 'A smooth keepsake that Fennel might appreciate.', [
    ['M9 39Q12 24 32 20Q53 19 55 36Q59 49 34 51Q12 52 9 39Z', '#88aa80'],
    ['M17 35Q23 26 34 26Q39 27 36 31Q27 31 22 37Z', '#d5e5a3'],
  ]],
  hatchet: ['#d6e6d1', 'Used automatically when you chop fallen branches.', [
    ['M14 49 34 21 41 26 22 54Z', '#bd8055'],
    ['M27 21 35 12 54 17 47 33 37 28Z', '#aebfc5'],
    ['M47 33 54 17', null],
  ]],
  pickaxe: ['#d9e8e3', 'Used automatically when you mine stone or copper.', [
    ['M15 49 34 20 41 26 23 54Z', '#bd8055'],
    ['M17 21Q36 4 52 24L56 35Q43 23 34 22Q22 22 14 28Z', '#b7c9cf'],
  ]],
  market: ['#f1d1d8', 'Bring the flowers to Hazel at Farmgate Market.', [
    ['M25 49 35 23M35 48 26 33M36 50 44 27', null],
    ['M9 33Q9 21 19 24Q18 14 28 17Q34 19 32 27Q42 27 39 35Q31 43 23 36Q15 41 9 33Z', '#e988a0'],
    ['M35 21Q34 12 42 13Q45 5 51 11Q57 14 52 21Q59 26 49 30Q40 31 35 21Z', '#f4bf68'],
  ]],
  pond: ['#d8e5ee', 'Report what you found at the pond trail to Reed.', [
    ['M17 14H45L52 21V50H17Z', '#fff2c9'],
    ['M43 14V23H52M23 30H44M23 36H41M23 42H37', null],
  ]],
};

const tools = { hatchet: 'Hatchet', pickaxe: 'Pickaxe', market: 'Farm flowers', pond: 'Trail report', orchard: 'Cider apples' };
export const itemLabel = item => itemNames[item]?.[0] ?? tools[item];
export const itemDescription = item => item === 'orchard' ? 'Bring the cider apples to Clover at the orchard.' : art[item]?.[1] ?? '';
export const stockedItems = stock => Object.keys(itemNames).filter(item => stock[item] > 0);

const icons = new Map();
export function itemIconSource(item) {
  const key = item === 'orchard' ? 'apples' : item;
  if (icons.has(key)) return icons.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const pen = canvas.getContext('2d');
  pen.scale(2, 2);
  pen.lineWidth = 2.25;
  pen.lineJoin = pen.lineCap = 'round';
  pen.strokeStyle = '#50343c';
  const [tone, , layers] = art[key];
  pen.fillStyle = tone;
  pen.beginPath();
  pen.roundRect(2, 2, 60, 60, 15);
  pen.fill();
  for (const [shape, color] of layers) {
    const path = new Path2D(shape);
    if (color) {
      pen.fillStyle = color;
      pen.fill(path);
    }
    pen.stroke(path);
  }
  const url = canvas.toDataURL();
  icons.set(key, url);
  return url;
}

export function itemIcon(item) {
  const icon = new Image();
  icon.src = itemIconSource(item);
  icon.alt = '';
  icon.className = 'item-icon';
  icon.draggable = false;
  return icon;
}

export function itemTile(item, count, choose) {
  const tile = document.createElement(choose ? 'button' : 'div');
  tile.className = 'item-tile';
  if (choose) {
    tile.type = 'button';
    tile.addEventListener('click', choose);
  }
  tile.dataset.item = item;
  const label = document.createElement('span');
  label.className = 'item-name';
  label.textContent = itemLabel(item);
  tile.append(itemIcon(item), label);
  if (count !== null) {
    const quantity = document.createElement('strong');
    quantity.className = 'item-quantity';
    quantity.textContent = count;
    tile.append(quantity);
    if (choose) tile.setAttribute('aria-label', label.textContent + ', ' + count + ' available');
  }
  return tile;
}
