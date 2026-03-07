import { cpSync as o, readdirSync as p } from "node:fs";
import r from "node:path";
import { app as s } from "electron";
const a = /* @__PURE__ */ new Set(["base-vite-tailwind", "bridge-demo"]), c = r.join(s.getAppPath(), "electron", "templates");
function l(t, e) {
  if (!a.has(e))
    throw new Error(`project:initialize — unknown templateId "${e}"`);
  const i = p(t);
  if (i.length > 0)
    throw new Error(
      `project:initialize — target directory must be empty (found ${i.length} item(s))`
    );
  if (e === "bridge-demo") {
    const u = r.join(c, "base-vite-tailwind");
    o(u, t, { recursive: !0, force: !0 });
  }
  const n = r.join(c, e);
  o(n, t, { recursive: !0, force: !0 });
}
function j(t) {
  const e = r.join(s.getAppPath(), "electron", "templates"), i = r.join(e, "base-vite-tailwind"), n = r.join(e, "bridge-demo");
  o(i, t, { recursive: !0, force: !0 }), o(n, t, { recursive: !0, force: !0 });
}
export {
  l as initializeProject,
  j as injectDemoState
};
