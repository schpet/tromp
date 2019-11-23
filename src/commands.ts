import * as vscode from "vscode"
import { getCommand, readConfigFromFs } from "./trompConfig"
import * as path from "path"
import { failure, success } from "./Result"

function showErrorMessage(message: string, prefix = "Tromp: ") {
  vscode.window.showErrorMessage(`${prefix}${message}`)
}

export async function runCommand(context: vscode.ExtensionContext) {
  const commandResult = await getCommandInContext()
  if (!commandResult.ok) {
    showErrorMessage(commandResult.reason)
    return
  }
  const command = commandResult.value

  runTerminalCommand(`${command.command}`, context)
}

export async function runCommandWithLine(context: vscode.ExtensionContext) {
  showErrorMessage(`TODO`)
}

export async function runCommandWithFile(context: vscode.ExtensionContext) {
  const commandResult = await getCommandInContext()
  if (!commandResult.ok) {
    showErrorMessage(commandResult.reason)
    return
  }
  const command = commandResult.value

  runTerminalCommand(`${command.command} ${command.file}`, context)
}

export async function runPreviousCommand(context: vscode.ExtensionContext) {
  const prev = context.workspaceState.get(stateKeys.previousCommand)
  if (!prev) {
    showErrorMessage(`no previous command to run`)
    return
  }

  if (typeof prev !== "string") {
    showErrorMessage(`unexpected type of previous command`)
    return
  }

  runTerminalCommand(prev)
}

async function runTerminalCommand(
  cmd: string,
  context: null | vscode.ExtensionContext = null
) {
  const terminal =
    vscode.window.activeTerminal || vscode.window.createTerminal("tromp")

  terminal.show(true)

  // would be nicer to keep scroll-back history
  await vscode.commands.executeCommand("workbench.action.terminal.clear")

  terminal.sendText(cmd)

  if (context) context.workspaceState.update(stateKeys.previousCommand, cmd)
}

enum stateKeys {
  previousCommand = "PREVIOUS_COMMAND",
}

async function getCommandInContext() {
  const { workspaceFolders } = vscode.workspace
  const workspaceRoot = workspaceFolders && workspaceFolders[0]
  if (!workspaceRoot) {
    return failure(`need workspace to run`)
  }

  const editor = vscode.window.activeTextEditor
  if (!editor) {
    return failure(`needs an active editor to run`)
  }

  const rootFsPath = workspaceRoot.uri.fsPath

  const configFsPath = path.join(rootFsPath, "tromp.json")
  const trompConfigResult = await readConfigFromFs(configFsPath)
  if (!trompConfigResult.ok) {
    return failure(`tromp.json ${trompConfigResult.reason}`)
  }
  const trompConfig = trompConfigResult.value

  const commandResult = await getCommand({
    trompConfig,
    activeFsPath: editor.document.uri.fsPath,
    rootFsPath,
  })

  return commandResult
}
