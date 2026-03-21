Generate a design debt health report. Call the `flint_debt_report` MCP tool.

If the user provided a glob pattern as an argument: use that glob.
If no argument was provided: default to `"src/**/*.tsx"`.

Use `format: "markdown"` and `track: true` to enable trend tracking.

Present the report inline — health score (0-100), letter grade (A-F), top violated rules, top violated files, and trend direction if available.

Arguments: $ARGUMENTS