"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const zeropsProvider_1 = require("./zeropsProvider");
const zeropsApi_1 = require("./services/zeropsApi");
async function activate(context) {
    // Initialize the API
    await zeropsApi_1.ZeropsApi.initialize(context);
    // Create and register the provider
    const provider = new zeropsProvider_1.ZeropsProvider(context.extensionUri, context);
    // Register commands
    const loginCommand = vscode.commands.registerCommand('zerops.login', async () => {
        await zeropsApi_1.ZeropsApi.login();
    });
    const logoutCommand = vscode.commands.registerCommand('zerops.logout', async () => {
        await zeropsApi_1.ZeropsApi.logout();
        vscode.window.showInformationMessage('Logged out from Zerops');
    });
    context.subscriptions.push(provider, loginCommand, logoutCommand, vscode.window.registerWebviewViewProvider('zVsc', provider));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map