import * as Ajv from "ajv"
import { promises as fs } from "fs"
import * as minimatch from "minimatch"
import { failure, Result, success } from "./Result"
import * as trompSchema from "./trompSchema.json"
import { TrompConfig } from "./types/trompSchema.js"

export function findCommand(
  trompConfig: TrompConfig,
  targetFsPathRelative: string
) {
  const command = trompConfig.commands.find(configTestEntry =>
    minimatch(targetFsPathRelative, configTestEntry.match)
  )
  if (!command) return

  return {
    ...command,
    targetFsPathRelative,
  }
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
      return failure(`doesn’t seem right – ${dataPath} ${message}`)
    }
    return failure(`doesn’t seem right (no info from ajv about why)`)
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
