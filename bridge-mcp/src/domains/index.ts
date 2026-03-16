/**
 * Domain Registry — bridge-mcp/src/domains/index.ts
 *
 * Registry of governance domains. Each domain has a name and a path
 * to its rules directory.
 *
 * This file satisfies the import in server.ts:
 *   import { domainRegistry } from "./domains/index.js"
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { healthcareDomainRules } from './healthcare.js'
import { fintechDomainRules } from './fintech.js'
import { ecommerceDomainRules } from './ecommerce.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface Domain {
    id: string
    name: string
    rulesPath: string
}

class DomainRegistry {
    private domains = new Map<string, Domain>()

    register(domain: Domain): void {
        this.domains.set(domain.id, domain)
    }

    get(id: string): Domain | undefined {
        return this.domains.get(id)
    }

    list(): string[] {
        return Array.from(this.domains.keys())
    }
}

export const domainRegistry = new DomainRegistry()

// Register built-in domains
domainRegistry.register({
    id: 'ui',
    name: 'UI Governance',
    rulesPath: path.join(__dirname, 'ui', 'rules'),
})

domainRegistry.register({
    id: 'healthcare',
    name: healthcareDomainRules.name,
    rulesPath: path.join(__dirname, 'healthcare'),
})

domainRegistry.register({
    id: 'fintech',
    name: fintechDomainRules.name,
    rulesPath: path.join(__dirname, 'fintech'),
})

domainRegistry.register({
    id: 'e-commerce',
    name: ecommerceDomainRules.name,
    rulesPath: path.join(__dirname, 'ecommerce'),
})

// Re-export domain rule objects for consumers
export { healthcareDomainRules } from './healthcare.js'
export { fintechDomainRules } from './fintech.js'
export { ecommerceDomainRules } from './ecommerce.js'
