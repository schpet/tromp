import { createMachine, assign } from "@xstate/fsm"

interface CContext {
  command: undefined | string
  configError: undefined | string
}

type CEvent =
  | { type: "RUN" }
  | { type: "CONFIG_OK"; command: string }
  | { type: "CONFIG_MISSING" }
  | { type: "CONFIG_ERROR"; configError: string }
  | { type: "EDIT" }
  | { type: "GENERATE" }
  | { type: "DISMISS" }
  | { type: "GENERATED" }
  | { type: "GENERATION_ERROR" }
  | { type: "RETRY" }

type CContextEmpty = CContext & {
  file: undefined
  command: undefined
  configError: undefined
}

type CContextError = CContext & {
  file: string
  command: undefined
  configError: string
}

type CContextCommand = CContext & {
  file: string
  command: string
  configError: undefined
}

type CState =
  | { value: "idle"; context: CContextEmpty }
  | { value: "invoked"; context: CContextCommand }
  | { value: "configurationMissing"; context: CContextEmpty }
  | { value: "configurationError"; context: CContextError }
  | { value: "generating"; context: CContext }
  | { value: "generationFailed"; context: CContext }
  | { value: "executing"; context: CContext }

export const configMachine = createMachine<CContext, CEvent, CState>({
  id: "config",
  initial: "idle",
  context: {
    command: undefined,
    configError: undefined,
  },
  states: {
    idle: {
      on: {
        RUN: "invoked",
      },
    },
    invoked: {
      on: {
        CONFIG_OK: {
          target: "executing",
          actions: [
            "RUN_COMMAND_ACTION",
            // assign({
            //   comand: (_ctx: any, ev: Extract<CEvent, { type: "CONFIG_OK" }>) =>
            //     ev.command,
            // }),
            assign({ comand: (_ctx, ev) => ev.command }),
          ],
        },
        CONFIG_MISSING: "configurationMissing",
        CONFIG_ERROR: {
          target: "configurationError",
          actions: assign({
            configError: (_ctx, ev) => ev.configError,
          }),
        },
      },
    },
    executing: {
      on: {
        DISMISS: "idle"
      }
    },
    configurationMissing: {
      on: {
        EDIT: "idle",
        GENERATE: "generating",
        DISMISS: "idle",
      },
    },
    configurationError: {
      on: {
        EDIT: "idle",
        DISMISS: "idle",
      },
    },
    generating: {
      on: {
        GENERATED: "idle",
        GENERATION_ERROR: "generationFailed",
      },
    },
    generationFailed: {
      on: {
        RETRY: "generating",
        DISMISS: "idle",
      },
    },
  },
})
