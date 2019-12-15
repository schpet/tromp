import Ajv from "ajv"
import * as alt from "alternate-file"
import { promises as fs } from "fs"
import minimatch from "minimatch"
import { relative } from "path"
import { failure, Result, success } from "./Result"
import * as trompSchema from "./trompSchema.json"
import {
  Commands,
  TrompConfig,
  ArgumentTypeUsedForLinesDefaultsToRspec,
} from "./types/trompSchema.js"

export function findCommand(
  trompConfig: TrompConfig,
  targetFsPathRelative: string
): Commands | undefined {
  return trompConfig.commands.find(configTestEntry =>
    minimatch(targetFsPathRelative, configTestEntry.match)
  )
}

export function decodeConfig(config: string): Result<TrompConfig, string> {
  let configData
  try {
    configData = JSON.parse(config)
  } catch (e) {
    return failure(`invalid json`)
  }

  const ajv = new Ajv()
  const validate = ajv.compile(trompSchema) // todo memoizeone
  const valid = validate(configData)

  if (!valid) {
    const { errors } = validate
    if (errors && errors.length > 0) {
      const [firstError] = errors
      const dataPath = firstError.dataPath || `root`
      const message = firstError.message || `(unknown)`
      return failure(`${dataPath} ${message}`)
    }
    return failure(`no info from ajv about problems`)
  }

  return success(configData)
}

export async function readConfigFromFs(
  configPath: string
): Promise<Result<TrompConfig, string>> {
  let configBuffer
  try {
    configBuffer = await fs.readFile(configPath)
  } catch (e) {
    return failure(`failed to read: ${e.message}`)
  }

  return decodeConfig(configBuffer.toString())
}

export interface TrompCommand {
  command: string
  file: string
  mode: ArgumentTypeUsedForLinesDefaultsToRspec
}

export async function getCommand({
  trompConfig,
  activeFsPath,
  rootFsPath,
}: {
  trompConfig: TrompConfig
  activeFsPath: string
  rootFsPath: string
}): Promise<Result<TrompCommand, string>> {
  const activeFsPathRelative = relative(rootFsPath, activeFsPath)
  let [command, file] = [
    findCommand(trompConfig, activeFsPathRelative),
    activeFsPathRelative,
  ]

  if (!command) {
    // file isn't a match.
    // use projections.json to see if an alternative matches
    // alternate-file has strange types, so casted to any
    const alternate = (await alt.findAlternateFile(activeFsPath)) as any
    const altFsPath: string | undefined = alternate.ok

    if (altFsPath !== undefined) {
      const altFsPathRelative = relative(rootFsPath, altFsPath)
      command = findCommand(trompConfig, altFsPathRelative)
      file = altFsPathRelative
    }
  }

  if (!command) {
    return failure(activeFsPathRelative)
  }

  const mode = command.mode || "rspec"

  return success({ command: command.command, file, mode })
}
