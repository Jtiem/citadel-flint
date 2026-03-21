Audit and auto-fix governance violations across multiple files. Call the `flint_swarm_audit_fix` MCP tool.

If the user provided a glob pattern as an argument: use that glob.
If no argument was provided: default to `"src/**/*.tsx"` for the current project.

Pass `autoFix: true` to enable automatic remediation.

After the sweep completes, present:
1. Total files scanned
2. Files with violations (list them)
3. Fixes applied vs. remaining issues
4. Overall health verdict

If issues remain, suggest: "Run `/report` for the full design debt breakdown."

Arguments: $ARGUMENTS