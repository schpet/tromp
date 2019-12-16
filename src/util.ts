import { promises as fs, existsSync } from "fs"
import * as path from "path"
import * as vscode from "vscode"
import { failure, Result, success } from "./Result"
import { decodeConfig, getCommand, TrompCommand } from "./config"
import { TrompConfig } from "./types/trompSchema"
import { TrompCommandProblem, CommandArgument } from "./machine"
import * as nearest from "./nearest"

const getWorkspace = () => {
  const { workspaceFolders } = vscode.workspace
  const workspaceRoot = workspaceFolders && workspaceFolders[0]
  if (!workspaceRoot) return
  return workspaceRoot.uri
}

export async function getCommandInContext(
  mode: CommandArgument
): Promise<Result<TrompCommand, TrompCommandProblem>> {
  const workspace = getWorkspace()
  if (!workspace) {
    return failure({ problem: "no_workspace" })
  }

  const configFsPath = path.join(workspace.fsPath, "tromp.json")

  let configBuffer
  try {
    configBuffer = await fs.readFile(configFsPath)
  } catch (e) {
    return failure({
      problem: "config_not_found",
      message: `failed to read ${configFsPath}`,
      workspace,
    })
  }

  const trompConfigResult = decodeConfig(configBuffer.toString())

  if (!trompConfigResult.ok) {
    return failure({
      problem: "config_invalid",
      message: trompConfigResult.reason,
      workspace,
    })
  }

  const trompConfig = trompConfigResult.value

  const editor = vscode.window.activeTextEditor
  if (!editor) {
    return failure({
      problem: "no_editor",
      workspace,
    })
  }

  const commandResult = await getCommand({
    trompConfig,
    activeFsPath: editor.document.uri.fsPath,
    rootFsPath: workspace.fsPath,
  })

  if (!commandResult.ok) {
    return failure({
      problem: "match_not_found",
      message: commandResult.reason,
      workspace,
    })
  }
  const command = commandResult.value

  // todo: break this out?
  switch (mode) {
    case CommandArgument.none:
      return success({ ...command })
    case CommandArgument.file:
      return success({
        ...command,
        command: `${command.command} ${command.file}`,
      })
    case CommandArgument.nearest: {
      const getLine = (line: number) => {
        return editor.document.lineAt(line).text
      }
      const nearestFn = nearest[command.mode]
      const nearestResult = nearestFn({
        file: command.file,
        line: editor.selection.active.line,
        getLine,
      })

      if (!nearestResult.ok) {
        return failure({
          problem: "nearest_not_found",
          message: nearestResult.reason,
          workspace,
        })
      }

      return success({
        ...command,
        command: `${command.command} ${nearestResult.value}`,
      })
    }
    default:
      throw new Error(`invariant: unexpected argument ${mode}`)
  }
}

export async function runTerminalCommand(cmd: string, terminalName = "Tromp") {
  const terminal =
    vscode.window.terminals.find(terminal => terminal.name === terminalName) ||
    vscode.window.createTerminal(terminalName)

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

  if (existsSync(destination)) {
    return failure(`File already exists ${destination}`)
  }

  try {
    await fs.writeFile(destination, JSON.stringify(sampleConfig, null, 2))
    return success(true)
  } catch (e) {
    return failure(`Failed to write to ${destination}`)
  }
}
