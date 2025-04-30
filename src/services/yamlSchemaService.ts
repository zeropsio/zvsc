import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CliService } from './cliService';

export class YamlSchemaService {
    private static disposable: vscode.Disposable | null = null;
    private static readonly SCHEMA_FILENAME = 'zerops-yml-schema.json';

    static async registerSchema(context: vscode.ExtensionContext): Promise<void> {
        try {
            const schema = await CliService.fetchYamlSchema(true);
            const schemaPath = path.join(context.extensionPath, this.SCHEMA_FILENAME);
            fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
            console.log('Zerops YAML schema saved successfully:', schemaPath);
        } catch (error) {
            console.error('Failed to save YAML schema:', error);
        }
    }

    static dispose(): void {
        if (this.disposable) {
            this.disposable.dispose();
            this.disposable = null;
        }
    }
} 