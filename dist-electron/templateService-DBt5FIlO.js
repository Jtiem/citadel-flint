import { cpSync as o, readdirSync as u } from "node:fs";
import t from "node:path";
import { app as s } from "electron";
const m = /* @__PURE__ */ new Set(["base-vite-tailwind", "bridge-demo"]), c = t.join(s.getAppPath(), "electron", "templates");
function l(r, e) {
  if (!m.has(e))
    throw new Error(`project:initialize — unknown templateId "${e}"`);
  const i = u(r);
  if (i.length > 0)
    throw new Error(
      `project:initialize — target directory must be empty (found ${i.length} item(s))`
    );
  if (e === "bridge-demo") {
    const p = t.join(c, "base-vite-tailwind");
    o(p, r, { recursive: !0, force: !0 });
  }
  const n = t.join(c, e);
  o(n, r, { recursive: !0, force: !0 });
}
function j(r) {
  const e = t.join(s.getAppPath(), "electron", "templates"), i = t.join(e, "base-vite-tailwind"), n = t.join(e, "bridge-demo");
  o(i, r, { recursive: !0, force: !0 }), o(n, r, { recursive: !0, force: !0 });
}
export {
  l as initializeProject,
  j as injectDemoState
};
