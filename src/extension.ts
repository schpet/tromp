import * as vscode from "vscode"
import { buildTrompService } from "./service"
import { CommandArgument } from "./commandMachine"

const { registerCommand } = vscode.commands

export function activate(context: vscode.ExtensionContext) {
  const service = buildTrompService().start()

  const commands: {
    [command: string]: Parameters<typeof service["send"]>[0]
  } = {
    "tromp.runCommand": {
      type: "RUN_COMMAND",
      argument: CommandArgument.none,
    },
    "tromp.runCommandWithFile": {
      type: "RUN_COMMAND",
      argument: CommandArgument.file,
    },
    "tromp.runCommandWithNearest": {
      type: "RUN_COMMAND",
      argument: CommandArgument.nearest,
    },
    "tromp.runPreviousCommand": {
      type: "RUN_PREVIOUS",
    },
    "tromp.openBookmark": {
      type: "OPEN_BOOKMARK",
    },
  }

  const disposers = Object.entries(commands).map(([command, event]) =>
    registerCommand(command, () => {
      service.send(event)
    })
  )

  context.subscriptions.push(...disposers)
}

// this method is called when your extension is deactivated
export function deactivate() {}
