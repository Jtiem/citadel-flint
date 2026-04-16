/**
 * Sprint 4 — D1: Central Zod input schema registry for MCP tools.
 *
 * Wave 1 coverage:
 *   - 5 rule pack tools (flint_list_rule_packs, flint_enable_pack,
 *     flint_disable_pack, flint_set_rule_mode, flint_compliance_coverage)
 *   - 5 handler-extraction targets (flint_audit, flint_fix,
 *     flint_migrate_tw, flint_agent_trust, flint_set_policy)
 *
 * Wave 2 (Group B) will hoist `validateToolInput(...)` into the
 * CallToolRequest dispatch path in server.ts. Until then this file is
 * import-safe and side-effect-free.
 *
 * Design rules:
 *   - Every schema mirrors the exact shape the current handler consumes
 *     (verified against server.ts case bodies). Do not invent fields.
 *   - Optional fields stay optional. String-literal unions become
 *     z.enum(...) so Zod rejects typos before the handler runs.
 *   - `validateToolInput` throws a structured error with the Zod issue
 *     array on failure — caller (Wave 2) decides how to format the
 *     user-facing response.
 *
 * Commandment 16: Inferred TS types from these schemas must match the
 * real handler signatures. Drift here becomes a TSC error the moment
 * Wave 2 lands because the handlers import from this file.
 */

import { z } from "zod";

// ─── Rule pack tools (Sprint 3 registered, Sprint 4 validated) ──────

/** flint_list_rule_packs — optional filters, all strings. */
export const flintListRulePacksSchema = z
    .object({
        domain: z.string().optional(),
        jurisdiction: z.string().optional(),
        status: z.string().optional(),
    })
    .strict();

export type FlintListRulePacksInput = z.infer<typeof flintListRulePacksSchema>;

/** flint_enable_pack — requires pack_id, optional projectRoot override. */
export const flintEnablePackSchema = z
    .object({
        pack_id: z.string().min(1, "pack_id is required"),
        projectRoot: z.string().optional(),
    })
    .strict();

export type FlintEnablePackInput = z.infer<typeof flintEnablePackSchema>;

/** flint_disable_pack — same shape as enable_pack. */
export const flintDisablePackSchema = z
    .object({
        pack_id: z.string().min(1, "pack_id is required"),
        projectRoot: z.string().optional(),
    })
    .strict();

export type FlintDisablePackInput = z.infer<typeof flintDisablePackSchema>;

/**
 * flint_set_rule_mode — per-rule enforcement level.
 * Modes mirror the rulePacks handler contract:
 *   coercive | normative | advisory | off
 * ("blocking" belongs to ResolvedPolicy; the tool API uses "coercive".)
 */
export const flintSetRuleModeSchema = z
    .object({
        rule_id: z.string().min(1, "rule_id is required"),
        mode: z.enum(["coercive", "normative", "advisory", "off"]),
        projectRoot: z.string().optional(),
    })
    .strict();

export type FlintSetRuleModeInput = z.infer<typeof flintSetRuleModeSchema>;

/** flint_compliance_coverage — optional jurisdiction filter. */
export const flintComplianceCoverageSchema = z
    .object({
        jurisdictions: z.array(z.string()).optional(),
        projectRoot: z.string().optional(),
    })
    .strict();

export type FlintComplianceCoverageInput = z.infer<
    typeof flintComplianceCoverageSchema
>;

// ─── Handler-extraction targets (Wave 2 will import these) ──────────

/**
 * flint_audit — single-file OR batch mode.
 *
 * The handler enforces at runtime: either `filePaths` non-empty, or
 * BOTH `source` + `filePath`. We mirror that with a refinement so Zod
 * rejects the empty-args case before reaching the handler body.
 */
export const flintAuditSchema = z
    .object({
        source: z.string().optional(),
        filePath: z.string().optional(),
        filePaths: z.array(z.string()).optional(),
        ruleIds: z.array(z.string()).optional(),
        severity: z.enum(["info", "warning", "critical"]).optional(),
        healOnAudit: z.boolean().optional(),
    })
    .strict()
    .refine(
        (v) =>
            (v.filePaths && v.filePaths.length > 0) ||
            (typeof v.source === "string" && typeof v.filePath === "string"),
        {
            message:
                "Missing required parameters: provide either `filePaths` (batch) or both `source` and `filePath` (single file).",
        },
    );

export type FlintAuditInput = z.infer<typeof flintAuditSchema>;

/**
 * flint_fix — accepts either `file` OR `filePath` (handler normalises),
 * optional inline source, optional violation id filter, dry-run flag.
 */
export const flintFixSchema = z
    .object({
        file: z.string().optional(),
        source: z.string().optional(),
        filePath: z.string().optional(),
        violationIds: z.array(z.string()).optional(),
        dryRun: z.boolean().optional(),
    })
    .strict()
    .refine(
        (v) => typeof v.file === "string" || typeof v.filePath === "string",
        {
            message:
                "flint_fix requires either `file` or `filePath` (absolute or project-relative).",
        },
    );

export type FlintFixInput = z.infer<typeof flintFixSchema>;

/**
 * flint_migrate_tw — Tailwind v3→v4 AST class migration.
 * filePaths must be a non-empty array; glob is optional and must not
 * contain traversal segments (the handler enforces that second check).
 */
export const flintMigrateTwSchema = z
    .object({
        filePaths: z.array(z.string()).min(1, "filePaths must be non-empty"),
        glob: z.string().optional(),
        dryRun: z.boolean().optional(),
        from: z.literal("3").optional(),
        to: z.literal("4").optional(),
    })
    .strict();

export type FlintMigrateTwInput = z.infer<typeof flintMigrateTwSchema>;

/**
 * flint_agent_trust — action-dispatched; each action has its own
 * required-field rules enforced inside the handler. Zod validates the
 * enum and the presence of projectRoot up front.
 *
 * TrustTier enum mirrors the `trustTierService` export
 * (`restricted | standard | elevated | admin`).
 */
export const flintAgentTrustSchema = z
    .object({
        action: z.enum(["profile", "list", "promote", "demote", "reset"]),
        projectRoot: z.string().min(1, "projectRoot is required"),
        agentId: z.string().optional(),
        targetTier: z
            .enum(["restricted", "standard", "elevated", "admin"])
            .optional(),
    })
    .strict();

export type FlintAgentTrustInput = z.infer<typeof flintAgentTrustSchema>;

/**
 * flint_set_policy — read/update/reset the resolved policy.
 * The handler uses `mergeAndValidatePolicy` for deep field validation,
 * so the Zod schema only guards the discriminator and the presence of
 * `policy` on update. Partial policy shape is intentionally loose.
 */
export const flintSetPolicySchema = z
    .object({
        action: z.enum(["read", "update", "reset"]),
        policy: z.record(z.string(), z.unknown()).optional(),
    })
    .strict()
    .refine(
        (v) => v.action !== "update" || (v.policy && typeof v.policy === "object"),
        {
            message:
                "'update' action requires a 'policy' object with partial policy fields.",
        },
    );

export type FlintSetPolicyInput = z.infer<typeof flintSetPolicySchema>;

// ─── Registry + validator ───────────────────────────────────────────

/**
 * Central map of MCP tool name → Zod schema.
 *
 * Wave 2 will (a) extend this map to cover every registered tool and
 * (b) hoist `validateToolInput` into the server.ts dispatch prelude.
 * Until then, unknown tool names fall through untouched in
 * `validateToolInput` so the existing handlers keep working.
 */
export const TOOL_INPUT_SCHEMAS: Record<string, z.ZodTypeAny> = {
    // Rule packs
    flint_list_rule_packs: flintListRulePacksSchema,
    flint_enable_pack: flintEnablePackSchema,
    flint_disable_pack: flintDisablePackSchema,
    flint_set_rule_mode: flintSetRuleModeSchema,
    flint_compliance_coverage: flintComplianceCoverageSchema,

    // Handler extraction targets
    flint_audit: flintAuditSchema,
    flint_fix: flintFixSchema,
    flint_migrate_tw: flintMigrateTwSchema,
    flint_agent_trust: flintAgentTrustSchema,
    flint_set_policy: flintSetPolicySchema,
};

/**
 * Structured validation error thrown by `validateToolInput`.
 *
 * Wave 2 (server.ts dispatch) catches this, converts to the
 * `toolError(...)` CallToolResult shape, and forwards the Zod issues
 * array so the client can pinpoint the failing field.
 */
export class ToolInputValidationError extends Error {
    constructor(
        public readonly toolName: string,
        public readonly issues: z.ZodIssue[],
    ) {
        super(
            `Invalid input for tool "${toolName}": ${issues
                .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
                .join("; ")}`,
        );
        this.name = "ToolInputValidationError";
    }
}

/**
 * Look up the schema for `toolName` and `schema.parse(args)`.
 * If no schema is registered, return `args` untouched (legacy
 * passthrough — Wave 2 will fill the registry to remove this escape
 * hatch). On Zod failure, throw `ToolInputValidationError` with the
 * structured issue array intact.
 *
 * The generic `T` lets callers annotate the expected inferred type
 * at the call site, e.g.
 *
 *     const args = validateToolInput<FlintAuditInput>("flint_audit", raw);
 *
 * When no schema is registered the cast is unsound but matches the
 * current handler pattern of `as { ... }` casts; Wave 2 replaces both.
 */
export function validateToolInput<T = unknown>(
    toolName: string,
    args: unknown,
): T {
    const schema = TOOL_INPUT_SCHEMAS[toolName];
    if (!schema) {
        // Legacy passthrough — matches today's `as { ... }` cast behaviour.
        return args as T;
    }
    const result = schema.safeParse(args ?? {});
    if (!result.success) {
        throw new ToolInputValidationError(toolName, result.error.issues);
    }
    return result.data as T;
}
