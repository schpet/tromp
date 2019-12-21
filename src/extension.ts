import * as vscode from "vscode"
import { buildTrompService } from "./service"
import { CommandArgument } from "./commandMachine"

const { registerCommand } = vscode.commands

export function activate(context: vscode.ExtensionContext) {
  const service = buildTrompService().start()

  // todo: clean this up with a list

  const runCommand = registerCommand("tromp.runCommand", () => {
    service.send({ type: "RUN_COMMAND", argument: CommandArgument.none })
  })
  const runCommandWithFile = registerCommand("tromp.runCommandWithFile", () => {
    service.send({ type: "RUN_COMMAND", argument: CommandArgument.file })
  })
  const runCommandWithNearest = registerCommand(
    "tromp.runCommandWithNearest",
    () => {
      service.send({ type: "RUN_COMMAND", argument: CommandArgument.nearest })
    }
  )
  const runPreviousCommand = registerCommand("tromp.runPreviousCommand", () => {
    service.send({ type: "RUN_PREVIOUS" })
  })
  const openBookmark = registerCommand("tromp.openBookmark", () => {
    service.send({ type: "OPEN_BOOKMARK" })
  })

  context.subscriptions.push(runCommand)
  context.subscriptions.push(runCommandWithFile)
  context.subscriptions.push(runCommandWithNearest)
  context.subscriptions.push(runPreviousCommand)
  context.subscriptions.push(openBookmark)
}

// this method is called when your extension is deactivated
export function deactivate() {}
