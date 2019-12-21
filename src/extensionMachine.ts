import { assign, createMachine, Interpreter, spawn } from "xstate"
import {
  CommandArgument,
  CommandContext,
  CommandEvent,
  commandMachine,
} from "./commandMachine"

export interface ExtensionContext {
  currentCommand: string | undefined
  commandFinders: {
    id: number
    ref: Interpreter<CommandContext, any, CommandEvent>
  }[]
  commandMachine: typeof commandMachine
}

export type ExtensionEvent =
  | { type: "RUN_COMMAND"; argument: CommandArgument }
  | { type: "RUN_PREVIOUS" }
  | { type: "COMMAND_FINDER.STARTED"; id: number }
  | { type: "COMMAND_FINDER.FOUND"; command: string }
  | { type: "COMMAND_FINDER.FINISHED"; id: number }
  | { type: "OPEN_BOOKMARK" }

export type ExtensionState =
  | { value: "idle"; context: ExtensionContext }
  | {
      value: "executing"
      context: ExtensionContext & { currentCommand: string }
    }

let commandFinderId = 0
export const extensionMachine = createMachine<
  ExtensionContext,
  ExtensionEvent,
  ExtensionState
>({
  id: "tromp",
  initial: "idle",
  strict: true,
  context: {
    currentCommand: undefined,
    commandFinders: [],
    commandMachine: commandMachine,
  },
  states: {
    idle: {
      on: {
        "RUN_COMMAND": {
          actions: assign({
            commandFinders: (context, event) => {
              if (!context.commandMachine.context)
                throw new Error("invariant: needs context")

              const id = commandFinderId++

              return [
                ...context.commandFinders,
                {
                  id,
                  ref: spawn(
                    context.commandMachine.withContext({
                      ...context.commandMachine.context,
                      id,
                      argument: event.argument,
                    })
                  ),
                },
              ]
            },
          }),
        },
        "RUN_PREVIOUS": [
          {
            cond: function hasPreviousCommand(context, _event) {
              return context.currentCommand !== undefined
            },
            target: "executing",
          },
          {
            actions: "NO_PREVIOUS_COMMAND",
          },
        ],
        "COMMAND_FINDER.FOUND": {
          target: "executing",
          actions: assign({
            currentCommand: (_context, event) => event.command,
          }),
        },
        "COMMAND_FINDER.FINISHED": {
          actions: assign({
            commandFinders: (context, event) =>
              context.commandFinders.filter(
                commandFinder => commandFinder.id !== event.id
              ),
          }),
        },
        "OPEN_BOOKMARK": "openBookmark",
      },
    },
    openBookmark: {
      invoke: {
        src: "bookmarkMachine",
        onDone: "idle",
      },
    },
    executing: {
      entry: "RUN_COMMAND_IN_TERMINAL",
      on: {
        "": "idle",
      },
    },
  },
})
