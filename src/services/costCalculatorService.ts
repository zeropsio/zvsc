import * as vscode from 'vscode';

const PRICING = {
  CORES: {
    SHARED: 0.60,
    DEDICATED: 6.00
  },
  RAM: 0.75,
  DISK: 0.05,
  PROJECTS: {
    LIGHTWEIGHT: 0,
    SERIOUS: 10
  },
  ADDITIONAL: {
    DEDICATED_IPV4: 3.00,
    OBJECT_STORAGE: 0.01,
    EXTRA_EGRESS: 0.02,
    EXTRA_BACKUP: 0.50,
    EXTRA_BUILD_TIME: 0.50
  }
};

type CalculationState = {
  projectType: string;
  cpuType: string;
  cpuCount: number;
  ram: number;
  disk: number;
  dedicatedIpv4: boolean;
  objectStorage: number;
  extraEgress: number;
  extraBackup: number;
  extraBuildTime: number;
  totalCost: number;
};

export class CostCalculatorService implements vscode.Disposable {
  private static instance: CostCalculatorService;
  private disposed = false;

  private constructor() {
  }

  public static getInstance(): CostCalculatorService {
    if (!CostCalculatorService.instance) {
      CostCalculatorService.instance = new CostCalculatorService();
    }
    return CostCalculatorService.instance;
  }

  public async startCalculator() {
    const state: CalculationState = {
      projectType: 'lightweight',
      cpuType: 'shared',
      cpuCount: 1,
      ram: 1,
      disk: 1,
      dedicatedIpv4: false,
      objectStorage: 0,
      extraEgress: 0,
      extraBackup: 0,
      extraBuildTime: 0,
      totalCost: 0
    };
    
    await this.startCalculatorFlow(state);
  }

  private async startCalculatorFlow(state: CalculationState) {
    const totalCostStatusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      101
    );
    totalCostStatusBar.text = `$(dollar) $0.00 per 30d`;
    totalCostStatusBar.tooltip = "Current estimated cost";
    totalCostStatusBar.show();
    
    try {
      interface CostCalculatorQuickPickItem extends vscode.QuickPickItem {
        id: string;
      }
      
      const projectTypeResult = await vscode.window.showQuickPick<CostCalculatorQuickPickItem>([
        { label: "Lightweight Core", description: "Free", id: "lightweight" },
        { label: "Serious Core", description: "$10/30 days", id: "serious" }
      ], {
        placeHolder: "Select project core type"
      });
      
      if (!projectTypeResult) {
        totalCostStatusBar.dispose();
        return;
      }
      
      state.projectType = projectTypeResult.id;
      state.totalCost = this.calculateTotalCost(state);
      totalCostStatusBar.text = `$(dollar) $${state.totalCost.toFixed(2)} per 30d`;
      
      const cpuTypeResult = await vscode.window.showQuickPick<CostCalculatorQuickPickItem>([
        { label: "Shared CPU", description: "$0.60 per CPU/30d", id: "shared" },
        { label: "Dedicated CPU", description: "$6.00 per CPU/30d", id: "dedicated" }
      ], {
        placeHolder: "Select CPU type"
      });
      
      if (!cpuTypeResult) {
        totalCostStatusBar.dispose();
        return;
      }
      
      state.cpuType = cpuTypeResult.id;
      state.totalCost = this.calculateTotalCost(state);
      totalCostStatusBar.text = `$(dollar) $${state.totalCost.toFixed(2)} per 30d`;
      
      const cpuCountResult = await vscode.window.showInputBox({
        value: state.cpuCount.toString(),
        prompt: "CPU Count (1-32)",
        validateInput: value => {
          const num = Number(value);
          return (!isNaN(num) && num >= 1 && num <= 32) ? null : "Enter a number between 1 and 32";
        }
      });
      
      if (!cpuCountResult) {
        totalCostStatusBar.dispose();
        return;
      }
      
      state.cpuCount = Number(cpuCountResult);
      state.totalCost = this.calculateTotalCost(state);
      totalCostStatusBar.text = `$(dollar) $${state.totalCost.toFixed(2)} per 30d`;
      
      const ramResult = await vscode.window.showInputBox({
        value: state.ram.toString(),
        prompt: "RAM in GB ($0.75 per 0.25GB/30d)",
        validateInput: value => {
          const num = Number(value);
          return (!isNaN(num) && num >= 0.25) ? null : "Enter a number greater than or equal to 0.25";
        }
      });
      
      if (!ramResult) {
        totalCostStatusBar.dispose();
        return;
      }
      
      state.ram = Number(ramResult);
      state.totalCost = this.calculateTotalCost(state);
      totalCostStatusBar.text = `$(dollar) $${state.totalCost.toFixed(2)} per 30d`;
      
      const diskResult = await vscode.window.showInputBox({
        value: state.disk.toString(),
        prompt: "Disk Space in GB ($0.05 per 0.5GB/30d)",
        validateInput: value => {
          const num = Number(value);
          return (!isNaN(num) && num >= 0.5) ? null : "Enter a number greater than or equal to 0.5";
        }
      });
      
      if (!diskResult) {
        totalCostStatusBar.dispose();
        return;
      }
      
      state.disk = Number(diskResult);
      state.totalCost = this.calculateTotalCost(state);
      totalCostStatusBar.text = `$(dollar) $${state.totalCost.toFixed(2)} per 30d`;
      
      interface BooleanQuickPickItem extends vscode.QuickPickItem {
        boolValue: boolean;
      }
      
      const ipv4Result = await vscode.window.showQuickPick<BooleanQuickPickItem>([
        { label: "Yes", description: "$3.00/30d", boolValue: true },
        { label: "No", description: "Use shared IP (free)", boolValue: false }
      ], {
        placeHolder: "Do you need a dedicated IPv4 address?"
      });
      
      if (!ipv4Result) {
        totalCostStatusBar.dispose();
        return;
      }
      
      state.dedicatedIpv4 = ipv4Result.boolValue;
      state.totalCost = this.calculateTotalCost(state);
      totalCostStatusBar.text = `$(dollar) $${state.totalCost.toFixed(2)} per 30d`;
      
      const objectStorageResult = await vscode.window.showInputBox({
        value: state.objectStorage.toString(),
        prompt: "Object Storage in GB ($0.01 per GB/30d)",
        validateInput: value => {
          const num = Number(value);
          return (!isNaN(num) && num >= 0) ? null : "Enter a number greater than or equal to 0";
        }
      });
      
      if (!objectStorageResult) {
        totalCostStatusBar.dispose();
        return;
      }
      
      state.objectStorage = Number(objectStorageResult);
      state.totalCost = this.calculateTotalCost(state);
      totalCostStatusBar.text = `$(dollar) $${state.totalCost.toFixed(2)} per 30d`;
      
      const egressResult = await vscode.window.showInputBox({
        value: state.extraEgress.toString(),
        prompt: "Extra Egress in GB ($0.02 per GB)",
        validateInput: value => {
          const num = Number(value);
          return (!isNaN(num) && num >= 0) ? null : "Enter a number greater than or equal to 0";
        }
      });
      
      if (!egressResult) {
        totalCostStatusBar.dispose();
        return;
      }
      
      state.extraEgress = Number(egressResult);
      state.totalCost = this.calculateTotalCost(state);
      totalCostStatusBar.text = `$(dollar) $${state.totalCost.toFixed(2)} per 30d`;
      
      const backupResult = await vscode.window.showInputBox({
        value: state.extraBackup.toString(),
        prompt: "Extra Backup Space in GB ($0.50 per 5GB)",
        validateInput: value => {
          const num = Number(value);
          return (!isNaN(num) && num >= 0) ? null : "Enter a number greater than or equal to 0";
        }
      });
      
      if (!backupResult) {
        totalCostStatusBar.dispose();
        return;
      }
      
      state.extraBackup = Number(backupResult);
      state.totalCost = this.calculateTotalCost(state);
      totalCostStatusBar.text = `$(dollar) $${state.totalCost.toFixed(2)} per 30d`;
      
      const buildTimeResult = await vscode.window.showInputBox({
        value: state.extraBuildTime.toString(),
        prompt: "Extra Build Time in hours ($0.50 per 15h)",
        validateInput: value => {
          const num = Number(value);
          return (!isNaN(num) && num >= 0) ? null : "Enter a number greater than or equal to 0";
        }
      });
      
      if (!buildTimeResult) {
        totalCostStatusBar.dispose();
        return;
      }
      
      state.extraBuildTime = Number(buildTimeResult);
      state.totalCost = this.calculateTotalCost(state);
      totalCostStatusBar.text = `$(dollar) $${state.totalCost.toFixed(2)} per 30d`;
      
      const summary = this.getSummary(state);
      
      const detailsPanel = vscode.window.createOutputChannel("Zerops Cost Breakdown");
      detailsPanel.appendLine(summary);
      detailsPanel.show();
      
      vscode.window.showInformationMessage(
        `Zerops Cost Estimate: $${state.totalCost.toFixed(2)} per 30 days`, 
        'Copy to Clipboard'
      ).then(selection => {
        if (selection === 'Copy to Clipboard') {
          vscode.env.clipboard.writeText(summary);
          vscode.window.showInformationMessage('Cost breakdown copied to clipboard');
        }
      });
      
      totalCostStatusBar.dispose();
      
    } catch (error) {
      console.error("Error in calculator flow:", error);
      totalCostStatusBar.dispose();
    }
  }

  private calculateTotalCost(state: CalculationState): number {
    let totalCost = PRICING.PROJECTS[state.projectType.toUpperCase() as keyof typeof PRICING.PROJECTS];
    
    const cpuCost = state.cpuType === 'shared' ? 
      PRICING.CORES.SHARED * state.cpuCount : 
      PRICING.CORES.DEDICATED * state.cpuCount;
    
    const ramUnits = state.ram / 0.25;
    const ramCost = PRICING.RAM * ramUnits;
    
    const diskUnits = state.disk / 0.5;
    const diskCost = PRICING.DISK * diskUnits;
    
    totalCost += cpuCost + ramCost + diskCost;
    
    if (state.dedicatedIpv4) {
      totalCost += PRICING.ADDITIONAL.DEDICATED_IPV4;
    }
    
    if (state.objectStorage > 0) {
      totalCost += PRICING.ADDITIONAL.OBJECT_STORAGE * state.objectStorage;
    }
    
    if (state.extraEgress > 0) {
      totalCost += PRICING.ADDITIONAL.EXTRA_EGRESS * state.extraEgress;
    }
    
    if (state.extraBackup > 0) {
      const backupUnits = state.extraBackup / 5;
      totalCost += PRICING.ADDITIONAL.EXTRA_BACKUP * backupUnits;
    }
    
    if (state.extraBuildTime > 0) {
      const buildTimeUnits = state.extraBuildTime / 15;
      totalCost += PRICING.ADDITIONAL.EXTRA_BUILD_TIME * buildTimeUnits;
    }
    
    return totalCost;
  }

  private getSummary(state: CalculationState): string {
    const projectCost = PRICING.PROJECTS[state.projectType.toUpperCase() as keyof typeof PRICING.PROJECTS];
    
    const cpuCost = state.cpuType === 'shared' ? 
      PRICING.CORES.SHARED * state.cpuCount : 
      PRICING.CORES.DEDICATED * state.cpuCount;
    
    const ramUnits = state.ram / 0.25;
    const ramCost = PRICING.RAM * ramUnits;
    
    const diskUnits = state.disk / 0.5;
    const diskCost = PRICING.DISK * diskUnits;
    
    const ipv4Cost = state.dedicatedIpv4 ? PRICING.ADDITIONAL.DEDICATED_IPV4 : 0;
    const storageCost = PRICING.ADDITIONAL.OBJECT_STORAGE * state.objectStorage;
    const egressCost = PRICING.ADDITIONAL.EXTRA_EGRESS * state.extraEgress;
    const backupCost = PRICING.ADDITIONAL.EXTRA_BACKUP * (state.extraBackup / 5);
    const buildCost = PRICING.ADDITIONAL.EXTRA_BUILD_TIME * (state.extraBuildTime / 15);

    let summary = `
Zerops Cost Breakdown
-----------------------------------

Project Core (${state.projectType}): $${projectCost.toFixed(2)}

Resources:
  ${state.cpuCount}x ${state.cpuType} CPU Core:   $${cpuCost.toFixed(2)}
  ${state.ram}GB RAM:        $${ramCost.toFixed(2)}
  ${state.disk}GB Disk:      $${diskCost.toFixed(2)}
`;

    if (state.dedicatedIpv4 || state.objectStorage > 0) {
      summary += `
Additional Services:`;
      
      if (state.dedicatedIpv4) {
        summary += `
  Dedicated IPv4:   $${ipv4Cost.toFixed(2)}`;
      }
      
      if (state.objectStorage > 0) {
        summary += `
  Object Storage:   $${storageCost.toFixed(2)} (${state.objectStorage}GB)`;
      }
    }
    
    if (state.extraEgress > 0 || state.extraBackup > 0 || state.extraBuildTime > 0) {
      summary += `
      
Overage:`;
      
      if (state.extraEgress > 0) {
        summary += `
  Extra Egress:     $${egressCost.toFixed(2)} (${state.extraEgress}GB)`;
      }
      
      if (state.extraBackup > 0) {
        summary += `
  Extra Backup:     $${backupCost.toFixed(2)} (${state.extraBackup}GB)`;
      }
      
      if (state.extraBuildTime > 0) {
        summary += `
  Extra Build Time: $${buildCost.toFixed(2)} (${state.extraBuildTime}h)`;
      }
    }

    summary += `

-----------------------------------
Total Cost:        $${state.totalCost.toFixed(2)} per 30 days

Pricing details: https://docs.zerops.io/company/pricing
`;

    return summary;
  }

  public dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
  }
} 