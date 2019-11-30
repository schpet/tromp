import { createMachine, assign, StateMachine } from "@xstate/fsm"
import { TrompConfig } from "./types/trompSchema"
import { Uri } from "vscode"

interface CContext {
  workspace: Uri | undefined
  configError: string | undefined
}

type CContextEmpty = CContext & {
  file: undefined
  configError: undefined
}

type CContextError = CContext & {
  file: string
  configError: string
  workspace: Uri
}

type CEvent =
  | { type: "RUN" }
  | { type: "SUCCESS" }
  | { type: "NO_COMMAND", workspace: Uri }
  | { type: "CONFIG_MISSING"; workspace: Uri }
  | { type: "CONFIG_ERROR"; configError: string; workspace: Uri }
  | { type: "EDIT"; workspace: Uri }
  | { type: "GENERATE" }
  | { type: "DISMISS" }
  | { type: "GENERATED" }
  | { type: "GENERATION_ERROR" }
  | { type: "RETRY" }
  | { type: "NO_WORKSPACE" }

type CState =
  | { value: "idle"; context: CContextEmpty }
  | {
      value: "invoked"
      context: CContext & {
        file: string
        command: string
        configError: undefined
      }
    }
  | { value: "configurationMissing"; context: CContext & { workspace: Uri } }
  | { value: "configurationError"; context: CContextError }
  | { value: "generating"; context: CContext }
  | { value: "generationFailed"; context: CContext }
  | { value: "executing"; context: CContext }
  | { value: "noWorkspace"; context: CContext }
  | { value: "noCommand"; context: CContext & { workspace: Uri } }

// type questions:
// - when adding state not in TState, why no error?
export const configMachine = createMachine<CContext, CEvent, CState>({
  id: "config",
  initial: "idle",
  context: {
    workspace: undefined, // where tromp.json and commands are run relative to
    configError: undefined,
  },
  states: {
    idle: {
      on: {
        RUN: "invoked",
      },
    },
    invoked: {
      entry: [{ type: "EXECUTE" }],
      on: {
        // event
        RUN: "invoked",
        SUCCESS: {
          target: "idle",
          actions: [
            // TODO: consider storing "previous command" to state
          ],
        },
        NO_COMMAND: {
          target: "noCommand", // TODO: assign the current filename
          actions: assign({
            // @ts-ignore
            workspace: (_ctx, ev) => ev.workspace,
          }),
        },
        CONFIG_MISSING: {
          target: "configurationMissing",
          actions: assign({
            // @ts-ignore
            workspace: (_ctx, ev) => ev.workspace,
          }),
        },
        CONFIG_ERROR: {
          target: "configurationError",
          actions: assign({
            // @ts-ignore
            configError: (_ctx, ev) => ev.configError,
            // @ts-ignore
            workspace: (_ctx, ev) => ev.workspace,
          }),
        },
        NO_WORKSPACE: "noWorkspace",
      },
    },
    noCommand: {
      on: {
        RUN: "invoked",
        DISMISS: "idle",
        EDIT: {
          target: "idle",
          actions: [
            assign({
              // @ts-ignore
              workspace: (_ctx, ev) => ev.workspace,
            }),
            { type: "EDIT_CONFIG" },
          ],
        },
      },
    },
    configurationMissing: {
      on: {
        RUN: "invoked",
        EDIT: {
          target: "idle",
          actions: [
            assign({
              // @ts-ignore
              workspace: (_ctx, ev) => ev.workspace,
            }),
            { type: "EDIT_CONFIG" },
          ],
        },
        GENERATE: "generating",
        DISMISS: "idle",
      },
    },
    configurationError: {
      on: {
        RUN: "invoked",
        EDIT: {
          target: "idle",
          actions: ["EDIT_CONFIG"],
        },
        DISMISS: "idle",
      },
    },
    generating: {
      entry: ["GENERATE_CONFIG"],
      on: {
        RUN: "invoked",
        GENERATED: {
          target: "idle",
        },
        GENERATION_ERROR: "generationFailed",
      },
    },
    generationFailed: {
      on: {
        RUN: "invoked",
        RETRY: "generating",
        DISMISS: "idle",
      },
    },
    noWorkspace: {
      on: {
        RUN: "invoked",
        DISMISS: "idle",
      },
    },
  },
})
