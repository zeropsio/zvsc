import * as vscode from 'vscode';

export class ZeropsProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly context: vscode.ExtensionContext) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        const config = vscode.workspace.getConfiguration('zvsc');
        const currentToken = config.get<string>('accessToken') || '';

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

    private async handlePush() {
        const config = vscode.workspace.getConfiguration('zvsc');
        const token = config.get<string>('accessToken');
        
        if (!token) {
            vscode.window.showErrorMessage('Please set your Zerops access token first.');
            return;
        }

        try {
            // TODO For later: Implement actual push logic here with zerops api maybe :c
            vscode.window.showInformationMessage('Changes pushed to Zerops successfully!');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage('Failed to push changes: ' + errorMessage);
        }
    }

    private getWebviewContent(currentToken: string): string {
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
                            gap: 15px;
                            padding-top: 40px;
                        }
                        .token-section {
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                            padding: 0 8px;
                        }
                        .token-input {
                            width: 100%;
                            padding: 5px;
                            background: var(--vscode-dropdown-background);
                            color: var(--vscode-dropdown-foreground);
                            border: 1px solid var(--vscode-dropdown-border);
                            border-radius: 2px;
                        }
                        .push-button {
                            background: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border: none;
                            padding: 8px 16px;
                            cursor: pointer;
                            border-radius: 4px;
                        }
                        .push-button:hover {
                            background: var(--vscode-button-hoverBackground);
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
                            color: var(--vscode-input-foreground);
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
                        <button class="push-button" id="pushButton">
                            Push Changes
                        </button>
                        <div class="token-section">
                            <label>Access Token</label>
                            <select class="token-input" id="tokenSelect">
                                <option value="" disabled selected>Select access token</option>
                                ${currentToken ? `<option value="${currentToken}" selected>••••••••••••••••</option>` : ''}
                            </select>
                            <div class="token-actions">
                                <button class="btn" id="editBtn">Edit</button>
                                <button class="btn" id="addBtn">Add New</button>
                            </div>
                            <div id="tokenInput-container" style="display: none">
                                <input 
                                    type="password" 
                                    class="token-input" 
                                    id="tokenInput" 
                                    placeholder="Enter your Zerops access token"
                                />
                                <div class="token-actions">
                                    <button class="btn" id="saveToken">Save Token</button>
                                    <button class="btn" id="cancelBtn">Cancel</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <script>
                        const vscode = acquireVsCodeApi();
                        const tokenInput = document.getElementById('tokenInput');
                        const tokenInputContainer = document.getElementById('tokenInput-container');
                        const tokenSelect = document.getElementById('tokenSelect');
                        const editBtn = document.getElementById('editBtn');
                        const addBtn = document.getElementById('addBtn');
                        const saveBtn = document.getElementById('saveToken');
                        const cancelBtn = document.getElementById('cancelBtn');

                        addBtn.addEventListener('click', () => {
                            tokenInputContainer.style.display = 'block';
                            tokenInput.value = '';
                        });

                        cancelBtn.addEventListener('click', () => {
                            tokenInputContainer.style.display = 'none';
                        });

                        saveBtn.addEventListener('click', () => {
                            const token = tokenInput.value;
                            if (token) {
                                vscode.postMessage({
                                    command: 'saveToken',
                                    token: token
                                });
                                tokenInputContainer.style.display = 'none';
                                // Add new option to select
                                const option = document.createElement('option');
                                option.value = token;
                                option.text = '••••••••••••••••';
                                option.selected = true;
                                tokenSelect.appendChild(option);
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