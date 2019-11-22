import * as alt from "alternate-file"
import * as path from "path"
import { relative } from "path"
import { failure, Result, success } from "./Result"
import { readConfigFromFs, findCommand } from "./trompConfig"

export async function runTest(
  rootFsPath: string,
  activeFsPath: string
): Promise<Result<string, string>> {
  const configFsPath = path.join(rootFsPath, "tromp.json")
  const trompConfigResult = await readConfigFromFs(configFsPath)
  if (!trompConfigResult.ok) {
    return failure(`tromp.json ${trompConfigResult.reason}`)
  }

  const trompConfig = trompConfigResult.value

  const activeFsPathRelative = relative(rootFsPath, activeFsPath)
  let command = findCommand(trompConfig, activeFsPathRelative)

  if (!command) {
    // file isn't a match.
    // use projections.json to see if an alternative matches
    // alternate-file has strange types, so casted to any
    const alternate = (await alt.findAlternateFile(activeFsPath)) as any
    const altFsPath: string | undefined = alternate.ok

    if (altFsPath) {
      const altFsPathRelative = relative(rootFsPath, altFsPath)
      command = findCommand(trompConfig, altFsPathRelative)
    }
  }

  if (!command) {
    return failure(`tromp.json has no match for ${activeFsPathRelative}`)
  }

  return success(`${command.command} ${command.targetFsPathRelative}`)
}
