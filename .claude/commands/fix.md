Auto-fix governance violations in a component file. Call the `flint_fix` MCP tool.

If the user provided a file path as an argument: use that path.
If no argument was provided: check the IDE selection context for a file reference. If none, ask the user which file to fix.

Resolve relative paths against the current working directory.

First run with `dry_run: true` and show what will change. Then ask: "Apply these fixes?" If the user confirms (or if they passed `--yes`), run again with `dry_run: false`.

After fixing, automatically run `/audit` on the same file to confirm the fixes resolved the violations.

Arguments: $ARGUMENTS
