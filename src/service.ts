import path from "path"
import * as vscode from "vscode"
import { interpret, Interpreter } from "xstate"
import {
  CommandContext,
  CommandEvent,
  commandMachine,
  trompMachine,
} from "./machine"
import {
  generateConfig,
  getCommandInContext,
  runTerminalCommand,
  getConfig,
} from "./util"

export const buildTrompService = () => {
  const configuredCommandMachine = commandMachine.withConfig({
    services: {
      findCommand: async (context, event) => {
        const commandResult = await getCommandInContext(context.argument)
        if (!commandResult.ok) {
          throw commandResult.reason
        }
        const command = commandResult.value
        const editor = vscode.window.activeTextEditor
        if (!editor) throw new Error("invariant: expected editor")

        return command.command
      },
      generateConfig: async (context, event) => {
        if (!context.workspace) throw new Error("invariant: expected workspace")
        const file = vscode.Uri.file(
          path.join(context.workspace.fsPath, "tromp.json")
        )
        const result = await generateConfig(file.fsPath)
        if (result.ok) {
          vscode.window.showTextDocument(file)
          return
        } else {
          throw result.reason
        }
      },
      renderConfigNotFound: (context, event) => (callback, onEvent) => {
        vscode.window
          .showErrorMessage("Configuration not found", "Generate tromp.json")
          .then(value => {
            switch (value) {
              case "Generate tromp.json":
                callback("GENERATE")
                break
              case undefined:
                callback("DISMISS")
                break
              default:
                throw new Error(`invariant: unhandled value ${value}`)
            }
          })

        return () => {}
      },
      renderConfigInvalid: (context, event) => (callback, onEvent) => {
        vscode.window
          .showErrorMessage(
            `Problem with configuration: ${context.errorMessage}`,
            "Edit tromp.json"
          )
          .then(value => {
            switch (value) {
              case "Edit tromp.json":
                callback({ type: "EDIT" })
                break
              case undefined:
                callback({ type: "DISMISS" })
                break
              default:
                throw new Error(`invariant: unhandled value ${value}`)
            }
          })
      },
      renderMatchNotFound: (context, event) => (callback, onEvent) => {
        vscode.window
          .showErrorMessage(
            `Match not found for ${context.errorMessage}`,
            "Edit tromp.json"
          )
          .then(value => {
            switch (value) {
              case "Edit tromp.json":
                callback({ type: "EDIT" })
                break
              case undefined:
                callback({ type: "DISMISS" })
                break
              default:
                throw new Error(`invariant: unhandled value ${value}`)
            }
          })
      },
      renderGenerationFailed: () => callback => {
        vscode.window
          .showErrorMessage(`Generation failed`)
          .then(() => callback("DISMISS"))
      },
      renderNoWorkspace: () => callback => {
        vscode.window
          .showErrorMessage(`Tromp needs a workspace to run`)
          .then(() => callback("DISMISS"))
      },
      renderNoEditor: () => callback => {
        vscode.window
          .showErrorMessage(`Tromp needs an editor to run`)
          .then(() => callback("DISMISS"))
      },
      renderBasicError: (context, event) => callback => {
        vscode.window
          .showErrorMessage(context.errorMessage || "Unknown error")
          .then(() => callback("DISMISS"))
      },
    },
    actions: {
      EDIT_CONFIG: context => {
        // TODO: possible to typecheck this?
        if (!context.workspace) throw new Error("invariant: expected workspace")

        const file = vscode.Uri.file(
          path.join(context.workspace.fsPath, "tromp.json")
        )
        vscode.window.showTextDocument(file)
      },
    },
  })

  const machine = trompMachine
    .withContext({
      ...trompMachine.context!,
      commandMachine: configuredCommandMachine,
    })
    .withConfig({
      actions: {
        RUN_COMMAND_IN_TERMINAL: (context, _event) => {
          if (!context.currentCommand)
            throw new Error("invariant: no current command")
          runTerminalCommand(context.currentCommand)
        },
      },
      services: {
        openLink: async () => {
          const configResult = await getConfig()
          if (!configResult.ok) {
            vscode.window.showErrorMessage(
              `Problem with config: ${configResult.reason.problem}`
            )
            return
          }

          const config = configResult.value
          const bookmarks = config.bookmarks || {}
          const bookmarkNames = Object.keys(bookmarks)

          if (bookmarkNames.length === 0) {
            vscode.window.showErrorMessage(`No links in config`)
            return
          }

          vscode.window.showQuickPick(bookmarkNames).then(choice => {
            if (!choice) return
            const link = bookmarks[choice]

            vscode.commands.executeCommand(
              "vscode.open",
              vscode.Uri.parse(link)
            )
          })
        },
      },
    })

  return interpret(machine)
}
