// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { interpret } from "@xstate/fsm"
import { quote } from "shell-quote"
import * as vscode from "vscode"
import * as commands from "./commands"
import { configMachine } from "./configMachine"
import { getCommandInContext, runTerminalCommand, getWorkspace } from "./util"
import * as path from "path"

const { registerCommand } = vscode.commands

function showErrorMessage(message: string, prefix = "Tromp: ") {
  vscode.window.showErrorMessage(`${prefix}${message}`)
}

export function activate(context: vscode.ExtensionContext) {
  const configService = interpret(configMachine).start()

  configService.subscribe(state => {
    console.log(`STATE=${state.value}`)

    // UI (state)
    ;(() => {
      if (state.matches("configurationError")) {
        vscode.window
          .showErrorMessage(
            `Tromp: ${state.context.configError}`,
            "Edit tromp.json"
          )
          .then(value => {
            switch (value) {
              case "Edit tromp.json":
                configService.send({ type: "EDIT" })
                break
            }
          })
        return
      }
      console.log(`STATE=${state.value} (no ui)`)
    })()

    console.log(
      `actions for STATE=${state.value}: ${JSON.stringify(state.actions)}`
    )

    // Actions (effects)
    state.actions.forEach(async action => {
      console.log(`STATE=${state.value} ACTION=${action.type}`)

      // Q: action.type is a string here, possible to type this?
      switch (action.type) {
        case "EXECUTE": {
          const workspaceResult = getWorkspace()

          // TODO get this with the command
          if (!workspaceResult.ok) {
            configService.send({ type: "NO_WORKSPACE" })
            break
          }

          const commandResult = await getCommandInContext()

          if (commandResult.ok) {
            const command = commandResult.value
            runTerminalCommand(command.command)
            configService.send({ type: "SUCCESS" })
          } else {
            configService.send({
              type: "CONFIG_ERROR",
              configError: commandResult.reason,
              workspace: workspaceResult.value,
            })
          }
          break
        }
        case "EDIT_CONFIG":
          const file = vscode.Uri.file(
            path.join(state.context.workspace!.fsPath, "tromp.json")
          )
          vscode.window.showTextDocument(file)
          break
        default:
          console.log(`ACTION=${action.type} unhandled`)
          break
      }
    })
  })

  const runCommand = registerCommand("tromp.runCommand", () =>
    commands.runCommand(context)
  )
  const runCommandWithLine = registerCommand("tromp.runCommandWithLine", () =>
    commands.runCommandWithLine(context)
  )
  const runPreviousCommand = registerCommand("tromp.runPreviousCommand", () =>
    commands.runPreviousCommand(context)
  )
  const runCommandWithFile = registerCommand(
    "tromp.runCommandWithFile",
    () => configService.send({ type: "RUN" })
    // commands.runCommandWithFile(context)
  )

  context.subscriptions.push(runCommand)
  context.subscriptions.push(runCommandWithFile)
  context.subscriptions.push(runCommandWithLine)
  context.subscriptions.push(runPreviousCommand)
}

// this method is called when your extension is deactivated
export function deactivate() {}
