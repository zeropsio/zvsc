import * as vscode from 'vscode';
import { CliService } from './services/cliService';

// Store references to status bar items
let zeropsStatusBarItem: vscode.StatusBarItem;
let pushStatusBarItem: vscode.StatusBarItem;
let vpnUpStatusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating Zerops extension...');
    
    try {
        // Check if zcli is installed
        const isCliInstalled = await CliService.checkCliInstalled();
        if (!isCliInstalled) {
            throw new Error('zcli is not installed. Please install zcli to use this extension.');
        }
        
        // Check if user is already logged in first
        await CliService.checkLoginStatus();
        
        // If not logged in, try auto-login
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

        // Register commands first
        // Register Push from status bar command
        let pushFromStatusBarCommand = vscode.commands.registerCommand('zerops.pushFromStatusBar', async () => {
            try {
                const settings = await CliService.loadProjectSettings();
                
                if (!settings.serviceId) {
                    // No serviceId saved, prompt the user to enter one
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
                    // Use the saved serviceId
                    await CliService.pushToService(settings.serviceId);
                }
            } catch (error) {
                console.error('Push failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to push: ${errorMessage}`);
            }
        });
        
        // Register VPN Up status bar command
        let vpnUpFromStatusBarCommand = vscode.commands.registerCommand('zerops.vpnUpFromStatusBar', async () => {
            try {
                const settings = await CliService.loadProjectSettings();
                
                if (!settings.projectId) {
                    // No projectId saved, prompt the user to enter one
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
                    // Use the saved projectId
                    await CliService.vpnUp(settings.projectId, false);
                }
            } catch (error) {
                console.error('VPN connection failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to connect VPN: ${errorMessage}`);
            }
        });
        
        // Register VPN Down status bar command
        let vpnDownFromStatusBarCommand = vscode.commands.registerCommand('zerops.vpnDownFromStatusBar', async () => {
            try {
                await CliService.vpnDown();
            } catch (error) {
                console.error('VPN disconnection failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to disconnect VPN: ${errorMessage}`);
            }
        });

        // Now create status bar items after commands are registered
        try {
            // Create a single status bar item for all Zerops commands
            zeropsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 2);
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
                        const settings = await CliService.loadProjectSettings();
                        const hasServiceId = settings && settings.serviceId;
                        const hasProjectId = settings && settings.projectId;
                        
                        let commands = [];
                        
                        // Add operational commands if applicable
                        if (hasServiceId) {
                            commands.push({ label: '$(cloud-upload) Push to Zerops', action: 'zerops.pushFromStatusBar', keepOpen: false });
                        }
                        
                        if (hasProjectId) {
                            commands.push({ label: '$(plug) VPN Up', action: 'zerops.vpnUpFromStatusBar', keepOpen: false });
                            commands.push({ label: '$(circle-slash) VPN Down', action: 'zerops.vpnDownFromStatusBar', keepOpen: false });
                        }
                        
                        // Add configuration options based on what's missing or needs editing
                        if (hasServiceId) {
                            commands.push({ label: '$(edit) Edit Service ID', action: 'setupServiceId', keepOpen: true });
                        } else {
                            commands.push({ label: '$(add) Add Service ID', action: 'setupServiceId', keepOpen: true });
                        }
                        
                        if (hasProjectId) {
                            commands.push({ label: '$(edit) Edit Project ID', action: 'setupProjectId', keepOpen: true });
                        } else {
                            commands.push({ label: '$(add) Add Project ID', action: 'setupProjectId', keepOpen: true });
                        }
                        
                        // Add login option only if user is not logged in
                        if (!CliService.getLoginStatus()) {
                            commands.push({ label: '$(key) Login with Access Token', action: 'zerops.login', keepOpen: false });
                        } else {
                            // Add logout option if they are logged in
                            commands.push({ label: '$(sign-out) Logout from Zerops', action: 'zerops.logout', keepOpen: false });
                        }
                        
                        const selected = await vscode.window.showQuickPick(commands, {
                            placeHolder: 'Zerops Commands'
                        });
                        
                        if (!selected) {
                            // User canceled the menu
                            keepMenuOpen = false;
                            continue;
                        }
                        
                        if (selected.action === 'setupServiceId') {
                            // Handle Service ID setup
                            const serviceId = await vscode.window.showInputBox({
                                prompt: 'Enter your Zerops Service ID',
                                placeHolder: 'Service ID from Zerops Dashboard',
                                value: hasServiceId ? settings.serviceId : '',  // Pre-fill with existing value if editing
                                ignoreFocusOut: true,
                                validateInput: (value: string) => {
                                    return value && value.length > 0 ? null : 'Service ID is required';
                                }
                            });
                            
                            if (serviceId) {
                                // Save the service ID
                                await CliService.saveProjectSettings({ 
                                    serviceId,
                                    projectId: settings?.projectId || ''
                                });
                                vscode.window.showInformationMessage(`Service ID ${hasServiceId ? 'updated' : 'added'} successfully`);
                            }
                            
                            // Menu stays open for configuration actions
                            keepMenuOpen = selected.keepOpen;
                        } else if (selected.action === 'setupProjectId') {
                            // Handle Project ID setup
                            const projectId = await vscode.window.showInputBox({
                                prompt: 'Enter your Zerops Project ID',
                                placeHolder: 'Project ID from Zerops Dashboard',
                                value: hasProjectId ? settings.projectId : '',  // Pre-fill with existing value if editing
                                ignoreFocusOut: true,
                                validateInput: (value: string) => {
                                    return value && value.length > 0 ? null : 'Project ID is required';
                                }
                            });
                            
                            if (projectId) {
                                // Save the project ID
                                await CliService.saveProjectSettings({ 
                                    serviceId: settings?.serviceId || '',
                                    projectId
                                });
                                vscode.window.showInformationMessage(`Project ID ${hasProjectId ? 'updated' : 'added'} successfully`);
                            }
                            
                            // Menu stays open for configuration actions
                            keepMenuOpen = selected.keepOpen;
                        } else {
                            // For operational commands, execute and close menu
                            vscode.commands.executeCommand(selected.action);
                            keepMenuOpen = selected.keepOpen;
                        }
                    }
                } catch (error) {
                    console.error('Error handling Zerops commands:', error);
                    vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            });
            
            // Create dedicated Push button
            pushStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
            pushStatusBarItem.text = "$(cloud-upload) zPush";
            pushStatusBarItem.tooltip = "Push to Zerops";
            pushStatusBarItem.command = 'zerops.pushFromStatusBar';
            
            // Create dedicated VPN Up button
            vpnUpStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
            vpnUpStatusBarItem.text = "$(plug) zVpn Up";
            vpnUpStatusBarItem.tooltip = "Connect to Zerops VPN";
            vpnUpStatusBarItem.command = 'zerops.vpnUpFromStatusBar';
            
            // Show all status bar items
            zeropsStatusBarItem.show();
            pushStatusBarItem.show();
            vpnUpStatusBarItem.show();
            
            // Register all status bar items with the extension context
            context.subscriptions.push(zeropsStatusBarItem);
            context.subscriptions.push(pushStatusBarItem);
            context.subscriptions.push(vpnUpStatusBarItem);
            context.subscriptions.push(showCommandsCommand);
            
            console.log('Created Zerops status bar item');
        } catch (error) {
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

        // Include the new commands in the context subscriptions
        context.subscriptions.push(
            loginCommand,
            logoutCommand,
            vpnUpCommand,
            vpnDownCommand,
            pushFromStatusBarCommand,
            vpnUpFromStatusBarCommand,
            vpnDownFromStatusBarCommand
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
} 