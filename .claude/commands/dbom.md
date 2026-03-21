Generate a Design Bill of Materials. Call the `flint_generate_dbom` MCP tool.

If the user provided a glob pattern as an argument: use that glob.
If no argument was provided: default to `"src/**/*.tsx"`.

Use `format: "markdown"` for human-readable output. If the user says "cyclonedx" or "json", use that format instead.

Present: token inventory, component inventory, violation summary, and dependency graph.

Arguments: $ARGUMENTS