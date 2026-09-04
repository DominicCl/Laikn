import * as vscode from 'vscode';
import axios from 'axios';

// 1. SHARED CONFIG & OUTPUT CHANNEL
const outputChannel = vscode.window.createOutputChannel("Laikn Green Router");
const cloudRunUrl = 'https://laikn-proxy-819883251321.northamerica-northeast1.run.app';

export function activate(context: vscode.ExtensionContext) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "laikn.eco-route";
    statusBarItem.text = `$(laikn-logo) Laikn`; 
    statusBarItem.show();

    // 2. BACKGROUND ALARM CHECKER (Checks every 60 seconds)
    const timer = setInterval(() => {
        const pending = context.globalState.get<{ targetTime: number; region: string; userId: string }>('laiknPendingShift');
        
        if (pending && Date.now() >= pending.targetTime) {
            // Target clean window reached
            vscode.window.showInformationMessage(
                `🟢 Laikn Green Window: It's time to run your workload in ${pending.region}!`,
                'Mark as Completed',
                'Dismiss'
            ).then(async (choice) => {
                // Clear alarm so it doesn't re-trigger
                context.globalState.update('laiknPendingShift', undefined);

                if (choice === 'Mark as Completed') {
                    try {
                        await axios.post(`${cloudRunUrl}/decision`, {
                            user_id: pending.userId,
                            decision: 'shift_completed',
                            chosen_option: `Verified run in ${pending.region}`
                        });
                        vscode.window.showInformationMessage("🌿 Impact recorded on your dashboard!");
                    } catch (e) {
                        console.error("Failed to verify shift", e);
                    }
                }
            });
        }
    }, 60000);

    // Ensure timer cleans up on extension deactivation
    context.subscriptions.push({ dispose: () => clearInterval(timer) });

    // 3. MAIN ECO-ROUTE COMMAND
    let disposable = vscode.commands.registerCommand('laikn.eco-route', async () => {
        const savedRegions = context.globalState.get<string[]>('lastSelectedRegions', []);
        
        const chosenRegions = await vscode.window.showQuickPick(
            [
                { label: 'all', description: '🌍 Check Global (16 Regions)'},
                { label: 'us-central1', description: '🇺🇸 Iowa (Wind)'},
                { label: 'us-west1', description: '🇺🇸 Oregon (Hydro)'},
                { label: 'us-east4', description: '🇺🇸 Virginia (Hydro/Solar)'},
                { label: 'southamerica-east1', description: '🇧🇷 São Paulo (Hydro)'},
                { label: 'europe-west9', description: '🇫🇷 Paris (Nuclear)'},
                { label: 'europe-west2', description: '🇬🇧 London (Wind)'},
                { label: 'europe-west3', description: '🇩🇪 Frankfurt (Coal/Mixed)'},
                { label: 'europe-west1', description: '🇧🇪 St. Ghislain (Nuclear/Mixed)'},
                { label: 'europe-north1', description: '🇫🇮 Finland (Nuclear)'},
                { label: 'asia-northeast1', description: '🇯🇵 Tokyo (Gas)'},
                { label: 'asia-south1', description: '🇮🇳 Mumbai (Gas)'},
                { label: 'australia-southeast1', description: '🇦🇺 Sydney (Solar)'},
                { label: 'europe-southwest1', description: '🇪🇸 Madrid (Solar)'},
                { label: 'europe-north2', description: '🇸🇪 Stockholm (Hydro)'},
                { label: 'asia-southeast1', description: '🇸🇬 Singapore (Gas)'},
            ].map(region => ({       
                ...region,
                picked: savedRegions.includes(region.label)
            })),
            {
                canPickMany: true,
                placeHolder: 'Where do you have server access? (Select multiple)'
            }
        );

        if (!chosenRegions || chosenRegions.length === 0) return;

        context.globalState.update('lastSelectedRegions', chosenRegions.map(r => r.label));

        let regionIds: string[] = [];
        const isGlobal = chosenRegions.find(r => r.label === 'all');
        if (!isGlobal) {
            regionIds = chosenRegions.map(r => r.label);
        }

        try {
            const userId = vscode.env.machineId;

            // Call Go Proxy Advisor
            const response = await axios.post(cloudRunUrl, { 
                allowed_regions: regionIds,
                user_id: userId
            });

            const data = response.data;

            const baseDashboardUrl = data.dashboard_url || 'https://laikn-dashboard-819883251321.us-central1.run.app';
            const userDashboardUrl = `${baseDashboardUrl}?user=${userId}`;

            // Print to Green Console
            outputChannel.clear();
            outputChannel.show(true);
            
            outputChannel.appendLine("⚡ LAIKN ROUTING REPORT ⚡");
            outputChannel.appendLine(`>> Status:       Success`);
            outputChannel.appendLine(`>> Routed To:    ${data.region}`);
            outputChannel.appendLine(`>> Carbon Cost:  ${data.carbon_intensity}g/kWh`);
            outputChannel.appendLine(`>> CO2 Saved:    ${data.co2_saved}g`);
            outputChannel.appendLine(`>> Suggestion:   ${data.suggestion}`);
            outputChannel.appendLine(`>> Dashboard:    ${userDashboardUrl}`); 
            outputChannel.appendLine("");
            outputChannel.appendLine("====== 📊 LIVE ANALYSIS ======");
            outputChannel.appendLine(data.analysis); 
            outputChannel.appendLine("==============================");

            // Action Fork Prompt
            const buttons: string[] = [`Run Now (${data.region})`];
            if (data.best_future_region && data.optimal_wait > 0) {
                buttons.push(`Wait ${data.optimal_wait}h (${data.best_future_region})`);
            }

            vscode.window.showInformationMessage(data.suggestion, ...buttons).then(async (choice) => {
                let decisionType = 'ignored';
                let optionText = 'Dismissed prompt (Assumed Immediate)';

                if (choice) {
                    decisionType = choice.startsWith('Run Now') ? 'immediate' : 'shifted';
                    optionText = choice;
                }
                
                outputChannel.appendLine(`>> User Decision: [${optionText}]`);

                if (decisionType === 'shifted') {
                    const targetTimeMs = Date.now() + (data.optimal_wait * 60 * 60 * 1000);
                    context.globalState.update('laiknPendingShift', {
                        targetTime: targetTimeMs,
                        region: data.best_future_region,
                        userId: userId
                    });
                    vscode.window.showInformationMessage(
                        `🌿 Alarm set! We'll remind you to run in ${data.best_future_region} in ${data.optimal_wait} hours.`
                    );
                }

                try {
                    await axios.post(`${cloudRunUrl}/decision`, {
                        user_id: userId,
                        decision: decisionType,
                        chosen_option: optionText
                    });
                } catch {
                    outputChannel.appendLine(`>> Note: Could not sync decision to cloud.`);
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage("Laikn Error: " + error);
            outputChannel.appendLine(`>> ERROR: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}