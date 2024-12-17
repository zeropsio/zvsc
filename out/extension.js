"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const zeropsProvider_1 = require("./zeropsProvider");
function activate(context) {
    const zeropsProvider = new zeropsProvider_1.ZeropsProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('zVsc', zeropsProvider));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map