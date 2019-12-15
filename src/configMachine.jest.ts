import "jest"
import { interpret } from "xstate"
import {
  CommandArgument,
  commandMachine as commandMachinePlain,
  trompMachine,
} from "./configMachine"

it(`runs a command successfully`, done => {
  const commandMachine = commandMachinePlain.withConfig({
    services: {
      findCommand: async () => `yarn jest foo/bar/baz.test.js`,
    },
  })

  const machine = trompMachine
    .withContext({
      ...trompMachine.context!,
      commandMachine,
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
  service.send({ type: "RUN_FILE", argument: CommandArgument.file })
})
