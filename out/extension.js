"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const zeropsProvider_1 = require("./zeropsProvider");
const zeropsApi_1 = require("./services/zeropsApi");
async function activate(context) {
    console.log('Activating Zerops extension...');
    try {
        // Initialize the API first
        await zeropsApi_1.ZeropsApi.initialize(context);
        console.log('API initialized successfully');
        // Create and register the provider
        const provider = new zeropsProvider_1.ZeropsProvider(context.extensionUri, context);
        // Register commands
        const loginCommand = vscode.commands.registerCommand('zerops.login', async () => {
            try {
                await zeropsApi_1.ZeropsApi.login();
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                vscode.window.showErrorMessage(`Login failed: ${errorMessage}`);
            }
        });
        const logoutCommand = vscode.commands.registerCommand('zerops.logout', async () => {
            try {
                await zeropsApi_1.ZeropsApi.logout();
                vscode.window.showInformationMessage('Logged out from Zerops');
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                vscode.window.showErrorMessage(`Logout failed: ${errorMessage}`);
            }
        });
        context.subscriptions.push(provider, loginCommand, logoutCommand, vscode.window.registerWebviewViewProvider('zVsc', provider, {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        }));
        console.log('Zerops extension activated successfully');
    }
    catch (error) {
        console.error('Failed to activate Zerops extension:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        vscode.window.showErrorMessage(`Failed to initialize Zerops extension: ${errorMessage}`);
    }
}
exports.activate = activate;
function deactivate() {
    console.log('Deactivating Zerops extension...');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map