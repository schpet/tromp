import { Uri } from "vscode"
import {
  assign,
  createMachine,
  DoneInvokeEvent,
  Interpreter,
  sendParent,
  spawn,
} from "xstate"
import { TrompConfig } from "./types/trompSchema"

export enum CommandArgument {
  file = "file",
  nearest = "nearest",
  none = "none",
}

const findCommandErrorActions = assign<
  CommandContext,
  DoneInvokeEvent<TrompCommandProblem>
>({
  workspace: (_context, event: CommandErrorEvent) => {
    return event.data.workspace
  },
  errorMessage: (_context, event: DoneInvokeEvent<TrompCommandProblem>) =>
    event.data.message,
})

export type TrompCommandProblem =
  | { problem: "no_workspace"; message?: undefined; workspace?: undefined }
  | { problem: "no_editor"; message?: undefined; workspace: Uri }
  | { problem: "config_not_found"; message: string; workspace: Uri }
  | { problem: "config_invalid"; message: string; workspace: Uri }
  | { problem: "match_not_found"; message: string; workspace: Uri }
  | { problem: "nearest_not_found"; message: string; workspace: Uri }

export interface ConfigContext {
  workspace: Uri | undefined
  errorMessage: string | undefined
  config: TrompConfig | undefined
}

export type ConfigEvent =
  | { type: "EDIT" }
  | { type: "DISMISS" }
  | { type: "GENERATE" }

export type ConfigState =
  | { value: "initial"; context: ConfigContext }
  | { value: "configNotFound"; context: ConfigContext }
  | { value: "configInvalid"; context: ConfigContext }
  | { value: "noWorkspace"; context: ConfigContext }
  | { value: "generating"; context: ConfigContext }
  | { value: "generationFailed"; context: ConfigContext }
  | { value: "edit"; context: ConfigContext & { workspace: Uri } }

export const configMachine = createMachine<
  ConfigContext,
  ConfigEvent,
  ConfigState
>({
  id: "config",
  initial: "initial",
  strict: true,
  context: { workspace: undefined, errorMessage: undefined, config: undefined },
  states: {
    initial: {
      invoke: {
        src: "getConfig",
        onDone: {
          target: "complete",
          actions: assign({
            config: (_context, event) => {
              return event.data
            },
          }),
        },
        onError: [
          {
            target: "configNotFound",
            cond: function configNotFound(_context, event) {
              return event.data && event.data.problem === "config_not_found"
            },
            actions: assign({
              workspace: (_context, event) => event.data.workspace,
              errorMessage: (_context, event) => event.data.message,
            }),
          },
          // {
          //   target: "configInvalid",
          //   cond: function configInvalid(_context, event) {
          //     return event.data && event.data.problem === "config_invalid"
          //   },
          //   actions: findCommandErrorActions,
          // },
          // {
          //   target: "noEditor",
          //   cond: function noEditor(_context, event) {
          //     return event.data && event.data.problem === "no_editor"
          //   },
          //   actions: findCommandErrorActions,
          // },
          // {
          //   target: "noWorkspace",
          //   cond: function noWorkspace(_context, event) {
          //     return event.data && event.data.problem === "no_workspace"
          //   },
          //   actions: findCommandErrorActions,
          // }
        ],
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
    complete: {
      type: "final",
      data: {
        // TODO: remove type?
        config: (context: ConfigContext) => context.config,
      },
    },
  },
})

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
    // TODO putconfig in context here
  },
  states: {
    started: {
      invoke: {
        src: "configMachine",
        onDone: [
          {
            target: "configured",
            cond: (_context, event) => {
              return !!event.data.config
            },
          },
          {
            target: "complete",
          },
        ],
      },
    },
    configured: {
      invoke: {
        src: "findCommand",
        onDone: {
          target: "complete",
          actions: sendParent(
            (_context: void, event: DoneInvokeEvent<string>) => {
              return {
                type: "COMMAND_FINDER.FOUND",
                command: event.data,
              }
            }
          ),
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
        EDIT: "edit", // TODO: necessary to have a state for this?
      },
    },
    edit: {
      entry: "EDIT_CONFIG",
      on: {
        "": "complete",
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
      entry: sendParent((context: { id: string }) => ({
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
  | { type: "RUN_COMMAND"; argument: CommandArgument }
  | { type: "RUN_PREVIOUS" }
  | { type: "COMMAND_FINDER.STARTED"; id: number }
  | { type: "COMMAND_FINDER.FOUND"; command: string }
  | { type: "COMMAND_FINDER.FINISHED"; id: number }
  | { type: "OPEN_LINK" }

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
        "OPEN_LINK": "openLink",
      },
    },
    // this is disappointing, should be able to spawn a machine that finds and
    // generates a config
    openLink: {
      invoke: {
        src: "openLink",
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
