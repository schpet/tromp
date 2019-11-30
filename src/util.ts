import * as path from "path"
import * as vscode from "vscode"
import { failure, success, Result } from "./Result"
import { getCommand, readConfigFromFs, decodeConfig } from "./trompConfig"
import { promises as fs } from "fs"
import { TrompConfig } from "./types/trompSchema"

export const getWorkspace = () => {
  const { workspaceFolders } = vscode.workspace
  const workspaceRoot = workspaceFolders && workspaceFolders[0]
  if (!workspaceRoot) {
    return failure(`need workspace to run`)
  }
  return success(workspaceRoot.uri)
}

export async function getTrompConfig(
  workspace: vscode.Uri
): Promise<Result<TrompConfig, { fileExists: boolean; message: string }>> {
  const rootFsPath = workspace.fsPath
  const configFsPath = path.join(rootFsPath, "tromp.json")

  let configBuffer
  try {
    configBuffer = await fs.readFile(configFsPath)
  } catch (e) {
    return failure({
      fileExists: false,
      message: `failed to read ${configFsPath}`,
    })
  }

  const trompConfigResult = decodeConfig(configBuffer.toString())

  if (!trompConfigResult.ok) {
    return failure({
      fileExists: true,
      message: `tromp.json ${trompConfigResult.reason}`,
    })
  }

  const trompConfig = trompConfigResult.value
  return success(trompConfig)
}

export async function getCommandInContext() {
  const workspaceResult = getWorkspace()
  if (!workspaceResult.ok) return workspaceResult
  const workspace = workspaceResult.value
  const rootFsPath = workspace.fsPath

  const configResult = await getTrompConfig(workspace)
  if (!configResult.ok) return failure(configResult.reason.message)
  const trompConfig = configResult.value

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

export async function generateConfig(destination: string) {
  const sampleConfig: TrompConfig = {
    commands: [
      {
        command: "npm test",
        match: "**/*.test.js",
        mode: "jest",
      },
    ],
  }

  try {
    await fs.writeFile(destination, JSON.stringify(sampleConfig, null, 2))
    return success(true)
  } catch (e) {
    return failure(`Failed to write to ${destination}`)
  }
}
