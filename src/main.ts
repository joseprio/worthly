import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

// Long-press opens the context menu on Android, with a haptic buzz. Keep it for text fields only.
document.addEventListener("contextmenu", (e) => {
  if (!(e.target as Element).closest("input, textarea")) e.preventDefault();
});

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
