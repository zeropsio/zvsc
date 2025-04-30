import * as vscode from 'vscode';
import { CliService } from './services/cliService';
import * as fs from 'fs';
import * as path from 'path';
import { Recipe, RecipeOption, CloneOption } from './types';
import { RECIPES } from './recipes';
import { ZEROPS_YML, IMPORT_YML } from './init';
import { GitHubWorkflowService } from './services/githubWorkflowService';
import { ProjectSettings, loadProjectSettings } from './utils/settings';
import { YamlSchemaService } from './services/yamlSchemaService';
import fetch from 'node-fetch';
import { YamlGeneratorService } from './services/yamlGeneratorService';
const yaml = require('js-yaml');

let zeropsStatusBarItem: vscode.StatusBarItem;
let pushStatusBarItem: vscode.StatusBarItem;
let vpnUpStatusBarItem: vscode.StatusBarItem;
let serviceStatusBarItem: vscode.StatusBarItem;
let guiStatusBarItem: vscode.StatusBarItem;
let vpnDownStatusBarItem: vscode.StatusBarItem;
let terminalStatusBarItem: vscode.StatusBarItem;
let reloadStatusBarItem: vscode.StatusBarItem;

function updateStatusBarVisibility() {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        if (zeropsStatusBarItem) zeropsStatusBarItem.show();
        if (pushStatusBarItem) pushStatusBarItem.show();
        if (vpnUpStatusBarItem) vpnUpStatusBarItem.show();
        if (serviceStatusBarItem) serviceStatusBarItem.show();
        if (guiStatusBarItem) guiStatusBarItem.show();
        if (vpnDownStatusBarItem) vpnDownStatusBarItem.show();
        if (terminalStatusBarItem) terminalStatusBarItem.show();
        if (reloadStatusBarItem) reloadStatusBarItem.show();
    } else {
    }
}

interface TerminalDataEvent {
    terminal: vscode.Terminal;
    data: string;
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating Zerops extension...');
    
    try {
        const isCliInstalled = await CliService.checkCliInstalled();
        if (!isCliInstalled) {
            throw new Error('zcli is not installed. Please install zcli to use this extension.');
        }
        
        await CliService.checkLoginStatus();
        
        if (!CliService.getLoginStatus()) {
            try {
                const isLoggedIn = await CliService.autoLogin(context);
                if (isLoggedIn) {
                    console.log('Auto-login successful');
                }
            } catch (error) {
                console.error('Auto-login failed:', error);
            }
        } else {
            console.log('User is already logged in');
        }

        try {
            await YamlSchemaService.registerSchema(context);
        } catch (error) {
            console.error('Failed to register YAML schema:', error);
        }

        CliService.listProjects(false).catch(error => {
            console.error('Failed to fetch projects on startup:', error);
        });
        
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                updateStatusBarVisibility();
            }
        });
        
        updateStatusBarVisibility();
        
        terminalStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        terminalStatusBarItem.text = "$(terminal) Terminal";
        terminalStatusBarItem.tooltip = "Open Terminal";
        terminalStatusBarItem.command = 'zerops.openTerminal';
        terminalStatusBarItem.show();
        
        guiStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
        guiStatusBarItem.text = "$(globe) zGUI";
        guiStatusBarItem.tooltip = "Explore Zerops GUI";
        guiStatusBarItem.command = 'zerops.exploreGuiFromStatusBar';
        guiStatusBarItem.show();
        
        const githubWorkflowService = GitHubWorkflowService.getInstance();
        
        let pushCommand = vscode.commands.registerCommand('zerops.pushFromStatusBar', async () => {
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
        
        let vpnUpFromStatusBarCommand = vscode.commands.registerCommand('zerops.vpnUpFromStatusBar', async () => {
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
        
        let vpnDownFromStatusBarCommand = vscode.commands.registerCommand('zerops.vpnDownFromStatusBar', async () => {
            try {
                await CliService.vpnDown();
            } catch (error) {
                console.error('VPN disconnection failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to disconnect VPN: ${errorMessage}`);
            }
        });

        try {
            zeropsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 3);
            zeropsStatusBarItem.text = "$(rocket) Zerops";
            zeropsStatusBarItem.tooltip = "Zerops Controls";
            
            zeropsStatusBarItem.command = 'zerops.showCommands';
            
            const showCommandsCommand = vscode.commands.registerCommand('zerops.showCommands', async () => {
                try {
                    let keepMenuOpen = true;
                    
                    while (keepMenuOpen) {
                        const settings = await CliService.loadProjectSettings();
                        const hasServiceId = settings && settings.serviceId;
                        const hasProjectId = settings && settings.projectId;
                        
                        let commands = [];
                        
                        if (!hasServiceId || !hasProjectId) {
                            if (!hasServiceId) {
                                commands.push({ label: '$(edit) Set Service ID', action: 'setServiceId', description: 'Configure a Zerops Service ID', keepOpen: true });
                            }
                            
                            if (!hasProjectId) {
                                commands.push({ label: '$(edit) Set Project ID', action: 'setProjectId', description: 'Configure a Zerops Project ID', keepOpen: true });
                            }
                        }
                        
                        if (hasServiceId) {
                            commands.push({ label: '$(cloud-upload) Push to Zerops', action: 'zerops.pushFromStatusBar', keepOpen: false });
                        }
                        
                        if (hasProjectId) {
                            commands.push({ label: '$(plug) VPN Up', action: 'zerops.vpnUpFromStatusBar', keepOpen: false });
                            commands.push({ label: '$(debug-disconnect) VPN Down', action: 'zerops.vpnDownFromStatusBar', keepOpen: false });
                        }
                        
                        commands.push({ label: '$(globe) Explore GUI', action: 'zerops.exploreGui', keepOpen: true });
                        commands.push({ label: '$(book) Zerops Docs', action: 'openDocs', keepOpen: false });
                        commands.push({ label: '$(file-add) Init Configurations', action: 'initConfigurations', keepOpen: true });
                        commands.push({ label: '$(repo) Clone Recipe', action: 'cloneRecipe', keepOpen: true });

                        commands.push({ label: '$(comment-discussion) Support', action: 'support', keepOpen: true });
                        
                        // commands.push({ label: '$(feedback) zFeedback', action: 'zerops.sendFeedback', keepOpen: false });

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

                        if (selected.action === 'setServiceId') {
                            const currentSettings = await CliService.loadProjectSettings();
                            const serviceId = await vscode.window.showInputBox({
                                prompt: 'Enter your Zerops Service ID',
                                placeHolder: 'Service ID from Zerops Dashboard',
                                value: currentSettings.serviceId || '',
                                validateInput: (value: string) => {
                                    return value && value.length > 0 ? null : 'Service ID is required';
                                }
                            });
                            
                            if (serviceId) {
                                await CliService.saveProjectSettings({ 
                                    serviceId,
                                    projectId: currentSettings.projectId || ''
                                });
                                vscode.window.showInformationMessage('Service ID saved successfully');
                            }
                            keepMenuOpen = true;
                        } else if (selected.action === 'setProjectId') {
                            const currentSettings = await CliService.loadProjectSettings();
                            const projectId = await vscode.window.showInputBox({
                                prompt: 'Enter your Zerops Project ID',
                                placeHolder: 'Project ID from Zerops Dashboard',
                                value: currentSettings.projectId || '',
                                validateInput: (value: string) => {
                                    return value && value.length > 0 ? null : 'Project ID is required';
                                }
                            });
                            
                            if (projectId) {
                                await CliService.saveProjectSettings({ 
                                    serviceId: currentSettings.serviceId || '',
                                    projectId
                                });
                                vscode.window.showInformationMessage('Project ID saved successfully');
                            }
                            keepMenuOpen = true;
                        } else if (selected.action === 'cloneRecipe') {
                            try {
                                const recipes = RECIPES;
                                
                                const recipeOptions = recipes.map((recipe: Recipe): RecipeOption => ({
                                    label: `$(repo) ${recipe.name}`,
                                    action: 'clone',
                                    description: `Clone ${recipe.url}`,
                                    url: recipe.url,
                                    name: recipe.name
                                }));
                                
                                recipeOptions.push({ 
                                    label: '$(arrow-left) Go Back', 
                                    action: 'goBack', 
                                    description: 'Return to main menu',
                                    url: '',
                                    name: '' 
                                });
                                
                                const recipeSelected = await vscode.window.showQuickPick(recipeOptions, {
                                    placeHolder: 'Select a recipe to clone'
                                }) as RecipeOption | undefined;
                                
                                if (recipeSelected) {
                                    if (recipeSelected.action === 'goBack') {
                                        keepMenuOpen = true;
                                    } else {
                                        const cloneOptions: CloneOption[] = [
                                            { label: '$(folder-opened) Clone to a new directory', action: 'newDir', description: `Create a new directory: ${recipeSelected.name}` },
                                            { label: '$(root-folder) Clone to current workspace root', action: 'root', description: 'Files will be copied to the workspace root' },
                                            { label: '$(arrow-left) Go Back', action: 'goBack', description: 'Return to recipe selection' }
                                        ];
                                        
                                        const cloneOption = await vscode.window.showQuickPick(cloneOptions, {
                                            placeHolder: 'Where to clone the repository?'
                                        }) as CloneOption | undefined;
                                        
                                        if (cloneOption) {
                                            if (cloneOption.action === 'goBack') {
                                                continue;
                                            } else {
                                                const workspaceFolders = vscode.workspace.workspaceFolders;
                                                if (!workspaceFolders || workspaceFolders.length === 0) {
                                                    vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
                                                    keepMenuOpen = true;
                                                    continue;
                                                }
                                                
                                                const currentWorkspace = workspaceFolders[0].uri.fsPath;
                                                
                                                let clonePath = currentWorkspace;
                                                if (cloneOption.action === 'newDir') {
                                                    clonePath = path.join(currentWorkspace, recipeSelected.name);
                                                    
                                                    if (fs.existsSync(clonePath)) {
                                                        const overwrite = await vscode.window.showWarningMessage(
                                                            `Directory '${recipeSelected.name}' already exists. Do you want to overwrite it?`,
                                                            'Yes', 'No'
                                                        );
                                                        
                                                        if (overwrite !== 'Yes') {
                                                            keepMenuOpen = true;
                                                            continue;
                                                        }
                                                    }
                                                }
                                                
                                                await vscode.window.withProgress({
                                                    location: vscode.ProgressLocation.Notification,
                                                    title: `Cloning ${recipeSelected.name}...`,
                                                    cancellable: false
                                                }, async (progress) => {
                                                    progress.report({ increment: 0 });
                                                    
                                                    try {
                                                        let gitArgs = ['clone', recipeSelected.url];
                                                        
                                                        if (cloneOption.action === 'newDir') {
                                                            gitArgs.push(recipeSelected.name);
                                                        } else {
                                                            gitArgs.push('.');
                                                        }
                                                        
                                                        const { spawn } = require('child_process');
                                                        const git = spawn('git', gitArgs, { cwd: currentWorkspace });
                                                        
                                                        let errorOutput = '';
                                                        
                                                        git.stderr.on('data', (data: Buffer) => {
                                                            const output = data.toString();
                                                            console.log(`Git stderr: ${output}`);

                                                            if (output.includes('Cloning into')) {
                                                                progress.report({ increment: 20, message: 'Starting clone operation...' });
                                                            } else if (output.includes('Resolving deltas')) {
                                                                progress.report({ increment: 40, message: 'Resolving deltas...' });
                                                            } else {
                                                                errorOutput += output;
                                                            }
                                                        });
                                                        
                                                        await new Promise<number>((resolve, reject) => {
                                                            git.on('close', (code: number) => {
                                                                if (code === 0) {
                                                                    resolve(code);
                                                                } else {
                                                                    reject(new Error(`Git clone failed with code ${code}: ${errorOutput}`));
                                                                }
                                                            });
                                                        });
                                                        
                                                        progress.report({ increment: 100, message: 'Clone completed successfully!' });
                                                        
                                                        vscode.window.showInformationMessage(`Successfully cloned ${recipeSelected.name}`);
                                                    } catch (error: unknown) {
                                                        console.error('Clone failed:', error);
                                                        vscode.window.showErrorMessage(`Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`);
                                                    }
                                                });
                                                
                                                keepMenuOpen = false;
                                            }
                                        } else {
                                            keepMenuOpen = true;
                                        }
                                    }
                                } else {
                                    keepMenuOpen = true;
                                }
                            } catch (error) {
                                console.error('Error in clone recipe handler:', error);
                                vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                keepMenuOpen = true;
                            }
                        }
                        else if (selected.action === 'initConfigurations') {
                            try {
                                const configOptions = [
                                    { label: '$(file-code) Init basic zerops.yml', action: 'initZYml', description: 'Initializes a basic zerops.yml file in root' },
                                    { label: '$(file-code) Init basic zerops-project-import.yml', action: 'initZYmlImport', description: 'Initializes a basic zerops-project-import.yml file in root' },
                                    { label: '$(file-add) Setup zerops.yml from scratch(DIY)', action: 'setupYamlFromScratch', description: 'Create a zerops.yml file by selecting options' },
                                    { label: '$(github) Add GitHub Workflow', action: 'initGitHubWorkflow', description: 'Adds GitHub workflow for automated deployments' },
                                    { label: '$(arrow-left) Go Back', action: 'goBack', description: 'Return to main menu', keepMenuOpen: false }
                                ];
                                
                                const configSelected = await vscode.window.showQuickPick(configOptions, {
                                    placeHolder: 'Select a configuration to initialize'
                                });
                                
                                if (configSelected) {
                                    if (configSelected.action === 'goBack') {
                                        keepMenuOpen = true;
                                    } else if (configSelected.action === 'initGitHubWorkflow') {
                                        const workspaceFolders = vscode.workspace.workspaceFolders;
                                        if (!workspaceFolders || workspaceFolders.length === 0) {
                                            vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
                                            keepMenuOpen = true;
                                            continue;
                                        }

                                        const currentWorkspace = workspaceFolders[0].uri.fsPath;
                                        const workflowDir = path.join(currentWorkspace, '.github', 'workflows');
                                        const workflowPath = path.join(workflowDir, 'deploy.yml');

                                        if (fs.existsSync(workflowPath)) {
                                            const overwrite = await vscode.window.showWarningMessage(
                                                'GitHub workflow already exists. Do you want to overwrite it?',
                                                'Yes', 'No'
                                            );
                                            
                                            if (overwrite !== 'Yes') {
                                                keepMenuOpen = true;
                                                continue;
                                            }
                                        }

                                        const settings = await loadProjectSettings();
                                        if (!settings?.serviceId) {
                                            vscode.window.showErrorMessage('No service ID found. Please set a service ID in .vscode/zerops.json or through the Settings menu.');
                                            keepMenuOpen = true;
                                            continue;
                                        }

                                        try {
                                            await githubWorkflowService.addWorkflow();
                                            keepMenuOpen = false;
                                        } catch (error) {
                                            console.error('Failed to create GitHub workflow:', error);
                                            vscode.window.showErrorMessage(`Failed to create GitHub workflow: ${error instanceof Error ? error.message : String(error)}`);
                                            keepMenuOpen = true;
                                        }
                                    } else if (configSelected.action === 'setupYamlFromScratch') {
                                        await YamlGeneratorService.createFromScratch();
                                        keepMenuOpen = false;
                                    } else if (configSelected.action === 'initZYml') {
                                        const workspaceFolders = vscode.workspace.workspaceFolders;
                                        if (!workspaceFolders || workspaceFolders.length === 0) {
                                            vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
                                            keepMenuOpen = true;
                                            continue;
                                        }
                                        
                                        const currentWorkspace = workspaceFolders[0].uri.fsPath;
                                        const zeropsYmlPath = path.join(currentWorkspace, 'zerops.yml');
                                        
                                        if (fs.existsSync(zeropsYmlPath)) {
                                            const overwrite = await vscode.window.showWarningMessage(
                                                'zerops.yml already exists. Do you want to overwrite it?',
                                                'Yes', 'No'
                                            );
                                            
                                            if (overwrite !== 'Yes') {
                                                keepMenuOpen = true;
                                                continue;
                                            }
                                        }
                                        
                                        try {
                                            fs.writeFileSync(zeropsYmlPath, ZEROPS_YML);
                                            vscode.window.showInformationMessage('zerops.yml has been created successfully!');
                                            
                                            const doc = await vscode.workspace.openTextDocument(zeropsYmlPath);
                                            await vscode.window.showTextDocument(doc);
                                            
                                            keepMenuOpen = false;
                                        } catch (error) {
                                            console.error('Failed to create zerops.yml:', error);
                                            vscode.window.showErrorMessage(`Failed to create zerops.yml: ${error instanceof Error ? error.message : String(error)}`);
                                            keepMenuOpen = true;
                                        }
                                    } else if (configSelected.action === 'initZYmlImport') {
                                        const workspaceFolders = vscode.workspace.workspaceFolders;
                                        if (!workspaceFolders || workspaceFolders.length === 0) {
                                            vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
                                            keepMenuOpen = true;
                                            continue;
                                        }
                                        
                                        const currentWorkspace = workspaceFolders[0].uri.fsPath;
                                        const zeropsYmlImportPath = path.join(currentWorkspace, 'zerops-project-import.yml');
                                        
                                        if (fs.existsSync(zeropsYmlImportPath)) {
                                            const overwrite = await vscode.window.showWarningMessage(
                                                'zerops-project-import.yml already exists. Do you want to overwrite it?',
                                                'Yes', 'No'
                                            );
                                            
                                            if (overwrite !== 'Yes') {
                                                keepMenuOpen = true;
                                                continue;
                                            }
                                        }
                                        
                                        try {
                                            fs.writeFileSync(zeropsYmlImportPath, IMPORT_YML);
                                            vscode.window.showInformationMessage('zerops-project-import.yml has been created successfully!');
                                            
                                            const doc = await vscode.workspace.openTextDocument(zeropsYmlImportPath);
                                            await vscode.window.showTextDocument(doc);
                                            
                                            keepMenuOpen = false;
                                        } catch (error) {
                                            console.error('Failed to create zerops-project-import.yml:', error);
                                            vscode.window.showErrorMessage(`Failed to create zerops-project-import.yml: ${error instanceof Error ? error.message : String(error)}`);
                                            keepMenuOpen = true;
                                        }
                                    }
                                } else {
                                    keepMenuOpen = true;
                                }
                            } catch (error) {
                                console.error('Error in init configurations handler:', error);
                                vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                keepMenuOpen = true;
                            }
                        }
                        else if (selected.action === 'support') {
                            const supportOptions = [
                                { label: '$(comment-discussion) Discord Community', action: 'openDiscord', description: 'Join our Discord server' },
                                { label: '$(mail) Email Support', action: 'openEmailSupport', description: 'Contact support@zerops.io' },
                                { label: '$(globe) Forum', action: 'openForumSupport', description: 'Visit support.zerops.io forum' },
                                { label: '$(arrow-left) Go Back', action: 'goBack', description: 'Return to main menu', keepMenuOpen: false }
                            ];
                            
                            const supportSelected = await vscode.window.showQuickPick(supportOptions, {
                                placeHolder: 'Select support option'
                            });
                            
                            if (supportSelected) {
                                if (supportSelected.action === 'goBack') {
                                    keepMenuOpen = true;
                                } else if (supportSelected.action === 'openDiscord') {
                                    await openDiscordServer();
                                    keepMenuOpen = true;
                                } else if (supportSelected.action === 'openEmailSupport') {
                                    const emailAddress = 'support@zerops.io';
                                    const emailOptions = [
                                        { label: '$(mail) Open Mail', action: 'openMail', description: 'Open in default mail client' },
                                        { label: '$(clippy) Copy Email', action: 'copyEmail', description: 'Copy to clipboard' },
                                        { label: '$(arrow-left) Cancel', action: 'cancel', description: 'Go back' }
                                    ];
                                    
                                    const emailAction = await vscode.window.showQuickPick(emailOptions, {
                                        placeHolder: 'Choose action for ' + emailAddress
                                    });
                                    
                                    if (emailAction) {
                                        if (emailAction.action === 'openMail') {
                                            vscode.env.openExternal(vscode.Uri.parse('mailto:' + emailAddress));
                                        } else if (emailAction.action === 'copyEmail') {
                                            vscode.env.clipboard.writeText(emailAddress);
                                            vscode.window.showInformationMessage('Email address copied to clipboard');
                                        }
                                    }
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
                                { label: '$(edit) Set Service ID', action: 'setServiceId', description: 'Configure a Zerops Service ID' },
                                { label: '$(edit) Set Project ID', action: 'setProjectId', description: 'Configure a Zerops Project ID' },
                                { label: '$(sync) Update zCLI', action: 'updateZcli', description: 'Update Zerops CLI to the latest version' },
                                { label: '$(extensions) Check for Extension Updates', action: 'checkExtensionUpdates', description: 'Check for Zerops extension updates', keepMenuOpen: false },
                                { label: '$(sign-out) Logout', action: 'zerops.logout', description: 'Logout from Zerops' },
                                { label: '$(arrow-left) Go Back', action: 'goBack', description: 'Return to main menu', keepMenuOpen: false }
                            ];
                            
                            const settingsSelected = await vscode.window.showQuickPick(settingsOptions, {
                                placeHolder: 'Select settings option'
                            });
                            
                            if (settingsSelected) {
                                if (settingsSelected.action === 'goBack') {
                                    keepMenuOpen = true;
                                } else if (settingsSelected.action === 'setServiceId') {
                                    const currentSettings = await CliService.loadProjectSettings();
                                    const serviceId = await vscode.window.showInputBox({
                                        prompt: 'Enter your Zerops Service ID',
                                        placeHolder: 'Service ID from Zerops Dashboard',
                                        value: currentSettings.serviceId || '',
                                        validateInput: (value: string) => {
                                            return value && value.length > 0 ? null : 'Service ID is required';
                                        }
                                    });
                                    
                                    if (serviceId) {
                                        await CliService.saveProjectSettings({ 
                                            serviceId,
                                            projectId: currentSettings.projectId || ''
                                        });
                                        vscode.window.showInformationMessage('Service ID saved successfully');
                                    }
                                    keepMenuOpen = true;
                                } else if (settingsSelected.action === 'setProjectId') {
                                    const currentSettings = await CliService.loadProjectSettings();
                                    const projectId = await vscode.window.showInputBox({
                                        prompt: 'Enter your Zerops Project ID',
                                        placeHolder: 'Project ID from Zerops Dashboard',
                                        value: currentSettings.projectId || '',
                                        validateInput: (value: string) => {
                                            return value && value.length > 0 ? null : 'Project ID is required';
                                        }
                                    });
                                    
                                    if (projectId) {
                                        await CliService.saveProjectSettings({ 
                                            serviceId: currentSettings.serviceId || '',
                                            projectId
                                        });
                                        vscode.window.showInformationMessage('Project ID saved successfully');
                                    }
                                    keepMenuOpen = true;
                                } else if (settingsSelected.action === 'updateZcli') {
                                    try {
                                        const terminal = vscode.window.createTerminal('Zerops CLI Update');
                                        terminal.show();
                                        terminal.sendText('curl -s https://zerops.io/install.sh | bash');
                                        vscode.window.showInformationMessage('Updating Zerops CLI...');
                                    } catch (error) {
                                        vscode.window.showErrorMessage(`Failed to update Zerops CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                    }
                                    keepMenuOpen = true;
                                } else if (settingsSelected.action === 'checkExtensionUpdates') {
                                    keepMenuOpen = false;
                                    try {
                                        const extensionId = 'zerops.zvsc';
                                        vscode.commands.executeCommand('workbench.extensions.action.showExtensionsWithIds', [extensionId]);
                                    } catch (error) {
                                        vscode.window.showErrorMessage(`Failed to open extension page: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                    }
                                } else {
                                    vscode.commands.executeCommand(settingsSelected.action);
                                    keepMenuOpen = true;
                                }
                            } else {
                                keepMenuOpen = true;
                            }
                        } else if (selected.action === 'zerops.exploreGui') {
                            vscode.commands.executeCommand('zerops.exploreGui');
                            keepMenuOpen = false;
                        } else if (selected.action === 'openDocs') {
                            const panel = vscode.window.createWebviewPanel(
                                'zeropsDocs',
                                'Zerops Documentation',
                                vscode.ViewColumn.One,
                                {
                                    enableScripts: true,
                                    retainContextWhenHidden: true,
                                }
                            );
                            
                            panel.webview.html = `
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                    <meta charset="UTF-8">
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                    <title>Zerops Documentation</title>
                                    <style>
                                        body, html {
                                            margin: 0;
                                            padding: 0;
                                            height: 100%;
                                            overflow: hidden;
                                        }
                                        iframe {
                                            width: 100%;
                                            height: 100vh;
                                            border: none;
                                        }
                                    </style>
                                </head>
                                <body>
                                    <iframe src="https://docs.zerops.io" title="Zerops Documentation"></iframe>
                                </body>
                                </html>
                            `;
                            
                            keepMenuOpen = false;
                        } else if (selected.action === 'zerops.openDashboard') {
                            vscode.env.openExternal(vscode.Uri.parse('https://app.zerops.io/dashboard/projects'));
                            keepMenuOpen = false;
                        } else if (selected.action === 'zerops.openProjectDashboard') {
                            if (settings.projectId) {
                                vscode.env.openExternal(vscode.Uri.parse(`https://app.zerops.io/project/${settings.projectId}/service-stacks`));
                            }
                            keepMenuOpen = false;
                        } else if (selected.action === 'zerops.openServiceDashboard') {
                            if (settings.serviceId) {
                                vscode.env.openExternal(vscode.Uri.parse(`https://app.zerops.io/service-stack/${settings.serviceId}/dashboard`));
                            }
                            keepMenuOpen = false;
                        } else if (selected.action === 'checkExtensionUpdates') {
                            keepMenuOpen = false;
                            try {
                                const extensionId = 'zerops.zvsc';
                                vscode.commands.executeCommand('workbench.extensions.action.showExtensionsWithIds', [extensionId]);
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to open extension page: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            
            serviceStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 2);
            serviceStatusBarItem.text = "$(server) zService";
            serviceStatusBarItem.tooltip = "Explore Zerops Service";
            serviceStatusBarItem.command = 'zerops.exploreServiceFromStatusBar';
            
            pushStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
            pushStatusBarItem.text = "$(cloud-upload) zPush";
            pushStatusBarItem.tooltip = "Push to Zerops";
            pushStatusBarItem.command = 'zerops.pushFromStatusBar';
            
            vpnUpStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
            vpnUpStatusBarItem.text = "$(plug) zVpn Up";
            vpnUpStatusBarItem.tooltip = "Connect to Zerops VPN";
            vpnUpStatusBarItem.command = 'zerops.vpnUpFromStatusBar';
            
            vpnDownStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
            vpnDownStatusBarItem.text = "$(debug-disconnect) zVpn Down";
            vpnDownStatusBarItem.tooltip = "Disconnect from Zerops VPN";
            vpnDownStatusBarItem.command = 'zerops.vpnDownFromStatusBar';
            vpnDownStatusBarItem.show();
            
            zeropsStatusBarItem.show();
            pushStatusBarItem.show();
            vpnUpStatusBarItem.show();
            serviceStatusBarItem.show();
            guiStatusBarItem.show();
            vpnDownStatusBarItem.show();
            
            context.subscriptions.push(zeropsStatusBarItem);
            context.subscriptions.push(pushStatusBarItem);
            context.subscriptions.push(vpnUpStatusBarItem);
            context.subscriptions.push(serviceStatusBarItem);
            context.subscriptions.push(guiStatusBarItem);
            context.subscriptions.push(vpnDownStatusBarItem);
            context.subscriptions.push(showCommandsCommand);
            context.subscriptions.push(pushCommand);
            
            console.log('Created Zerops status bar item');
        } catch (error) {
            console.error('Failed to create status bar items:', error);
        }

        let vpnUpCommand = vscode.commands.registerCommand('zerops.vpnUp', async () => {
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
        
        let vpnDownCommand = vscode.commands.registerCommand('zerops.vpnDown', async () => {
            try {
                await CliService.vpnDown();
            } catch (error) {
                console.error('VPN disconnection failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to disconnect VPN: ${errorMessage}`);
            }
        });

        let openDashboardCommand = vscode.commands.registerCommand('zerops.openDashboard', async () => {
            try {
                vscode.env.openExternal(vscode.Uri.parse('https://app.zerops.io/dashboard/projects'));
            } catch (error) {
                console.error('Failed to open Zerops Dashboard:', error);
                vscode.window.showErrorMessage('Failed to open Zerops Dashboard');
            }
        });

        let openProjectDashboardCommand = vscode.commands.registerCommand('zerops.openProjectDashboard', async () => {
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

        let openServiceDashboardCommand = vscode.commands.registerCommand('zerops.openServiceDashboard', async () => {
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

        let exploreServiceFromStatusBarCommand = vscode.commands.registerCommand('zerops.exploreServiceFromStatusBar', async () => {
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
                
                const serviceOptions = [
                    { label: '$(open-editors-view-icon) Open Service', action: 'zerops.openServiceDashboard', description: 'Opens on Web' },
                    { label: '$(compare-changes) Pipelines & CI/CD', action: 'openServiceDeploy', description: 'Opens on Web' },
                    { label: '$(globe) Subdomain, Domain & IP access', action: 'openServiceRouting', description: 'Opens on Web' },
                    { label: '$(database) Automatic Scaling', action: 'openServiceAutoscaling', description: 'Opens on Web' },
                    { label: '$(settings-gear) Environment Variables', action: 'openServiceUserData', description: 'Opens on Web' },
                    { label: '$(debug) Runtime Log', action: 'openServiceLog', description: 'Opens on Web' },
                    { label: '$(terminal) Remote Web Terminal', action: 'openServiceTerminal', description: 'Opens on Web' },
                    { label: '$(file-directory) File Browser', action: 'openServiceFileBrowser', description: 'Opens on Web' },
                    { label: '$(arrow-left) Go Back', action: 'backToGuiMenu', description: 'Return to previous menu' }
                ];
                
                const serviceSelected = await vscode.window.showQuickPick(serviceOptions, {
                    placeHolder: 'Select Service option'
                });
                
                if (serviceSelected) {
                    if (serviceSelected.action === 'backToGuiMenu') {
                        vscode.commands.executeCommand('zerops.exploreGuiFromStatusBar');
                    } else if (serviceSelected.action === 'zerops.openServiceDashboard') {
                        vscode.commands.executeCommand(serviceSelected.action);
                    } else {
                        let url = '';
                        switch (serviceSelected.action) {
                            case 'openServiceDeploy':
                                url = `https://app.zerops.io/service-stack/${settings.serviceId}/deploy`;
                                break;
                            case 'openServiceRouting':
                                url = `https://app.zerops.io/service-stack/${settings.serviceId}/routing`;
                                break;
                            case 'openServiceAutoscaling':
                                url = `https://app.zerops.io/service-stack/${settings.serviceId}/autoscaling`;
                                break;
                            case 'openServiceUserData':
                                url = `https://app.zerops.io/service-stack/${settings.serviceId}/user-data`;
                                break;
                            case 'openServiceLog':
                                url = `https://app.zerops.io/service-stack/${settings.serviceId}/log`;
                                break;
                            case 'openServiceTerminal':
                                url = `https://app.zerops.io/service-stack/${settings.serviceId}/terminal`;
                                break;
                            case 'openServiceFileBrowser':
                                url = `https://app.zerops.io/service-stack/${settings.serviceId}/file-browser`;
                                break;
                        }
                        
                        if (url) {
                            vscode.env.openExternal(vscode.Uri.parse(url));
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to open Service menu:', error);
                vscode.window.showErrorMessage('Failed to open Service menu');
            }
        });

        let exploreGuiFromStatusBarCommand = vscode.commands.registerCommand('zerops.exploreGuiFromStatusBar', async () => {
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
                        vscode.commands.executeCommand('zerops.showCommands');
                        return;
                    } else if (guiSelected.action === 'exploreProjects') {
                        await handleExploreProjects();
                    } else if (guiSelected.action === 'exploreService') {
                        await handleExploreService(settings);
                    } else {
                        vscode.commands.executeCommand(guiSelected.action);
                    }
                }
            } catch (error) {
                console.error('Failed to open GUI menu:', error);
                vscode.window.showErrorMessage('Failed to open GUI menu');
            }
        });

        let exploreGuiCommand = vscode.commands.registerCommand('zerops.exploreGui', async () => {
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
                
                if (!guiSelected) {
                    return;
                }
                
                if (guiSelected.action === 'goBack') {
                    vscode.commands.executeCommand('zerops.showCommands');
                    return;
                } else if (guiSelected.action === 'exploreProjects') {
                    try {
                        let projects = await CliService.listProjects(true);
                        let projectsShown = false;
                        
                        if (projects.length > 0) {
                            projectsShown = true;
                            
                            const projectOptions = projects.map(project => ({
                                label: `$(project) ${project.name}`,
                                description: project.id,
                                action: 'openProject',
                                projectId: project.id
                            }));
                            
                            projectOptions.push({ 
                                label: '$(arrow-left) Go Back', 
                                action: 'goBack', 
                                description: 'Return to GUI menu',
                                projectId: ''
                            });
                            
                            const refreshingMessage = vscode.window.setStatusBarMessage("$(sync~spin) Refreshing projects...");
                            CliService.listProjects(false)
                                .catch(error => {
                                    console.error('Failed to refresh projects list:', error);
                                })
                                .finally(() => {
                                    refreshingMessage.dispose();
                                });
                            
                            const projectSelected = await vscode.window.showQuickPick(projectOptions, {
                                placeHolder: 'Select a project to open'
                            });
                            
                            if (!projectSelected) {
                                return;
                            }
                            
                            if (projectSelected.action === 'goBack') {
                                vscode.commands.executeCommand('zerops.exploreGui');
                            } else if (projectSelected.action === 'openProject' && projectSelected.projectId) {
                                vscode.env.openExternal(vscode.Uri.parse(`https://app.zerops.io/project/${projectSelected.projectId}/service-stacks`));
                            }
                        }
                        
                        if (!projectsShown) {
                            const loadingMessage = vscode.window.setStatusBarMessage("$(sync~spin) Loading projects...");
                            projects = await CliService.listProjects(false);
                            loadingMessage.dispose();
                            
                            if (projects.length === 0) {
                                vscode.window.showInformationMessage('No projects found.');
                                return;
                            }
                            
                            const projectOptions = projects.map(project => ({
                                label: `$(project) ${project.name}`,
                                description: project.id,
                                action: 'openProject',
                                projectId: project.id
                            }));
                            
                            projectOptions.push({ 
                                label: '$(arrow-left) Go Back', 
                                action: 'goBack', 
                                description: 'Return to GUI menu',
                                projectId: ''
                            });
                            
                            const projectSelected = await vscode.window.showQuickPick(projectOptions, {
                                placeHolder: 'Select a project to open'
                            });
                            
                            if (!projectSelected) {
                                return;
                            }
                            
                            if (projectSelected.action === 'goBack') {
                                vscode.commands.executeCommand('zerops.exploreGui');
                            } else if (projectSelected.action === 'openProject' && projectSelected.projectId) {
                                vscode.env.openExternal(vscode.Uri.parse(`https://app.zerops.io/project/${projectSelected.projectId}/service-stacks`));
                            }
                        }
                    } catch (error) {
                        console.error('Failed to list projects:', error);
                        vscode.window.showErrorMessage('Failed to list projects. Make sure you are logged in.');
                    }
                } else if (guiSelected.action === 'exploreService') {
                    if (settings.serviceId) {
                        const serviceOptions = [
                            { label: '$(open-editors-view-icon) Open Service', action: 'zerops.openServiceDashboard', description: 'Opens on Web' },
                            { label: '$(compare-changes) Pipelines & CI/CD', action: 'openServiceDeploy', description: 'Opens on Web' },
                            { label: '$(globe) Subdomain, Domain & IP access', action: 'openServiceRouting', description: 'Opens on Web' },
                            { label: '$(database) Automatic Scaling', action: 'openServiceAutoscaling', description: 'Opens on Web' },
                            { label: '$(settings-gear) Environment Variables', action: 'openServiceUserData', description: 'Opens on Web' },
                            { label: '$(debug) Runtime Log', action: 'openServiceLog', description: 'Opens on Web' },
                            { label: '$(terminal) Remote Web Terminal', action: 'openServiceTerminal', description: 'Opens on Web' },
                            { label: '$(file-directory) File Browser', action: 'openServiceFileBrowser', description: 'Opens on Web' },
                            { label: '$(arrow-left) Go Back', action: 'backToGuiMenu', description: 'Return to previous menu' }
                        ];
                        
                        const serviceSelected = await vscode.window.showQuickPick(serviceOptions, {
                            placeHolder: 'Select Service option'
                        });
                        
                        if (!serviceSelected) {
                            return;
                        }
                        
                        if (serviceSelected.action === 'backToGuiMenu') {
                            vscode.commands.executeCommand('zerops.exploreGui');
                        } else if (serviceSelected.action === 'zerops.openServiceDashboard') {
                            vscode.commands.executeCommand(serviceSelected.action);
                        } else {
                            let url = '';
                            switch (serviceSelected.action) {
                                case 'openServiceDeploy':
                                    url = `https://app.zerops.io/service-stack/${settings.serviceId}/deploy`;
                                    break;
                                case 'openServiceRouting':
                                    url = `https://app.zerops.io/service-stack/${settings.serviceId}/routing`;
                                    break;
                                case 'openServiceAutoscaling':
                                    url = `https://app.zerops.io/service-stack/${settings.serviceId}/autoscaling`;
                                    break;
                                case 'openServiceUserData':
                                    url = `https://app.zerops.io/service-stack/${settings.serviceId}/user-data`;
                                    break;
                                case 'openServiceLog':
                                    url = `https://app.zerops.io/service-stack/${settings.serviceId}/log`;
                                    break;
                                case 'openServiceTerminal':
                                    url = `https://app.zerops.io/service-stack/${settings.serviceId}/terminal`;
                                    break;
                                case 'openServiceFileBrowser':
                                    url = `https://app.zerops.io/service-stack/${settings.serviceId}/file-browser`;
                                    break;
                            }
                            
                            if (url) {
                                vscode.env.openExternal(vscode.Uri.parse(url));
                            }
                        }
                    } else {
                        vscode.window.showWarningMessage('No Service ID found. Please set a Service ID first.');
                    }
                } else if (guiSelected.action === 'goBack') {
                    vscode.commands.executeCommand('zerops.showCommands');
                    return;
                } else {
                    vscode.commands.executeCommand(guiSelected.action);
                }
            } catch (error) {
                console.error('Failed to open GUI menu:', error);
                vscode.window.showErrorMessage('Failed to open GUI menu');
            }
        });

        const loginCommand = vscode.commands.registerCommand('zerops.login', async () => {
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

        const logoutCommand = vscode.commands.registerCommand('zerops.logout', async () => {
            try {
                await CliService.logout(context);
            } catch (error) {
                console.error('Logout failed:', error);
                vscode.window.showErrorMessage('Failed to logout from Zerops');
            }
        });

        let initProjectCommand = vscode.commands.registerCommand('zerops.initProject', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
                return;
            }
            
            const currentWorkspace = workspaceFolders[0].uri.fsPath;
            
            const importYmlPath = path.join(currentWorkspace, 'import.yml');
            if (!fs.existsSync(importYmlPath)) {
                const { IMPORT_YML } = require('./init');
                fs.writeFileSync(importYmlPath, IMPORT_YML);
                vscode.window.showInformationMessage('Created import.yml file');
            }
            
            const zeropsYmlPath = path.join(currentWorkspace, 'zerops.yml');
            if (!fs.existsSync(zeropsYmlPath)) {
                const { ZEROPS_YML } = require('./init');
                fs.writeFileSync(zeropsYmlPath, ZEROPS_YML);
                vscode.window.showInformationMessage('Created zerops.yml file');
            }
        });

        const costCalculatorStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        costCalculatorStatusBarItem.command = 'zerops.exploreCostCalculator';
        costCalculatorStatusBarItem.text = '$(rocket) zCost';
        costCalculatorStatusBarItem.tooltip = 'Open Cost Calculator';
        costCalculatorStatusBarItem.show();

        const otherToolsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -1);
        otherToolsStatusBarItem.command = 'zerops.otherToolsMenu';
        otherToolsStatusBarItem.text = '$(tools) Other Tools';
        otherToolsStatusBarItem.tooltip = 'Open other tools';
        otherToolsStatusBarItem.show();

        const otherToolsMenuCommand = vscode.commands.registerCommand('zerops.otherToolsMenu', async () => {
            const options = [
                { label: '$(note) Scratchpad', action: 'zerops.openScratchpad' },
                { label: '$(graph) Treemap', action: 'zerops.openTreemap' }
            ];
            const selected = await vscode.window.showQuickPick(options, { placeHolder: 'Select a tool' });
            if (selected) {
                vscode.commands.executeCommand(selected.action);
            }
        });

        reloadStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -1);
        reloadStatusBarItem.text = "$(refresh)";
        reloadStatusBarItem.tooltip = "Reload IDE";
        reloadStatusBarItem.command = 'zerops.reloadExtension';
        reloadStatusBarItem.show();

        const reloadCommand = vscode.commands.registerCommand('zerops.reloadExtension', async () => {
            try {
                CliService.clearProjectsCache();
                CliService.clearSettingsCache();
                CliService.clearSchemaCache();
                
                try {
                    await YamlSchemaService.registerSchema(context);
                } catch (error) {
                    console.error('Failed to refresh schema:', error);
                }
                
                const reloadingMessage = vscode.window.setStatusBarMessage("$(sync~spin) Reloading Zerops extension...");
                
                setTimeout(() => {
                    reloadingMessage.dispose();
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }, 500);
            } catch (error) {
                console.error('Failed to reload extension:', error);
                vscode.window.showErrorMessage('Failed to reload Zerops extension');
            }
        });

        let openTerminalCommand = vscode.commands.registerCommand('zerops.openTerminal', async () => {
            try {
                const terminal = vscode.window.createTerminal('Zerops');
                terminal.show();
            } catch (error) {
                console.error('Failed to open terminal:', error);
                vscode.window.showErrorMessage('Failed to open terminal');
            }
        });

        const commands = [
            vpnUpCommand,
            vpnDownCommand,
            pushCommand,
            vpnUpFromStatusBarCommand,
            vpnDownFromStatusBarCommand,
            exploreServiceFromStatusBarCommand,
            exploreGuiFromStatusBarCommand,
            openDashboardCommand,
            openProjectDashboardCommand,
            openServiceDashboardCommand,
            exploreGuiCommand,
            loginCommand,
            logoutCommand,
            initProjectCommand,
            openTerminalCommand,
            vscode.commands.registerCommand('zerops.initGitHubWorkflow', () => {
                githubWorkflowService.addWorkflow();
            }),
            vscode.commands.registerCommand('zerops.createCommentedGitHubWorkflow', () => {
                githubWorkflowService.addWorkflow();
            }),
//             vscode.commands.registerCommand('zerops.sendFeedback', async () => {
//                 const consent = await vscode.window.showInformationMessage(
//                     'We will collect your git config (name & email), IDE type, and OS information along with your feedback. Do you want to proceed?',
//                     'Yes', 'No'
//                 );

//                 if (consent !== 'Yes') {
//                     return;
//                 }

//                 const feedback = await vscode.window.showInputBox({
//                     prompt: 'Enter your feedback',
//                     placeHolder: 'Type your message here...',
//                     ignoreFocusOut: true
//                 });

//                 if (feedback) {
//                     try {
//                         const webhookUrl = 'https://discord.com/api/webhooks/test';
                        
//                         let gitInfo = 'Git info not available';
//                         try {
//                             const { exec } = require('child_process');
//                             const gitName = await new Promise((resolve) => {
//                                 exec('git config user.name', (error: any, stdout: string) => {
//                                     resolve(error ? '' : stdout.trim());
//                                 });
//                             });
//                             const gitEmail = await new Promise((resolve) => {
//                                 exec('git config user.email', (error: any, stdout: string) => {
//                                     resolve(error ? '' : stdout.trim());
//                                 });
//                             });
//                             gitInfo = `${gitName} <${gitEmail}>`;
//                         } catch (error) {
//                             console.error('Failed to get git info:', error);
//                         }

//                         const response = await fetch(webhookUrl, {
//                             method: 'POST',
//                             headers: {
//                                 'Content-Type': 'application/json',
//                             },
//                             body: JSON.stringify({
//                                 content: `User: ${gitInfo}
// OS: ${process.platform}
// IDE: ${vscode.env.appName}
// Feedback: ${feedback}
// ----------------------------------------`
//                             })
//                         });

//                         if (response.ok) {
//                             vscode.window.showInformationMessage('Thank you for your feedback!');
//                         } else {
//                             throw new Error('Failed to send feedback');
//                         }
//                     } catch (error) {
//                         vscode.window.showErrorMessage('Failed to send feedback. Please try again later.');
//                     }
//                 }
//             }),
            vscode.commands.registerCommand('zerops.openScratchpad', async () => {
                const panel = vscode.window.createWebviewPanel(
                    'zeropsScratchpad',
                    'Scratchpad',
                    vscode.ViewColumn.One,
                    { enableScripts: true }
                );
                const saved = context.globalState.get('zeropsScratchpadContent', '');
                panel.webview.html = `
                    <html>
                    <body style="margin:0;padding:0;background:#1e1e1e;color:#d4d4d4;">
                        <textarea id="scratchpad" style="width:100vw;height:98vh;background:#1e1e1e;color:#d4d4d4;font-size:16px;border:none;outline:none;resize:none;">${saved}</textarea>
                        <script>
                            const vscode = acquireVsCodeApi();
                            const textarea = document.getElementById('scratchpad');
                            textarea.addEventListener('input', () => {
                                vscode.postMessage({ type: 'save', value: textarea.value });
                            });
                        </script>
                    </body>
                    </html>
                `;
                panel.webview.onDidReceiveMessage(msg => {
                    if (msg.type === 'save') {
                        context.globalState.update('zeropsScratchpadContent', msg.value);
                    }
                });
            }),
            vscode.commands.registerCommand('zerops.openTreemap', async () => {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
                    return;
                }
                const rootPath = workspaceFolders[0].uri.fsPath;
                const EXCLUDED_FOLDERS = ['.git', 'node_modules', '.vscode', 'dist', 'build', 'out', 'coverage'];
                const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.rb', '.go', '.cpp', '.c', '.cs', '.php', '.html', '.css', '.json', '.rs', '.kt', '.swift', '.m', '.h', '.sh', '.pl', '.lua', '.dart', '.scala', '.xml', '.yml', '.yaml'];
                let nodeId = 1;
                function scanDir(dir: string, parentId?: number, nodes: any[] = [], edges: any[] = []) {
                    const stats = fs.statSync(dir);
                    const base = path.basename(dir);
                    if (stats.isDirectory()) {
                        if (EXCLUDED_FOLDERS.includes(base) || base.startsWith('.')) {
                            nodes.push({ id: nodeId, label: base, shape: 'ellipse', color: '#888' });
                            if (typeof parentId === 'number') {
                                edges.push({ from: parentId, to: nodeId });
                            }
                            nodeId++;
                            return;
                        }
                        const thisId = nodeId++;
                        nodes.push({ id: thisId, label: base, shape: 'ellipse', color: '#007acc' });
                        if (typeof parentId === 'number') {
                            edges.push({ from: parentId, to: thisId });
                        }
                        const children = fs.readdirSync(dir);
                        for (const name of children) {
                            scanDir(path.join(dir, name), thisId, nodes, edges);
                        }
                    } else {
                        const ext = path.extname(base).toLowerCase();
                        if (CODE_EXTENSIONS.includes(ext)) {
                            const thisId = nodeId++;
                            nodes.push({ id: thisId, label: base, shape: 'box', color: '#444' });
                            if (typeof parentId === 'number') {
                                edges.push({ from: parentId, to: thisId });
                            }
                        }
                    }
                }
                const nodes: any[] = [];
                const edges: any[] = [];
                scanDir(rootPath, undefined, nodes, edges);
                const panel = vscode.window.createWebviewPanel(
                    'codebaseMindMap',
                    'Codebase Mind Map',
                    vscode.ViewColumn.One,
                    { enableScripts: true }
                );
                panel.webview.html = `
                    <html>
                    <head>
                        <meta charset='UTF-8'>
                        <title>Codebase Mind Map</title>
                        <script type="text/javascript" src="https://unpkg.com/vis-network@9.1.2/dist/vis-network.min.js"></script>
                        <link href="https://unpkg.com/vis-network@9.1.2/dist/vis-network.min.css" rel="stylesheet" type="text/css" />
                        <style>
                            body { background: #1e1e1e; color: #d4d4d4; margin: 0; }
                            #mynetwork { width: 100vw; height: 98vh; background: #1e1e1e; }
                        </style>
                    </head>
                    <body>
                        <div id="mynetwork"></div>
                        <script type="text/javascript">
                            const nodes = new vis.DataSet(${JSON.stringify(nodes)});
                            const edges = new vis.DataSet(${JSON.stringify(edges)});
                            const container = document.getElementById('mynetwork');
                            const data = { nodes, edges };
                            const options = {
                                nodes: { font: { color: '#fff' }, borderWidth: 1 },
                                edges: { color: '#888' },
                                layout: { improvedLayout: true },
                                physics: { stabilization: false, barnesHut: { gravitationalConstant: -30000, springLength: 120 } },
                                interaction: { hover: true, navigationButtons: true, keyboard: true }
                            };
                            new vis.Network(container, data, options);
                        </script>
                    </body>
                    </html>
                `;
            }),
            otherToolsMenuCommand
        ];

        context.subscriptions.push(...commands, githubWorkflowService);
        context.subscriptions.push(
            costCalculatorStatusBarItem,
            otherToolsStatusBarItem,
            reloadStatusBarItem,
            reloadCommand
        );

        console.log('Zerops extension activated successfully');

        try {
            const versionInfo = await CliService.checkCliVersion();
            if (versionInfo.needsUpdate) {
                const updateMessage = `zcli update available: ${versionInfo.current} → ${versionInfo.latest}`;
                const updateButton = 'Update Now';
                const response = await vscode.window.showInformationMessage(updateMessage, updateButton);
                
                if (response === updateButton) {
                    await CliService.updateCli();
                }
            }
        } catch (error) {
            console.error('Failed to check zcli version:', error);
        }
    } catch (error) {
        console.error('Failed to activate Zerops extension:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        vscode.window.showErrorMessage(`Failed to initialize Zerops extension: ${errorMessage}`);
    }
}

export function deactivate() {
    console.log('Deactivating Zerops extension...');
    
    YamlSchemaService.dispose();
    
    if (zeropsStatusBarItem) {
        zeropsStatusBarItem.dispose();
    }
    if (pushStatusBarItem) {
        pushStatusBarItem.dispose();
    }
    if (vpnUpStatusBarItem) {
        vpnUpStatusBarItem.dispose();
    }
    if (serviceStatusBarItem) {
        serviceStatusBarItem.dispose();
    }
    if (guiStatusBarItem) {
        guiStatusBarItem.dispose();
    }
    if (vpnDownStatusBarItem) {
        vpnDownStatusBarItem.dispose();
    }
    if (terminalStatusBarItem) {
        terminalStatusBarItem.dispose();
    }
    if (reloadStatusBarItem) {
        reloadStatusBarItem.dispose();
    }
}

async function handleExploreProjects() {
    try {
        let projects = await CliService.listProjects(true);
        let projectsShown = false;
        
        if (projects.length > 0) {
            projectsShown = true;
            
            const projectOptions = projects.map(project => ({
                label: `$(project) ${project.name}`,
                description: project.id,
                action: 'openProject',
                projectId: project.id
            }));
            
            projectOptions.push({ 
                label: '$(arrow-left) Go Back', 
                action: 'goBack', 
                description: 'Return to GUI menu',
                projectId: ''
            });
            
            const refreshingMessage = vscode.window.setStatusBarMessage("$(sync~spin) Refreshing projects...");
            CliService.listProjects(false)
                .catch(error => {
                    console.error('Failed to refresh projects list:', error);
                })
                .finally(() => {
                    refreshingMessage.dispose();
                });
            
            const projectSelected = await vscode.window.showQuickPick(projectOptions, {
                placeHolder: 'Select a project to open'
            });
            
            if (!projectSelected) {
                return;
            }
            
            if (projectSelected.action === 'goBack') {
                vscode.commands.executeCommand('zerops.exploreGuiFromStatusBar');
            } else if (projectSelected.action === 'openProject' && projectSelected.projectId) {
                vscode.env.openExternal(vscode.Uri.parse(`https://app.zerops.io/project/${projectSelected.projectId}/service-stacks`));
            }
        }
        
        if (!projectsShown) {
            const loadingMessage = vscode.window.setStatusBarMessage("$(sync~spin) Loading projects...");
            projects = await CliService.listProjects(false);
            loadingMessage.dispose();
            
            if (projects.length === 0) {
                vscode.window.showInformationMessage('No projects found.');
                return;
            }
            
            const projectOptions = projects.map(project => ({
                label: `$(project) ${project.name}`,
                description: project.id,
                action: 'openProject',
                projectId: project.id
            }));
            
            projectOptions.push({ 
                label: '$(arrow-left) Go Back', 
                action: 'goBack', 
                description: 'Return to GUI menu',
                projectId: ''
            });
            
            const projectSelected = await vscode.window.showQuickPick(projectOptions, {
                placeHolder: 'Select a project to open'
            });
            
            if (!projectSelected) {
                return;
            }
            
            if (projectSelected.action === 'goBack') {
                vscode.commands.executeCommand('zerops.exploreGuiFromStatusBar');
            } else if (projectSelected.action === 'openProject' && projectSelected.projectId) {
                vscode.env.openExternal(vscode.Uri.parse(`https://app.zerops.io/project/${projectSelected.projectId}/service-stacks`));
            }
        }
    } catch (error) {
        console.error('Failed to list projects:', error);
        vscode.window.showErrorMessage('Failed to list projects. Make sure you are logged in.');
    }
}

async function handleExploreService(settings: any) {
    if (!settings || !settings.serviceId) {
        vscode.window.showWarningMessage('No Service ID found. Please set a Service ID first.');
        return;
    }
    
    const serviceOptions = [
        { label: '$(open-editors-view-icon) Open Service', action: 'zerops.openServiceDashboard', description: 'Opens on Web' },
        { label: '$(compare-changes) Pipelines & CI/CD', action: 'openServiceDeploy', description: 'Opens on Web' },
        { label: '$(globe) Subdomain, Domain & IP access', action: 'openServiceRouting', description: 'Opens on Web' },
        { label: '$(database) Automatic Scaling', action: 'openServiceAutoscaling', description: 'Opens on Web' },
        { label: '$(settings-gear) Environment Variables', action: 'openServiceUserData', description: 'Opens on Web' },
        { label: '$(debug) Runtime Log', action: 'openServiceLog', description: 'Opens on Web' },
        { label: '$(terminal) Remote Web Terminal', action: 'openServiceTerminal', description: 'Opens on Web' },
        { label: '$(file-directory) File Browser', action: 'openServiceFileBrowser', description: 'Opens on Web' },
        { label: '$(arrow-left) Go Back', action: 'backToGuiMenu', description: 'Return to previous menu' }
    ];
    
    const serviceSelected = await vscode.window.showQuickPick(serviceOptions, {
        placeHolder: 'Select Service option'
    });
    
    if (!serviceSelected) {
        return;
    }
    
    if (serviceSelected.action === 'backToGuiMenu') {
        vscode.commands.executeCommand('zerops.exploreGuiFromStatusBar');
    } else if (serviceSelected.action === 'zerops.openServiceDashboard') {
        vscode.commands.executeCommand(serviceSelected.action);
    } else {
        let url = '';
        switch (serviceSelected.action) {
            case 'openServiceDeploy':
                url = `https://app.zerops.io/service-stack/${settings.serviceId}/deploy`;
                break;
            case 'openServiceRouting':
                url = `https://app.zerops.io/service-stack/${settings.serviceId}/routing`;
                break;
            case 'openServiceAutoscaling':
                url = `https://app.zerops.io/service-stack/${settings.serviceId}/autoscaling`;
                break;
            case 'openServiceUserData':
                url = `https://app.zerops.io/service-stack/${settings.serviceId}/user-data`;
                break;
            case 'openServiceLog':
                url = `https://app.zerops.io/service-stack/${settings.serviceId}/log`;
                break;
            case 'openServiceTerminal':
                url = `https://app.zerops.io/service-stack/${settings.serviceId}/terminal`;
                break;
            case 'openServiceFileBrowser':
                url = `https://app.zerops.io/service-stack/${settings.serviceId}/file-browser`;
                break;
        }
        
        if (url) {
            vscode.env.openExternal(vscode.Uri.parse(url));
        }
    }
}

async function openDiscordServer() {
    const discordInviteLink = 'https://discord.gg/3yZknaRhxK';
    
    try {
        vscode.env.openExternal(vscode.Uri.parse(discordInviteLink));
    } catch (error) {
        console.error('Failed to open Discord server:', error);
        vscode.window.showErrorMessage('Failed to open Discord server link');
    }
} 