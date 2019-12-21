import { Uri } from "vscode"
import { assign, createMachine, DoneInvokeEvent, sendParent } from "xstate"
import { TrompConfig } from "./types/trompSchema"

export enum CommandArgument {
  file = "file",
  nearest = "nearest",
  none = "none",
}

export type TrompCommandProblem =
  | { problem: "no_editor"; message?: undefined; workspace: Uri }
  | { problem: "match_not_found"; message: string; workspace: Uri }
  | { problem: "nearest_not_found"; message: string; workspace: Uri }

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

export interface CommandContext {
  id: number
  errorMessage: string | undefined
  workspace: Uri | undefined
  config: TrompConfig | undefined
  argument: CommandArgument
}

type CommandContextConfigured = CommandContext & {
  workspace: Uri
  config: TrompConfig
}

export type CommandEvent =
  | { type: "EDIT" }
  | { type: "DISMISS" }
  | { type: "GENERATE" }
  | { type: "RETRY" }

export type CommandState =
  | { value: "started"; context: CommandContext }
  | { value: "matchNotFound"; context: CommandContextConfigured }
  | { value: "edit"; context: CommandContextConfigured }
  | { value: "noEditor"; context: CommandContextConfigured }
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
    config: undefined,
    workspace: undefined,
    errorMessage: undefined,
    id: -1, // <-- bad default? better way to handle context that comes in?
  },
  states: {
    started: {
      invoke: {
        src: "configMachine",
        onDone: [
          {
            target: "configured",
            cond: (_context, event) => {
              return !!(event.data.config && event.data.workspace)
            },
            actions: assign({
              config: (_context, event) => event.data.config,
              workspace: (_context, event) => event.data.workspace,
            }),
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
            target: "noEditor",
            cond: function noEditor(_context, event) {
              return event.data && event.data.problem === "no_editor"
            },
            actions: assign({
              errorMessage: (_context, event) => event.data.message,
            }),
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
