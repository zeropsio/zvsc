import * as vscode from 'vscode';
import { CliService } from './cliService';

export class UIService {
    private static instance: UIService;

    private constructor() {}

    public static getInstance(): UIService {
        if (!UIService.instance) {
            UIService.instance = new UIService();
        }
        return UIService.instance;
    }

    public async handleExploreProjects(): Promise<void> {
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

    public async handleExploreService(settings: any): Promise<void> {
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

    public async openDiscordServer(): Promise<void> {
        const discordInviteLink = 'https://discord.gg/3yZknaRhxK';
        
        try {
            vscode.env.openExternal(vscode.Uri.parse(discordInviteLink));
        } catch (error) {
            console.error('Failed to open Discord server:', error);
            vscode.window.showErrorMessage('Failed to open Discord server link');
        }
    }
} 