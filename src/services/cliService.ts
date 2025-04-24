import * as vscode from 'vscode';
import { exec } from 'child_process';
import { spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface ProjectSettings {
    serviceId?: string;
    projectId?: string;
}

export class CliService {
    private static outputChannel: vscode.OutputChannel;
    private static currentPushProcess: ReturnType<typeof spawn> | null = null;
    private static zeropsTerminal: vscode.Terminal | null = null;
    private static isLoggedIn: boolean = false;
    private static projectsCache: {id: string, name: string}[] | null = null;

    private static getOutputChannel(): vscode.OutputChannel {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('Zerops');
        }
        return this.outputChannel;
    }

    private static async executeCommand(command: string, options?: { cwd?: string, appendToOutput?: boolean }): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            exec(`zcli ${command}`, options, (error, stdout, stderr) => {
                if (options?.appendToOutput) {
                    const outputChannel = this.getOutputChannel();
                    if (stdout) {
                        outputChannel.append(stdout.toString());
                    }
                    if (stderr) {
                        outputChannel.append(stderr.toString());
                    }
                }
                
                if (error) {
                    reject(error);
                } else {
                    resolve({
                        stdout: stdout.toString(),
                        stderr: stderr.toString()
                    });
                }
            });
        });
    }

    private static spawnCommand(args: string[], cwd: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const outputChannel = this.getOutputChannel();
            outputChannel.show();
            outputChannel.appendLine(`Executing: zcli ${args.join(' ')}`);

            const child = spawn('zcli', args, { cwd });
            this.currentPushProcess = child;

            child.stdout.on('data', (data) => {
                outputChannel.append(data.toString());
            });

            child.stderr.on('data', (data) => {
                outputChannel.append(data.toString());
            });

            child.on('error', (error) => {
                this.currentPushProcess = null;
                outputChannel.appendLine(`Error: ${error.message}`);
                reject(error);
            });

            child.on('close', (code) => {
                this.currentPushProcess = null;
                if (code === 0) {
                    resolve();
                } else if (code === null) {
                    reject(new Error('Command was cancelled'));
                } else {
                    reject(new Error(`Command failed with exit code ${code}`));
                }
            });
        });
    }

    static async saveProjectSettings(settings: ProjectSettings): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found. Please open a folder in VS Code.');
        }

        const vscodePath = path.join(workspaceRoot, '.vscode');
        if (!fs.existsSync(vscodePath)) {
            fs.mkdirSync(vscodePath, { recursive: true });
        }

        const settingsPath = path.join(vscodePath, 'zerops.json');
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }

    static async loadProjectSettings(): Promise<ProjectSettings> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return {};
        }

        const settingsPath = path.join(workspaceRoot, '.vscode', 'zerops.json');
        
        try {
            if (fs.existsSync(settingsPath)) {
                const content = fs.readFileSync(settingsPath, 'utf-8');
                return JSON.parse(content) as ProjectSettings;
            }
        } catch (error) {
            console.error('Failed to load project settings:', error);
        }
        
        return {};
    }

    static async checkCliInstalled(): Promise<boolean> {
        try {
            const { stdout } = await this.executeCommand('version');
            console.log('zcli version:', stdout);
            return true;
        } catch (error) {
            console.error('Failed to verify zcli installation:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`zcli verification failed: ${errorMessage}. Make sure zcli is installed and in your PATH.`);
            return false;
        }
    }

    static async checkLoginStatus(): Promise<boolean> {
        try {
            const { stdout, stderr } = await this.executeCommand('', { appendToOutput: false });
            const output = stdout + stderr;
            
            if (output.includes('Welcome in Zerops!')) {
                console.log('User is logged in to Zerops (detected from welcome message)');
                this.updateLoginStatus(true);
                return true;
            }
            
            try {
                const { stdout: userStdout, stderr: userStderr } = await this.executeCommand('user', { appendToOutput: false });
                const userOutput = userStdout + userStderr;
                
                if (userOutput.includes('not logged in') || userOutput.includes('login first') || userOutput.includes('unauthorized')) {
                    this.updateLoginStatus(false);
                    return false;
                }
                
                if (userOutput.includes('@') || userOutput.includes('email') || userOutput.includes('user')) {
                    console.log('User is logged in to Zerops (detected from user info)');
                    this.updateLoginStatus(true);
                    return true;
                }
            } catch (error) {
            }
            
            this.updateLoginStatus(false);
            return false;
        } catch (error) {
            console.error('Failed to check login status:', error);
            this.updateLoginStatus(false);
            return false;
        }
    }
    
    static getLoginStatus(): boolean {
        return this.isLoggedIn;
    }

    static async login(token: string, context?: vscode.ExtensionContext): Promise<void> {
        try {
            console.log('Logging in to Zerops...');
            
            const { stdout, stderr } = await this.executeCommand(`login ${token}`, { appendToOutput: false });
            
            if (stderr && (stderr.includes('error') || stderr.includes('Error'))) {
                throw new Error(`Login failed: ${stderr}`);
            }
            
            const success = stdout.includes('Success') || !stderr.includes('error');
            
            if (success) {
                console.log('Login successful');
                
                if (context) {
                    await context.secrets.store('zerops-token', token);
                }
                
                vscode.window.showInformationMessage('Successfully logged in to Zerops');
                this.updateLoginStatus(true);
                
                this.listProjects(false).catch(error => {
                    console.error('Initial projects fetch after login failed:', error);
                });
            } else {
                console.error('Login failed:', stderr);
                vscode.window.showErrorMessage(`Failed to login: ${stderr}`);
                this.updateLoginStatus(false);
            }
        } catch (error) {
            console.error('Login failed:', error);
            
            if (context) {
                await context.secrets.delete('zerops-token');
            }
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Login failed: ${errorMessage}`);
            this.updateLoginStatus(false);
            throw error;
        }
    }

    static async logout(context?: vscode.ExtensionContext): Promise<void> {
        try {
            console.log('Logging out from Zerops...');
            
            const { stdout, stderr } = await this.executeCommand('logout', { appendToOutput: false });
            
            if (context) {
                await context.secrets.delete('zerops-token');
            }
            
            this.clearProjectsCache();
            
            this.updateLoginStatus(false);
            vscode.window.showInformationMessage('Successfully logged out from Zerops');
        } catch (error) {
            console.error('Logout failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to logout: ${errorMessage}`);
            throw error;
        }
    }

    static async pushToService(serviceId: string): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found. Please open a folder in VS Code.');
        }

        await this.saveProjectSettings({
            ...(await this.loadProjectSettings()),
            serviceId
        });

        try {
            const terminal = this.getZeropsTerminal();
            terminal.show(true);
            
            const command = `zcli push --serviceId ${serviceId}`;
            terminal.sendText(command);
            
            
            return Promise.resolve();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error(`Failed to push to service: ${errorMessage}`);
            throw error;
        }
    }

    static async autoLogin(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            const token = await context.secrets.get('zerops-token');
            if (!token) {
                this.updateLoginStatus(false);
                return false;
            }

            try {
                const { stdout, stderr } = await this.executeCommand(`login ${token}`, { appendToOutput: false });
                
                const output = stdout + stderr;
                if (output.includes('Error') && !output.includes('Welcome')) {
                    console.log('Auto-login failed: token might be invalid');
                    this.updateLoginStatus(false);
                    await context.secrets.delete('zerops-token');
                    return false;
                }
            } catch (error) {
                console.error('Auto-login execution failed:', error);
                this.updateLoginStatus(false);
                await context.secrets.delete('zerops-token');
                return false;
            }
            
            await context.secrets.store('zerops-token', token);
            
            this.updateLoginStatus(true);
            console.log('Auto-login successful');
            return true;
        } catch (error) {
            console.error('Auto-login failed:', error);
            await context.secrets.delete('zerops-token');
            this.updateLoginStatus(false);
            return false;
        }
    }

    static async cancelPush(): Promise<void> {
        if (this.currentPushProcess) {
            this.currentPushProcess.kill();
            this.getOutputChannel().appendLine('Push cancelled by user');
            this.currentPushProcess = null;
            throw new Error('Push cancelled by user');
        }
    }

    private static getZeropsTerminal(): vscode.Terminal {
        if (!this.zeropsTerminal) {
            const existingTerminals = vscode.window.terminals;
            const existingZeropsTerminal = existingTerminals.find(term => term.name === 'Zerops');
            
            if (existingZeropsTerminal) {
                console.log('Found existing Zerops terminal, reusing it');
                this.zeropsTerminal = existingZeropsTerminal;
            } else {
                console.log('Creating new Zerops terminal');
                this.zeropsTerminal = vscode.window.createTerminal('Zerops');
            }
            
            vscode.window.onDidCloseTerminal(terminal => {
                if (terminal === this.zeropsTerminal) {
                    this.zeropsTerminal = null;
                }
            });
        }
        
        return this.zeropsTerminal;
    }

    static async vpnUp(projectId: string, autoDisconnect: boolean = false): Promise<void> {
        const outputChannel = this.getOutputChannel();
        outputChannel.appendLine(`Connecting VPN to project ${projectId}...`);
        
        try {
            await this.saveProjectSettings({
                ...(await this.loadProjectSettings()),
                projectId
            });
            
            const terminal = this.getZeropsTerminal();
            terminal.show(true);
            
            const autoDisconnectFlag = autoDisconnect ? ' --auto-disconnect' : '';
            const command = `zcli vpn up ${projectId}${autoDisconnectFlag}`;
            
            terminal.sendText(command);
            
            outputChannel.appendLine(`Running command in terminal: ${command}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            outputChannel.appendLine(`Failed to start VPN connection: ${errorMessage}`);
            throw error;
        }
    }

    static async vpnDown(): Promise<void> {
        const outputChannel = this.getOutputChannel();
        outputChannel.appendLine('Disconnecting VPN...');
        
        try {
            const terminal = this.getZeropsTerminal();
            terminal.show(true);
            
            terminal.sendText('zcli vpn down');
            
            outputChannel.appendLine('Running command in terminal: zcli vpn down');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            outputChannel.appendLine(`Failed to start VPN disconnection: ${errorMessage}`);
            throw error;
        }
    }
    
    static async checkVpnStatus(): Promise<'connected' | 'disconnected' | 'unknown'> {
        try {
            const { stdout, stderr } = await this.executeCommand('vpn status');
            const output = stdout + stderr;
            
            if (output.includes('connected') || output.includes('active') || output.includes('running')) {
                return 'connected';
            } else if (output.includes('disconnected') || output.includes('inactive') || output.includes('not running')) {
                return 'disconnected';
            }
            
            return 'unknown';
        } catch (error) {
            console.error('Failed to check VPN status:', error);
            return 'unknown';
        }
    }

    static updateLoginStatus(status: boolean): void {
        this.isLoggedIn = status;
        vscode.commands.executeCommand('setContext', 'zerops.isLoggedIn', status);
    }
    
    static async listProjects(useCache: boolean = true): Promise<{id: string, name: string}[]> {
        try {
            if (useCache && this.projectsCache !== null) {
                return this.projectsCache;
            }
            
            const { stdout } = await this.executeCommand('project list', { appendToOutput: true });
            const projects: {id: string, name: string}[] = [];
            
            const lines = stdout.split('\n');
            for (let i = 2; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line === '' || line.startsWith('├') || line.startsWith('└') || line.startsWith('┌')) {
                    continue;
                }
                
                const match = line.match(/│\s+([a-zA-Z0-9+/=]+)\s+│\s+([^│]+)/);
                if (match && match.length >= 3) {
                    const id = match[1].trim();
                    const name = match[2].trim();
                    projects.push({ id, name });
                }
            }
            
            this.projectsCache = projects;
            
            return projects;
        } catch (error) {
            console.error('Failed to list projects:', error);
            throw error;
        }
    }
    
    static clearProjectsCache() {
        this.projectsCache = null;
    }
} 