// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode"
import * as alt from "alternate-file"
import { relative } from "path"
import { promises as fs } from "fs"
import * as path from "path"
import * as t from "io-ts"
import { isLeft } from "fp-ts/lib/Either"
import * as minimatch from "minimatch"

const TrompTests = t.interface({
  match: t.string,
  command: t.string,
})

const TrompConfig = t.interface({
  tests: t.array(TrompTests),
})

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "tromp.runTest",
    async () => {
      const { workspaceFolders } = vscode.workspace
      const root = workspaceFolders && workspaceFolders[0]
      if (!root) {
        vscode.window.showErrorMessage("no workspace")
        return
      }

      let trompConfig
      try {
        const configPath = path.join(root.uri.fsPath, "tromp.json")
        const configFile = await fs.readFile(configPath)
        const configData = JSON.parse(configFile.toString())
        const result = TrompConfig.decode(configData)

        if (isLeft(result)) {
          const validationMessage = result.left.map(x => x.message)
          throw new Error(`validation error: ${validationMessage}`)
        }

        trompConfig = result.right
      } catch (e) {
        vscode.window.showErrorMessage(`Problem with tromp.json: ${e.message}`)
        return
      }

      const editor = vscode.window.activeTextEditor
      if (!editor) {
        return vscode.window.showErrorMessage("no editor :(")
      }

      const { fsPath } = editor.document.uri
      let relativeTestPath = relative(
        root.uri.fsPath,
        editor.document.uri.fsPath
      )

      let command = trompConfig.tests.find(configTestEntry =>
        minimatch(relativeTestPath, configTestEntry.match)
      )

      // file isn't a match.
      // use projections.json to see if an alternative matches
      if (!command) {
        const alternate = await alt.findAlternateFile(fsPath)
        if (!alt.isAlternateFileNotFoundError(alternate)) {
          // @ts-ignore
          const altFsPath: string = alternate.ok
          relativeTestPath = relative(root.uri.fsPath, altFsPath)

          command = trompConfig.tests.find(configTestEntry =>
            minimatch(relativeTestPath, configTestEntry.match)
          )
        }
      }

      if (!command) {
        return vscode.window.showErrorMessage(
          `tromp.json has no match for ${relativeTestPath}`
        )
      }

      const terminal =
        vscode.window.activeTerminal || vscode.window.createTerminal("tromp")

      terminal.show(true)
      await vscode.commands.executeCommand("workbench.action.terminal.clear")
      terminal.sendText(`${command.command} ${relativeTestPath}`)
    }
  )

  context.subscriptions.push(disposable)
}

// this method is called when your extension is deactivated
export function deactivate() {}
