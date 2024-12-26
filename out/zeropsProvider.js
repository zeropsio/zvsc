"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeropsProvider = void 0;
const zeropsApi_1 = require("./services/zeropsApi");
class ZeropsProvider {
    constructor(_extensionUri, _context) {
        this._extensionUri = _extensionUri;
        this._context = _context;
        this._disposables = [];
        // Remove initialization from constructor
    }
    dispose() {
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    async initialize() {
        if (!this._view) {
            console.log('View not ready, skipping initialization');
            return;
        }
        try {
            console.log('Initializing Zerops provider...');
            // Update UI to loading state first
            this._view.webview.postMessage({
                type: 'loading',
                message: 'Checking authentication status...'
            });
            // Check authentication status
            const isAuthenticated = await zeropsApi_1.ZeropsApi.isAuthenticated();
            console.log('Authentication status:', isAuthenticated);
            // Update UI with authentication state
            this._view.webview.postMessage({
                type: 'initializeState',
                isAuthenticated
            });
            // If authenticated, fetch user info and projects
            if (isAuthenticated) {
                this._view.webview.postMessage({
                    type: 'loading',
                    message: 'Loading your data...'
                });
                try {
                    const [userInfo, projects] = await Promise.all([
                        zeropsApi_1.ZeropsApi.getUserInfo(),
                        zeropsApi_1.ZeropsApi.getProjects()
                    ]);
                    console.log('Initial data fetched successfully');
                    this._view.webview.postMessage({
                        type: 'initialData',
                        userInfo,
                        projects
                    });
                }
                catch (error) {
                    console.error('Failed to fetch initial data:', error);
                    this._view.webview.postMessage({
                        type: 'error',
                        message: 'Failed to load initial data. Please try logging in again.'
                    });
                }
            }
            else {
                // Not authenticated, show login form
                this._view.webview.postMessage({
                    type: 'showLogin'
                });
            }
        }
        catch (error) {
            console.error('Failed to initialize:', error);
            this._view.webview.postMessage({
                type: 'error',
                message: 'Failed to initialize Zerops extension. Please try again.'
            });
        }
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Initialize after webview is ready
        this.initialize();
        const messageHandler = webviewView.webview.onDidReceiveMessage(async (data) => {
            try {
                await this.handleMessage(data, webviewView);
            }
            catch (error) {
                this.handleError(error, webviewView);
            }
        });
        this._disposables.push(messageHandler);
    }
    registerMessageHandlers(webviewView) {
        webviewView.webview.onDidReceiveMessage(async (data) => {
            try {
                await this.handleMessage(data, webviewView);
            }
            catch (error) {
                this.handleError(error, webviewView);
            }
        });
    }
    async handleMessage(data, webviewView) {
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
                await zeropsApi_1.ZeropsApi.deleteToken();
                webviewView.webview.postMessage({
                    type: 'tokenDeleted'
                });
                break;
            default:
                console.warn('Unknown message type:', data.type);
        }
    }
    async handleLogin(token, webviewView) {
        try {
            webviewView.webview.postMessage({
                type: 'loading',
                message: 'Logging in...'
            });
            const success = await zeropsApi_1.ZeropsApi.login(token);
            if (success) {
                const userInfo = await zeropsApi_1.ZeropsApi.getUserInfo();
                webviewView.webview.postMessage({
                    type: 'loginResult',
                    success,
                    userInfo,
                    message: 'Login successful!'
                });
                webviewView.webview.postMessage({
                    type: 'loading',
                    message: 'Loading your projects...'
                });
                const projects = await zeropsApi_1.ZeropsApi.getProjects();
                webviewView.webview.postMessage({
                    type: 'projectsLoaded',
                    projects
                });
            }
            else {
                webviewView.webview.postMessage({
                    type: 'loginResult',
                    success,
                    message: 'Login failed. Please check your token.'
                });
            }
        }
        catch (error) {
            console.error('Login error:', error);
            webviewView.webview.postMessage({
                type: 'error',
                message: error instanceof Error ? error.message : 'Login failed. Please try again.'
            });
        }
    }
    async handleGetProjects(webviewView) {
        const projects = await zeropsApi_1.ZeropsApi.getProjects();
        webviewView.webview.postMessage({
            type: 'projectsLoaded',
            projects
        });
    }
    async handleGetProjectDetails(projectId, webviewView) {
        const projectDetails = await zeropsApi_1.ZeropsApi.getProjectDetails(projectId);
        webviewView.webview.postMessage({
            type: 'projectDetailsLoaded',
            project: projectDetails
        });
    }
    handleError(error, webviewView) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        console.error('Zerops provider error:', error);
        webviewView.webview.postMessage({
            type: 'error',
            message: errorMessage
        });
    }
    _getHtmlForWebview(webview) {
        return /*html*/ `<!DOCTYPE html>
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
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                    }
                    .loading-spinner {
                        width: 20px;
                        height: 20px;
                        border: 2px solid #f3f3f3;
                        border-top: 2px solid #0098ff;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div id="loadingIndicator">
                        <div class="loading-spinner"></div>
                        <p class="loading">Initializing Zerops...</p>
                    </div>

                    <div id="loginForm" style="display: none;">
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

                    <div id="message" class="message" style="display: none;"></div>

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

                        function showLoading(message = 'Loading...') {
                            loadingIndicator.style.display = 'flex';
                            loadingIndicator.querySelector('p').textContent = message;
                            loginForm.style.display = 'none';
                            tokenDisplay.style.display = 'none';
                            projectsList.style.display = 'none';
                            messageDiv.style.display = 'none';
                        }

                        function hideLoading() {
                            loadingIndicator.style.display = 'none';
                        }

                        function updateDisplay(hasToken) {
                            hideLoading();
                            loginForm.style.display = hasToken ? 'none' : 'block';
                            tokenDisplay.style.display = hasToken ? 'block' : 'none';
                            messageDiv.style.display = 'none';
                        }

                        function showMessage(text, type = 'info') {
                            messageDiv.textContent = text;
                            messageDiv.className = \`message \${type}\`;
                            messageDiv.style.display = 'block';
                        }

                        function handleLogin() {
                            const token = tokenInput.value;
                            if (!token) {
                                showMessage('Please enter an access token', 'error');
                                return;
                            }

                            loginButton.disabled = true;
                            showLoading('Connecting to Zerops...');
                            vscode.postMessage({ type: 'login', token });
                        }

                        function handleProjectClick(projectId) {
                            showLoading('Loading project details...');
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
                            projectsList.style.display = 'block';
                        }

                        // Event Listeners
                        loginButton.addEventListener('click', handleLogin);

                        editButton.addEventListener('click', () => {
                            updateDisplay(false);
                            messageDiv.style.display = 'none';
                        });

                        cancelButton.addEventListener('click', () => {
                            updateDisplay(true);
                            tokenInput.value = '';
                            messageDiv.style.display = 'none';
                        });

                        deleteButton.addEventListener('click', () => {
                            const confirmDelete = confirm('Are you sure you want to delete your token? This cannot be undone.');
                            if (confirmDelete) {
                                showLoading('Deleting token...');
                                vscode.postMessage({ type: 'deleteToken' });
                            }
                        });

                        // Message Handler
                        window.addEventListener('message', event => {
                            const message = event.data;
                            switch (message.type) {
                                case 'initializeState':
                                    updateDisplay(message.isAuthenticated);
                                    if (!message.isAuthenticated) {
                                        showMessage('Please log in to continue', 'info');
                                    }
                                    break;

                                case 'initialData':
                                    hideLoading();
                                    updateUserInfo(message.userInfo);
                                    renderProjects(message.projects);
                                    break;

                                case 'loginResult':
                                    loginButton.disabled = false;
                                    hideLoading();
                                    showMessage(message.message, message.success ? 'success' : 'error');
                                    
                                    if (message.success) {
                                        tokenInput.value = '';
                                        updateDisplay(true);
                                        updateUserInfo(message.userInfo);
                                    }
                                    break;

                                case 'error':
                                    hideLoading();
                                    showMessage(message.message, 'error');
                                    break;

                                case 'tokenDeleted':
                                    hideLoading();
                                    showMessage('Token has been deleted', 'success');
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
exports.ZeropsProvider = ZeropsProvider;
//# sourceMappingURL=zeropsProvider.js.map