Run Tailwind v3→v4 AST-level class migration. Call the `flint_migrate_tw` MCP tool.

If the user provided a file path or glob as an argument: use it.
If no argument was provided: ask which file or glob to migrate.

Pass the argument as `file` (for a single file path) or `glob` (if it contains `*`).

After migration, present:
1. Classes transformed (old → new)
2. Post-migration audit results
3. Any manual review items

Arguments: $ARGUMENTS