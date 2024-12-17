import * as vscode from 'vscode';

export class ZeropsProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly context: vscode.ExtensionContext) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body { 
                            padding: 10px;
                            color: var(--vscode-foreground);
                            font-family: var(--vscode-font-family);
                        }
                        .container {
                            display: flex;
                            flex-direction: column;
                            align-items: start;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Zerops</h2>
                    </div>
                </body>
            </html>
        `;
    }
} 