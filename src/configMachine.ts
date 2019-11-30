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
  | { type: "NO_COMMAND" }
  | { type: "CONFIG_MISSING" }
  | { type: "CONFIG_ERROR"; configError: string; workspace: Uri }
  | { type: "EDIT" }
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
  | { value: "configurationMissing"; context: CContextEmpty }
  | { value: "configurationError"; context: CContextError }
  | { value: "generating"; context: CContext }
  | { value: "generationFailed"; context: CContext }
  | { value: "executing"; context: CContext }
  | { value: "noWorkspace"; context: CContext }

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
        RUN: {
          target: "invoked",
        },
      },
    },
    invoked: {
      entry: [{ type: "EXECUTE" }],
      on: {
        // event
        SUCCESS: {
          target: "idle",
          actions: [
            // TODO: consider storing "previous command" to state
          ],
        },
        NO_COMMAND: "noCommand", // TODO: assign the current filename
        CONFIG_MISSING: "configurationMissing",
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
        DISMISS: "idle",
        EDIT: "idle",
      },
    },
    configurationMissing: {
      on: {
        EDIT: {
          target: "idle",
          actions: ["EDIT_CONFIG"],
        },
        GENERATE: "generating",
        DISMISS: "idle",
      },
    },
    configurationError: {
      on: {
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
        GENERATED: {
          target: "idle",
        },
        GENERATION_ERROR: "generationFailed",
      },
    },
    generationFailed: {
      on: {
        RETRY: "generating",
        DISMISS: "idle",
      },
    },
    noWorkspace: {
      on: {
        DISMISS: "idle",
      },
    },
  },
})
