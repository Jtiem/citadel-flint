/**
 * Minimal vscode module mock for unit testing pure functions.
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
        public startChar: number,
        public endLine: number,
        public endChar: number,
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

export class CodeAction {
    diagnostics?: Diagnostic[];
    isPreferred?: boolean;
    command?: unknown;
    constructor(public title: string, public kind?: unknown) {}
}

export const CodeActionKind = {
    QuickFix: 'quickfix',
};

export class ThemeColor {
    constructor(public id: string) {}
}

export enum StatusBarAlignment {
    Left = 1,
    Right = 2,
}

export const workspace = {
    getConfiguration: () => ({
        get: (key: string, defaultValue: unknown) => defaultValue,
    }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
    onDidSaveTextDocument: () => ({ dispose: () => {} }),
    onDidOpenTextDocument: () => ({ dispose: () => {} }),
    onDidCloseTextDocument: () => ({ dispose: () => {} }),
};

export const languages = {
    createDiagnosticCollection: () => ({
        set: () => {},
        delete: () => {},
        dispose: () => {},
        get: () => [],
    }),
    onDidChangeDiagnostics: () => ({ dispose: () => {} }),
};

export const window = {
    createStatusBarItem: () => ({
        text: '',
        tooltip: '',
        command: '',
        backgroundColor: undefined,
        show: () => {},
        dispose: () => {},
    }),
    onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
    showWarningMessage: () => {},
    showInformationMessage: () => {},
    showErrorMessage: () => {},
    activeTextEditor: undefined,
    createOutputChannel: () => ({
        appendLine: () => {},
        dispose: () => {},
    }),
};

export const commands = {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: () => Promise.resolve(),
};

export const Uri = {
    file: (path: string) => ({ fsPath: path, toString: () => path }),
};

export class WorkspaceEdit {
    replace() {}
}

export const ProgressLocation = { Notification: 15 };
