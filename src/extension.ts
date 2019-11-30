// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { interpret } from "@xstate/fsm"
import { quote } from "shell-quote"
import * as vscode from "vscode"
import * as commands from "./commands"
import { configMachine } from "./configMachine"
import {
  getCommandInContext,
  runTerminalCommand,
  getWorkspace,
  getTrompConfig,
  generateConfig,
} from "./util"
import * as path from "path"
import { getCommand } from "./trompConfig"

const { registerCommand } = vscode.commands

export function activate(context: vscode.ExtensionContext) {
  const configService = interpret(configMachine).start()

  configService.subscribe(state => {
    console.log(`STATE=${state.value}`)

    // UI (state)
    ;(() => {
      if (state.matches("configurationError")) {
        const actions = {
          edit: "Edit tromp.json",
        }
        vscode.window
          .showErrorMessage(`${state.context.configError}`, actions.edit)
          .then(value => {
            switch (value) {
              case actions.edit:
                configService.send({ type: "EDIT", workspace: state.context.workspace })
                break
              case undefined:
                configService.send({ type: "DISMISS" })
                break
              default:
                throw new Error(`invariant: unexpected value ${value}`)
            }
          })
        return
      }

      if (state.matches("configurationMissing")) {
        const actions = {
          generate: "Generate tromp.json",
        }
        vscode.window
          .showErrorMessage(
            `No tromp.json configuration found`,
            actions.generate
          )
          .then(value => {
            switch (value) {
              case actions.generate:
                configService.send({ type: "GENERATE" })
                break
              case undefined:
                configService.send({ type: "DISMISS" })
                break
              default:
                throw new Error(`invariant: unexpected value ${value}`)
            }
          })
        return
      }

      if (state.matches("noCommand")) {
        const actions = {
          edit: "Edit tromp.json",
        }
        vscode.window
          .showErrorMessage(`No match found for current file`, actions.edit)
          .then(value => {
            switch (value) {
              case actions.edit:
                configService.send({ type: "EDIT", workspace: state.context.workspace })
                break
              case undefined:
                configService.send({ type: "DISMISS" })
                break
              default:
                throw new Error(`invariant: unexpected value ${value}`)
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
          const workspace = workspaceResult.value

          // const commandResult = await getCommandInContext()
          const configResult = await getTrompConfig(workspace)
          if (!configResult.ok) {
            if (configResult.reason.fileExists) {
              configService.send({
                type: "CONFIG_ERROR",
                configError: configResult.reason.message,
                workspace,
              })
              return
            } else {
              configService.send({
                type: "CONFIG_MISSING",
                workspace,
              })
              return
            }
          }
          const trompConfig = configResult.value

          const editor = vscode.window.activeTextEditor
          if (!editor) {
            throw new Error("TODO: 'no active editor' state")
          }

          const commandResult = await getCommand({
            trompConfig,
            activeFsPath: editor.document.uri.fsPath,
            rootFsPath: workspace.fsPath,
          })

          if (commandResult.ok) {
            const command = commandResult.value
            runTerminalCommand(`${command.command} ${command.file}`)
            configService.send({ type: "SUCCESS" })
          } else {
            configService.send({ type: "NO_COMMAND", workspace })
          }
          break
        }
        case "EDIT_CONFIG": {
          if (!state.context.workspace) {
            throw new Error("invariant: bad state, no workspace")
          }

          const file = vscode.Uri.file(
            path.join(state.context.workspace.fsPath, "tromp.json")
          )
          vscode.window.showTextDocument(file)
          // vscode.workspace.openTextDocument(file)
          break
        }
        case "GENERATE_CONFIG": {
          const file = vscode.Uri.file(
            path.join(state.context.workspace!.fsPath, "tromp.json")
          )
          const result = await generateConfig(file.fsPath)
          if (result.ok) {
            vscode.window.showTextDocument(file)
            configService.send({ type: "GENERATED" })
          } else {
            configService.send({ type: "GENERATION_ERROR" })
          }
          break
        }
        default:
          console.log(`UH OH, TODO ACTION=${action.type}`)
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
