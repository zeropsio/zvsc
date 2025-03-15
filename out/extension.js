"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const zeropsProvider_1 = require("./zeropsProvider");
const cliService_1 = require("./services/cliService");
async function activate(context) {
    console.log('Activating Zerops extension...');
    try {
        // Check if zcli is installed
        const isCliInstalled = await cliService_1.CliService.checkCliInstalled();
        if (!isCliInstalled) {
            throw new Error('zcli is not installed. Please install zcli to use this extension.');
        }
        // Create and register the provider
        const provider = new zeropsProvider_1.ZeropsProvider(context.extensionUri, context);
        // Try auto-login
        try {
            const isLoggedIn = await cliService_1.CliService.autoLogin(context);
            if (isLoggedIn) {
                provider.refresh();
            }
        }
        catch (error) {
            console.error('Auto-login failed:', error);
        }
        // Register commands
        let loginCommand = vscode.commands.registerCommand('zerops.login', async () => {
            try {
                const token = await vscode.window.showInputBox({
                    prompt: 'Enter your Zerops Personal Access Token',
                    placeHolder: 'Your token from Zerops Access Token Management',
                    password: true,
                    ignoreFocusOut: true,
                    validateInput: (value) => {
                        return value && value.length > 0 ? null : 'Token is required';
                    }
                });
                if (token) {
                    await cliService_1.CliService.login(token, context);
                    provider.refresh();
                }
            }
            catch (error) {
                console.error('Login failed:', error);
                vscode.window.showErrorMessage('Failed to login to Zerops');
            }
        });
        let logoutCommand = vscode.commands.registerCommand('zerops.logout', async () => {
            try {
                await cliService_1.CliService.logout(context);
                provider.refresh();
            }
            catch (error) {
                console.error('Logout failed:', error);
                vscode.window.showErrorMessage('Failed to logout from Zerops');
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