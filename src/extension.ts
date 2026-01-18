import * as vscode from 'vscode';
import axios from 'axios'; // axios is a popular HTTP client library for making http requests

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('laikn.minify', async () => {
		// Check if the user has a text editor open
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showInformationMessage("Open a file first!")
			return;
		}

		// Get the text the user highlighted
		const selection = editor.selection;
		const text = editor.document.getText(selection);

		if (!text) {
			vscode.window.showInformationMessage("Highlight some code to route!")
			return;
		}

		// Show a processing image
		vscode.window.setStatusBarMessage("Laikn: Routing to Green Cloud...", 3000)

		try {
			// Send the text to your Go server on the Google Cloud
			const response = await axios.post(
				'https://laikn-proxy-819883251321.us-central1.run.app', // The real URL
				text,
				{headers: { 'Content-Type': 'text/plain' }}
			);

			// Replace the highlighted text with the result from the server
			editor.edit(editBuilder => {
				editBuilder.replace(selection, response.data)
			})

			vscode.window.showInformationMessage("Success! Proceed in us-central1.")
		} catch (error) {
			vscode.window.showErrorMessage("Laikn Failed: Server connection error.")
			console.error(error)
		}
	});
	context.subscriptions.push(disposable)
}

export function deactivate() {}