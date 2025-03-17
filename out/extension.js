"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const cliService_1 = require("./services/cliService");
const fs = require("fs");
const path = require("path");
const recipes_1 = require("./recipes");
const init_1 = require("./init");
// Store references to status bar items
let zeropsStatusBarItem;
let pushStatusBarItem;
let vpnUpStatusBarItem;
let serviceStatusBarItem;
let guiStatusBarItem;
let vpnDownStatusBarItem;
async function activate(context) {
    console.log('Activating Zerops extension...');
    try {
        // Check if zcli is installed
        const isCliInstalled = await cliService_1.CliService.checkCliInstalled();
        if (!isCliInstalled) {
            throw new Error('zcli is not installed. Please install zcli to use this extension.');
        }
        // Check if user is already logged in first
        await cliService_1.CliService.checkLoginStatus();
        // If not logged in, try auto-login
        if (!cliService_1.CliService.getLoginStatus()) {
            try {
                const isLoggedIn = await cliService_1.CliService.autoLogin(context);
                if (isLoggedIn) {
                    console.log('Auto-login successful');
                }
            }
            catch (error) {
                console.error('Auto-login failed:', error);
            }
        }
        else {
            console.log('User is already logged in');
        }
        // Register commands first
        // Register Push from status bar command
        let pushFromStatusBarCommand = vscode.commands.registerCommand('zerops.pushFromStatusBar', async () => {
            try {
                const settings = await cliService_1.CliService.loadProjectSettings();
                if (!settings.serviceId) {
                    // No serviceId saved, prompt the user to enter one
                    const serviceId = await vscode.window.showInputBox({
                        prompt: 'Enter your Zerops Service ID',
                        placeHolder: 'Service ID from Zerops Dashboard',
                        ignoreFocusOut: true,
                        validateInput: (value) => {
                            return value && value.length > 0 ? null : 'Service ID is required';
                        }
                    });
                    if (serviceId) {
                        await cliService_1.CliService.pushToService(serviceId);
                    }
                }
                else {
                    // Use the saved serviceId
                    await cliService_1.CliService.pushToService(settings.serviceId);
                }
            }
            catch (error) {
                console.error('Push failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to push: ${errorMessage}`);
            }
        });
        // Register VPN Up status bar command
        let vpnUpFromStatusBarCommand = vscode.commands.registerCommand('zerops.vpnUpFromStatusBar', async () => {
            try {
                const settings = await cliService_1.CliService.loadProjectSettings();
                if (!settings.projectId) {
                    // No projectId saved, prompt the user to enter one
                    const projectId = await vscode.window.showInputBox({
                        prompt: 'Enter your Zerops Project ID',
                        placeHolder: 'Project ID from Zerops Dashboard',
                        ignoreFocusOut: true,
                        validateInput: (value) => {
                            return value && value.length > 0 ? null : 'Project ID is required';
                        }
                    });
                    if (projectId) {
                        await cliService_1.CliService.vpnUp(projectId, false);
                    }
                }
                else {
                    // Use the saved projectId
                    await cliService_1.CliService.vpnUp(settings.projectId, false);
                }
            }
            catch (error) {
                console.error('VPN connection failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to connect VPN: ${errorMessage}`);
            }
        });
        // Register VPN Down status bar command
        let vpnDownFromStatusBarCommand = vscode.commands.registerCommand('zerops.vpnDownFromStatusBar', async () => {
            try {
                await cliService_1.CliService.vpnDown();
            }
            catch (error) {
                console.error('VPN disconnection failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to disconnect VPN: ${errorMessage}`);
            }
        });
        // Now create status bar items after commands are registered
        try {
            // Create a single status bar item for all Zerops commands
            zeropsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 3);
            zeropsStatusBarItem.text = "$(rocket) Zerops";
            zeropsStatusBarItem.tooltip = "Zerops Controls";
            // Create QuickPick menu command
            zeropsStatusBarItem.command = 'zerops.showCommands';
            // Register the command for the QuickPick menu
            const showCommandsCommand = vscode.commands.registerCommand('zerops.showCommands', async () => {
                try {
                    let keepMenuOpen = true;
                    // Continue showing the menu until explicitly closed
                    while (keepMenuOpen) {
                        // Check if project settings exist
                        const settings = await cliService_1.CliService.loadProjectSettings();
                        const hasServiceId = settings && settings.serviceId;
                        const hasProjectId = settings && settings.projectId;
                        let commands = [];
                        // Add operational commands if applicable
                        if (hasServiceId) {
                            commands.push({ label: '$(cloud-upload) Push to Zerops', action: 'zerops.pushFromStatusBar', keepOpen: false });
                        }
                        if (hasProjectId) {
                            commands.push({ label: '$(plug) VPN Up', action: 'zerops.vpnUpFromStatusBar', keepOpen: false });
                            commands.push({ label: '$(debug-disconnect) VPN Down', action: 'zerops.vpnDownFromStatusBar', keepOpen: false });
                        }
                        // Add Explore GUI option before configuration options
                        commands.push({ label: '$(globe) Explore GUI', action: 'exploreGui', keepOpen: true });
                        // Add Clone Recipe option
                        commands.push({ label: '$(repo-clone) Clone Recipe', action: 'cloneRecipe', keepOpen: true });
                        // Add Init Configurations option
                        commands.push({ label: '$(file-add) Init Configurations', action: 'initConfigurations', keepOpen: true });
                        // Add Zerops Docs option
                        commands.push({ label: '$(book) Zerops Docs', action: 'openDocs', keepOpen: false });
                        // Add Settings menu option with gear icon
                        commands.push({ label: '$(gear) Settings', action: 'settings', keepOpen: true });
                        // If user is not logged in, show login directly in the main menu
                        if (!cliService_1.CliService.getLoginStatus()) {
                            commands.push({ label: '$(key) Login with Access Token', action: 'zerops.login', keepOpen: false });
                        }
                        const selected = await vscode.window.showQuickPick(commands, {
                            placeHolder: 'Zerops Commands'
                        });
                        if (!selected) {
                            // User canceled the menu
                            keepMenuOpen = false;
                            continue;
                        }
                        // Handle the Clone Recipe option
                        if (selected.action === 'cloneRecipe') {
                            try {
                                // Use recipes from recipes.ts instead of reading from JSON file
                                const recipes = recipes_1.RECIPES;
                                // Create recipe options for the quick pick
                                const recipeOptions = recipes.map((recipe) => ({
                                    label: `$(repo) ${recipe.name}`,
                                    action: 'clone',
                                    description: `Clone ${recipe.url}`,
                                    url: recipe.url,
                                    name: recipe.name
                                }));
                                // Add Go Back option
                                recipeOptions.push({
                                    label: '$(arrow-left) Go Back',
                                    action: 'goBack',
                                    description: 'Return to main menu',
                                    url: '',
                                    name: ''
                                });
                                // Show the recipes menu
                                const recipeSelected = await vscode.window.showQuickPick(recipeOptions, {
                                    placeHolder: 'Select a recipe to clone',
                                    ignoreFocusOut: true
                                });
                                if (recipeSelected) {
                                    if (recipeSelected.action === 'goBack') {
                                        // Just keep menu open to return to main menu
                                        keepMenuOpen = true;
                                    }
                                    else {
                                        // Ask user where to clone the repository
                                        const cloneOptions = [
                                            { label: '$(folder-opened) Clone to a new directory', action: 'newDir', description: `Create a new directory: ${recipeSelected.name}` },
                                            { label: '$(root-folder) Clone to current workspace root', action: 'root', description: 'Files will be copied to the workspace root' },
                                            { label: '$(arrow-left) Go Back', action: 'goBack', description: 'Return to recipe selection' }
                                        ];
                                        const cloneOption = await vscode.window.showQuickPick(cloneOptions, {
                                            placeHolder: 'Where to clone the repository?',
                                            ignoreFocusOut: true
                                        });
                                        if (cloneOption) {
                                            if (cloneOption.action === 'goBack') {
                                                // Stay on the recipe menu
                                                continue;
                                            }
                                            else {
                                                // Get the current workspace folder
                                                const workspaceFolders = vscode.workspace.workspaceFolders;
                                                if (!workspaceFolders || workspaceFolders.length === 0) {
                                                    vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
                                                    keepMenuOpen = true;
                                                    continue;
                                                }
                                                const currentWorkspace = workspaceFolders[0].uri.fsPath;
                                                // Determine the clone path
                                                let clonePath = currentWorkspace;
                                                if (cloneOption.action === 'newDir') {
                                                    clonePath = path.join(currentWorkspace, recipeSelected.name);
                                                    // Check if directory already exists
                                                    if (fs.existsSync(clonePath)) {
                                                        const overwrite = await vscode.window.showWarningMessage(`Directory '${recipeSelected.name}' already exists. Do you want to overwrite it?`, 'Yes', 'No');
                                                        if (overwrite !== 'Yes') {
                                                            keepMenuOpen = true;
                                                            continue;
                                                        }
                                                    }
                                                }
                                                // Show progress while cloning
                                                await vscode.window.withProgress({
                                                    location: vscode.ProgressLocation.Notification,
                                                    title: `Cloning ${recipeSelected.name}...`,
                                                    cancellable: false
                                                }, async (progress) => {
                                                    progress.report({ increment: 0 });
                                                    try {
                                                        // Determine git clone options based on where to clone
                                                        let gitArgs = ['clone', recipeSelected.url];
                                                        if (cloneOption.action === 'newDir') {
                                                            // For new directory, just use the default git clone behavior
                                                            // which creates a new directory with the repo name
                                                            gitArgs.push(recipeSelected.name);
                                                        }
                                                        else {
                                                            // For root directory, clone directly to current directory
                                                            gitArgs.push('.');
                                                        }
                                                        // Execute git clone command
                                                        const { spawn } = require('child_process');
                                                        const git = spawn('git', gitArgs, { cwd: currentWorkspace });
                                                        let errorOutput = '';
                                                        git.stderr.on('data', (data) => {
                                                            const output = data.toString();
                                                            console.log(`Git stderr: ${output}`);
                                                            // Git progress messages also come through stderr
                                                            if (output.includes('Cloning into')) {
                                                                progress.report({ increment: 20, message: 'Starting clone operation...' });
                                                            }
                                                            else if (output.includes('Resolving deltas')) {
                                                                progress.report({ increment: 40, message: 'Resolving deltas...' });
                                                            }
                                                            else {
                                                                errorOutput += output;
                                                            }
                                                        });
                                                        // Wait for process to complete
                                                        await new Promise((resolve, reject) => {
                                                            git.on('close', (code) => {
                                                                if (code === 0) {
                                                                    resolve(code);
                                                                }
                                                                else {
                                                                    reject(new Error(`Git clone failed with code ${code}: ${errorOutput}`));
                                                                }
                                                            });
                                                        });
                                                        // No need for temp directory or copying files anymore
                                                        progress.report({ increment: 100, message: 'Clone completed successfully!' });
                                                        vscode.window.showInformationMessage(`Successfully cloned ${recipeSelected.name}`);
                                                    }
                                                    catch (error) {
                                                        console.error('Clone failed:', error);
                                                        vscode.window.showErrorMessage(`Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`);
                                                    }
                                                });
                                                keepMenuOpen = false;
                                            }
                                        }
                                        else {
                                            // User canceled, go back to main menu
                                            keepMenuOpen = true;
                                        }
                                    }
                                }
                                else {
                                    // User canceled, go back to main menu
                                    keepMenuOpen = true;
                                }
                            }
                            catch (error) {
                                console.error('Error in clone recipe handler:', error);
                                vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                keepMenuOpen = true;
                            }
                        }
                        // Handle the Init Configurations option
                        else if (selected.action === 'initConfigurations') {
                            try {
                                // Create configuration options
                                const configOptions = [
                                    { label: '$(file-code) Init zerops.yml', action: 'initZYml', description: 'Initializes a zerops.yml file in root' },
                                    { label: '$(file-code) Init zerops-project-import.yml', action: 'initZYmlImport', description: 'Initializes a zerops-project-import.yml file in root' },
                                    { label: '$(arrow-left) Go Back', action: 'goBack', description: 'Return to main menu' }
                                ];
                                // Show configuration options
                                const configSelected = await vscode.window.showQuickPick(configOptions, {
                                    placeHolder: 'Select a configuration to initialize',
                                    ignoreFocusOut: true
                                });
                                if (configSelected) {
                                    if (configSelected.action === 'goBack') {
                                        // Just keep menu open to return to main menu
                                        keepMenuOpen = true;
                                    }
                                    else if (configSelected.action === 'initZYml') {
                                        // Get the current workspace folder
                                        const workspaceFolders = vscode.workspace.workspaceFolders;
                                        if (!workspaceFolders || workspaceFolders.length === 0) {
                                            vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
                                            keepMenuOpen = true;
                                            continue;
                                        }
                                        const currentWorkspace = workspaceFolders[0].uri.fsPath;
                                        const zeropsYmlPath = path.join(currentWorkspace, 'zerops.yml');
                                        // Check if zerops.yml already exists
                                        if (fs.existsSync(zeropsYmlPath)) {
                                            // Ask for confirmation to overwrite
                                            const overwrite = await vscode.window.showWarningMessage('zerops.yml already exists. Do you want to overwrite it?', 'Yes', 'No');
                                            if (overwrite !== 'Yes') {
                                                keepMenuOpen = true;
                                                continue;
                                            }
                                        }
                                        // No confirmation needed if file doesn't exist
                                        // Create zerops.yml file
                                        try {
                                            fs.writeFileSync(zeropsYmlPath, init_1.ZEROPS_YML);
                                            vscode.window.showInformationMessage('zerops.yml has been created successfully!');
                                            // Open the file in the editor
                                            const doc = await vscode.workspace.openTextDocument(zeropsYmlPath);
                                            await vscode.window.showTextDocument(doc);
                                            keepMenuOpen = false;
                                        }
                                        catch (error) {
                                            console.error('Failed to create zerops.yml:', error);
                                            vscode.window.showErrorMessage(`Failed to create zerops.yml: ${error instanceof Error ? error.message : String(error)}`);
                                            keepMenuOpen = true;
                                        }
                                    }
                                    else if (configSelected.action === 'initZYmlImport') {
                                        // Get the current workspace folder
                                        const workspaceFolders = vscode.workspace.workspaceFolders;
                                        if (!workspaceFolders || workspaceFolders.length === 0) {
                                            vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
                                            keepMenuOpen = true;
                                            continue;
                                        }
                                        const currentWorkspace = workspaceFolders[0].uri.fsPath;
                                        const zeropsYmlImportPath = path.join(currentWorkspace, 'zerops-project-import.yml');
                                        // Check if zerops-project-import.yml already exists
                                        if (fs.existsSync(zeropsYmlImportPath)) {
                                            // Ask for confirmation to overwrite
                                            const overwrite = await vscode.window.showWarningMessage('zerops-project-import.yml already exists. Do you want to overwrite it?', 'Yes', 'No');
                                            if (overwrite !== 'Yes') {
                                                keepMenuOpen = true;
                                                continue;
                                            }
                                        }
                                        // No confirmation needed if file doesn't exist
                                        // Create zerops-project-import.yml file
                                        try {
                                            fs.writeFileSync(zeropsYmlImportPath, init_1.IMPORT_YML);
                                            vscode.window.showInformationMessage('zerops-project-import.yml has been created successfully!');
                                            // Open the file in the editor
                                            const doc = await vscode.workspace.openTextDocument(zeropsYmlImportPath);
                                            await vscode.window.showTextDocument(doc);
                                            keepMenuOpen = false;
                                        }
                                        catch (error) {
                                            console.error('Failed to create zerops-project-import.yml:', error);
                                            vscode.window.showErrorMessage(`Failed to create zerops-project-import.yml: ${error instanceof Error ? error.message : String(error)}`);
                                            keepMenuOpen = true;
                                        }
                                    }
                                }
                                else {
                                    // User canceled, go back to main menu
                                    keepMenuOpen = true;
                                }
                            }
                            catch (error) {
                                console.error('Error in init configurations handler:', error);
                                vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                keepMenuOpen = true;
                            }
                        }
                        // Handle the Settings menu option
                        else if (selected.action === 'settings') {
                            const settingsOptions = [];
                            // Add configuration options based on what's available
                            if (hasServiceId && hasProjectId) {
                                // If both IDs are configured, show a single Edit Configuration option
                                settingsOptions.push({ label: '$(gear) Edit Configuration', action: 'editConfiguration', description: 'Edit Service and Project IDs' });
                            }
                            else {
                                // Otherwise, show individual options based on what's missing or needs editing
                                if (hasServiceId) {
                                    settingsOptions.push({ label: '$(edit) Edit Service ID', action: 'setupServiceId', description: `Current: ${settings.serviceId}` });
                                }
                                else {
                                    settingsOptions.push({ label: '$(add) Add Service ID', action: 'setupServiceId', description: 'Configure Service ID' });
                                }
                                if (hasProjectId) {
                                    settingsOptions.push({ label: '$(edit) Edit Project ID', action: 'setupProjectId', description: `Current: ${settings.projectId}` });
                                }
                                else {
                                    settingsOptions.push({ label: '$(add) Add Project ID', action: 'setupProjectId', description: 'Configure Project ID' });
                                }
                            }
                            // Add logout option if they are logged in
                            if (cliService_1.CliService.getLoginStatus()) {
                                settingsOptions.push({ label: '$(sign-out) Logout from Zerops', action: 'zerops.logout', description: 'Sign out from Zerops' });
                            }
                            // Add Go Back option
                            settingsOptions.push({ label: '$(arrow-left) Go Back', action: 'goBack', description: 'Return to main menu' });
                            const settingsSelected = await vscode.window.showQuickPick(settingsOptions, {
                                placeHolder: 'Settings'
                            });
                            if (settingsSelected) {
                                if (settingsSelected.action === 'goBack') {
                                    // Keep menu open to return to main menu
                                    keepMenuOpen = true;
                                }
                                else if (settingsSelected.action === 'editConfiguration') {
                                    // Handle editing both Service ID and Project ID in a submenu
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
                                            // Skip to next iteration to show settings menu again
                                            continue;
                                        }
                                        else if (configSelected.action === 'setupServiceId') {
                                            // Handle Service ID setup
                                            const serviceId = await vscode.window.showInputBox({
                                                prompt: 'Enter your Zerops Service ID',
                                                placeHolder: 'Service ID from Zerops Dashboard',
                                                value: settings.serviceId,
                                                ignoreFocusOut: true,
                                                validateInput: (value) => {
                                                    return value && value.length > 0 ? null : 'Service ID is required';
                                                }
                                            });
                                            if (serviceId) {
                                                // Save the service ID
                                                await cliService_1.CliService.saveProjectSettings({
                                                    serviceId,
                                                    projectId: settings.projectId
                                                });
                                                vscode.window.showInformationMessage('Service ID updated successfully');
                                            }
                                        }
                                        else if (configSelected.action === 'setupProjectId') {
                                            // Handle Project ID setup
                                            const projectId = await vscode.window.showInputBox({
                                                prompt: 'Enter your Zerops Project ID',
                                                placeHolder: 'Project ID from Zerops Dashboard',
                                                value: settings.projectId,
                                                ignoreFocusOut: true,
                                                validateInput: (value) => {
                                                    return value && value.length > 0 ? null : 'Project ID is required';
                                                }
                                            });
                                            if (projectId) {
                                                // Save the project ID
                                                await cliService_1.CliService.saveProjectSettings({
                                                    serviceId: settings.serviceId,
                                                    projectId
                                                });
                                                vscode.window.showInformationMessage('Project ID updated successfully');
                                            }
                                        }
                                    }
                                    // Keep the menu open after editing configuration
                                    keepMenuOpen = true;
                                }
                                else {
                                    // For other settings options (direct ones like setupServiceId, setupProjectId, or logout)
                                    vscode.commands.executeCommand(settingsSelected.action);
                                    if (settingsSelected.action === 'zerops.logout') {
                                        keepMenuOpen = false; // Close menu after logout
                                    }
                                    else {
                                        keepMenuOpen = true; // Keep open for other actions
                                    }
                                }
                            }
                            else {
                                // User canceled the settings menu, go back to main menu
                                keepMenuOpen = true;
                            }
                        }
                        else if (selected.action === 'exploreGui') {
                            // Create submenu options for GUI navigation
                            const guiOptions = [
                                { label: '$(browser) Open GUI', action: 'zerops.openDashboard', description: 'Opens on Web' },
                            ];
                            // Add project option if available
                            if (hasProjectId) {
                                guiOptions.push({
                                    label: '$(project) Open Project',
                                    action: 'zerops.openProjectDashboard',
                                    description: `Opens on Web`
                                });
                            }
                            // Add Explore Service option if available (instead of Open Service)
                            if (hasServiceId) {
                                guiOptions.push({
                                    label: '$(server) Explore Service',
                                    action: 'exploreService',
                                    description: `Explore service options`
                                });
                            }
                            // Add Go Back option at the bottom
                            guiOptions.push({
                                label: '$(arrow-left) Go Back',
                                action: 'goBack',
                                description: 'Return to main menu'
                            });
                            // Show the submenu
                            const guiSelected = await vscode.window.showQuickPick(guiOptions, {
                                placeHolder: 'Select GUI to open'
                            });
                            if (guiSelected) {
                                if (guiSelected.action === 'goBack') {
                                    // Show the GUI options again via recursive handling
                                    // The exploreGui action will be handled in the next iteration
                                    keepMenuOpen = true;
                                }
                                else if (guiSelected.action === 'exploreService') {
                                    // Show service-specific options directly in the current flow
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
                                                // Re-show the GUI menu options
                                                const guiOptions = [
                                                    { label: '$(browser) Open GUI', action: 'zerops.openDashboard', description: 'Opens on Web' },
                                                ];
                                                // Add project option if available
                                                if (hasProjectId) {
                                                    guiOptions.push({
                                                        label: '$(project) Open Project',
                                                        action: 'zerops.openProjectDashboard',
                                                        description: `Opens on Web`
                                                    });
                                                }
                                                // Add Explore Service option if available
                                                if (hasServiceId) {
                                                    guiOptions.push({
                                                        label: '$(server) Explore Service',
                                                        action: 'exploreService',
                                                        description: `Explore service options`
                                                    });
                                                }
                                                // Add Go Back option at the bottom
                                                guiOptions.push({
                                                    label: '$(arrow-left) Go Back',
                                                    action: 'goBack',
                                                    description: 'Return to main menu'
                                                });
                                                // Re-show the GUI submenu
                                                const nextGuiSelected = await vscode.window.showQuickPick(guiOptions, {
                                                    placeHolder: 'Select GUI to open'
                                                });
                                                if (nextGuiSelected) {
                                                    if (nextGuiSelected.action === 'goBack') {
                                                        // Just keep menu open to continue loop from main menu
                                                        keepMenuOpen = true;
                                                    }
                                                    else if (nextGuiSelected.action === 'exploreService') {
                                                        // Handled in next iteration
                                                        keepMenuOpen = true;
                                                    }
                                                    else {
                                                        // Execute the selected GUI action
                                                        vscode.commands.executeCommand(nextGuiSelected.action);
                                                        keepMenuOpen = false;
                                                    }
                                                }
                                                else {
                                                    // If cancelled, stay on main menu
                                                    keepMenuOpen = true;
                                                }
                                            }
                                            else if (serviceSelected.action === 'zerops.openServiceDashboard') {
                                                // Use the existing command for service dashboard
                                                vscode.commands.executeCommand(serviceSelected.action);
                                            }
                                            else {
                                                // Handle custom service URLs
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
                                    }
                                    else {
                                        vscode.window.showWarningMessage('No Service ID found. Please set a Service ID first.');
                                    }
                                }
                                else {
                                    // Execute the selected GUI action
                                    vscode.commands.executeCommand(guiSelected.action);
                                }
                            }
                        }
                        else if (selected.action === 'zerops.openDashboard') {
                            vscode.env.openExternal(vscode.Uri.parse('https://app.zerops.io/dashboard/projects'));
                            keepMenuOpen = false;
                        }
                        else if (selected.action === 'zerops.openProjectDashboard') {
                            if (settings.projectId) {
                                vscode.env.openExternal(vscode.Uri.parse(`https://app.zerops.io/project/${settings.projectId}/service-stacks`));
                            }
                            keepMenuOpen = false;
                        }
                        else if (selected.action === 'zerops.openServiceDashboard') {
                            if (settings.serviceId) {
                                vscode.env.openExternal(vscode.Uri.parse(`https://app.zerops.io/service-stack/${settings.serviceId}/dashboard`));
                            }
                            keepMenuOpen = false;
                        }
                        else if (selected.action === 'openDocs') {
                            // Create and show webview panel for docs inside VS Code
                            const panel = vscode.window.createWebviewPanel('zeropsDocs', // Unique ID
                            'Zerops Documentation', // Title displayed in the tab
                            vscode.ViewColumn.One, // Open in the first editor column
                            {
                                enableScripts: true,
                                retainContextWhenHidden: true, // Keep the webview content when hidden
                            });
                            // Set the webview's HTML content - loading the docs website
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
                        }
                        else {
                            // For operational commands, execute and close menu
                            vscode.commands.executeCommand(selected.action);
                            keepMenuOpen = selected.keepOpen;
                        }
                    }
                }
                catch (error) {
                    console.error('Error handling Zerops commands:', error);
                    vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            });
            // Create dedicated Explore Service button
            serviceStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 2);
            serviceStatusBarItem.text = "$(server) zService";
            serviceStatusBarItem.tooltip = "Explore Zerops Service";
            serviceStatusBarItem.command = 'zerops.exploreServiceFromStatusBar';
            // Create dedicated Explore GUI button
            guiStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
            guiStatusBarItem.text = "$(globe) zGUI";
            guiStatusBarItem.tooltip = "Explore Zerops GUI";
            guiStatusBarItem.command = 'zerops.exploreGuiFromStatusBar';
            // Create dedicated Push button
            pushStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
            pushStatusBarItem.text = "$(cloud-upload) zPush";
            pushStatusBarItem.tooltip = "Push to Zerops";
            pushStatusBarItem.command = 'zerops.pushFromStatusBar';
            // Create dedicated VPN Up button (moved to right side)
            vpnUpStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
            vpnUpStatusBarItem.text = "$(plug) zVpn Up";
            vpnUpStatusBarItem.tooltip = "Connect to Zerops VPN";
            vpnUpStatusBarItem.command = 'zerops.vpnUpFromStatusBar';
            // Create dedicated VPN Down button on the right side
            vpnDownStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
            vpnDownStatusBarItem.text = "$(debug-disconnect) zVpn Down";
            vpnDownStatusBarItem.tooltip = "Disconnect from Zerops VPN";
            vpnDownStatusBarItem.command = 'zerops.vpnDownFromStatusBar';
            // Show all status bar items
            zeropsStatusBarItem.show();
            pushStatusBarItem.show();
            vpnUpStatusBarItem.show();
            serviceStatusBarItem.show();
            guiStatusBarItem.show();
            vpnDownStatusBarItem.show();
            // Register all status bar items with the extension context
            context.subscriptions.push(zeropsStatusBarItem);
            context.subscriptions.push(pushStatusBarItem);
            context.subscriptions.push(vpnUpStatusBarItem);
            context.subscriptions.push(serviceStatusBarItem);
            context.subscriptions.push(guiStatusBarItem);
            context.subscriptions.push(vpnDownStatusBarItem);
            context.subscriptions.push(showCommandsCommand);
            console.log('Created Zerops status bar item');
        }
        catch (error) {
            console.error('Failed to create status bar items:', error);
        }
        // Register other commands
        let loginCommand = vscode.commands.registerCommand('zerops.login', async () => {
            try {
                const token = await vscode.window.showInputBox({
                    prompt: 'Enter your Zerops Personal Access Token',
                    placeHolder: 'Your token from Zerops Access Token Management',
                    password: true,
                    ignoreFocusOut: true,
                    validateInput: (value) => {
                        return value && value.length > 0 ? null : 'Token is required';
                    }
                });
                if (token) {
                    await cliService_1.CliService.login(token, context);
                }
            }
            catch (error) {
                console.error('Login failed:', error);
                vscode.window.showErrorMessage('Failed to login to Zerops');
            }
        });
        let logoutCommand = vscode.commands.registerCommand('zerops.logout', async () => {
            try {
                await cliService_1.CliService.logout(context);
            }
            catch (error) {
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
                    validateInput: (value) => {
                        return value && value.length > 0 ? null : 'Project ID is required';
                    }
                });
                if (projectId) {
                    const autoDisconnect = await vscode.window.showQuickPick(['Yes', 'No'], {
                        placeHolder: 'Auto-disconnect existing VPN connections?'
                    });
                    await cliService_1.CliService.vpnUp(projectId, autoDisconnect === 'Yes');
                }
            }
            catch (error) {
                console.error('VPN connection failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to connect VPN: ${errorMessage}`);
            }
        });
        let vpnDownCommand = vscode.commands.registerCommand('zerops.vpnDown', async () => {
            try {
                await cliService_1.CliService.vpnDown();
            }
            catch (error) {
                console.error('VPN disconnection failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to disconnect VPN: ${errorMessage}`);
            }
        });
        // Register the extension commands
        let openDashboardCommand = vscode.commands.registerCommand('zerops.openDashboard', async () => {
            try {
                vscode.env.openExternal(vscode.Uri.parse('https://app.zerops.io/dashboard/projects'));
            }
            catch (error) {
                console.error('Failed to open Zerops Dashboard:', error);
                vscode.window.showErrorMessage('Failed to open Zerops Dashboard');
            }
        });
        let openProjectDashboardCommand = vscode.commands.registerCommand('zerops.openProjectDashboard', async () => {
            try {
                const settings = await cliService_1.CliService.loadProjectSettings();
                if (settings.projectId) {
                    vscode.env.openExternal(vscode.Uri.parse(`https://app.zerops.io/project/${settings.projectId}/service-stacks`));
                }
                else {
                    vscode.window.showWarningMessage('No Project ID found. Please set a Project ID first.');
                }
            }
            catch (error) {
                console.error('Failed to open Project Dashboard:', error);
                vscode.window.showErrorMessage('Failed to open Project Dashboard');
            }
        });
        let openServiceDashboardCommand = vscode.commands.registerCommand('zerops.openServiceDashboard', async () => {
            try {
                const settings = await cliService_1.CliService.loadProjectSettings();
                if (settings.serviceId) {
                    vscode.env.openExternal(vscode.Uri.parse(`https://app.zerops.io/service-stack/${settings.serviceId}/dashboard`));
                }
                else {
                    vscode.window.showWarningMessage('No Service ID found. Please set a Service ID first.');
                }
            }
            catch (error) {
                console.error('Failed to open Service Dashboard:', error);
                vscode.window.showErrorMessage('Failed to open Service Dashboard');
            }
        });
        // Add a command to handle Explore Service from status bar
        let exploreServiceFromStatusBarCommand = vscode.commands.registerCommand('zerops.exploreServiceFromStatusBar', async () => {
            try {
                // Check if project settings exist
                const settings = await cliService_1.CliService.loadProjectSettings();
                if (!settings || !settings.serviceId) {
                    // No service ID saved, prompt the user to enter one
                    const serviceId = await vscode.window.showInputBox({
                        prompt: 'Enter your Zerops Service ID',
                        placeHolder: 'Service ID from Zerops Dashboard',
                        ignoreFocusOut: true,
                        validateInput: (value) => {
                            return value && value.length > 0 ? null : 'Service ID is required';
                        }
                    });
                    if (!serviceId) {
                        return; // User cancelled
                    }
                    // Save the service ID
                    await cliService_1.CliService.saveProjectSettings({
                        serviceId,
                        projectId: settings?.projectId || ''
                    });
                    vscode.window.showInformationMessage('Service ID saved successfully');
                }
                // Show service options
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
                        // Stay on the same command, but recreate the GUI menu without going back to main menu
                        // Create a new instance of the GUI menu in the current context
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
                        // Show the GUI menu directly instead of re-triggering the command
                        const guiSelected = await vscode.window.showQuickPick(guiOptions, {
                            placeHolder: 'Select GUI to open'
                        });
                        if (guiSelected) {
                            if (guiSelected.action === 'goBack') {
                                // Just return, which closes the menu
                                return;
                            }
                            else if (guiSelected.action === 'exploreService') {
                                // Display the service options again (re-show the menu we came from)
                                vscode.commands.executeCommand('zerops.exploreServiceFromStatusBar');
                            }
                            else {
                                // Execute the selected GUI action
                                vscode.commands.executeCommand(guiSelected.action);
                            }
                        }
                    }
                    else if (serviceSelected.action === 'zerops.openServiceDashboard') {
                        // Use the existing command for service dashboard
                        vscode.commands.executeCommand(serviceSelected.action);
                    }
                    else {
                        // Handle custom service URLs
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
            }
            catch (error) {
                console.error('Failed to open Service menu:', error);
                vscode.window.showErrorMessage('Failed to open Service menu');
            }
        });
        // Add a command to handle Explore GUI from status bar
        let exploreGuiFromStatusBarCommand = vscode.commands.registerCommand('zerops.exploreGuiFromStatusBar', async () => {
            try {
                // Check if project settings exist
                const settings = await cliService_1.CliService.loadProjectSettings();
                const hasServiceId = settings && settings.serviceId;
                const hasProjectId = settings && settings.projectId;
                // Create submenu options for GUI navigation
                const guiOptions = [
                    { label: '$(browser) Open GUI', action: 'zerops.openDashboard', description: 'Opens on Web' },
                ];
                // Add project option if available
                if (hasProjectId) {
                    guiOptions.push({
                        label: '$(project) Open Project',
                        action: 'zerops.openProjectDashboard',
                        description: `Opens on Web`
                    });
                }
                // Add Explore Service option if available
                if (hasServiceId) {
                    guiOptions.push({
                        label: '$(server) Explore Service',
                        action: 'exploreService',
                        description: `Explore service options`
                    });
                }
                // Add Go Back option at the bottom
                guiOptions.push({
                    label: '$(arrow-left) Go Back',
                    action: 'goBack',
                    description: 'Return to main menu'
                });
                // Show the submenu
                const guiSelected = await vscode.window.showQuickPick(guiOptions, {
                    placeHolder: 'Select GUI to open'
                });
                if (guiSelected) {
                    if (guiSelected.action === 'goBack') {
                        // Just return, closing the menu
                        return;
                    }
                    else if (guiSelected.action === 'exploreService') {
                        // Show service-specific options directly in the current flow
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
                                    // Just return to the previous menu
                                    vscode.commands.executeCommand('zerops.exploreGuiFromStatusBar');
                                }
                                else if (serviceSelected.action === 'zerops.openServiceDashboard') {
                                    // Use the existing command for service dashboard
                                    vscode.commands.executeCommand(serviceSelected.action);
                                }
                                else {
                                    // Handle custom service URLs
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
                        }
                        else {
                            vscode.window.showWarningMessage('No Service ID found. Please set a Service ID first.');
                        }
                    }
                    else {
                        // Execute the selected GUI action
                        vscode.commands.executeCommand(guiSelected.action);
                    }
                }
            }
            catch (error) {
                console.error('Failed to open GUI menu:', error);
                vscode.window.showErrorMessage('Failed to open GUI menu');
            }
        });
        // Include the new commands in the context subscriptions
        context.subscriptions.push(loginCommand, logoutCommand, vpnUpCommand, vpnDownCommand, pushFromStatusBarCommand, vpnUpFromStatusBarCommand, vpnDownFromStatusBarCommand, exploreServiceFromStatusBarCommand, exploreGuiFromStatusBarCommand, openDashboardCommand, openProjectDashboardCommand, openServiceDashboardCommand);
        console.log('Zerops extension activated successfully');
    }
    catch (error) {
        console.error('Failed to activate Zerops extension:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        vscode.window.showErrorMessage(`Failed to initialize Zerops extension: ${errorMessage}`);
    }
}
exports.activate = activate;
function deactivate() {
    console.log('Deactivating Zerops extension...');
    // Clean up status bar items if they exist
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
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map