import fs from "node:fs";
import path from "node:path";

export interface TelemetryEvent {
    tool: string;
    input_summary: string;
    outcome: string;
    metadata: string;
}

export class TelemetryLogger {
    private readonly logPath: string;

    constructor(projectRoot: string) {
        const flintDir = path.join(projectRoot, ".flint");
        this.logPath = path.join(flintDir, "telemetry-events.jsonl");

        try {
            if (!fs.existsSync(flintDir)) {
                fs.mkdirSync(flintDir, { recursive: true });
            }
        } catch {
            // Silently swallow directory creation errors
        }
    }

    log(event: TelemetryEvent): void {
        try {
            const line = JSON.stringify({
                timestamp: new Date().toISOString(),
                ...event,
            });
            fs.appendFileSync(this.logPath, line + "\n", "utf-8");
        } catch {
            // Silently swallow write errors — telemetry must never break the tool
        }
    }
}
