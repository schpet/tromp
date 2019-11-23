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

  const laMapping = {
    rspec: rspecLineArgument,
    jest: jestLineArgument,
  } as const

  const lineArgument = laMapping[command.mode](editor, command.file)

  runTerminalCommand(`${command.command} ${lineArgument}`, context)
}

function rspecLineArgument(editor: vscode.TextEditor, file: string) {
  return `${file}:${editor.selection.start.line}`
}

const TEST_NAME_REGEX = /(describe|it|test)\(("([^"]+)"|`([^`]+)`|'([^']+)'),/

function jestLineArgument(editor: vscode.TextEditor, file: string) {
  // https://github.com/firsttris/vscode-jest-runner/blob/master/src/jestRunner.ts
  const testName = findCurrentTestName(editor)
  return `${file} -t '${testName}'`
}

/**
 * TODO:
 * check for tests with quotes e.g. `has 'single quotes`
 *
 * copied from
 * https://github.com/firsttris/vscode-jest-runner/blob/master/src/jestRunner.ts
 * MIT Copyright (c) 2017 Tristan Teufel
 */
function findCurrentTestName(editor: vscode.TextEditor): string {
  // from selection
  const { selection, document } = editor
  if (!selection.isEmpty) {
    return removeFirstAndLastChars(document.getText(selection))
  }

  // from cursor position
  for (
    let currentLine = selection.active.line;
    currentLine >= 0;
    currentLine--
  ) {
    const text = document.getText(
      new vscode.Range(currentLine, 0, currentLine, 100000)
    )
    const match = TEST_NAME_REGEX.exec(text)
    if (match) {
      return removeFirstAndLastChars(match[2])
    }
  }

  return ""
}

function removeFirstAndLastChars(s: string): string {
  return s.slice(1, -1)
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
