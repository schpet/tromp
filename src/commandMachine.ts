import { Uri } from "vscode"
import { assign, createMachine, DoneInvokeEvent, sendParent } from "xstate"

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
