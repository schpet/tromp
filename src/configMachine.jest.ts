import { configMachine } from "./configMachine"
import { interpret } from "@xstate/fsm"

it("can run", () => {
  const toggleService = interpret(configMachine).start()
  const mock = jest.fn()

  toggleService.subscribe(state => {
    console.log(`state=${state.value}`)
    // console.log(state)
    mock(state.value, state.changed)
    state.actions.forEach(action => {
      switch (action.type) {
        case "RUN_COMMAND_ACTION": {
          console.log("run command from outside!!")
          break
        }
      }
    })
  })

  expect(mock).toHaveBeenNthCalledWith(1, "idle", undefined)

  toggleService.send({ type: "RUN" })
  expect(mock).toHaveBeenNthCalledWith(2, "started", true)

  // invalid events
  toggleService.send({ type: "EDIT" })
  toggleService.send({ type: "REJECT" })
  expect(mock).toHaveBeenNthCalledWith(3, "started", false)
  expect(mock).toHaveBeenNthCalledWith(4, "started", false)

  toggleService.send({ type: "CONFIG_OK", command: "foo" })
  expect(mock).toHaveBeenNthCalledWith(5, "success", true)

  // manually send this??
  toggleService.send({ type: "" })
  expect(mock).toHaveBeenNthCalledWith(6, "idle", true)

  toggleService.stop()
})
