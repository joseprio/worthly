// Hash routing keeps deep links working on GitHub Pages, which has no SPA fallback.
export type Route = { name: "overview" } | { name: "item"; id: string };

const parse = (hash: string): Route => {
  const [name, id] = hash.replace(/^#\/?/, "").split("/");
  if (name == "item" && id) return { name, id };
  return { name: "overview" };
};

export const router = $state({ route: parse(location.hash) });

const sync = () => {
  router.route = parse(location.hash);
};
window.addEventListener("hashchange", sync);
window.addEventListener("popstate", sync);

export const href = (path: string) => `#/${path}`;

/** Opens a screen, marking the history entry as ours so `back` knows it can pop it. */
export const go = (path: string) => {
  history.pushState({ worthly: true }, "", `#/${path}`);
  sync();
};

/**
 * Closes the current screen. Pops history when we opened it (so the system Back button stays in
 * step); after a deep link there's nothing of ours to pop, so replace with `fallback` instead of
 * leaving the app.
 */
export const back = (fallback: string) => {
  if (history.state?.worthly) history.back();
  else {
    history.replaceState(null, "", `#/${fallback}`);
    sync();
  }
};
