Check Flint server health and project governance status.

1. Call `flint_status` to verify the MCP server is running.
2. Call `flint_get_context` with the current working directory as `projectRoot` to get project state.

Present a concise dashboard:
- Server: online/offline
- Project root detected
- Components registered
- Active violations
- Sync status (if Figma connected)
- Last audit timestamp

Arguments: $ARGUMENTS