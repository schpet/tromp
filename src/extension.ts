// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode"
import { runCommand } from "./commands"

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand("tromp.runTest", runCommand)
  context.subscriptions.push(disposable)
}

// this method is called when your extension is deactivated
export function deactivate() {}
