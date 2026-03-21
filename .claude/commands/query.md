Search the component registry. Call the `flint_query_registry` MCP tool.

Use the user's argument as the `query` parameter. If no argument was provided, ask what component they're looking for.

Present the results as a table: component name, file path, description, and usage example (if available).

If no results found, suggest: "Try a broader term, or run `/sweep` to re-index."

Arguments: $ARGUMENTS