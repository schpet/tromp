import * as path from "path"
import * as vscode from "vscode"
import { failure, success } from "./Result"
import { getCommand, readConfigFromFs } from "./trompConfig"

export const getWorkspace = () => {
  const { workspaceFolders } = vscode.workspace
  const workspaceRoot = workspaceFolders && workspaceFolders[0]
  if (!workspaceRoot) {
    return failure(`need workspace to run`)
  }
  return success(workspaceRoot.uri)
}

export async function getCommandInContext() {
  const workspaceResult = getWorkspace()
  if (!workspaceResult.ok) return workspaceResult

  const rootFsPath = workspaceResult.value.fsPath
  const configFsPath = path.join(rootFsPath, "tromp.json")

  const trompConfigResult = await readConfigFromFs(configFsPath)
  if (!trompConfigResult.ok) {
    return failure(`tromp.json ${trompConfigResult.reason}`)
  }
  const trompConfig = trompConfigResult.value

  const editor = vscode.window.activeTextEditor
  if (!editor) {
    return failure(`needs an active editor to run`)
  }

  const commandResult = await getCommand({
    trompConfig,
    activeFsPath: editor.document.uri.fsPath,
    rootFsPath,
  })

  return commandResult
}

export enum stateKeys {
  previousCommand = "PREVIOUS_COMMAND",
}


export async function runTerminalCommand(cmd: string) {
  const terminal =
    vscode.window.activeTerminal || vscode.window.createTerminal("tromp")

  terminal.show(true)

  // would be nicer to keep scroll-back history
  await vscode.commands.executeCommand("workbench.action.terminal.clear")

  terminal.sendText(cmd)
}
