import * as vscode from "vscode"
import { CommandArgument } from "./configMachine"
import { buildTrompService } from "./trompService"

const { registerCommand } = vscode.commands

export function activate(context: vscode.ExtensionContext) {
  const service = buildTrompService().start()

  const runCommand = registerCommand("tromp.runCommand", () => {
    service.send({ type: "RUN_FILE", argument: CommandArgument.none })
  })
  const runCommandWithFile = registerCommand("tromp.runCommandWithFile", () => {
    service.send({ type: "RUN_FILE", argument: CommandArgument.file })
  })
  const runCommandWithLine = registerCommand("tromp.runCommandWithLine", () => {
    service.send({ type: "RUN_FILE", argument: CommandArgument.nearest })
  })
  const runPreviousCommand = registerCommand("tromp.runPreviousCommand", () => {
    service.send({ type: "RUN_PREVIOUS" })
  })

  context.subscriptions.push(runCommand)
  context.subscriptions.push(runCommandWithFile)
  context.subscriptions.push(runCommandWithLine)
  context.subscriptions.push(runPreviousCommand)
}

// this method is called when your extension is deactivated
export function deactivate() {}
