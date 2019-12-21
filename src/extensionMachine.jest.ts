import "jest"
import { interpret } from "xstate"
import { configMachine } from "./configMachine"
import {
  commandMachine,
  CommandArgument,
  TrompCommandProblem,
} from "./commandMachine"
import { extensionMachine } from "./extensionMachine"

it(`runs a command successfully`, done => {
  const configMachineSetup = configMachine.withConfig({
    services: {
      getConfig: async () => {
        return { todo: "put a config here" }
      },
    },
  })

  const commandMachineSetup = commandMachine.withConfig({
    services: {
      configMachine: configMachineSetup,
      findCommand: async () => {
        return `yarn jest foo/bar/baz.test.js`
      },
    },
  })

  const machine = extensionMachine
    .withContext({
      ...extensionMachine.context!,
      commandMachine: commandMachineSetup,
    })
    .withConfig({
      actions: {
        RUN_COMMAND_IN_TERMINAL: context => {
          expect(context.currentCommand).toEqual(
            "yarn jest foo/bar/baz.test.js"
          )
          done()
        },
        CONNECT_COMMAND_FINDER_UI: () => {},
      },
    })

  const service = interpret(machine).start()
  service.send({ type: "RUN_COMMAND", argument: CommandArgument.file })
})

it(`invokes the config generation services`, done => {
  const configMachineSetup = configMachine.withConfig({
    services: {
      getConfig: () => {
        const result: TrompCommandProblem = {
          problem: "config_not_found",
          message: "uh oh",
          workspace: null as any,
        }
        return Promise.reject(result)
      },
      renderConfigNotFound: () => callback => {
        // instead of rendering UI, immediately callback with "GENERATE" event
        callback("GENERATE")
      },
      generateConfig: () => {
        done()
        return Promise.resolve()
      },
    },
  })

  const commandMachineSetup = commandMachine.withConfig({
    services: {
      configMachine: configMachineSetup,
    },
  })

  const machine = extensionMachine
    .withContext({
      ...extensionMachine.context!,
      commandMachine: commandMachineSetup,
    })
    .withConfig({
      actions: {
        CONNECT_COMMAND_FINDER_UI: () => {},
      },
    })

  const service = interpret(machine).start()
  service.send({ type: "RUN_COMMAND", argument: CommandArgument.file })
})
