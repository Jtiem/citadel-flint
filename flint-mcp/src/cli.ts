#!/usr/bin/env node
/**
 * Flint CLI entry point.
 * Supports:
 *   flint serve  — starts the MCP stdio server (default)
 *   flint init   — zero-config project initialisation
 */
import { runServer } from "./server.js";
import { runInit } from "./core/init/initRunner.js";

const command = process.argv[2] ?? "serve";

if (command === "init") {
    const projectRoot =
        process.argv.find((a) => a.startsWith("--project-root="))?.split("=")[1] ??
        process.cwd();
    const srcDir =
        process.argv.find((a) => a.startsWith("--src-dir="))?.split("=")[1];
    const forceTokens = process.argv.includes("--force-tokens");

    runInit({ projectRoot, srcDir, forceTokens })
        .then((result) => {
            if (result.warnings.length > 0) {
                console.log("\nWarnings:");
                result.warnings.forEach((w) => console.log(`  \u26a0 ${w}`));
            }
            process.exit(0);
        })
        .catch((err: Error) => {
            console.error("Init failed:", err.message);
            process.exit(1);
        });
} else if (command === "serve") {
    runServer().catch((err) => {
        console.error(`[Flint] Fatal startup error: ${err}`);
        process.exit(1);
    });
} else {
    console.error(`Unknown command: ${command}`);
    console.error("Usage: flint [serve|init]");
    process.exit(1);
}
