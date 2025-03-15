"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeropsApi = void 0;
const vscode = require("vscode");
const https = require("https");
const url_1 = require("url");
function withCustomEndpoint(endpoint) {
    return (config) => {
        config.endpoint = endpoint;
    };
}
function withTimeout(timeout) {
    return (config) => {
        config.timeout = timeout;
    };
}
function withMaxRetries(maxRetries) {
    return (config) => {
        config.maxRetries = maxRetries;
    };
}
function defaultConfig(...options) {
    const config = {
        endpoint: 'https://api.app-prg1.zerops.io',
        timeout: 30000,
        maxRetries: 2
    };
    options.forEach(option => option(config));
    return config;
}
class ZeropsError extends Error {
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = 'ZeropsError';
    }
}
async function makeRequest(url, options, data) {
    return new Promise((resolve, reject) => {
        const urlObj = new url_1.URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            port: 443,
            method: options.method || 'GET',
            headers: options.headers
        };
        console.log('Making request to:', url);
        console.log('Request options:', requestOptions);
        const req = https.request(requestOptions, res => {
            let data = '';
            // Handle redirects like in the fetch example
            if (res.statusCode === 301) {
                console.error('Redirected URL:', res.headers.location);
                const redirectUrl = res.headers.location;
                if (redirectUrl) {
                    return makeRequest(redirectUrl, options, data)
                        .then(resolve)
                        .catch(reject);
                }
            }
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                console.log('Response status:', res.statusCode);
                console.log('Response headers:', res.headers);
                console.log('Response data:', data);
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(data ? JSON.parse(data) : undefined);
                    }
                    catch (e) {
                        resolve(data);
                    }
                }
                else {
                    reject(new Error(`HTTP Error: ${res.statusCode} - ${data}`));
                }
            });
        });
        req.on('error', error => {
            console.error('Request error:', error);
            reject(error);
        });
        if (data) {
            const body = typeof data === 'string' ? data : JSON.stringify(data);
            req.write(body);
        }
        req.end();
    });
}
class ZeropsClient {
    constructor(token, ...options) {
        this.config = defaultConfig(...options);
        this.token = token;
        // Match headers exactly with working example
        this.headers = {
            'Accept': 'application/json, text/plain, */*'
        };
        if (token) {
            this.setToken(token);
        }
    }
    getApiUrl() {
        return `${this.config.endpoint}/api/rest/public`; // Added /public to match working URL
    }
    async doRequest(method, endpoint, options = {}) {
        if (!this.token) {
            throw new Error('API token is required for this operation');
        }
        const url = `${this.getApiUrl()}/${endpoint.replace(/^\/+/, '')}`;
        const requestOptions = {
            method,
            headers: this.headers
        };
        try {
            return await makeRequest(url, requestOptions, options.body);
        }
        catch (error) {
            console.error('Request failed:', error);
            throw error;
        }
    }
    async getUserInfo() {
        return this.doRequest('GET', 'user/info');
    }
    async getProjects() {
        return this.doRequest('GET', 'project')
            .then(response => response.items);
    }
    async getProjectDetails(projectId) {
        return this.doRequest('GET', `project/${projectId}`);
    }
    setToken(token) {
        this.token = token;
        this.headers['Authorization'] = `Bearer ${token.trim()}`;
    }
    hasToken() {
        return !!this.token;
    }
    async login() {
        if (!this.token) {
            throw new Error('Token is required for login');
        }
        try {
            const userInfo = await this.getUserInfo();
            return !!userInfo;
        }
        catch (error) {
            console.error('Login validation failed:', error);
            return false;
        }
    }
}
class ZeropsApi {
    static async initialize(context, ...options) {
        this.context = context;
        this.config = defaultConfig(...options);
        // Initialize the client if we have a stored token
        const token = context.globalState.get('zeropsToken');
        if (token) {
            this.client = new ZeropsClient(token, ...options);
        }
    }
    static async isAuthenticated() {
        return !!this.client?.hasToken();
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
        // Create client with default region first
        this.client = new ZeropsClient(token, withCustomEndpoint(this.config.endpoint));
        // First try to login
        const loginSuccess = await this.client.login();
        if (!loginSuccess) {
            throw new Error('Login failed');
        }
        // Then get user info
        const userInfo = await this.client.getUserInfo();
        // Store token and user info
        await this.context?.globalState.update('zeropsToken', token);
        await this.context?.globalState.update('zeropsUserInfo', userInfo);
        vscode.window.showInformationMessage(`Login successful! Welcome ${userInfo.fullName} (${userInfo.email})`);
        return true;
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
    // New methods for public API
    static async getPublicApiStatus() {
        const url = `${this.publicApiEndpoint}/status`;
        return await makeRequest(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
    }
    static async getPublicApiVersion() {
        const url = `${this.publicApiEndpoint}/version`;
        return await makeRequest(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
    }
    // Add more public API methods as needed based on the Swagger documentation
    static async getPublicApiHealth() {
        const url = `${this.publicApiEndpoint}/health`;
        return await makeRequest(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
    }
}
exports.ZeropsApi = ZeropsApi;
ZeropsApi.publicApiEndpoint = 'https://api.app-prg1.zerops.io/api/rest/public';
//# sourceMappingURL=zeropsApi.js.map