import * as vscode from 'vscode';

export class StatusBarService implements vscode.Disposable {
    private static instance: StatusBarService;
    
    private zeropsStatusBarItem!: vscode.StatusBarItem;
    private pushStatusBarItem!: vscode.StatusBarItem;
    private vpnUpStatusBarItem!: vscode.StatusBarItem;
    private serviceStatusBarItem!: vscode.StatusBarItem;
    private guiStatusBarItem!: vscode.StatusBarItem;
    private vpnDownStatusBarItem!: vscode.StatusBarItem;
    private terminalStatusBarItem!: vscode.StatusBarItem;

    private constructor() {
        this.initializeStatusBarItems();
    }

    public static getInstance(): StatusBarService {
        if (!StatusBarService.instance) {
            StatusBarService.instance = new StatusBarService();
        }
        return StatusBarService.instance;
    }

    private initializeStatusBarItems(): void {
        this.zeropsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 3);
        this.zeropsStatusBarItem.text = "$(rocket) Zerops";
        this.zeropsStatusBarItem.tooltip = "Zerops Controls";
        this.zeropsStatusBarItem.command = 'zerops.showCommands';
        
        this.pushStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
        this.pushStatusBarItem.text = "$(cloud-upload) zPush";
        this.pushStatusBarItem.tooltip = "Push to Zerops";
        this.pushStatusBarItem.command = 'zerops.pushFromStatusBar';
        
        this.serviceStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 2);
        this.serviceStatusBarItem.text = "$(server) zService";
        this.serviceStatusBarItem.tooltip = "Explore Zerops Service";
        this.serviceStatusBarItem.command = 'zerops.exploreServiceFromStatusBar';
        
        this.guiStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
        this.guiStatusBarItem.text = "$(globe) zGUI";
        this.guiStatusBarItem.tooltip = "Explore Zerops GUI";
        this.guiStatusBarItem.command = 'zerops.exploreGuiFromStatusBar';
        
        this.vpnUpStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
        this.vpnUpStatusBarItem.text = "$(plug) zVpn Up";
        this.vpnUpStatusBarItem.tooltip = "Connect to Zerops VPN";
        this.vpnUpStatusBarItem.command = 'zerops.vpnUpFromStatusBar';
        
        this.vpnDownStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
        this.vpnDownStatusBarItem.text = "$(debug-disconnect) zVpn Down";
        this.vpnDownStatusBarItem.tooltip = "Disconnect from Zerops VPN";
        this.vpnDownStatusBarItem.command = 'zerops.vpnDownFromStatusBar';
        
        this.terminalStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.terminalStatusBarItem.text = "$(terminal) Terminal";
        this.terminalStatusBarItem.tooltip = "Open Zerops Terminal";
        this.terminalStatusBarItem.command = 'zerops.openTerminal';
    }

    public showAll(): void {
        this.zeropsStatusBarItem.show();
        this.pushStatusBarItem.show();
        this.vpnUpStatusBarItem.show();
        this.serviceStatusBarItem.show();
        this.guiStatusBarItem.show();
        this.vpnDownStatusBarItem.show();
        this.terminalStatusBarItem.show();
    }

    public updateVisibility(): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            this.showAll();
        }
    }

    public registerHandlers(): void {
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.updateVisibility();
            }
        });
    }

    public registerToSubscriptions(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            this.zeropsStatusBarItem,
            this.pushStatusBarItem,
            this.vpnUpStatusBarItem,
            this.serviceStatusBarItem,
            this.guiStatusBarItem,
            this.vpnDownStatusBarItem,
            this.terminalStatusBarItem
        );
    }

    public dispose(): void {
        this.zeropsStatusBarItem.dispose();
        this.pushStatusBarItem.dispose();
        this.vpnUpStatusBarItem.dispose();
        this.serviceStatusBarItem.dispose();
        this.guiStatusBarItem.dispose();
        this.vpnDownStatusBarItem.dispose();
        this.terminalStatusBarItem.dispose();
    }
} 