import { cpSync as o, readdirSync as p } from "node:fs";
import r from "node:path";
import { app as n } from "electron";
const m = /* @__PURE__ */ new Set(["base-vite-tailwind", "bridge-demo"]), a = r.join(n.getAppPath(), "electron", "templates");
function f(t, e) {
  if (!m.has(e))
    throw new Error(`project:initialize — unknown templateId "${e}"`);
  const i = p(t);
  if (i.length > 0)
    throw new Error(
      `project:initialize — target directory must be empty (found ${i.length} item(s))`
    );
  const c = r.join(a, e);
  o(c, t, { recursive: !0 });
}
function d(t) {
  const e = r.join(n.getAppPath(), "electron", "templates", "bridge-demo");
  o(e, t, { recursive: !0, force: !0 });
}
export {
  f as initializeProject,
  d as injectDemoState
};
