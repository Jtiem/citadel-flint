import { cpSync, readdirSync } from "node:fs";
import path__default from "node:path";
import { app } from "electron";
const KNOWN_TEMPLATES = /* @__PURE__ */ new Set(["base-vite-tailwind", "bridge-demo"]);
const TEMPLATES_DIR = path__default.join(app.getAppPath(), "electron", "templates");
function initializeProject(targetPath, templateId) {
  if (!KNOWN_TEMPLATES.has(templateId)) {
    throw new Error(`project:initialize — unknown templateId "${templateId}"`);
  }
  const entries = readdirSync(targetPath);
  if (entries.length > 0) {
    throw new Error(
      `project:initialize — target directory must be empty (found ${entries.length} item(s))`
    );
  }
  if (templateId === "bridge-demo") {
    const baseSrc = path__default.join(TEMPLATES_DIR, "base-vite-tailwind");
    cpSync(baseSrc, targetPath, { recursive: true, force: true });
  }
  const templateSrc = path__default.join(TEMPLATES_DIR, templateId);
  cpSync(templateSrc, targetPath, { recursive: true, force: true });
}
function injectDemoState(targetPath) {
  const templatesDir = path__default.join(app.getAppPath(), "electron", "templates");
  const baseSrc = path__default.join(templatesDir, "base-vite-tailwind");
  const demoSrc = path__default.join(templatesDir, "bridge-demo");
  cpSync(baseSrc, targetPath, { recursive: true, force: true });
  cpSync(demoSrc, targetPath, { recursive: true, force: true });
}
export {
  initializeProject,
  injectDemoState
};
