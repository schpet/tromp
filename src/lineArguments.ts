import { success, Result, failure } from "./Result"
import { quote } from "shell-quote"

interface Args {
  line: number
  file: string
  getLine: (line: number) => string | undefined
}

export function rspec(args: Args): Result<string, string> {
  const { file, line } = args
  return success(`${file}:${line}`)
}

export function jest(args: Args): Result<string, string> {
  const { file, line, getLine } = args
  let currentLine = line

  let match
  while (currentLine >= 0) {
    const text = getLine(currentLine--)
    if (!text) continue

    const matches = JEST_TEST_REGEX.exec(text)
    if (matches && matches[2]) {
      match = matches[2]
      break
    }
  }

  if (!match) return failure("didn’t find any it, test, or describe calls")

  const trimmed = match.slice(1, -1)

  return success(quote([file, "-t", trimmed]))
}

/**
 * thank you
 * https://github.com/firsttris/vscode-jest-runner/blob/master/src/jestRunner.ts
 */
const JEST_TEST_REGEX = /(describe|it|test)\(("([^"]+)"|`([^`]+)`|'([^']+)'),/
