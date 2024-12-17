import * as vscode from 'vscode';
import { ZeropsProvider } from './zeropsProvider';

export function activate(context: vscode.ExtensionContext) {
    const zeropsProvider = new ZeropsProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('zVsc', zeropsProvider)
    );
}

export function deactivate() {} 