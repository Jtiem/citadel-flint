/**
 * Minimal ambient declarations for GitHub Actions packages.
 * These are present at runtime (in node_modules during CI) but the local
 * flint-ci node_modules may be empty during type-checking in development.
 * The real type declarations ship with @actions/core and @actions/github.
 */

interface AnnotationProperties {
  title?: string
  file?: string
  startLine?: number
  endLine?: number
  startColumn?: number
  endColumn?: number
}

declare module '@actions/core' {
  export function getInput(name: string, options?: { required?: boolean; trimWhitespace?: boolean }): string
  export function getBooleanInput(name: string, options?: { required?: boolean }): boolean
  export function setOutput(name: string, value: unknown): void
  export function setFailed(message: string | Error): void
  export function info(message: string): void
  export function warning(message: string | Error, properties?: AnnotationProperties): void
  export function error(message: string | Error, properties?: AnnotationProperties): void
  export function debug(message: string): void
  export function startGroup(name: string): void
  export function endGroup(): void
  export const summary: {
    addRaw(text: string, addEOL?: boolean): unknown
    write(options?: { overwrite?: boolean }): Promise<unknown>
  }
}

interface OctokitListFilesParams {
  owner: string
  repo: string
  pull_number: number
  per_page?: number
  page?: number
}

interface OctokitListFilesResult {
  filename: string
  status: string
}

interface OctokitListCommentsParams {
  owner: string
  repo: string
  issue_number: number
  per_page?: number
  page?: number
}

interface OctokitCommentResult {
  id: number
  body?: string | null
  user?: { login: string } | null
}

interface OctokitCreateCommentParams {
  owner: string
  repo: string
  issue_number: number
  body: string
}

interface OctokitUpdateCommentParams {
  owner: string
  repo: string
  comment_id: number
  body: string
}

interface OctokitInstance {
  rest: {
    pulls: {
      listFiles(params: OctokitListFilesParams): Promise<{ data: OctokitListFilesResult[] }>
    }
    issues: {
      listComments(params: OctokitListCommentsParams): Promise<{ data: OctokitCommentResult[] }>
      createComment(params: OctokitCreateCommentParams): Promise<unknown>
      updateComment(params: OctokitUpdateCommentParams): Promise<unknown>
    }
  }
}

interface PullRequestPayload {
  number: number
  base?: { ref?: string }
  [key: string]: unknown
}

interface GithubContext {
  repo: { owner: string; repo: string }
  issue: { number: number }
  payload: {
    pull_request?: PullRequestPayload
    [key: string]: unknown
  }
  eventName: string
  sha: string
  ref: string
  workflow: string
  action: string
  actor: string
}

declare module '@actions/github' {
  export const context: GithubContext
  export function getOctokit(token: string): OctokitInstance
}
