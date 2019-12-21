import { Uri } from "vscode"
import { assign, createMachine } from "xstate"
import { TrompConfig } from "./types/trompSchema"

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
