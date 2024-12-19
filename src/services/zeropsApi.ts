import fetch, { HeadersInit, RequestInit, Headers } from 'node-fetch';
import * as vscode from 'vscode';

interface AuthResponse {
    token: string;
    user: UserInfo;
}

interface UserInfo {
    fullName: string;
    email: string;
}

interface Project {
    id: string;
    name: string;
    description?: string;
}

interface ProjectResponse {
    items: Project[];
}

class ZeropsError extends Error {
    constructor(
        message: string,
        public status: number,
        public body: string
    ) {
        super(message);
        this.name = 'ZeropsError';
    }
}

class ZeropsClient {
    private baseUrl: string = 'https://api.app.zerops.io';
    private headers: HeadersInit;
    private timeout: number;

    constructor(token?: string, timeout: number = 30000) {
        this.timeout = timeout;
        this.headers = {
            'Content-Type': 'application/json',
            'Support-ID': this.generateSupportId()
        };
        if (token) {
            this.setToken(token);
        }
    }

    setToken(token: string) {
        this.headers = {
            ...this.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    private generateSupportId(): string {
        return Math.random().toString(36).substring(2, 15);
    }

    private async doRequest<T>(
        method: string,
        endpoint: string,
        options: {
            body?: any;
            contentType?: string;
            contentLength?: number;
        } = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        
        // Create a new headers object
        const headers = new Headers(this.headers);

        if (options.contentType) {
            headers.set('Content-Type', options.contentType);
        }

        const requestInit: RequestInit = {
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

        const response = await fetch(url, requestInit);
        const responseBody = await response.text();

        if (!response.ok) {
            throw new ZeropsError(
                `Request failed: ${response.statusText}`,
                response.status,
                responseBody
            );
        }

        // Only parse as JSON if there's content and it's JSON
        if (responseBody && response.headers.get('content-type')?.includes('application/json')) {
            return JSON.parse(responseBody);
        }

        return responseBody as T;
    }

    async getUserInfo(): Promise<UserInfo> {
        return this.doRequest<UserInfo>('GET', '/api/rest/user/info');
    }

    async getProjects(): Promise<Project[]> {
        const response = await this.doRequest<ProjectResponse>('GET', '/api/rest/project');
        return response.items;
    }

    async getProjectDetails(projectId: string): Promise<Project> {
        return this.doRequest<Project>('GET', `/api/rest/project/${projectId}`);
    }

    async validateToken(): Promise<boolean> {
        try {
            await this.getUserInfo();
            return true;
        } catch (error) {
            return false;
        }
    }
}

export class ZeropsApi {
    private static client?: ZeropsClient;
    private static context?: vscode.ExtensionContext;

    static async initialize(context: vscode.ExtensionContext) {
        this.context = context;
        const token = context.globalState.get<string>('zeropsToken');
        if (token) {
            this.client = new ZeropsClient(token);
            try {
                await this.client.validateToken();
            } catch (error) {
                // Token is invalid, clear it
                await this.deleteToken();
            }
        }
    }

    static async login(token?: string): Promise<boolean> {
        if (!token) {
            token = await vscode.window.showInputBox({
                prompt: 'Enter your Zerops API token',
                password: true,
                ignoreFocusOut: true,
                placeHolder: 'Your Zerops API token',
                validateInput: (value: string) => {
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
        } catch (error) {
            this.handleError(error);
            return false;
        }
    }

    static async deleteToken(): Promise<void> {
        try {
            await this.context?.globalState.update('zeropsToken', undefined);
            this.client = undefined;
            vscode.window.showInformationMessage('Zerops token has been deleted');
        } catch (error) {
            vscode.window.showErrorMessage('Failed to delete Zerops token');
            console.error('Error deleting token:', error);
        }
    }

    static async logout(): Promise<void> {
        await this.deleteToken();
    }

    static async getProjects(): Promise<Project[]> {
        if (!this.client) {
            throw new Error('Not authenticated. Please login first.');
        }
        return this.client.getProjects();
    }

    static async getProjectDetails(projectId: string): Promise<Project> {
        if (!this.client) {
            throw new Error('Not authenticated. Please login first.');
        }
        return this.client.getProjectDetails(projectId);
    }

    static async getUserInfo(): Promise<UserInfo> {
        if (!this.client) {
            throw new Error('Not authenticated. Please login first.');
        }
        return this.client.getUserInfo();
    }

    static async isAuthenticated(): Promise<boolean> {
        if (!this.client) {
            return false;
        }
        try {
            await this.client.validateToken();
            return true;
        } catch {
            return false;
        }
    }

    private static handleError(error: unknown): never {
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