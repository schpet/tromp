import { Uri } from "vscode"
import {
  assign,
  createMachine,
  DoneInvokeEvent,
  Interpreter,
  sendParent,
  spawn,
} from "xstate"

export enum CommandArgument {
  file = "file",
  nearest = "nearest",
  none = "none",
}

export type TrompCommandProblem =
  | { problem: "no_workspace"; message?: undefined; workspace?: undefined }
  | { problem: "no_editor"; message?: undefined; workspace: Uri }
  | { problem: "config_not_found"; message: string; workspace: Uri }
  | { problem: "config_invalid"; message: string; workspace: Uri }
  | { problem: "match_not_found"; message: string; workspace: Uri }
  | { problem: "nearest_not_found"; message: string; workspace: Uri }

export interface CommandContext {
  id: number
  errorMessage: string | undefined
  workspace: Uri | undefined
  argument: CommandArgument
}

export type CommandEvent =
  | { type: "EDIT" }
  | { type: "DISMISS" }
  | { type: "GENERATE" }
  | { type: "RETRY" }

export type CommandState =
  | { value: "started"; context: CommandContext }
  | { value: "matchNotFound"; context: CommandContext }
  | { value: "configNotFound"; context: CommandContext }
  | { value: "configInvalid"; context: CommandContext }
  | { value: "edit"; context: CommandContext & { workspace: Uri } }
  | { value: "generating"; context: CommandContext }
  | { value: "generationFailed"; context: CommandContext }
  | { value: "noWorkspace"; context: CommandContext }
  | { value: "noEditor"; context: CommandContext }
  | { value: "complete"; context: CommandContext }

type CommandErrorEvent = DoneInvokeEvent<TrompCommandProblem>

const findCommandErrorActions = assign<
  CommandContext,
  DoneInvokeEvent<TrompCommandProblem>
>({
  workspace: (_context, event: CommandErrorEvent) => {
    console.log(`wtf`, event)
    return event.data.workspace
  },
  errorMessage: (_context, event: DoneInvokeEvent<TrompCommandProblem>) =>
    event.data.message,
})

export const commandMachine = createMachine<
  CommandContext,
  CommandEvent,
  CommandState
>({
  id: "commandFinder",
  initial: "started",
  strict: true,
  context: {
    argument: CommandArgument.none,
    workspace: undefined,
    errorMessage: undefined,
    id: -1, // <-- bad default? better way to handle context that comes in?
  },
  states: {
    started: {
      entry: sendParent((context: CommandContext, event: void) => ({
        type: "COMMAND_FINDER.STARTED",
        id: context.id,
      })),
      invoke: {
        src: "findCommand",
        onDone: {
          target: "complete",
          actions: sendParent((
            context: CommandContext /*todo why type?*/,
            event: DoneInvokeEvent<string>
          ) => {
            return {
              type: "COMMAND_FINDER.FOUND",
              command: event.data,
            }
          }),
        },
        onError: [
          {
            target: "matchNotFound",
            cond: function matchNotFound(_context, event: CommandErrorEvent) {
              return event.data.problem === "match_not_found"
            },
            actions: findCommandErrorActions,
          },
          {
            target: "configNotFound",
            cond: function configNotFound(_context, event: CommandErrorEvent) {
              return event.data.problem === "config_not_found"
            },
            actions: findCommandErrorActions,
          },
          {
            target: "configInvalid",
            cond: function configInvalid(_context, event) {
              return event.data && event.data.problem === "config_invalid"
            },
            actions: findCommandErrorActions,
          },
          {
            target: "noEditor",
            cond: function noEditor(_context, event) {
              return event.data && event.data.problem === "no_editor"
            },
            actions: findCommandErrorActions,
          },
          {
            target: "noWorkspace",
            cond: function noWorkspace(_context, event) {
              return event.data && event.data.problem === "no_workspace"
            },
            actions: findCommandErrorActions,
          },
          {
            target: "basicError",
            actions: findCommandErrorActions,
          },
        ],
      },
    },
    matchNotFound: {
      invoke: { src: "renderMatchNotFound" },
      on: {
        DISMISS: "complete",
        EDIT: "edit",
      },
    },
    configNotFound: {
      invoke: { src: "renderConfigNotFound" },
      on: {
        GENERATE: "generating",
        DISMISS: "complete",
      },
    },
    configInvalid: {
      invoke: { src: "renderConfigInvalid" },
      on: {
        EDIT: "edit",
        DISMISS: "complete",
      },
    },
    edit: {
      entry: "EDIT_CONFIG",
      on: {
        "": "complete",
      },
    },
    generating: {
      invoke: {
        id: "generateConfig",
        src: "generateConfig",
        onDone: "complete",
        onError: "generationFailed",
      },
    },
    generationFailed: {
      invoke: { src: "renderGenerationFailed" },
      on: {
        // RETRY: "generating",
        DISMISS: "complete",
      },
    },
    noWorkspace: {
      invoke: { src: "renderNoWorkspace" },
      on: {
        DISMISS: "complete",
      },
    },
    noEditor: {
      invoke: { src: "renderNoEditor" },
      on: {
        DISMISS: "complete",
      },
    },
    basicError: {
      invoke: { src: "renderBasicError" },
      on: {
        DISMISS: "complete",
      },
    },
    complete: {
      type: "final",
      // @ts-ignore
      entry: sendParent((context, event) => ({
        type: "COMMAND_FINDER.FINISHED",
        id: context.id,
      })),
    },
  },
})

export interface ExtensionContext {
  currentCommand: string | undefined
  commandFinders: {
    id: number
    ref: Interpreter<CommandContext, any, CommandEvent>
  }[]
  commandMachine: typeof commandMachine
}

export type ExtensionEvent =
  | { type: "RUN_FILE"; argument: CommandArgument }
  | { type: "RUN_PREVIOUS" }
  | { type: "COMMAND_FINDER.STARTED"; id: number }
  | { type: "COMMAND_FINDER.FOUND"; command: string }
  | { type: "COMMAND_FINDER.FINISHED"; id: number }

export type ExtensionState =
  | { value: "idle"; context: ExtensionContext }
  | {
      value: "executing"
      context: ExtensionContext & { currentCommand: string }
    }

let commandFinderId = 0
export const trompMachine = createMachine<
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
        "RUN_FILE": {
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
        "COMMAND_FINDER.STARTED": {
          actions: "CONNECT_COMMAND_FINDER_UI",
        },
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
