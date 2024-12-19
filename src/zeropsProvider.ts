import * as vscode from 'vscode';
import { ZeropsApi } from './services/zeropsApi';

export class ZeropsProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        this.initialize();
    }

    dispose() {
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private async initialize() {
        try {
            // Just check if we have a stored token
            const isAuthenticated = await ZeropsApi.isAuthenticated();
            
            if (this._view) {
                // Immediately update UI state
                this._view.webview.postMessage({
                    type: 'initializeState',
                    isAuthenticated
                });

                // If authenticated, fetch user info and projects in parallel
                if (isAuthenticated) {
                    Promise.all([
                        ZeropsApi.getUserInfo(),
                        ZeropsApi.getProjects()
                    ]).then(([userInfo, projects]) => {
                        // Send both updates at once
                        this._view?.webview.postMessage({
                            type: 'initialData',
                            userInfo,
                            projects
                        });
                    }).catch(error => {
                        console.error('Failed to fetch initial data:', error);
                    });
                }
            }
        } catch (error) {
            console.error('Failed to initialize:', error);
        }
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        const messageHandler = webviewView.webview.onDidReceiveMessage(async (data) => {
            try {
                await this.handleMessage(data, webviewView);
            } catch (error) {
                this.handleError(error, webviewView);
            }
        });

        this._disposables.push(messageHandler);
    }

    private registerMessageHandlers(webviewView: vscode.WebviewView) {
        webviewView.webview.onDidReceiveMessage(async (data) => {
            try {
                await this.handleMessage(data, webviewView);
            } catch (error) {
                this.handleError(error, webviewView);
            }
        });
    }

    private async handleMessage(data: any, webviewView: vscode.WebviewView) {
        switch (data.type) {
            case 'login':
                await this.handleLogin(data.token, webviewView);
                break;

            case 'getProjects':
                await this.handleGetProjects(webviewView);
                break;

            case 'getProjectDetails':
                await this.handleGetProjectDetails(data.projectId, webviewView);
                break;

            case 'editMode':
                webviewView.webview.postMessage({ type: 'showEditMode' });
                break;

            case 'deleteToken':
                await ZeropsApi.deleteToken();
                webviewView.webview.postMessage({
                    type: 'tokenDeleted'
                });
                break;

            default:
                console.warn('Unknown message type:', data.type);
        }
    }

    private async handleLogin(token: string, webviewView: vscode.WebviewView) {
        const success = await ZeropsApi.login(token);
        if (success) {
            const userInfo = await ZeropsApi.getUserInfo();
            webviewView.webview.postMessage({ 
                type: 'loginResult', 
                success,
                userInfo,
                message: 'Login successful!'
            });

            const projects = await ZeropsApi.getProjects();
            webviewView.webview.postMessage({
                type: 'projectsLoaded',
                projects
            });
        } else {
            webviewView.webview.postMessage({ 
                type: 'loginResult', 
                success,
                message: 'Login failed. Please check your token.'
            });
        }
    }

    private async handleGetProjects(webviewView: vscode.WebviewView) {
        const projects = await ZeropsApi.getProjects();
        webviewView.webview.postMessage({
            type: 'projectsLoaded',
            projects
        });
    }

    private async handleGetProjectDetails(projectId: string, webviewView: vscode.WebviewView) {
        const projectDetails = await ZeropsApi.getProjectDetails(projectId);
        webviewView.webview.postMessage({
            type: 'projectDetailsLoaded',
            project: projectDetails
        });
    }

    private handleError(error: unknown, webviewView: vscode.WebviewView) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        console.error('Zerops provider error:', error);
        
        webviewView.webview.postMessage({
            type: 'error',
            message: errorMessage
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return /*html*/`<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
                <title>Zerops</title>
                <style>
                    .container { padding: 20px; }
                    .input-group { margin-bottom: 10px; }
                    input { width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ccc; border-radius: 4px; }
                    .button-group { display: flex; gap: 10px; margin-top: 10px; }
                    button { 
                        padding: 8px 16px;
                        cursor: pointer;
                        border: none;
                        border-radius: 4px;
                        font-weight: 500;
                    }
                    .primary-button {
                        background-color: #0098ff;
                        color: white;
                    }
                    .secondary-button {
                        background-color: #f0f0f0;
                        color: #333;
                    }
                    button:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                    .message { margin-top: 10px; padding: 8px; border-radius: 4px; }
                    .error { color: #f44336; background: #ffebee; }
                    .success { color: #4caf50; background: #e8f5e9; }
                    .loading { color: #2196f3; background: #e3f2fd; }
                    #loginForm { display: none; }
                    #tokenDisplay { display: none; }
                    .token-display {
                        margin: 20px 0;
                        padding: 10px;
                        background: #f5f5f5;
                        border-radius: 4px;
                    }
                    .project-item {
                        padding: 10px;
                        margin: 10px 0;
                        border: 1px solid #ccc;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    .project-item:hover {
                        background-color: #f5f5f5;
                    }
                    .project-item h4 {
                        margin: 0 0 5px 0;
                    }
                    .project-item p {
                        margin: 0;
                        font-size: 0.9em;
                        color: #666;
                    }
                    .danger-button {
                        background-color: #dc3545;
                        color: white;
                    }
                    .danger-button:hover {
                        background-color: #c82333;
                    }
                    .button-group {
                        display: flex;
                        gap: 8px;
                    }
                    .user-info {
                        margin-bottom: 10px;
                        padding: 10px;
                        background: #f8f9fa;
                        border-radius: 4px;
                    }
                    .user-info p {
                        margin: 4px 0;
                    }
                    .user-email {
                        color: #666;
                        font-size: 0.9em;
                    }
                    #loadingIndicator {
                        text-align: center;
                        padding: 20px;
                    }
                    .loading {
                        color: #0098ff;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div id="loadingIndicator">
                        <p class="loading">Initializing Zerops...</p>
                    </div>

                    <div id="loginForm">
                        <div class="input-group">
                            <label>Access Token:</label>
                            <input type="password" id="tokenInput" placeholder="Enter your Zerops access token">
                        </div>
                        <div class="button-group">
                            <button id="loginButton" class="primary-button">Login</button>
                            <button id="cancelButton" class="secondary-button">Cancel</button>
                        </div>
                    </div>

                    <div id="tokenDisplay" style="display: none;">
                        <div class="token-display">
                            <div id="userInfo">
                                <p>Not logged in</p>
                            </div>
                        </div>
                        <div class="button-group">
                            <button id="editButton" class="secondary-button">Edit Token</button>
                            <button id="deleteButton" class="danger-button">Delete Token</button>
                        </div>
                    </div>

                    <div id="message" class="message"></div>

                    <div id="projectsList" style="display: none;">
                        <h3>Your Projects</h3>
                        <div id="projectsContainer"></div>
                    </div>
                </div>

                <script>
                    (function() {
                        const vscode = acquireVsCodeApi();
                        const loadingIndicator = document.getElementById('loadingIndicator');
                        const tokenInput = document.getElementById('tokenInput');
                        const loginForm = document.getElementById('loginForm');
                        const tokenDisplay = document.getElementById('tokenDisplay');
                        const loginButton = document.getElementById('loginButton');
                        const editButton = document.getElementById('editButton');
                        const cancelButton = document.getElementById('cancelButton');
                        const deleteButton = document.getElementById('deleteButton');
                        const messageDiv = document.getElementById('message');
                        const projectsList = document.getElementById('projectsList');
                        const projectsContainer = document.getElementById('projectsContainer');

                        // Initialize all forms as hidden
                        loginForm.style.display = 'none';
                        tokenDisplay.style.display = 'none';
                        projectsList.style.display = 'none';
                        messageDiv.style.display = 'none';

                        function updateDisplay(hasToken) {
                            loadingIndicator.style.display = 'none';
                            loginForm.style.display = hasToken ? 'none' : 'block';
                            tokenDisplay.style.display = hasToken ? 'block' : 'none';
                            messageDiv.style.display = 'block';
                        }

                        function handleLogin() {
                            const token = tokenInput.value;
                            if (!token) {
                                messageDiv.textContent = 'Please enter an access token';
                                messageDiv.className = 'message error';
                                return;
                            }

                            loginButton.disabled = true;
                            messageDiv.textContent = 'Connecting to Zerops...';
                            messageDiv.className = 'message loading';

                            vscode.postMessage({ type: 'login', token });
                        }

                        function handleProjectClick(projectId) {
                            vscode.postMessage({ type: 'getProjectDetails', projectId });
                        }

                        function renderProjects(projectsList) {
                            projects = projectsList;
                            projectsContainer.innerHTML = projects.map(project => 
                                \`<div class="project-item" onclick="handleProjectClick('\${project.id}')">
                                    <h4>\${project.name}</h4>
                                    <p>\${project.description || ''}</p>
                                </div>\`
                            ).join('');
                            document.getElementById('projectsList').style.display = 'block';
                        }

                        // Event Listeners
                        loginButton.addEventListener('click', handleLogin);

                        editButton.addEventListener('click', () => {
                            updateDisplay(false);
                            messageDiv.textContent = '';
                        });

                        cancelButton.addEventListener('click', () => {
                            updateDisplay(true);
                            tokenInput.value = '';
                            messageDiv.textContent = '';
                        });

                        deleteButton.addEventListener('click', () => {
                            const confirmDelete = confirm('Are you sure you want to delete your token? This cannot be undone.');
                            if (confirmDelete) {
                                vscode.postMessage({ type: 'deleteToken' });
                            }
                        });

                        // Message Handler
                        window.addEventListener('message', event => {
                            const message = event.data;
                            switch (message.type) {
                                case 'initializeState':
                                    loadingIndicator.style.display = 'none';
                                    updateDisplay(message.isAuthenticated);
                                    break;

                                case 'initialData':
                                    updateUserInfo(message.userInfo);
                                    renderProjects(message.projects);
                                    break;

                                case 'loginResult':
                                    loginButton.disabled = false;
                                    messageDiv.textContent = message.message;
                                    messageDiv.className = 'message ' + (message.success ? 'success' : 'error');
                                    
                                    if (message.success) {
                                        tokenInput.value = '';
                                        updateDisplay(true);
                                        updateUserInfo(message.userInfo);
                                    }
                                    break;
                                case 'error':
                                    messageDiv.textContent = message.message;
                                    messageDiv.className = 'message error';
                                    break;
                                case 'tokenDeleted':
                                    messageDiv.textContent = 'Token has been deleted';
                                    messageDiv.className = 'message success';
                                    updateDisplay(false);
                                    updateUserInfo(null);
                                    break;
                            }
                        });

                        function updateUserInfo(userInfo) {
                            const userInfoDiv = document.getElementById('userInfo');
                            if (userInfo) {
                                userInfoDiv.innerHTML = \`
                                    <div class="user-info">
                                        <p><strong>\${userInfo.fullName}</strong></p>
                                        <p class="user-email">\${userInfo.email}</p>
                                    </div>
                                \`;
                            } else {
                                userInfoDiv.innerHTML = '<p>Not logged in</p>';
                            }
                        }
                    })();
                </script>
            </body>
            </html>`;
    }
} 