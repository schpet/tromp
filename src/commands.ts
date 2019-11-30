import * as vscode from "vscode"
import * as lineArguments from "./lineArguments"
import { getCommandInContext, runTerminalCommand, stateKeys } from "./util"

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

  runTerminalCommand(`${command.command}`)
}

export async function runCommandWithLine(context: vscode.ExtensionContext) {
  const commandResult = await getCommandInContext()
  if (!commandResult.ok) {
    showErrorMessage(commandResult.reason)
    return
  }
  const command = commandResult.value

  const { activeTextEditor: editor } = vscode.window
  if (!editor) {
    showErrorMessage("active text editor needed")
    return
  }

  const getLine = (line: number) => {
    return editor.document.lineAt(line).text
  }

  const lineArgumentFn = lineArguments[command.mode]
  const lineArgument = lineArgumentFn({
    file: command.file,
    line: editor.selection.active.line,
    getLine,
  })

  if (!lineArgument.ok) {
    showErrorMessage(lineArgument.reason)
    return
  }

  runTerminalCommand(`${command.command} ${lineArgument.value}`)
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
