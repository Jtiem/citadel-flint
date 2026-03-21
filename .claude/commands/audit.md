Run a Flint governance audit on a component file. Call the `audit_ui_component` MCP tool.

If the user provided a file path as an argument: use that path.
If no argument was provided: check the IDE selection context for a file reference. If none, ask the user which file to audit.

Resolve relative paths against the current working directory.

After receiving the audit result, present it as formatted markdown in your response — do NOT rely on the collapsed tool output block. Present:
1. The verdict (BLOCKED or APPROVED)
2. Violation count and summary table
3. The "Why it matters" explanations for each violation
4. A clear next step: "Say `/fix $FILE` to auto-remediate" (substituting the actual file path)

Arguments: $ARGUMENTS
