// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode"
import * as commands from "./commands"

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("tromp.runCommand", () =>
      commands.runCommand(context)
    ),
    vscode.commands.registerCommand("tromp.runCommandWithFile", () =>
      commands.runCommandWithFile(context)
    ),
    vscode.commands.registerCommand("tromp.runCommandWithLine", () =>
      commands.runCommandWithLine(context)
    ),
    vscode.commands.registerCommand("tromp.runPreviousCommand", () =>
      commands.runPreviousCommand(context)
    )
  )
}

// this method is called when your extension is deactivated
export function deactivate() {}
