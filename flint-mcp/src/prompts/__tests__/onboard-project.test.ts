import { describe, it, expect } from 'vitest'
import {
    ONBOARD_PROJECT_PROMPT_DEF,
    getOnboardProjectContent,
} from '../onboard-project.js'

describe('onboard-project prompt', () => {
    describe('ONBOARD_PROJECT_PROMPT_DEF', () => {
        it('has the correct name', () => {
            expect(ONBOARD_PROJECT_PROMPT_DEF.name).toBe('flint-onboard-project')
        })

        it('has a description', () => {
            expect(ONBOARD_PROJECT_PROMPT_DEF.description.length).toBeGreaterThan(0)
        })

        it('declares an optional projectRoot argument', () => {
            const arg = ONBOARD_PROJECT_PROMPT_DEF.arguments[0]
            expect(arg.name).toBe('projectRoot')
            expect(arg.required).toBe(false)
        })
    })

    describe('getOnboardProjectContent', () => {
        it('includes projectRoot when provided', () => {
            const content = getOnboardProjectContent('/tmp/my-project')
            expect(content).toContain('/tmp/my-project')
        })

        it('falls back to cwd hint when no projectRoot', () => {
            const content = getOnboardProjectContent()
            expect(content).toContain('current working directory')
        })

        it('references flint-workflow-guide for intent handoff', () => {
            const content = getOnboardProjectContent()
            expect(content).toContain('flint-workflow-guide')
        })

        it('asks the user what they want to accomplish', () => {
            const content = getOnboardProjectContent()
            expect(content.toLowerCase()).toContain('what')
            // Should include a question about the user goal
            expect(content).toContain('accomplish')
        })

        it('instructs the LLM to use the workflow guide with the user intent', () => {
            const content = getOnboardProjectContent()
            expect(content).toContain('intent')
        })

        it('instructs the LLM to keep the handoff seamless (no fourth-wall announcement)', () => {
            const content = getOnboardProjectContent()
            // The prompt must instruct seamless handoff — no "switching prompt" announcement to user
            expect(content).toContain('seamless')
            // Must not literally tell the user "now run this other prompt"
            expect(content).not.toContain('now run this other prompt')
        })

        it('preserves flint_get_context step', () => {
            const content = getOnboardProjectContent()
            expect(content).toContain('flint_get_context')
        })

        it('preserves flint_debt_report step', () => {
            const content = getOnboardProjectContent()
            expect(content).toContain('flint_debt_report')
        })

        it('preserves flint_reindex_registry step', () => {
            const content = getOnboardProjectContent()
            expect(content).toContain('flint_reindex_registry')
        })

        it('preserves flint_set_policy step', () => {
            const content = getOnboardProjectContent()
            expect(content).toContain('flint_set_policy')
        })

        it('preserves the read-only disclaimer', () => {
            const content = getOnboardProjectContent()
            expect(content).toContain('read-only')
        })

        it('still ends with the capabilities resource hint', () => {
            const content = getOnboardProjectContent()
            expect(content).toContain('flint://capabilities')
        })

        it('includes grade-based next steps', () => {
            const content = getOnboardProjectContent()
            expect(content).toContain('Grade A')
            expect(content).toContain('Grade F')
        })
    })
})
