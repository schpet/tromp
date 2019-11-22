// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode"
import { runTest } from "./commands"

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "tromp.runTest",
    async () => {
      const { workspaceFolders } = vscode.workspace
      const root = workspaceFolders && workspaceFolders[0]
      if (!root) {
        vscode.window.showErrorMessage(`Tromp: need workspace to run`)
        return
      }

      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showErrorMessage(`Tromp: needs an active editor to run`)
        return
      }

      const result = await runTest(root.uri.fsPath, editor.document.uri.fsPath)
      if (!result.ok) {
        vscode.window.showErrorMessage(`Tromp: ${result.reason}`)
        return
      }

      const terminal =
        vscode.window.activeTerminal || vscode.window.createTerminal("tromp")

      terminal.show(true)

      // would be nicer to keep scroll-back history
      await vscode.commands.executeCommand("workbench.action.terminal.clear")

      terminal.sendText(result.value)
    }
  )
  context.subscriptions.push(disposable)
}

// this method is called when your extension is deactivated
export function deactivate() {}
