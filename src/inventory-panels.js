import { itemDescription, itemIcon, itemLabel, itemTile, stockedItems } from './item-ui.js';

export function inventoryPanels(progress, view) {
  const $ = id => document.getElementById(id);
  const backpack = $('backpack');
  const grid = $('backpack-items');
  const detail = $('backpack-detail');
  const filters = $('backpack-filters');
  const exchange = $('exchange');
  const exchangeItems = $('exchange-items');
  const quantity = $('exchange-quantity');
  const status = $('exchange-status');
  let handoff = null;

  function showBackpack() {
    const entries = {
      Supplies: stockedItems(progress.inventory).map(item => [item, progress.inventory[item]]),
      Tools: progress.started ? [['hatchet', null], ...(view.hasPickaxe() ? [['pickaxe', null]] : [])] : [],
      'Job items': view.jobs().map(job => [job.id, 1]),
    };
    function select(item, tile) {
      for (const button of grid.children) button.setAttribute('aria-pressed', String(button === tile));
      const title = document.createElement('strong');
      title.textContent = itemLabel(item);
      const description = document.createElement('p');
      description.textContent = itemDescription(item);
      detail.replaceChildren(title, description);
      const action = view.context(item);
      if (action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pill';
        button.textContent = action.label;
        button.addEventListener('click', () => { backpack.close(); action.run(); });
        detail.append(button);
      }
      detail.hidden = false;
    }
    function showSection(name) {
      for (const button of filters.children) button.setAttribute('aria-pressed', String(button.textContent === name));
      const items = entries[name];
      detail.hidden = true;
      grid.replaceChildren(...items.map(([item, count]) => {
        const tile = itemTile(item, count, () => select(item, tile));
        tile.setAttribute('aria-pressed', 'false');
        return tile;
      }));
      const empty = $('backpack-empty');
      empty.hidden = items.length > 0;
      empty.textContent = { Supplies: 'Gather supplies or exchange items with a neighbor.', Tools: 'Bruno can lend you tools.', 'Job items': 'You aren’t carrying anything for a job.' }[name];
    }
    filters.replaceChildren(...Object.keys(entries).map(name => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.addEventListener('click', () => showSection(name));
      return button;
    }));
    showSection(entries.Supplies.length ? 'Supplies' : Object.keys(entries).find(name => entries[name].length) ?? 'Supplies');
    backpack.showModal();
  }

  function setQuantity(count) {
    const { from, giving, item } = handoff;
    const available = from[item];
    handoff.count = Math.max(1, Math.min(available, count));
    $('exchange-count').textContent = handoff.count;
    $('exchange-less').disabled = handoff.count <= 1;
    $('exchange-more').disabled = handoff.count >= available;
    $('exchange-max').disabled = handoff.count >= available;
    quantity.hidden = available <= 1;
    const after = (progress.inventory[item] ?? 0) + handoff.count * (giving ? -1 : 1);
    status.textContent = itemLabel(item) + ' in your bag after exchange · ' + after;
  }

  function openExchange(villager, giving, preferred) {
    const supplies = progress.villagerSupplies[villager.name];
    const from = giving ? progress.inventory : supplies;
    const to = giving ? supplies : progress.inventory;
    const items = stockedItems(from);
    $('exchange-title').textContent = giving ? 'Give to ' + villager.name : 'Take from ' + villager.name;
    $('exchange-submit').textContent = giving ? 'Give' : 'Take';
    $('exchange-submit').hidden = !items.length;
    for (const button of $('exchange-modes').children) {
      button.setAttribute('aria-pressed', String((button.id === 'exchange-give') === giving));
    }
    handoff = { villager, giving, from, to, item: null, count: 1 };
    function select(item) {
      handoff.item = item;
      for (const button of exchangeItems.children) button.setAttribute('aria-pressed', String(button.dataset.item === item));
      setQuantity(1);
    }
    exchangeItems.replaceChildren(...items.map(item => itemTile(item, from[item], () => select(item))));
    if (items.length) select(items.includes(preferred) ? preferred : items[0]);
    else {
      quantity.hidden = true;
      status.textContent = giving ? 'Your backpack is empty.' : villager.name + ' has no supplies to share right now.';
    }
    view.openExchange();
  }

  $('exchange-give').addEventListener('click', () => openExchange(handoff.villager, true));
  $('exchange-take').addEventListener('click', () => openExchange(handoff.villager, false));
  $('exchange-less').addEventListener('click', () => setQuantity(handoff.count - 1));
  $('exchange-more').addEventListener('click', () => setQuantity(handoff.count + 1));
  $('exchange-max').addEventListener('click', () => setQuantity(handoff.from[handoff.item]));
  $('exchange-cancel').addEventListener('click', view.closeExchange);
  exchange.addEventListener('submit', event => {
    event.preventDefault();
    if (!handoff?.item) return;
    if (!view.transfer(handoff)) status.textContent = 'That quantity is unavailable.';
  });

  function focusExchange() {
    (exchangeItems.querySelector('[aria-pressed=true]') ?? $('exchange-modes').querySelector('[aria-pressed=true]')).focus({ preventScroll: true });
  }

  let receiptTimer;
  function receipt(item, count) {
    const notice = $('item-receipt');
    const delta = count > 0 ? '+' : '−';
    notice.replaceChildren(itemIcon(item), delta + Math.abs(count) + ' ' + itemLabel(item));
    notice.hidden = false;
    clearTimeout(receiptTimer);
    receiptTimer = setTimeout(() => { notice.hidden = true; }, 2450);
  }

  return { showBackpack, openExchange, focusExchange, receipt, resetExchange: () => { handoff = null; } };
}
