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
    private static isLoggedIn: boolean = false; // Track login status

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

    // Project settings management (for storing service IDs per workspace)
    static async saveProjectSettings(settings: ProjectSettings): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found. Please open a folder in VS Code.');
        }

        // Create .vscode directory if it doesn't exist
        const vscodePath = path.join(workspaceRoot, '.vscode');
        if (!fs.existsSync(vscodePath)) {
            fs.mkdirSync(vscodePath, { recursive: true });
        }

        // Save settings to .vscode/zerops.json
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
            // We'll still use the direct execution method here since we need to
            // capture the output to verify installation
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
            // Run simple 'zcli' command with no arguments to check login status
            // This should return "Welcome in Zerops!" if logged in
            const { stdout, stderr } = await this.executeCommand('', { appendToOutput: false });
            const output = stdout + stderr;
            
            // If output contains "Welcome in Zerops!", user is logged in
            if (output.includes('Welcome in Zerops!')) {
                console.log('User is logged in to Zerops (detected from welcome message)');
                this.updateLoginStatus(true);
                return true;
            }
            
            // Fallback to checking user info if welcome message isn't found
            try {
                const { stdout: userStdout, stderr: userStderr } = await this.executeCommand('user', { appendToOutput: false });
                const userOutput = userStdout + userStderr;
                
                // If there's an error about being not logged in, user is not logged in
                if (userOutput.includes('not logged in') || userOutput.includes('login first') || userOutput.includes('unauthorized')) {
                    this.updateLoginStatus(false);
                    return false;
                }
                
                // If we get a response with user information, user is logged in
                if (userOutput.includes('@') || userOutput.includes('email') || userOutput.includes('user')) {
                    console.log('User is logged in to Zerops (detected from user info)');
                    this.updateLoginStatus(true);
                    return true;
                }
            } catch (error) {
                // Ignore errors in fallback check
            }
            
            // Default to not logged in if we can't determine
            this.updateLoginStatus(false);
            return false;
        } catch (error) {
            console.error('Failed to check login status:', error);
            this.updateLoginStatus(false);
            return false;
        }
    }
    
    // Getter for login status
    static getLoginStatus(): boolean {
        return this.isLoggedIn;
    }

    static async login(token: string, context?: vscode.ExtensionContext): Promise<void> {
        try {
            console.log('Logging in to Zerops...');
            
            // Use executeCommand to run zcli login rather than using the terminal
            // Don't append to output channel by default to keep it hidden
            const { stdout, stderr } = await this.executeCommand(`login ${token}`, { appendToOutput: false });
            
            // Check for error message in stderr
            if (stderr && !stderr.includes('Welcome') && stderr.includes('Error')) {
                throw new Error(stderr);
            }
            
            // Store the token if context is provided
            if (context) {
                await context.secrets.store('zerops-token', token);
            }
            
            // Set login status to true
            this.updateLoginStatus(true);
            
            // Success message through notification
            vscode.window.showInformationMessage('Successfully logged in to Zerops');
        } catch (error) {
            console.error('Login failed:', error);
            if (context) {
                await context.secrets.delete('zerops-token');
            }
            this.updateLoginStatus(false);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to login to Zerops: ${errorMessage}`);
            throw error;
        }
    }

    static async logout(context: vscode.ExtensionContext): Promise<void> {
        try {
            // Use executeCommand to run zcli logout rather than using the terminal
            await this.executeCommand('logout', { appendToOutput: false });
            
            // Delete the stored token
            await context.secrets.delete('zerops-token');
            
            // Set login status to false
            this.updateLoginStatus(false);
            
            // Success message through notification
            vscode.window.showInformationMessage('Successfully logged out from Zerops');
        } catch (error) {
            console.error('Logout failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to logout from Zerops: ${errorMessage}`);
            throw error;
        }
    }

    static async pushToService(serviceId: string): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found. Please open a folder in VS Code.');
        }

        // Save the serviceId to workspace settings
        await this.saveProjectSettings({
            ...(await this.loadProjectSettings()), // Keep existing settings like projectId
            serviceId
        });

        try {
            const terminal = this.getZeropsTerminal();
            terminal.show(true);
            
            // Use terminal for the push command instead of spawn
            const command = `zcli push --serviceId ${serviceId}`;
            terminal.sendText(command);
            
            // No longer set currentPushProcess since we're using terminal
            // This means we can't cancel it, but that's a trade-off for using terminal
            
            // Success will be determined by the user seeing the terminal output
            // We can't automatically detect completion anymore
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

            // Use executeCommand to run zcli login rather than using the terminal
            // Don't append to output channel to keep it hidden for auto-login
            try {
                const { stdout, stderr } = await this.executeCommand(`login ${token}`, { appendToOutput: false });
                
                // Check for successful login
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
            
            // Store the token again to ensure it's saved
            await context.secrets.store('zerops-token', token);
            
            // If we got here, login worked
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
        // First check if there's an existing Zerops terminal
        if (!this.zeropsTerminal) {
            // Look for an existing terminal named 'Zerops'
            const existingTerminals = vscode.window.terminals;
            const existingZeropsTerminal = existingTerminals.find(term => term.name === 'Zerops');
            
            if (existingZeropsTerminal) {
                console.log('Found existing Zerops terminal, reusing it');
                this.zeropsTerminal = existingZeropsTerminal;
            } else {
                // Create a new terminal if none exists
                console.log('Creating new Zerops terminal');
                this.zeropsTerminal = vscode.window.createTerminal('Zerops');
            }
            
            // Clean up reference when terminal is closed
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
            // Save the projectId to the workspace settings
            await this.saveProjectSettings({
                ...(await this.loadProjectSettings()), // Keep existing settings
                projectId // Add or update the projectId
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
} 