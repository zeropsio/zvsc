"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeropsProvider = void 0;
const vscode = require("vscode");
const cliService_1 = require("./services/cliService");
class ZeropsProvider {
    constructor(_extensionUri, _context) {
        this._extensionUri = _extensionUri;
        this._context = _context;
        this._disposables = [];
    }
    dispose() {
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    async refresh() {
        // Nothing to refresh
    }
    async resolveWebviewView(webviewView, context, token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        this._setWebviewMessageListener(webviewView.webview);
        // Check VPN status on load
        this._checkVpnStatus(webviewView.webview);
    }
    async _checkVpnStatus(webview) {
        try {
            const status = await cliService_1.CliService.checkVpnStatus();
            webview.postMessage({ command: 'vpnStatus', status });
        }
        catch (error) {
            console.error('Failed to check VPN status:', error);
        }
    }
    _setWebviewMessageListener(webview) {
        webview.onDidReceiveMessage(async (message) => {
            const { command } = message;
            switch (command) {
                case 'pushToService':
                    const serviceId = message.serviceId;
                    console.log(`Starting push to service ${serviceId}`);
                    try {
                        await cliService_1.CliService.pushToService(message.serviceId);
                        // No need to post completion message as we can't track completion anymore
                        // Just inform the user that the push command has been sent to the terminal
                        vscode.window.showInformationMessage('Push command sent to Zerops terminal');
                    }
                    catch (error) {
                        console.error('Failed to start push:', error);
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                        webview.postMessage({ command: 'pushError', message: errorMessage });
                        vscode.window.showErrorMessage(`Failed to start push: ${errorMessage}`);
                    }
                    finally {
                        // Re-enable the push button since we can't track completion
                        webview.postMessage({ command: 'resetButton' });
                    }
                    break;
                case 'loadProjectSettings':
                    try {
                        const settings = await cliService_1.CliService.loadProjectSettings();
                        webview.postMessage({ command: 'projectSettings', settings });
                    }
                    catch (error) {
                        console.error('Failed to load project settings:', error);
                    }
                    break;
                case 'checkVpnStatus':
                    await this._checkVpnStatus(webview);
                    break;
                case 'vpnUp':
                    try {
                        const projectId = message.projectId;
                        const autoDisconnect = message.autoDisconnect || false;
                        if (!projectId) {
                            throw new Error('Project ID is required for VPN connection');
                        }
                        webview.postMessage({ command: 'vpnConnecting' });
                        await cliService_1.CliService.vpnUp(projectId, autoDisconnect);
                        webview.postMessage({ command: 'vpnStatus', status: 'connected' });
                    }
                    catch (error) {
                        console.error('Failed to connect VPN:', error);
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                        webview.postMessage({ command: 'vpnError', message: errorMessage });
                        // Check status again in case the terminal method succeeded
                        setTimeout(() => this._checkVpnStatus(webview), 3000);
                    }
                    break;
                case 'vpnDown':
                    try {
                        webview.postMessage({ command: 'vpnDisconnecting' });
                        await cliService_1.CliService.vpnDown();
                        webview.postMessage({ command: 'vpnStatus', status: 'disconnected' });
                    }
                    catch (error) {
                        console.error('Failed to disconnect VPN:', error);
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                        webview.postMessage({ command: 'vpnError', message: errorMessage });
                        // Check status again in case the terminal method succeeded
                        setTimeout(() => this._checkVpnStatus(webview), 3000);
                    }
                    break;
            }
        });
    }
    _getHtmlForWebview(webview) {
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
                    .section {
                        margin-bottom: 1.5rem;
                    }
                    .section-title {
                        font-size: 1.1rem;
                        font-weight: 600;
                        padding-left: 0.45rem;
                        padding-bottom: 0.5rem;
                        border-bottom: 1px solid var(--vscode-widget-border);
                    }
                    .push-form, .vpn-form {
                        padding: 0.75rem;
                        border: 1px solid var(--vscode-widget-border);
                        border-radius: 4px;
                        margin-bottom: 1.5rem;
                    }
                    .form-group {
                        margin-bottom: 0.75rem;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 0.5rem;
                        font-weight: 500;
                    }
                    .form-group input[type="text"],
                    .form-group select {
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
                    .vpn-controls {
                        display: flex;
                        gap: 0.5rem;
                        align-items: center;
                    }
                    .info-text {
                        font-size: 0.9rem;
                        color: #6c6c6c;
                        margin-top: 0.5rem;
                        font-style: italic;
                    }
                    .hidden {
                        display: none;
                    }
                </style>
            </head>
            <body>
                <div id="app">
                    <div class="section">
                        <div class="section-title">Push Changes</div>
                        <div class="push-form">
                            <div class="form-group">
                                <label for="serviceId">Service ID<span class="required">*</span></label>
                                <input type="text" id="serviceId" placeholder="Enter service ID" required>
                            </div>
                            <div class="button-group">
                                <button class="button" id="pushButton" onclick="pushToService()">Push Changes</button>
                            </div>
                            <div id="pushStatus" class="status" style="display: none;"></div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">Zerops VPN</div>
                        <div class="vpn-form">
                            <div id="vpnControls">
                                <div class="form-group">
                                    <label for="projectId">Project ID<span class="required">*</span></label>
                                    <input type="text" id="projectId" placeholder="Enter project ID" required>
                                </div>
                                
                                <div class="button-group">
                                    <button class="button" id="connectVpnButton" onclick="connectVpn()">Connect VPN</button>
                                </div>
                                <div class="button-group" style="margin-top: 0.5rem;">
                                    <button class="button" id="disconnectVpnButton" onclick="disconnectVpn()" style="background-color: #666;">Disconnect VPN</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const pushButton = document.getElementById('pushButton');
                    const pushStatus = document.getElementById('pushStatus');
                    const connectVpnButton = document.getElementById('connectVpnButton');
                    const disconnectVpnButton = document.getElementById('disconnectVpnButton');

                    // Initial check of VPN status
                    vscode.postMessage({ command: 'checkVpnStatus' });
                    
                    // Load saved project settings
                    vscode.postMessage({ command: 'loadProjectSettings' });

                    function showStatus(elementId, message, isError) {
                        const statusElement = document.getElementById(elementId);
                        if (!statusElement) return;
                        statusElement.textContent = message;
                        statusElement.className = 'status ' + (isError ? 'error' : 'success');
                        statusElement.style.display = 'block';
                    }

                    function pushToService() {
                        const serviceId = document.getElementById('serviceId')?.value.trim() || '';
                        
                        if (!serviceId) {
                            showStatus('pushStatus', 'Service ID is required', true);
                            return;
                        }

                        if (pushStatus) {
                            pushStatus.style.display = 'none';
                        }

                        vscode.postMessage({
                            command: 'pushToService',
                            serviceId
                        });
                    }

                    function connectVpn() {
                        const projectId = document.getElementById('projectId')?.value.trim() || '';
                        
                        if (!projectId) {
                            vscode.window.showErrorMessage('Project ID is required');
                            return;
                        }
                        
                        connectVpnButton.disabled = true;
                        disconnectVpnButton.disabled = true;
                        
                        vscode.postMessage({
                            command: 'vpnUp',
                            projectId,
                            autoDisconnect: false
                        });
                    }

                    function disconnectVpn() {
                        connectVpnButton.disabled = true;
                        disconnectVpnButton.disabled = true;
                        
                        vscode.postMessage({
                            command: 'vpnDown'
                        });
                    }

                    function updateVpnStatusIndicator(status) {
                        if (status === 'connected' || status === 'disconnected') {
                            connectVpnButton.disabled = false;
                            disconnectVpnButton.disabled = false;
                        } else if (status === 'connecting' || status === 'disconnecting') {
                            // Just leave the buttons disabled while in transition states
                        }
                    }

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'pushComplete':
                                showStatus('pushStatus', 'Push completed successfully!', false);
                                break;
                            case 'pushError':
                                showStatus('pushStatus', message.message, true);
                                break;
                            case 'projectSettings':
                                if (message.settings && message.settings.serviceId) {
                                    document.getElementById('serviceId').value = message.settings.serviceId;
                                }
                                if (message.settings && message.settings.projectId) {
                                    document.getElementById('projectId').value = message.settings.projectId;
                                }
                                break;
                            case 'vpnStatus':
                                updateVpnStatusIndicator(message.status);
                                break;
                            case 'vpnConnecting':
                                updateVpnStatusIndicator('connecting');
                                break;
                            case 'vpnDisconnecting':
                                updateVpnStatusIndicator('disconnecting');
                                break;
                            case 'vpnError':
                                updateVpnStatusIndicator('disconnected');
                                connectVpnButton.disabled = false;
                                disconnectVpnButton.disabled = false;
                                break;
                        }
                    });
                </script>
            </body>
            </html>`;
    }
}
exports.ZeropsProvider = ZeropsProvider;
//# sourceMappingURL=zeropsProvider.js.map