import { categories, defaultGrowth, newId, type Category, type Item } from "./model";

const KEY = "worthly:items:v1";

const load = (): Item[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Item[]) : [];
  } catch {
    return [];
  }
};

export const store = $state({ items: load() });

$effect.root(() => {
  $effect(() => {
    const json = JSON.stringify(store.items);
    try {
      localStorage.setItem(KEY, json);
    } catch {
      // Storage full or unavailable (private mode): keep working in memory.
    }
  });
});

export const blankItem = (category: Category = "isa"): Item => ({
  id: newId(),
  name: "",
  category,
  kind: categories[category].kinds[0],
  snapshots: [],
  growthMin: defaultGrowth(category)[0],
  growthMax: defaultGrowth(category)[1],
  monthly: 0,
});

export const saveItem = (item: Item) => {
  const i = store.items.findIndex((x) => x.id == item.id);
  if (i == -1) store.items.push(item);
  else store.items[i] = item;
};

export const deleteItem = (id: string) => {
  store.items = store.items.filter((x) => x.id != id);
};

export const getItem = (id: string) => store.items.find((x) => x.id == id);
