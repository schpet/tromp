import * as fsm from "@xstate/fsm"

interface CContext {
  file: undefined | string
  command: undefined | string
  configError: undefined | string
}

type CEvent =
  | { type: "" }
  | { type: "RUN"; command: string }
  | { type: "CONFIG_OK" }
  | { type: "CONFIG_MISSING" }
  | { type: "CONFIG_ERROR"; configError: string }
  | { type: "EDIT" }
  | { type: "GENERATE" }
  | { type: "DISMISS" }
  | { type: "RESOLVE" }
  | { type: "REJECT" }
  | { type: "RETRY" }

type CContextEmpty = CContext & { file: undefined; command: undefined; configError: undefined }

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
  | { value: "started"; context: CContextCommand }
  | { value: "configurationMissing"; context: CContextEmpty }
  | { value: "configurationError"; context: CContextError }
  | { value: "editing"; context: CContext }
  | { value: "generating"; context: CContext }
  | { value: "generationFailed"; context: CContext }
  | { value: "generated"; context: CContext }
  | { value: "success"; context: CContext }

export const configMachine = fsm.createMachine<CContext, CEvent, CState>({
  id: "config",
  initial: "idle",
  context: {
    file: undefined,
    command: undefined,
    configError: undefined,
  },
  states: {
    idle: {
      on: {
        RUN: {
          target: "started",
          actions: fsm.assign({
            comand: (_ctx: any, ev: Extract<CEvent, { type: "RUN" }>) =>
              ev.command,
          }),
        },
      },
    },
    started: {
      on: {
        CONFIG_OK: "success",
        CONFIG_MISSING: "configurationMissing",
        CONFIG_ERROR: {
          target: "configurationError",
          actions: fsm.assign({
            configError: (_ctx: any, ev: any) => ev.configError,
          }),
        },
      },
    },
    configurationMissing: {
      on: {
        EDIT: "editing",
        GENERATE: "generating",
        DISMISS: "idle",
      },
    },
    configurationError: {
      on: {
        EDIT: "editing",
        DISMISS: "idle",
      },
    },
    editing: {
      on: {
        "": "idle",
      },
    },
    generating: {
      on: {
        RESOLVE: "generated",
        REJECT: "generationFailed",
      },
    },
    generationFailed: {
      on: {
        RETRY: "generating",
        DISMISS: "idle",
      },
    },
    generated: {
      on: {
        "": "idle",
      },
    },
    success: {
      on: {
        "": "idle",
      },
    },
  },
})
