/**
 * Mock of the vscode module for unit testing outside the extension host.
 * Only stubs the types/enums used by diagnosticsProvider and codeActionProvider.
 */

export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3,
}

export class Range {
    constructor(
        public startLine: number,
        public startCharacter: number,
        public endLine: number,
        public endCharacter: number,
    ) {}
}

export class Position {
    constructor(
        public line: number,
        public character: number,
    ) {}
}

export class Diagnostic {
    source?: string;
    code?: string | number;
    constructor(
        public range: Range,
        public message: string,
        public severity?: DiagnosticSeverity,
    ) {}
}

export const CodeActionKind = {
    QuickFix: 'quickfix',
};

export class CodeAction {
    diagnostics?: Diagnostic[];
    isPreferred?: boolean;
    command?: unknown;
    constructor(
        public title: string,
        public kind?: string,
    ) {}
}

export const languages = {
    createDiagnosticCollection: (name: string) => ({
        name,
        set: () => {},
        delete: () => {},
        dispose: () => {},
    }),
    registerCodeActionsProvider: () => ({ dispose: () => {} }),
};

export const workspace = {
    onDidSaveTextDocument: () => ({ dispose: () => {} }),
    onDidOpenTextDocument: () => ({ dispose: () => {} }),
    onDidCloseTextDocument: () => ({ dispose: () => {} }),
    getConfiguration: () => ({
        get: (key: string, defaultValue: unknown) => defaultValue,
    }),
    workspaceFolders: [],
    findFiles: async () => [],
    openTextDocument: async () => ({}),
    applyEdit: async () => true,
    textDocuments: [],
};

export const window = {
    createOutputChannel: () => ({
        appendLine: () => {},
        dispose: () => {},
    }),
    createStatusBarItem: () => ({
        text: '',
        tooltip: '',
        command: '',
        show: () => {},
        dispose: () => {},
    }),
    showWarningMessage: () => {},
    showInformationMessage: () => {},
    showErrorMessage: () => {},
    activeTextEditor: null,
    withProgress: async (_opts: unknown, task: Function) => task({ report: () => {} }, { isCancellationRequested: false }),
};

export const env = {
    appName: 'Visual Studio Code',
};

export const commands = {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: async () => {},
};

export const StatusBarAlignment = {
    Left: 1,
    Right: 2,
};

export const ProgressLocation = {
    Notification: 15,
};

export class WorkspaceEdit {
    replace() {}
}

export const Uri = {
    file: (path: string) => ({ fsPath: path, toString: () => path }),
};
