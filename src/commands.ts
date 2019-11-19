import * as vscode from "vscode"
import * as alt from "alternate-file"
import * as path from "path"
import * as t from "io-ts"
import * as minimatch from "minimatch"
import { relative } from "path"
import { promises as fs } from "fs"
import { isLeft } from "fp-ts/lib/Either"
import { reporter } from "io-ts-reporters"

const TrompTests = t.interface({
  match: t.string,
  command: t.string,
})

export const TrompConfig = t.interface({
  tests: t.array(TrompTests),
})

export type TrompConfig = t.TypeOf<typeof TrompConfig>

export async function runTest() {
  try {
    const { workspaceFolders } = vscode.workspace

    const root = workspaceFolders && workspaceFolders[0]
    if (!root) throw new Error("no workspace")

    const trompConfig = await getTrompConfig(root.uri.fsPath)

    const editor = vscode.window.activeTextEditor
    if (!editor) throw new Error("no editor :(")

    const activeFsPath = editor.document.uri.fsPath
    const activeFsPathRelative = relative(root.uri.fsPath, activeFsPath)

    let command = findCommand(trompConfig, activeFsPathRelative)

    if (!command) {
      // file isn't a match.
      // use projections.json to see if an alternative matches
      const alternate = await alt.findAlternateFile(activeFsPath)

      // @ts-ignore some sort of Either type i don't get
      const altFsPath: string | undefined = alternate.ok

      if (altFsPath) {
        const altFsPathRelative = relative(root.uri.fsPath, altFsPath)
        command = findCommand(trompConfig, altFsPathRelative)
      }
    }

    if (!command) {
      throw new Error(`tromp.json has no match for ${activeFsPathRelative}`)
    }

    const terminal =
      vscode.window.activeTerminal || vscode.window.createTerminal("tromp")

    terminal.show(true)

    // would be nicer to keep scroll-back history
    await vscode.commands.executeCommand("workbench.action.terminal.clear")

    terminal.sendText(`${command.command} ${command.targetFsPathRelative}`)
  } catch (e) {
    if (e instanceof Error) {
      vscode.window.showErrorMessage(e.message)
    } else {
      vscode.window.showErrorMessage(
        `unknown error: ${JSON.stringify(e, null, 2)}`
      )
    }
  }
}

function findCommand(trompConfig: TrompConfig, targetFsPathRelative: string) {
  const command = trompConfig.tests.find(configTestEntry =>
    minimatch(targetFsPathRelative, configTestEntry.match)
  )
  if (!command) return

  return {
    ...command,
    targetFsPathRelative,
  }
}

async function getTrompConfig(root: string, configName = "tromp.json") {
  let result
  try {
    const configPath = path.join(root, configName)
    const configFile = await fs.readFile(configPath)
    const configData = JSON.parse(configFile.toString())
    result = TrompConfig.decode(configData)
  } catch (e) {
    throw new Error(`problem loading ${configName}: ${e}`)
  }

  if (isLeft(result)) {
    // const validationMessage = result.left.map(x => x.message)
    throw new Error(
      `${configName} has ${result.left.length} validation error(s):\n` +
        reporter(result).join("\n")
    )
  }

  return result.right
}
