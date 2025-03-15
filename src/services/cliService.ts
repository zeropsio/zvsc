import * as vscode from 'vscode';
import { exec } from 'child_process';
import { spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CliService {
    private static outputChannel: vscode.OutputChannel;
    private static currentPushProcess: ReturnType<typeof spawn> | null = null;

    private static getOutputChannel(): vscode.OutputChannel {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('Zerops');
        }
        return this.outputChannel;
    }

    private static async executeCommand(command: string, options?: { cwd?: string }): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            exec(`zcli ${command}`, options, (error, stdout, stderr) => {
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

    static async login(token: string, context?: vscode.ExtensionContext): Promise<void> {
        try {
            console.log('Logging in to Zerops...');
            const { stdout, stderr } = await this.executeCommand(`login ${token}`);
            
            if (stderr && !stderr.includes('Welcome')) {
                throw new Error(stderr);
            }

            if (context) {
                await context.secrets.store('zerops-token', token);
            }

            vscode.window.showInformationMessage('Successfully logged in to Zerops');
        } catch (error) {
            console.error('Login failed:', error);
            if (context) {
                await context.secrets.delete('zerops-token');
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to login to Zerops: ${errorMessage}`);
            throw error;
        }
    }

    static async logout(context: vscode.ExtensionContext): Promise<void> {
        try {
            await this.executeCommand('logout');
            await context.secrets.delete('zerops-token');
            vscode.window.showInformationMessage('Successfully logged out from Zerops');
        } catch (error) {
            console.error('Logout failed:', error);
            vscode.window.showErrorMessage('Failed to logout from Zerops');
            throw error;
        }
    }

    static async pushToService(serviceId: string, options: { deployGitFolder?: boolean } = {}): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found. Please open a folder in VS Code.');
        }

        const args = ['push', '--serviceId', serviceId];
        if (options.deployGitFolder) {
            args.push('--deployGitFolder');
        }

        await this.spawnCommand(args, workspaceRoot);
    }

    static async autoLogin(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            const token = await context.secrets.get('zerops-token');
            if (!token) {
                return false;
            }

            await this.login(token);
            return true;
        } catch (error) {
            console.error('Auto-login failed:', error);
            await context.secrets.delete('zerops-token');
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
} 