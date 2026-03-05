import { readdirSync, cpSync } from "node:fs";
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
  const templateSrc = path.join(TEMPLATES_DIR, templateId);
  cpSync(templateSrc, targetPath, { recursive: true });
}
export {
  initializeProject
};
