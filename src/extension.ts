import * as vscode from 'vscode';
import { CliService } from './services/cliService';
import * as fs from 'fs';
import * as path from 'path';
import { Recipe, RecipeOption, CloneOption } from './types';
import { RECIPES } from './recipes';
import { ZEROPS_YML, IMPORT_YML } from './init';

let zeropsStatusBarItem: vscode.StatusBarItem;
let pushStatusBarItem: vscode.StatusBarItem;
let vpnUpStatusBarItem: vscode.StatusBarItem;
let serviceStatusBarItem: vscode.StatusBarItem;
let guiStatusBarItem: vscode.StatusBarItem;
let vpnDownStatusBarItem: vscode.StatusBarItem;

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

        let pushFromStatusBarCommand = vscode.commands.registerCommand('zerops.pushFromStatusBar', async () => {
            try {
                const settings = await CliService.loadProjectSettings();
                
                if (!settings.serviceId) {
                    const serviceId = await vscode.window.showInputBox({
                        prompt: 'Enter your Zerops Service ID',
                        placeHolder: 'Service ID from Zerops Dashboard',
                        ignoreFocusOut: true,
                        validateInput: (value: string) => {
                            return value && value.length > 0 ? null : 'Service ID is required';
                        }
                    });
                    
                    if (serviceId) {
                        await CliService.pushToService(serviceId);
                    }
                } else {
                    await CliService.pushToService(settings.serviceId);
                }
            } catch (error) {
                console.error('Push failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to push: ${errorMessage}`);
            }
        });
        
        let vpnUpFromStatusBarCommand = vscode.commands.registerCommand('zerops.vpnUpFromStatusBar', async () => {
            try {
                const settings = await CliService.loadProjectSettings();
                
                if (!settings.projectId) {
                    const projectId = await vscode.window.showInputBox({
                        prompt: 'Enter your Zerops Project ID',
                        placeHolder: 'Project ID from Zerops Dashboard',
                        ignoreFocusOut: true,
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
                        
                        if (hasServiceId) {
                            commands.push({ label: '$(cloud-upload) Push to Zerops', action: 'zerops.pushFromStatusBar', keepOpen: false });
                        }
                        
                        if (hasProjectId) {
                            commands.push({ label: '$(plug) VPN Up', action: 'zerops.vpnUpFromStatusBar', keepOpen: false });
                            commands.push({ label: '$(debug-disconnect) VPN Down', action: 'zerops.vpnDownFromStatusBar', keepOpen: false });
                        }
                        
                        commands.push({ label: '$(globe) Explore GUI', action: 'exploreGui', keepOpen: true });

                        commands.push({ label: '$(book) Zerops Docs', action: 'openDocs', keepOpen: false });
                        
                        commands.push({ label: '$(repo-clone) Clone Recipe', action: 'cloneRecipe', keepOpen: true });

                        commands.push({ label: '$(file-add) Init Configurations', action: 'initConfigurations', keepOpen: true });

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

                        if (selected.action === 'cloneRecipe') {
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
                                    placeHolder: 'Select a recipe to clone',
                                    ignoreFocusOut: true
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
                                            placeHolder: 'Where to clone the repository?',
                                            ignoreFocusOut: true
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
                                    { label: '$(file-code) Init zerops.yml', action: 'initZYml', description: 'Initializes a zerops.yml file in root' },
                                    { label: '$(file-code) Init zerops-project-import.yml', action: 'initZYmlImport', description: 'Initializes a zerops-project-import.yml file in root' },
                                    { label: '$(arrow-left) Go Back', action: 'goBack', description: 'Return to main menu' }
                                ];
                                
                                const configSelected = await vscode.window.showQuickPick(configOptions, {
                                    placeHolder: 'Select a configuration to initialize',
                                    ignoreFocusOut: true
                                });
                                
                                if (configSelected) {
                                    if (configSelected.action === 'goBack') {
                                        keepMenuOpen = true;
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
                        else if (selected.action === 'settings') {
                            const settingsOptions = [];
                            
                            if (hasServiceId && hasProjectId) {
                                settingsOptions.push({ label: '$(gear) Edit Configuration', action: 'editConfiguration', description: 'Edit Service and Project IDs' });
                            } else {
                                if (hasServiceId) {
                                    settingsOptions.push({ label: '$(edit) Edit Service ID', action: 'setupServiceId', description: `Current: ${settings.serviceId}` });
                                } else {
                                    settingsOptions.push({ label: '$(add) Add Service ID', action: 'setupServiceId', description: 'Configure Service ID' });
                                }
                                
                                if (hasProjectId) {
                                    settingsOptions.push({ label: '$(edit) Edit Project ID', action: 'setupProjectId', description: `Current: ${settings.projectId}` });
                                } else {
                                    settingsOptions.push({ label: '$(add) Add Project ID', action: 'setupProjectId', description: 'Configure Project ID' });
                                }
                            }
                            
                            if (CliService.getLoginStatus()) {
                                settingsOptions.push({ label: '$(sign-out) Logout from Zerops', action: 'zerops.logout', description: 'Sign out from Zerops' });
                            }
                            
                            settingsOptions.push({ label: '$(arrow-left) Go Back', action: 'goBack', description: 'Return to main menu' });
                            
                            const settingsSelected = await vscode.window.showQuickPick(settingsOptions, {
                                placeHolder: 'Settings'
                            });
                            
                            if (settingsSelected) {
                                if (settingsSelected.action === 'goBack') {
                                    keepMenuOpen = true;
                                } else if (settingsSelected.action === 'editConfiguration') {
                                    const configOptions = [
                                        { label: '$(edit) Edit Service ID', action: 'setupServiceId', description: `Current: ${settings.serviceId}` },
                                        { label: '$(edit) Edit Project ID', action: 'setupProjectId', description: `Current: ${settings.projectId}` },
                                        { label: '$(arrow-left) Go Back', action: 'goBackToSettings', description: 'Return to Settings' }
                                    ];
                                    
                                    const configSelected = await vscode.window.showQuickPick(configOptions, {
                                        placeHolder: 'Select configuration to edit'
                                    });
                                    
                                    if (configSelected) {
                                        if (configSelected.action === 'goBackToSettings') {
                                            continue;
                                        } else if (configSelected.action === 'setupServiceId') {
                                            const serviceId = await vscode.window.showInputBox({
                                                prompt: 'Enter your Zerops Service ID',
                                                placeHolder: 'Service ID from Zerops Dashboard',
                                                value: settings.serviceId,
                                                ignoreFocusOut: true,
                                                validateInput: (value: string) => {
                                                    return value && value.length > 0 ? null : 'Service ID is required';
                                                }
                                            });
                                            
                                            if (serviceId) {
                                                await CliService.saveProjectSettings({ 
                                                    serviceId,
                                                    projectId: settings.projectId
                                                });
                                                vscode.window.showInformationMessage('Service ID updated successfully');
                                            }
                                        } else if (configSelected.action === 'setupProjectId') {
                                            const projectId = await vscode.window.showInputBox({
                                                prompt: 'Enter your Zerops Project ID',
                                                placeHolder: 'Project ID from Zerops Dashboard',
                                                value: settings.projectId,
                                                ignoreFocusOut: true,
                                                validateInput: (value: string) => {
                                                    return value && value.length > 0 ? null : 'Project ID is required';
                                                }
                                            });
                                            
                                            if (projectId) {
                                                await CliService.saveProjectSettings({ 
                                                    serviceId: settings.serviceId,
                                                    projectId
                                                });
                                                vscode.window.showInformationMessage('Project ID updated successfully');
                                            }
                                        }
                                    }
                                    
                                    keepMenuOpen = true;
                                } else {
                                    vscode.commands.executeCommand(settingsSelected.action);
                                    if (settingsSelected.action === 'zerops.logout') {
                                        keepMenuOpen = false;
                                    } else {
                                        keepMenuOpen = true;
                                    }
                                }
                            } else {
                                keepMenuOpen = true;
                            }
                        } else if (selected.action === 'exploreGui') {
                            const guiOptions = [
                                { label: '$(browser) Open GUI', action: 'zerops.openDashboard', description: 'Opens on Web' },
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
                                    keepMenuOpen = true;
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
                                        
                                        if (serviceSelected) {
                                            if (serviceSelected.action === 'backToGuiMenu') {
                                                const guiOptions = [
                                                    { label: '$(browser) Open GUI', action: 'zerops.openDashboard', description: 'Opens on Web' },
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
                                                
                                                const nextGuiSelected = await vscode.window.showQuickPick(guiOptions, {
                                                    placeHolder: 'Select GUI to open'
                                                });
                                                
                                                if (nextGuiSelected) {
                                                    if (nextGuiSelected.action === 'goBack') {
                                                        keepMenuOpen = true;
                                                    } else if (nextGuiSelected.action === 'exploreService') {
                                                        keepMenuOpen = true;
                                                    } else {
                                                        vscode.commands.executeCommand(nextGuiSelected.action);
                                                        keepMenuOpen = false;
                                                    }
                                                } else {
                                                    keepMenuOpen = true;
                                                }
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
                                    } else {
                                        vscode.window.showWarningMessage('No Service ID found. Please set a Service ID first.');
                                    }
                                } else {
                                    vscode.commands.executeCommand(guiSelected.action);
                                }
                            }
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
            
            guiStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
            guiStatusBarItem.text = "$(globe) zGUI";
            guiStatusBarItem.tooltip = "Explore Zerops GUI";
            guiStatusBarItem.command = 'zerops.exploreGuiFromStatusBar';
            
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
            
            console.log('Created Zerops status bar item');
        } catch (error) {
            console.error('Failed to create status bar items:', error);
        }

        let loginCommand = vscode.commands.registerCommand('zerops.login', async () => {
            try {
                const token = await vscode.window.showInputBox({
                    prompt: 'Enter your Zerops Personal Access Token',
                    placeHolder: 'Your token from Zerops Access Token Management',
                    password: true,
                    ignoreFocusOut: true,
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

        let logoutCommand = vscode.commands.registerCommand('zerops.logout', async () => {
            try {
                await CliService.logout(context);
            } catch (error) {
                console.error('Logout failed:', error);
                vscode.window.showErrorMessage('Failed to logout from Zerops');
            }
        });
        
        let vpnUpCommand = vscode.commands.registerCommand('zerops.vpnUp', async () => {
            try {
                const projectId = await vscode.window.showInputBox({
                    prompt: 'Enter your Zerops Project ID',
                    placeHolder: 'Project ID from Zerops Dashboard',
                    ignoreFocusOut: true,
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
                        ignoreFocusOut: true,
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
                        const guiOptions = [
                            { label: '$(browser) Open GUI', action: 'zerops.openDashboard', description: 'Opens on Web' },
                        ];
                        
                        if (settings.projectId) {
                            guiOptions.push({ 
                                label: '$(project) Open Project', 
                                action: 'zerops.openProjectDashboard', 
                                description: `Opens on Web` 
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
                            } else if (guiSelected.action === 'exploreService') {
                                vscode.commands.executeCommand('zerops.exploreServiceFromStatusBar');
                            } else {
                                vscode.commands.executeCommand(guiSelected.action);
                            }
                        }
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
                const settings = await CliService.loadProjectSettings();
                const hasServiceId = settings && settings.serviceId;
                const hasProjectId = settings && settings.projectId;
                
                const guiOptions = [
                    { label: '$(browser) Open GUI', action: 'zerops.openDashboard', description: 'Opens on Web' },
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
                        } else {
                            vscode.window.showWarningMessage('No Service ID found. Please set a Service ID first.');
                        }
                    } else {
                        vscode.commands.executeCommand(guiSelected.action);
                    }
                }
            } catch (error) {
                console.error('Failed to open GUI menu:', error);
                vscode.window.showErrorMessage('Failed to open GUI menu');
            }
        });

        context.subscriptions.push(
            loginCommand,
            logoutCommand,
            vpnUpCommand,
            vpnDownCommand,
            pushFromStatusBarCommand,
            vpnUpFromStatusBarCommand,
            vpnDownFromStatusBarCommand,
            exploreServiceFromStatusBarCommand,
            exploreGuiFromStatusBarCommand,
            openDashboardCommand,
            openProjectDashboardCommand,
            openServiceDashboardCommand
        );

        console.log('Zerops extension activated successfully');
    } catch (error) {
        console.error('Failed to activate Zerops extension:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        vscode.window.showErrorMessage(`Failed to initialize Zerops extension: ${errorMessage}`);
    }
}

export function deactivate() {
    console.log('Deactivating Zerops extension...');
    
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
} 