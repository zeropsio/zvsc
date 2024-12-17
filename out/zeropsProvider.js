"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeropsProvider = void 0;
const vscode = require("vscode");
class ZeropsProvider {
    constructor(context) {
        this.context = context;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };
        const config = vscode.workspace.getConfiguration('zvsc');
        const currentToken = config.get('accessToken') || '';
        webviewView.webview.html = this.getWebviewContent(currentToken);
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'saveToken':
                    await config.update('accessToken', message.token, true);
                    vscode.window.showInformationMessage('Zerops token saved successfully!');
                    break;
                case 'push':
                    this.handlePush();
                    break;
            }
        });
    }
    async handlePush() {
        const config = vscode.workspace.getConfiguration('zvsc');
        const token = config.get('accessToken');
        if (!token) {
            vscode.window.showErrorMessage('Please set your Zerops access token first.');
            return;
        }
        try {
            vscode.window.showInformationMessage('Changes pushed to Zerops successfully!');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage('Failed to push changes: ' + errorMessage);
        }
    }
    getWebviewContent(currentToken) {
        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body { 
                            padding: 0;
                            color: var(--vscode-foreground);
                            font-family: var(--vscode-font-family);
                        }
                        .container {
                            display: flex;
                            flex-direction: column;
                            gap: 0;
                        }
                        .token-section {
                            margin-top: 15px;
                        }
                        .token-header {
                            display: flex;
                            align-items: center;
                            gap: 4px;
                            cursor: pointer;
                            padding: 3px 8px;
                            user-select: none;
                            font-size: 11px;
                            font-weight: 400;
                            text-transform: uppercase;
                            background-color: var(--vscode-activityBar-background);
                            color: var(--vscode-activityBar-foreground);
                        }
                        .chevron {
                            width: 16px;
                            height: 16px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            order: -1;
                        }
                        .chevron::after {
                            content: "";
                            width: 16px;
                            height: 16px;
                            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 13l-.618-.619 4.357-4.357z' fill='%23C5C5C5'/%3E%3C/svg%3E");
                            transform: rotate(0deg);
                            transition: transform 0.2s;
                        }
                        .token-content {
                            display: none;
                            padding: 8px;
                        }
                        .token-content.show {
                            display: block;
                        }
                        .token-header:has(+ .token-content.show) .chevron::after {
                            transform: rotate(90deg);
                        }
                        .token-input {
                            width: 100%;
                            padding: 5px;
                            background: var(--vscode-input-background);
                            color: var(--vscode-input-foreground);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 2px;
                        }
                        .push-button {
                            background: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border: none;
                            padding: 8px 16px;
                            cursor: pointer;
                            border-radius: 4px;
                            margin: 0 8px;
                        }
                        .push-button:hover {
                            background: var(--vscode-button-hoverBackground);
                        }
                        .token-actions {
                            display: flex;
                            gap: 8px;
                            margin-top: 8px;
                        }
                        .btn {
                            padding: 4px 8px;
                            border: none;
                            border-radius: 2px;
                            cursor: pointer;
                            background: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                        }
                        .btn:hover {
                            background: var(--vscode-button-hoverBackground);
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <button class="push-button" id="pushButton">
                            Push Changes
                        </button>
                        <div class="token-section">
                            <div class="token-header" id="tokenHeader">
                                <div class="chevron"></div>
                                <span>Access Token</span>
                            </div>
                            <div class="token-content" id="tokenContent">
                                <input 
                                    type="password" 
                                    class="token-input" 
                                    id="tokenInput" 
                                    value="${currentToken}"
                                    placeholder="Enter your Zerops access token"
                                />
                                <div class="token-actions">
                                    <button class="btn" id="saveToken">Save Token</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <script>
                        const vscode = acquireVsCodeApi();
                        const tokenInput = document.getElementById('tokenInput');
                        const saveBtn = document.getElementById('saveToken');
                        const tokenHeader = document.getElementById('tokenHeader');
                        const tokenContent = document.getElementById('tokenContent');

                        // Toggle dropdown
                        tokenHeader.addEventListener('click', () => {
                            tokenContent.classList.toggle('show');
                        });

                        // Save token
                        saveBtn.addEventListener('click', () => {
                            const token = tokenInput.value;
                            if (token) {
                                vscode.postMessage({
                                    command: 'saveToken',
                                    token: token
                                });
                            }
                        });

                        document.getElementById('pushButton').addEventListener('click', () => {
                            vscode.postMessage({
                                command: 'push'
                            });
                        });
                    </script>
                </body>
            </html>
        `;
    }
}
exports.ZeropsProvider = ZeropsProvider;
//# sourceMappingURL=zeropsProvider.js.map