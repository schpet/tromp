import path from "path"
import * as vscode from "vscode"
import { interpret, createMachine } from "xstate"
import { extensionMachine } from "./extensionMachine"
import {
  generateConfig,
  getCommandInContext,
  getConfig,
  runTerminalCommand,
  getWorkspace,
} from "./util"
import { commandMachine } from "./commandMachine"
import { configMachine } from "./configMachine"
import { bookmarkMachine } from "./bookmarkMachine"

export const buildTrompService = () => {
  const editConfig = (workspace: vscode.Uri | undefined) => {
    if (!workspace) throw new Error("invariant: expected workspace")

    const file = vscode.Uri.file(path.join(workspace.fsPath, "tromp.json"))
    vscode.window.showTextDocument(file)
  }

  const configuredConfigMachine = configMachine.withConfig({
    services: {
      getWorkspace: () => {
        const workspace = getWorkspace()
        if (!workspace) return Promise.reject()
        return Promise.resolve(workspace)
      },
      getConfig: async ({ workspace }) => {
        // todo, something like
        // getConfig: ({ workspace }) => toThrow(getConfig(workspace!))
        const configResult = await getConfig(workspace!)
        if (!configResult.ok) throw configResult.reason
        return configResult.value
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
    },
    actions: {
      EDIT_CONFIG: context => editConfig(context.workspace),
    },
  })

  const configuredCommandMachine = commandMachine.withConfig({
    services: {
      configMachine: configuredConfigMachine,
      findCommand: async (context, event) => {
        const commandResult = await getCommandInContext(
          context.argument,
          context.workspace!,
          context.config!
        )
        if (!commandResult.ok) {
          throw commandResult.reason
        }
        const command = commandResult.value
        const editor = vscode.window.activeTextEditor
        if (!editor) throw new Error("invariant: expected editor")

        return command.command
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
      EDIT_CONFIG: context => editConfig(context.workspace),
    },
  })

  const configuredBookmarkMachine = bookmarkMachine.withConfig({
    services: {
      configMachine: configuredConfigMachine,
      renderBookmarkList: async (context, event) => {
        const config = context.config!
        const bookmarks = config.bookmarks || {}

        const quickpickItems = Object.entries(bookmarks).map(
          ([name, url]): vscode.QuickPickItem => ({
            label: name,
            description: url,
          })
        )

        const choice = await vscode.window.showQuickPick(quickpickItems)

        if (!choice) return
        const link = bookmarks[choice.label]
        vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(link))
      },
      renderNoBookmarks: () => async callback => {
        const choice = await vscode.window.showInformationMessage(
          "No bookmarks to open",
          "Edit tromp.json"
        )
        if (choice === "Edit tromp.json") return callback("EDIT")
        callback("DISMISS")
      },
    },
    actions: {
      EDIT_CONFIG: context => editConfig(context.workspace),
    },
  })

  const machine = extensionMachine
    .withContext({
      ...extensionMachine.context!,
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
        bookmarkMachine: configuredBookmarkMachine,
      },
    })

  return interpret(machine)
}
