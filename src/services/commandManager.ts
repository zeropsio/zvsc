import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ZEROPS_YML, IMPORT_YML } from '../init';
import { CliService } from './cliService';
import { GitHubWorkflowService } from './githubWorkflowService';
import { UIService } from './uiService';
import { loadProjectSettings } from '../utils/settings';

export class CommandManager {
    private static instance: CommandManager;
    private commands: vscode.Disposable[] = [];
    private githubWorkflowService: GitHubWorkflowService;
    private uiService: UIService;

    private constructor() {
        this.githubWorkflowService = GitHubWorkflowService.getInstance();
        this.uiService = UIService.getInstance();
    }

    public static getInstance(): CommandManager {
        if (!CommandManager.instance) {
            CommandManager.instance = new CommandManager();
        }
        return CommandManager.instance;
    }

    public async registerCommands(context: vscode.ExtensionContext): Promise<void> {
        this.commands = [
            this.registerVpnUpCommand(),
            this.registerVpnDownCommand(),
            this.registerPushCommand(),
            this.registerVpnUpFromStatusBarCommand(),
            this.registerVpnDownFromStatusBarCommand(),
            this.registerExploreServiceFromStatusBarCommand(),
            this.registerExploreGuiFromStatusBarCommand(),
            this.registerOpenDashboardCommand(),
            this.registerOpenProjectDashboardCommand(),
            this.registerOpenServiceDashboardCommand(),
            this.registerExploreGuiCommand(),
            this.registerLoginCommand(context),
            this.registerLogoutCommand(context),
            this.registerScanProjectCommand(),
            this.registerInitProjectCommand(),
            this.registerShowCommandsCommand(),
            this.registerInitGitHubWorkflowCommand(),
            this.registerCreateCommentedGitHubWorkflowCommand()
        ];

        context.subscriptions.push(...this.commands, this.githubWorkflowService);
    }

    private registerVpnUpCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.vpnUp', async () => {
            try {
                const projectId = await vscode.window.showInputBox({
                    prompt: 'Enter your Zerops Project ID',
                    placeHolder: 'Project ID from Zerops Dashboard',
                    validateInput: (value: string) => {
                        return value && value.length > 0 ? null : 'Project ID is required';
                    }
                });

                if (projectId) {
                    const autoDisconnect = await vscode.window.showQuickPick(['Yes', 'No'], {
                        placeHolder: 'Auto-disconnect existing VPN connections?'
                    });
                    
                    await CliService.vpnUp(projectId, autoDisconnect === 'Yes');
                }
            } catch (error) {
                console.error('VPN connection failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to connect VPN: ${errorMessage}`);
            }
        });
    }

    private registerVpnDownCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.vpnDown', async () => {
            try {
                await CliService.vpnDown();
            } catch (error) {
                console.error('VPN disconnection failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to disconnect VPN: ${errorMessage}`);
            }
        });
    }

    private registerPushCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.pushFromStatusBar', async () => {
            const settings = await loadProjectSettings();
            if (!settings?.serviceId) {
                vscode.window.showErrorMessage('No service ID found. Please set a service ID in .vscode/zerops.json or through the Settings menu.');
                return;
            }

            try {
                await vscode.commands.executeCommand('zerops.push');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Push failed: ${errorMessage}`);
            }
        });
    }

    private registerVpnUpFromStatusBarCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.vpnUpFromStatusBar', async () => {
            try {
                const settings = await CliService.loadProjectSettings();
                
                if (!settings.projectId) {
                    const projectId = await vscode.window.showInputBox({
                        prompt: 'Enter your Zerops Project ID',
                        placeHolder: 'Project ID from Zerops Dashboard',
                        validateInput: (value: string) => {
                            return value && value.length > 0 ? null : 'Project ID is required';
                        }
                    });
                    
                    if (projectId) {
                        await CliService.vpnUp(projectId, false);
                    }
                } else {
                    await CliService.vpnUp(settings.projectId, false);
                }
            } catch (error) {
                console.error('VPN connection failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to connect VPN: ${errorMessage}`);
            }
        });
    }

    private registerVpnDownFromStatusBarCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.vpnDownFromStatusBar', async () => {
            try {
                await CliService.vpnDown();
            } catch (error) {
                console.error('VPN disconnection failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to disconnect VPN: ${errorMessage}`);
            }
        });
    }

    private registerExploreServiceFromStatusBarCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.exploreServiceFromStatusBar', async () => {
            try {
                const settings = await CliService.loadProjectSettings();
                
                if (!settings || !settings.serviceId) {
                    const serviceId = await vscode.window.showInputBox({
                        prompt: 'Enter your Zerops Service ID',
                        placeHolder: 'Service ID from Zerops Dashboard',
                        validateInput: (value: string) => {
                            return value && value.length > 0 ? null : 'Service ID is required';
                        }
                    });
                    
                    if (!serviceId) {
                        return;
                    }
                    
                    await CliService.saveProjectSettings({ 
                        serviceId,
                        projectId: settings?.projectId || ''
                    });
                    
                    vscode.window.showInformationMessage('Service ID saved successfully');
                }
                
                await this.uiService.handleExploreService(settings);
            } catch (error) {
                console.error('Failed to open Service menu:', error);
                vscode.window.showErrorMessage('Failed to open Service menu');
            }
        });
    }

    private registerOpenDashboardCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.openDashboard', async () => {
            try {
                vscode.env.openExternal(vscode.Uri.parse('https://app.zerops.io/dashboard/projects'));
            } catch (error) {
                console.error('Failed to open Zerops Dashboard:', error);
                vscode.window.showErrorMessage('Failed to open Zerops Dashboard');
            }
        });
    }

    private registerOpenProjectDashboardCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.openProjectDashboard', async () => {
            try {
                const settings = await CliService.loadProjectSettings();
                if (settings.projectId) {
                    vscode.env.openExternal(vscode.Uri.parse(`https://app.zerops.io/project/${settings.projectId}/service-stacks`));
                } else {
                    vscode.window.showWarningMessage('No Project ID found. Please set a Project ID first.');
                }
            } catch (error) {
                console.error('Failed to open Project Dashboard:', error);
                vscode.window.showErrorMessage('Failed to open Project Dashboard');
            }
        });
    }

    private registerOpenServiceDashboardCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.openServiceDashboard', async () => {
            try {
                const settings = await CliService.loadProjectSettings();
                if (settings.serviceId) {
                    vscode.env.openExternal(vscode.Uri.parse(`https://app.zerops.io/service-stack/${settings.serviceId}/dashboard`));
                } else {
                    vscode.window.showWarningMessage('No Service ID found. Please set a Service ID first.');
                }
            } catch (error) {
                console.error('Failed to open Service Dashboard:', error);
                vscode.window.showErrorMessage('Failed to open Service Dashboard');
            }
        });
    }

    private registerExploreGuiFromStatusBarCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.exploreGuiFromStatusBar', async () => {
            try {
                CliService.listProjects(false).catch(error => {
                    console.error('Background project fetch failed:', error);
                });
                
                const settings = await CliService.loadProjectSettings();
                const hasServiceId = settings && settings.serviceId;
                const hasProjectId = settings && settings.projectId;
                
                const guiOptions = [
                    { label: '$(browser) Open GUI', action: 'zerops.openDashboard', description: 'Opens on Web' },
                    { label: '$(project) Explore Projects', action: 'exploreProjects', description: 'List all projects' },
                ];
                
                if (hasProjectId) {
                    guiOptions.push({ 
                        label: '$(project) Open Project', 
                        action: 'zerops.openProjectDashboard', 
                        description: `Opens on Web` 
                    });
                }
                
                if (hasServiceId) {
                    guiOptions.push({ 
                        label: '$(server) Explore Service', 
                        action: 'exploreService', 
                        description: `Explore service options` 
                    });
                }
                
                guiOptions.push({ 
                    label: '$(arrow-left) Go Back', 
                    action: 'goBack', 
                    description: 'Return to main menu' 
                });
                
                const guiSelected = await vscode.window.showQuickPick(guiOptions, {
                    placeHolder: 'Select GUI to open'
                });
                
                if (guiSelected) {
                    if (guiSelected.action === 'goBack') {
                        return;
                    } else if (guiSelected.action === 'exploreProjects') {
                        await this.uiService.handleExploreProjects();
                    } else if (guiSelected.action === 'exploreService') {
                        await this.uiService.handleExploreService(settings);
                    } else {
                        vscode.commands.executeCommand(guiSelected.action);
                    }
                }
            } catch (error) {
                console.error('Failed to open GUI menu:', error);
                vscode.window.showErrorMessage('Failed to open GUI menu');
            }
        });
    }

    private registerExploreGuiCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.exploreGui', async () => {
            return vscode.commands.executeCommand('zerops.exploreGuiFromStatusBar');
        });
    }

    private registerLoginCommand(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.login', async () => {
            try {
                const token = await vscode.window.showInputBox({
                    prompt: 'Enter your Zerops Personal Access Token',
                    placeHolder: 'Your token from Zerops Access Token Management',
                    password: true,
                    validateInput: (value: string) => {
                        return value && value.length > 0 ? null : 'Token is required';
                    }
                });

                if (token) {
                    await CliService.login(token, context);
                }
            } catch (error) {
                console.error('Login failed:', error);
                vscode.window.showErrorMessage('Failed to login to Zerops');
            }
        });
    }

    private registerLogoutCommand(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.logout', async () => {
            try {
                await CliService.logout(context);
            } catch (error) {
                console.error('Logout failed:', error);
                vscode.window.showErrorMessage('Failed to logout from Zerops');
            }
        });
    }

    private registerScanProjectCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.scanProject', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
                return;
            }
            
            const currentWorkspace = workspaceFolders[0].uri.fsPath;
            const { scanProjectForFramework } = require('../init');
            await scanProjectForFramework(currentWorkspace);
        });
    }

    private registerInitProjectCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.initProject', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
                return;
            }
            
            const currentWorkspace = workspaceFolders[0].uri.fsPath;
            
            const { scanProjectForFramework } = require('../init');
            await scanProjectForFramework(currentWorkspace);
            
            const importYmlPath = path.join(currentWorkspace, 'import.yml');
            if (!fs.existsSync(importYmlPath)) {
                fs.writeFileSync(importYmlPath, IMPORT_YML);
                vscode.window.showInformationMessage('Created import.yml file');
            }
        });
    }

    private registerInitGitHubWorkflowCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.initGitHubWorkflow', () => {
            this.githubWorkflowService.addWorkflow();
        });
    }

    private registerCreateCommentedGitHubWorkflowCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.createCommentedGitHubWorkflow', () => {
            this.githubWorkflowService.addWorkflow();
        });
    }

    private registerShowCommandsCommand(): vscode.Disposable {
        return vscode.commands.registerCommand('zerops.showCommands', async () => {
            try {
                let keepMenuOpen = true;
                
                while (keepMenuOpen) {
                    const settings = await CliService.loadProjectSettings();
                    const hasServiceId = settings && settings.serviceId;
                    const hasProjectId = settings && settings.projectId;
                    
                    let commands = [];
                    
                    if (hasServiceId) {
                        commands.push({ label: '$(cloud-upload) Push to Zerops', action: 'zerops.pushFromStatusBar', keepOpen: false });
                    }
                    
                    if (hasProjectId) {
                        commands.push({ label: '$(plug) VPN Up', action: 'zerops.vpnUpFromStatusBar', keepOpen: false });
                        commands.push({ label: '$(debug-disconnect) VPN Down', action: 'zerops.vpnDownFromStatusBar', keepOpen: false });
                    }
                    
                    commands.push({ label: '$(globe) Explore GUI', action: 'zerops.exploreGui', keepOpen: true });
                    commands.push({ label: '$(file-add) Init Configurations', action: 'initConfigurations', keepOpen: true });
                    commands.push({ label: '$(comment-discussion) Support', action: 'support', keepOpen: true });
                    commands.push({ label: '$(gear) Settings', action: 'settings', keepOpen: true });
                    
                    if (!CliService.getLoginStatus()) {
                        commands.push({ label: '$(key) Login with Access Token', action: 'zerops.login', keepOpen: false });
                    }
                    
                    const selected = await vscode.window.showQuickPick(commands, {
                        placeHolder: 'Zerops Commands'
                    });
                    
                    if (!selected) {
                        keepMenuOpen = false;
                        continue;
                    }
                    
                    if (selected.action === 'initConfigurations') {
                        const configOptions = [
                            { label: '$(file-code) Init zerops.yml', action: 'initZYml', description: 'Initializes a zerops.yml file in root' },
                            { label: '$(file-code) Init zerops-project-import.yml', action: 'initZYmlImport', description: 'Initializes a zerops-project-import.yml file in root' },
                            { label: '$(search) Scan Project for Framework', action: 'detectFramework', description: 'Scan project and generate zerops.yml' },
                            { label: '$(github) Add GitHub Workflow', action: 'initGitHubWorkflow', description: 'Adds GitHub workflow for automated deployments' },
                            { label: '$(arrow-left) Go Back', action: 'goBack', description: 'Return to main menu' }
                        ];
                        
                        const configSelected = await vscode.window.showQuickPick(configOptions, {
                            placeHolder: 'Select a configuration to initialize'
                        });
                        
                        if (configSelected) {
                            if (configSelected.action === 'goBack') {
                                keepMenuOpen = true;
                            } else if (configSelected.action === 'detectFramework') {
                                vscode.commands.executeCommand('zerops.scanProject');
                                keepMenuOpen = false;
                            } else if (configSelected.action === 'initGitHubWorkflow') {
                                vscode.commands.executeCommand('zerops.initGitHubWorkflow');
                                keepMenuOpen = false;
                            } else if (configSelected.action === 'initZYml') {
                                this.initZeropsYml();
                                keepMenuOpen = false;
                            } else if (configSelected.action === 'initZYmlImport') {
                                this.initZeropsImportYml();
                                keepMenuOpen = false;
                            }
                        } else {
                            keepMenuOpen = true;
                        }
                    } else if (selected.action === 'support') {
                        const supportOptions = [
                            { label: '$(comment-discussion) Discord Community', action: 'openDiscord', description: 'Join our Discord server' },
                            { label: '$(mail) Email Support', action: 'openEmailSupport', description: 'Contact support@zerops.io' },
                            { label: '$(globe) Forum', action: 'openForumSupport', description: 'Visit support.zerops.io forum' },
                            { label: '$(arrow-left) Go Back', action: 'goBack', description: 'Return to main menu' }
                        ];
                        
                        const supportSelected = await vscode.window.showQuickPick(supportOptions, {
                            placeHolder: 'Select support option'
                        });
                        
                        if (supportSelected) {
                            if (supportSelected.action === 'goBack') {
                                keepMenuOpen = true;
                            } else if (supportSelected.action === 'openDiscord') {
                                await this.uiService.openDiscordServer();
                                keepMenuOpen = true;
                            } else if (supportSelected.action === 'openEmailSupport') {
                                this.handleEmailSupport();
                                keepMenuOpen = true;
                            } else if (supportSelected.action === 'openForumSupport') {
                                vscode.env.openExternal(vscode.Uri.parse('https://support.zerops.io'));
                                keepMenuOpen = true;
                            }
                        } else {
                            keepMenuOpen = true;
                        }
                    } else if (selected.action === 'settings') {
                        const settingsOptions = [
                            { label: '$(gear) General Settings', action: 'generalSettings', description: 'Configure general settings' },
                            { label: '$(arrow-left) Go Back', action: 'goBack', description: 'Return to main menu' }
                        ];
                        
                        const settingsSelected = await vscode.window.showQuickPick(settingsOptions, {
                            placeHolder: 'Select settings option'
                        });
                        
                        if (settingsSelected) {
                            if (settingsSelected.action === 'goBack') {
                                keepMenuOpen = true;
                            } else {
                                vscode.commands.executeCommand(settingsSelected.action);
                                keepMenuOpen = false;
                            }
                        } else {
                            keepMenuOpen = true;
                        }
                    } else {
                        vscode.commands.executeCommand(selected.action);
                        keepMenuOpen = selected.keepOpen;
                    }
                }
            } catch (error) {
                console.error('Error handling Zerops commands:', error);
                vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }

    private handleEmailSupport(): void {
        const emailAddress = 'support@zerops.io';
        const emailOptions = [
            { label: '$(mail) Open Mail', action: 'openMail', description: 'Open in default mail client' },
            { label: '$(clippy) Copy Email', action: 'copyEmail', description: 'Copy to clipboard' },
            { label: '$(arrow-left) Cancel', action: 'cancel', description: 'Go back' }
        ];
        
        vscode.window.showQuickPick(emailOptions, {
            placeHolder: 'Choose action for ' + emailAddress
        }).then(emailAction => {
            if (emailAction) {
                if (emailAction.action === 'openMail') {
                    vscode.env.openExternal(vscode.Uri.parse('mailto:' + emailAddress));
                } else if (emailAction.action === 'copyEmail') {
                    vscode.env.clipboard.writeText(emailAddress);
                    vscode.window.showInformationMessage('Email address copied to clipboard');
                }
            }
        });
    }

    private async initZeropsYml(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
            return;
        }
        
        const currentWorkspace = workspaceFolders[0].uri.fsPath;
        const zeropsYmlPath = path.join(currentWorkspace, 'zerops.yml');
        
        if (fs.existsSync(zeropsYmlPath)) {
            const overwrite = await vscode.window.showWarningMessage(
                'zerops.yml already exists. Do you want to overwrite it?',
                'Yes', 'No'
            );
            
            if (overwrite !== 'Yes') {
                return;
            }
        }
        
        try {
            fs.writeFileSync(zeropsYmlPath, ZEROPS_YML);
            vscode.window.showInformationMessage('zerops.yml has been created successfully!');
            
            const doc = await vscode.workspace.openTextDocument(zeropsYmlPath);
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            console.error('Failed to create zerops.yml:', error);
            vscode.window.showErrorMessage(`Failed to create zerops.yml: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async initZeropsImportYml(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
            return;
        }
        
        const currentWorkspace = workspaceFolders[0].uri.fsPath;
        const zeropsYmlImportPath = path.join(currentWorkspace, 'zerops-project-import.yml');
        
        if (fs.existsSync(zeropsYmlImportPath)) {
            const overwrite = await vscode.window.showWarningMessage(
                'zerops-project-import.yml already exists. Do you want to overwrite it?',
                'Yes', 'No'
            );
            
            if (overwrite !== 'Yes') {
                return;
            }
        }
        
        try {
            fs.writeFileSync(zeropsYmlImportPath, IMPORT_YML);
            vscode.window.showInformationMessage('zerops-project-import.yml has been created successfully!');
            
            const doc = await vscode.workspace.openTextDocument(zeropsYmlImportPath);
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            console.error('Failed to create zerops-project-import.yml:', error);
            vscode.window.showErrorMessage(`Failed to create zerops-project-import.yml: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
} 