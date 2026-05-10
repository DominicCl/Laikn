import * as vscode from 'vscode';
import axios from 'axios';

// 1. CREATE THE OUTPUT CHANNEL (The Green Console)
const outputChannel = vscode.window.createOutputChannel("Laikn Green Router");

export function activate(context: vscode.ExtensionContext) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "laikn.eco-route";
    statusBarItem.text = `$(laikn-logo) Laikn`; 
    statusBarItem.show();
    let disposable = vscode.commands.registerCommand('laikn.eco-route', async () => {

         const savedRegions = context.globalState.get<string[]>('lastSelectedRegions', []);
        
        // 2. ASK USER FOR PERMISSIONS (The Advisor UI)
        const chosenRegions = await vscode.window.showQuickPick(
            [
                { label: 'all', description: '🌍 Check Global (12 Regions)'},
                { label: 'us-central1', description: '🇺🇸 Iowa (Wind)'},
                { label: 'us-west1', description: '🇺🇸 Oregon (Hydro)'},
                { label: 'us-east4', description: '🇺🇸 Virginia (Hydro/Solar)'},
                { label: "southamerica-east1", description: '🇧🇷 São Paulo (Hydro)'},
                { label: 'europe-west9', description: '🇫🇷 Paris (Nuclear)'},
                { label: 'europe-west2', description: '🇬🇧 London (Wind)'},
                { label: 'europe-west3', description: '🇩🇪 Frankfurt (Coal/Mixed)'},
                { label: 'europe-west1', description: '🇧🇪 St. Ghislain (Nuclear/Mixed)'},
                { label: 'europe-north1', description: '🇫🇮 Finland (Nuclear)'},
                { label: 'asia-northeast1', description: '🇯🇵 Tokyo (Gas)'},
                { label: 'asia-south1', description: '🇮🇳 Mumbai (Gas)'},
                { label: 'australia-southeast1', description: '🇦🇺 Sydney (Coal)'},
            ].map(region => ({       
                ...region,
                picked: savedRegions.includes(region.label)
            })),
            {
                canPickMany: true,
                placeHolder: 'Where do you have server access? (Select multiple)'
            }
        );

        // If user cancels (hits escape), stop.
        if (!chosenRegions || chosenRegions.length === 0) return;

        context.globalState.update('lastSelectedRegions', chosenRegions.map(r => r.label));

        // Process the selection into a simple list of strings
        let regionIds: string[] = [];
        const isGlobal = chosenRegions.find(r => r.label === 'all');
        
        if (!isGlobal) {
            regionIds = chosenRegions.map(r => r.label);
        }

        try {
            const cloudRunUrl = 'https://laikn-router-819883251321.northamerica-northeast1.run.app';

            // for mutli-tenancy
            const userId = vscode.env.machineId;

            // 3. CALL THE GO ADVISOR 
            const response = await axios.post(cloudRunUrl, { 
                allowed_regions: regionIds,
                user_id: userId
            });

            const data = response.data;

            // 4. GET THE DYNAMIC URL FIRST
            // We moved this up so we can use it in both the console and the notification
            const config = vscode.workspace.getConfiguration('laikn');
            const baseDashboardUrl = config.get<string>('dashboardUrl') || 'http://localhost:3000';
            const userDashboardUrl = `${baseDashboardUrl}?user=${userId}`;

            // 5. PRINT TO GREEN CONSOLE
            outputChannel.clear();
            outputChannel.show(true); // Pop open the panel
            
            outputChannel.appendLine("⚡ LAIKN ROUTING REPORT ⚡");
            outputChannel.appendLine(`>> Status:       Success`);
            outputChannel.appendLine(`>> Routed To:    ${data.region}`);
            outputChannel.appendLine(`>> Carbon Cost:  ${data.carbon_intensity}g/kWh`);
            outputChannel.appendLine(`>> CO2 Saved:    ${data.co2_saved}g`);
            // NEW: Added the clickable link to the terminal output!
            outputChannel.appendLine(`>> Dashboard:    ${userDashboardUrl}`); 
            outputChannel.appendLine("");
            outputChannel.appendLine("====== 📊 LIVE ANALYSIS ======");
            outputChannel.appendLine(data.analysis); 
            outputChannel.appendLine("==============================");

            // 6. EXECUTE THE COMMAND AND SHOW NOTIFICATION
            vscode.window.showInformationMessage(
                data.suggestion,
                'View Dashboard'
            ).then(selection => {
                // If they click the button in the popup, open their default browser
                if (selection === 'View Dashboard') {
                    vscode.env.openExternal(vscode.Uri.parse(userDashboardUrl));
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage("Laikn Error: " + error);
            console.error(error);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}