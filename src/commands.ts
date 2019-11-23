import * as vscode from "vscode"
import { getCommand, readConfigFromFs } from "./trompConfig"
import * as path from "path"

const { showErrorMessage } = vscode.window

export async function runCommand(context: vscode.ExtensionContext) {
  const { workspaceFolders } = vscode.workspace
  const workspaceRoot = workspaceFolders && workspaceFolders[0]
  if (!workspaceRoot) {
    showErrorMessage(`Tromp: need workspace to run`)
    return
  }

  const editor = vscode.window.activeTextEditor
  if (!editor) {
    showErrorMessage(`Tromp: needs an active editor to run`)
    return
  }

  const rootFsPath = workspaceRoot.uri.fsPath

  const configFsPath = path.join(rootFsPath, "tromp.json")
  const trompConfigResult = await readConfigFromFs(configFsPath)
  if (!trompConfigResult.ok) {
    showErrorMessage(`Tromp: tromp.json ${trompConfigResult.reason}`)
    return
  }
  const trompConfig = trompConfigResult.value

  const commandResult = await getCommand({
    trompConfig,
    activeFsPath: editor.document.uri.fsPath,
    rootFsPath,
  })

  if (!commandResult.ok) {
    showErrorMessage(`Tromp: ${commandResult.reason}`)
    return
  }
  const { command, file } = commandResult.value

  const fullCommand = `${command.command} ${file}`
  runTerminalCommand(fullCommand)
  context.workspaceState.update(stateKeys.previousCommand, fullCommand)
}

export async function runPreviousCommand(context: vscode.ExtensionContext) {
  const prev = context.workspaceState.get(stateKeys.previousCommand)
  if (!prev) {
    showErrorMessage(`Tromp: no previous command to run`)
    return
  }

  if (typeof prev !== "string") {
    showErrorMessage(`Tromp: unexpected type of previous command`)
    return
  }

  runTerminalCommand(prev)
}

async function runTerminalCommand(cmd: string) {
  const terminal =
    vscode.window.activeTerminal || vscode.window.createTerminal("tromp")

  terminal.show(true)

  // would be nicer to keep scroll-back history
  await vscode.commands.executeCommand("workbench.action.terminal.clear")

  terminal.sendText(cmd)
}

enum stateKeys {
  previousCommand = "PREVIOUS_COMMAND",
}
