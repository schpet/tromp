// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode"
import * as commands from "./commands"

export function activate(context: vscode.ExtensionContext) {
  const { registerCommand } = vscode.commands

  const runCommand = registerCommand("tromp.runCommand", () =>
    commands.runCommand(context)
  )
  const runCommandWithLine = registerCommand("tromp.runCommandWithLine", () =>
    commands.runCommandWithLine(context)
  )
  const runPreviousCommand = registerCommand("tromp.runPreviousCommand", () =>
    commands.runPreviousCommand(context)
  )
  const runCommandWithFile = registerCommand("tromp.runCommandWithFile", () =>
    commands.runCommandWithFile(context)
  )

  context.subscriptions.push(runCommand)
  context.subscriptions.push(runCommandWithFile)
  context.subscriptions.push(runCommandWithLine)
  context.subscriptions.push(runPreviousCommand)
}

// this method is called when your extension is deactivated
export function deactivate() {}
