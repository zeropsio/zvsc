import * as vscode from 'vscode';
import { CliService } from './services/cliService';

export class ZeropsProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {}

    dispose() {
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    public async refresh() {
        // Nothing to refresh
    }

    async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        this._setWebviewMessageListener(webviewView.webview);
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(async (message: any) => {
            const { command } = message;

            switch (command) {
                case 'pushToService':
                    const serviceId = message.serviceId;
                    console.log(`Starting push to service ${serviceId}`);
                    
                    try {
                        await CliService.pushToService(message.serviceId, {
                            deployGitFolder: message.deployGitFolder
                        });
                        webview.postMessage({ command: 'pushComplete' });
                        vscode.window.showInformationMessage('Successfully pushed changes to service');
                    } catch (error) {
                        console.error('Failed to push:', error);
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                        webview.postMessage({ command: 'pushError', message: errorMessage });
                        if (errorMessage !== 'Push cancelled by user') {
                            vscode.window.showErrorMessage(`Failed to push: ${errorMessage}`);
                        }
                    } finally {
                        webview.postMessage({ command: 'resetButton' });
                    }
                    break;
                case 'cancelPush':
                    try {
                        await CliService.cancelPush();
                    } catch (error) {
                        // Cancellation was successful, reset the UI
                        webview.postMessage({ command: 'resetButton' });
                        webview.postMessage({ command: 'pushError', message: 'Push cancelled by user' });
                    }
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Zerops Push</title>
                <style>
                    body {
                        padding: 1rem;
                        color: var(--vscode-foreground);
                        font-family: var(--vscode-font-family);
                    }
                    .header {
                        margin-bottom: 1.5rem;
                    }
                    .push-form {
                        padding: 1rem;
                        border: 1px solid var(--vscode-widget-border);
                        border-radius: 4px;
                    }
                    .form-group {
                        margin-bottom: 1rem;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 0.5rem;
                        font-weight: 500;
                    }
                    .form-group input[type="text"] {
                        width: 100%;
                        padding: 0.5rem;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                    }
                    .form-group input[type="checkbox"] {
                        margin-right: 0.5rem;
                    }
                    .form-row {
                        display: flex;
                        align-items: center;
                        margin-bottom: 0.5rem;
                    }
                    .button {
                        width: 100%;
                        background: #54AEA3;
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 0.75rem;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        margin-top: 1rem;
                    }
                    .button:hover {
                        background: #489690;
                    }
                    .required {
                        color: var(--vscode-errorForeground);
                        margin-left: 0.25rem;
                    }
                    .button:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                    .status {
                        margin-top: 1rem;
                        padding: 0.5rem;
                        border-radius: 4px;
                    }
                    .status.error {
                        background: #ff000015;
                        border: 1px solid #ff000030;
                        color: #ff4444;
                    }
                    .status.success {
                        background: #00ff0015;
                        border: 1px solid #00ff0030;
                        color: #44ff44;
                    }
                    .button-group {
                        margin-top: 1rem;
                    }
                </style>
            </head>
            <body>
                <div id="app">

                    <div class="push-form">
                        <div class="form-group">
                            <label for="serviceId">Service ID<span class="required">*</span></label>
                            <input type="text" id="serviceId" placeholder="Enter service ID" required>
                        </div>
                        <div class="form-row">
                            <input type="checkbox" id="deployGitFolder">
                            <label for="deployGitFolder">Include .git folder</label>
                        </div>
                        <div class="button-group">
                            <button class="button" id="pushButton" onclick="pushToService()">Push Changes</button>
                        </div>
                        <div id="status" class="status" style="display: none;"></div>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const pushButton = document.getElementById('pushButton');
                    const status = document.getElementById('status');

                    function showStatus(message, isError) {
                        if (!status) return;
                        status.textContent = message;
                        status.className = 'status ' + (isError ? 'error' : 'success');
                        status.style.display = 'block';
                    }

                    function pushToService() {
                        const serviceId = document.getElementById('serviceId')?.value.trim() || '';
                        const deployGitFolder = document.getElementById('deployGitFolder')?.checked || false;

                        if (!serviceId) {
                            showStatus('Service ID is required', true);
                            return;
                        }

                        if (status) {
                            status.style.display = 'none';
                        }

                        vscode.postMessage({
                            command: 'pushToService',
                            serviceId,
                            deployGitFolder
                        });
                    }

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'pushComplete':
                                showStatus('Push completed successfully!', false);
                                break;
                            case 'pushError':
                                showStatus(message.message, true);
                                break;
                        }
                    });
                </script>
            </body>
            </html>`;
    }
} 