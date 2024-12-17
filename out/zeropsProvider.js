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
            // TODO For later: Implement actual push logic here with zerops api maybe :c
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
                            padding: 10px;
                            color: var(--vscode-foreground);
                            font-family: var(--vscode-font-family);
                        }
                        .container {
                            display: flex;
                            flex-direction: column;
                            gap: 15px;
                        }
                        .token-section {
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                        }
                        .token-input {
                            width: 100%;
                            padding: 5px;
                            background: var(--vscode-input-background);
                            color: var(--vscode-input-foreground);
                            border: 1px solid var(--vscode-input-border);
                        }
                        .push-button {
                            background: #4CAF50;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            cursor: pointer;
                            border-radius: 4px;
                        }
                        .push-button:hover {
                            background: #45a049;
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
                        .token-display {
                            padding: 5px;
                            background: var(--vscode-input-background);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 2px;
                        }
                        .token-actions {
                            display: flex;
                            gap: 8px;
                            margin-top: 4px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Zerops</h2>
                        <div class="token-section">
                            <label>Access Token</label>
                            <div id="tokenInput-container" style="display: ${currentToken ? 'none' : 'block'}">
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
                            <div id="tokenDisplay" style="display: ${currentToken ? 'block' : 'none'}">
                                <div class="token-display">••••••••••••••••</div>
                                <div class="token-actions">
                                    <button class="btn" id="editBtn">Edit</button>
                                </div>
                            </div>
                        </div>
                        <button class="push-button" id="pushButton">
                            Push Changes
                        </button>
                    </div>

                    <script>
                        const vscode = acquireVsCodeApi();
                        const tokenInput = document.getElementById('tokenInput');
                        const tokenInputContainer = document.getElementById('tokenInput-container');
                        const tokenDisplay = document.getElementById('tokenDisplay');
                        const editBtn = document.getElementById('editBtn');
                        const saveBtn = document.getElementById('saveToken');

                        editBtn.addEventListener('click', () => {
                            tokenInputContainer.style.display = 'block';
                            tokenDisplay.style.display = 'none';
                        });

                        saveBtn.addEventListener('click', () => {
                            const token = tokenInput.value;
                            if (token) {
                                vscode.postMessage({
                                    command: 'saveToken',
                                    token: token
                                });
                                tokenInputContainer.style.display = 'none';
                                tokenDisplay.style.display = 'block';
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