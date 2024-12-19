import * as vscode from 'vscode';
import { ZeropsProvider } from './zeropsProvider';
import { ZeropsApi } from './services/zeropsApi';

export async function activate(context: vscode.ExtensionContext) {
    // Initialize the API
    await ZeropsApi.initialize(context);
    
    // Create and register the provider
    const provider = new ZeropsProvider(context.extensionUri, context);
    
    // Register commands
    const loginCommand = vscode.commands.registerCommand('zerops.login', async () => {
        await ZeropsApi.login();
    });

    const logoutCommand = vscode.commands.registerCommand('zerops.logout', async () => {
        await ZeropsApi.logout();
        vscode.window.showInformationMessage('Logged out from Zerops');
    });

    context.subscriptions.push(
        provider,
        loginCommand,
        logoutCommand,
        vscode.window.registerWebviewViewProvider('zVsc', provider)
    );
}

export function deactivate() {} 