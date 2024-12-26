import * as vscode from 'vscode';
import { ZeropsProvider } from './zeropsProvider';
import { ZeropsApi } from './services/zeropsApi';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating Zerops extension...');
    
    try {
        // Initialize the API first
        await ZeropsApi.initialize(context);
        console.log('API initialized successfully');
        
        // Create and register the provider
        const provider = new ZeropsProvider(context.extensionUri, context);
        
        // Register commands
        const loginCommand = vscode.commands.registerCommand('zerops.login', async () => {
            try {
                await ZeropsApi.login();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                vscode.window.showErrorMessage(`Login failed: ${errorMessage}`);
            }
        });

        const logoutCommand = vscode.commands.registerCommand('zerops.logout', async () => {
            try {
                await ZeropsApi.logout();
                vscode.window.showInformationMessage('Logged out from Zerops');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                vscode.window.showErrorMessage(`Logout failed: ${errorMessage}`);
            }
        });

        context.subscriptions.push(
            provider,
            loginCommand,
            logoutCommand,
            vscode.window.registerWebviewViewProvider('zVsc', provider, {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            })
        );

        console.log('Zerops extension activated successfully');
    } catch (error) {
        console.error('Failed to activate Zerops extension:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        vscode.window.showErrorMessage(`Failed to initialize Zerops extension: ${errorMessage}`);
    }
}

export function deactivate() {
    console.log('Deactivating Zerops extension...');
} 