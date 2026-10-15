// Hash routing keeps deep links working on GitHub Pages, which has no SPA fallback.
export type Route =
  | { name: "overview" }
  | { name: "progression" }
  | { name: "items" }
  | { name: "item"; id: string };

const parse = (hash: string): Route => {
  const [name, id] = hash.replace(/^#\/?/, "").split("/");
  if (name == "progression") return { name };
  if (name == "items") return { name };
  if (name == "item" && id) return { name, id };
  return { name: "overview" };
};

export const router = $state({ route: parse(location.hash) });

window.addEventListener("hashchange", () => {
  router.route = parse(location.hash);
});

export const href = (path: string) => `#/${path}`;
export const go = (path: string) => {
  location.hash = `/${path}`;
};
export const back = (fallback: string) => {
  if (history.length > 1) history.back();
  else go(fallback);
};
