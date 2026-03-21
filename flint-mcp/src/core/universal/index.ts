/**
 * V.3 — Universal AST Abstraction — Public API
 */

export { FlintNode, FlintDocument, SourceRange, FlintVisitor, walk, findById, findByType, createNode, resetIdCounter } from "./flintNode.js";
export { LanguageAdapter, FlintMutation } from "./adapter.js";
export { LinterPlugin, LinterRule, LintViolation, LintContext, LintSeverity } from "./linterPlugin.js";
export { PluginRegistry, UniversalAuditResult } from "./registry.js";
export { JSXAdapter } from "./adapters/jsx-adapter.js";
export { JSONSchemaAdapter } from "./adapters/json-schema-adapter.js";
export { HTMLAdapter } from "./adapters/html-adapter.js";
