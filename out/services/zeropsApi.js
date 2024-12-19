"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeropsApi = void 0;
const node_fetch_1 = require("node-fetch");
const vscode = require("vscode");
class ZeropsError extends Error {
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = 'ZeropsError';
    }
}
class ZeropsClient {
    constructor(token, timeout = 30000) {
        this.baseUrl = 'https://api.app.zerops.io';
        this.timeout = timeout;
        this.headers = {
            'Content-Type': 'application/json',
            'Support-ID': this.generateSupportId()
        };
        if (token) {
            this.setToken(token);
        }
    }
    setToken(token) {
        this.headers = {
            ...this.headers,
            'Authorization': `Bearer ${token}`
        };
    }
    generateSupportId() {
        return Math.random().toString(36).substring(2, 15);
    }
    async doRequest(method, endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        // Create a new headers object
        const headers = new node_fetch_1.Headers(this.headers);
        if (options.contentType) {
            headers.set('Content-Type', options.contentType);
        }
        const requestInit = {
            method,
            headers,
            timeout: this.timeout
        };
        if (options.body) {
            requestInit.body = typeof options.body === 'string'
                ? options.body
                : JSON.stringify(options.body);
        }
        if (options.contentLength) {
            headers.set('Content-Length', options.contentLength.toString());
        }
        const response = await (0, node_fetch_1.default)(url, requestInit);
        const responseBody = await response.text();
        if (!response.ok) {
            throw new ZeropsError(`Request failed: ${response.statusText}`, response.status, responseBody);
        }
        // Only parse as JSON if there's content and it's JSON
        if (responseBody && response.headers.get('content-type')?.includes('application/json')) {
            return JSON.parse(responseBody);
        }
        return responseBody;
    }
    async getUserInfo() {
        return this.doRequest('GET', '/api/rest/user/info');
    }
    async getProjects() {
        const response = await this.doRequest('GET', '/api/rest/project');
        return response.items;
    }
    async getProjectDetails(projectId) {
        return this.doRequest('GET', `/api/rest/project/${projectId}`);
    }
    async validateToken() {
        try {
            await this.getUserInfo();
            return true;
        }
        catch (error) {
            return false;
        }
    }
}
class ZeropsApi {
    static async initialize(context) {
        this.context = context;
        const token = context.globalState.get('zeropsToken');
        if (token) {
            this.client = new ZeropsClient(token);
            try {
                await this.client.validateToken();
            }
            catch (error) {
                // Token is invalid, clear it
                await this.deleteToken();
            }
        }
    }
    static async login(token) {
        if (!token) {
            token = await vscode.window.showInputBox({
                prompt: 'Enter your Zerops API token',
                password: true,
                ignoreFocusOut: true,
                placeHolder: 'Your Zerops API token',
                validateInput: (value) => {
                    return value && value.length > 0 ? null : 'Token is required';
                }
            });
        }
        if (!token?.trim()) {
            throw new Error('Access token is required');
        }
        try {
            this.client = new ZeropsClient(token);
            await this.client.validateToken();
            // Store token if valid
            await this.context?.globalState.update('zeropsToken', token);
            return true;
        }
        catch (error) {
            this.handleError(error);
            return false;
        }
    }
    static async deleteToken() {
        try {
            await this.context?.globalState.update('zeropsToken', undefined);
            this.client = undefined;
            vscode.window.showInformationMessage('Zerops token has been deleted');
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to delete Zerops token');
            console.error('Error deleting token:', error);
        }
    }
    static async logout() {
        await this.deleteToken();
    }
    static async getProjects() {
        if (!this.client) {
            throw new Error('Not authenticated. Please login first.');
        }
        return this.client.getProjects();
    }
    static async getProjectDetails(projectId) {
        if (!this.client) {
            throw new Error('Not authenticated. Please login first.');
        }
        return this.client.getProjectDetails(projectId);
    }
    static async getUserInfo() {
        if (!this.client) {
            throw new Error('Not authenticated. Please login first.');
        }
        return this.client.getUserInfo();
    }
    static async isAuthenticated() {
        if (!this.client) {
            return false;
        }
        try {
            await this.client.validateToken();
            return true;
        }
        catch {
            return false;
        }
    }
    static handleError(error) {
        if (error instanceof ZeropsError) {
            switch (error.status) {
                case 401:
                    throw new Error('Authentication failed. Please login again.');
                case 403:
                    throw new Error('Access denied. Please check your permissions.');
                case 404:
                    throw new Error('Resource not found.');
                case 429:
                    throw new Error('Too many requests. Please try again later.');
                default:
                    throw new Error(`API Error (${error.status}): ${error.message}`);
            }
        }
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('An unexpected error occurred');
    }
}
exports.ZeropsApi = ZeropsApi;
//# sourceMappingURL=zeropsApi.js.map