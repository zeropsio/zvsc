import * as vscode from 'vscode';
import * as https from 'https';
import { URL } from 'url';
import { Agent } from 'http';

interface AuthResponse {
    token: string;
    user: UserInfo;
}

interface Avatar {
    largeAvatarUrl: string | null;
    smallAvatarUrl: string | null;
    externalAvatarUrl: string | null;
}

interface Language {
    id: string;
    name: string;
}

interface BillingInfo {
    vatNumber: string | null;
    companyNumber: string | null;
    companyName: string;
    invoiceAddressStreet: string;
    invoiceAddressCity: string;
    invoiceAddressPostcode: string;
    invoiceAddressCountryId: string;
    vatCountryId: string;
    vatMode: string;
    vatRate: number;
    vatVerified: boolean;
}

interface Client {
    id: string;
    accountName: string;
    avatar: Avatar | null;
    billingInfo: BillingInfo;
    paymentProviderClientId: string;
    verifiedByTopUp: boolean;
    verifiedManually: boolean;
}

interface ClientUser {
    id: string;
    clientId: string;
    userId: string;
    status: string;
    roleCode: string;
    client: Client;
    user: UserInfo;
}

interface UserInfo {
    id: string;
    email: string;
    fullName: string;
    firstName: string;
    lastName: string;
    avatar: Avatar;
    countryCallingCode: string | null;
    phoneNumber: string | null;
    language?: Language;
    created?: string;
    lastUpdate?: string;
    status?: string;
    clientUserList?: ClientUser[];
    passwordIsSet?: boolean;
    intercomHash?: string;
}

interface Project {
    id: string;
    name: string;
    description?: string;
}

interface ProjectResponse {
    items: Project[];
}

interface Region {
    name: string;
    address: string;
    isDefault: boolean;
}

interface Config {
    endpoint: string;
    timeout?: number;
    maxRetries?: number;
    region?: Region;
}

interface NetworkError extends Error {
    code?: string;
    errno?: number;
    syscall?: string;
}

type ConfigOption = (config: Config) => void;

function withCustomEndpoint(endpoint: string): ConfigOption {
    return (config: Config) => {
        config.endpoint = endpoint;
    };
}

function withTimeout(timeout: number): ConfigOption {
    return (config: Config) => {
        config.timeout = timeout;
    };
}

function withMaxRetries(maxRetries: number): ConfigOption {
    return (config: Config) => {
        config.maxRetries = maxRetries;
    };
}

function defaultConfig(...options: ConfigOption[]): Config {
    const config: Config = {
        endpoint: 'https://api.app-prg1.zerops.io',  // Base URL
        timeout: 30000,
        maxRetries: 2
    };
    
    options.forEach(option => option(config));
    return config;
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

async function makeRequest<T>(url: string, options: https.RequestOptions, data?: any): Promise<T> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions: https.RequestOptions = {
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
                    return makeRequest<T>(redirectUrl, options, data)
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
                    } catch (e) {
                        resolve(data as T);
                    }
                } else {
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
    private config: Config;
    private headers: { [key: string]: string };
    private token?: string;

    constructor(token?: string, ...options: ConfigOption[]) {
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

    private getApiUrl(): string {
        return `${this.config.endpoint}/api/rest/public`;  // Added /public to match working URL
    }

    private async doRequest<T>(
        method: string,
        endpoint: string,
        options: {
            body?: any;
        } = {}
    ): Promise<T> {
        if (!this.token) {
            throw new Error('API token is required for this operation');
        }

        const url = `${this.getApiUrl()}/${endpoint.replace(/^\/+/, '')}`;
        
        const requestOptions: https.RequestOptions = {
            method,
            headers: this.headers
        };

        try {
            return await makeRequest<T>(url, requestOptions, options.body);
        } catch (error) {
            console.error('Request failed:', error);
            throw error;
        }
    }

    async getUserInfo(): Promise<UserInfo> {
        return this.doRequest<UserInfo>('GET', 'user/info');
    }

    async getProjects(): Promise<Project[]> {
        return this.doRequest<ProjectResponse>('GET', 'project')
            .then(response => response.items);
    }

    async getProjectDetails(projectId: string): Promise<Project> {
        return this.doRequest<Project>('GET', `project/${projectId}`);
    }

    setToken(token: string) {
        this.token = token;
        this.headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    hasToken(): boolean {
        return !!this.token;
    }

    async login(): Promise<boolean> {
        if (!this.token) {
            throw new Error('Token is required for login');
        }

        try {
            const userInfo = await this.getUserInfo();
            return !!userInfo;
        } catch (error) {
            console.error('Login validation failed:', error);
            return false;
        }
    }
}

export class ZeropsApi {
    private static client?: ZeropsClient;
    private static context?: vscode.ExtensionContext;
    private static config: Config;
    private static publicApiEndpoint = 'https://api.app-prg1.zerops.io/api/rest/public';

    static async initialize(context: vscode.ExtensionContext, ...options: ConfigOption[]) {
        this.context = context;
        this.config = defaultConfig(...options);
        
        // Initialize the client if we have a stored token
        const token = context.globalState.get<string>('zeropsToken');
        if (token) {
            this.client = new ZeropsClient(token, ...options);
        }
    }

    static async isAuthenticated(): Promise<boolean> {
        return !!this.client?.hasToken();
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

        // Create client with default region first
        this.client = new ZeropsClient(token, 
            withCustomEndpoint(this.config.endpoint)
        );

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
        
        vscode.window.showInformationMessage(
            `Login successful! Welcome ${userInfo.fullName} (${userInfo.email})`
        );
        
        return true;
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

    // New methods for public API
    static async getPublicApiStatus(): Promise<any> {
        const url = `${this.publicApiEndpoint}/status`;
        return await makeRequest(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
    }

    static async getPublicApiVersion(): Promise<any> {
        const url = `${this.publicApiEndpoint}/version`;
        return await makeRequest(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
    }

    // Add more public API methods as needed based on the Swagger documentation
    static async getPublicApiHealth(): Promise<any> {
        const url = `${this.publicApiEndpoint}/health`;
        return await makeRequest(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
    }
} 