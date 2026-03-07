import { cpSync, readdirSync } from "node:fs";
import path from "node:path";
import { app } from "electron";
const KNOWN_TEMPLATES = /* @__PURE__ */ new Set(["base-vite-tailwind", "bridge-demo"]);
const TEMPLATES_DIR = path.join(app.getAppPath(), "electron", "templates");
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
    const baseSrc = path.join(TEMPLATES_DIR, "base-vite-tailwind");
    cpSync(baseSrc, targetPath, { recursive: true, force: true });
  }
  const templateSrc = path.join(TEMPLATES_DIR, templateId);
  cpSync(templateSrc, targetPath, { recursive: true, force: true });
}
function injectDemoState(targetPath) {
  const templatesDir = path.join(app.getAppPath(), "electron", "templates");
  const baseSrc = path.join(templatesDir, "base-vite-tailwind");
  const demoSrc = path.join(templatesDir, "bridge-demo");
  cpSync(baseSrc, targetPath, { recursive: true, force: true });
  cpSync(demoSrc, targetPath, { recursive: true, force: true });
}
export {
  initializeProject,
  injectDemoState
};
