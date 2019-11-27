import { configMachine } from "./configMachine"
import { interpret } from "@xstate/fsm"

it("can run", () => {
  const toggleService = interpret(configMachine).start()
  const mock = jest.fn()
  toggleService.subscribe(state => {
    mock(state.value)
    console.log(`state=${state.value}`)
  })

  expect(mock).toHaveBeenNthCalledWith(1, "idle")

  toggleService.send({ type: "RUN", })
  expect(mock).toHaveBeenNthCalledWith(2, "started")

  // invalid events
  toggleService.send({ type: "EDIT" })
  toggleService.send({ type: "REJECT" })
  expect(mock).toHaveBeenNthCalledWith(3, "started")
  expect(mock).toHaveBeenNthCalledWith(4, "started")

  toggleService.send({ type: "CONFIG_OK", command: "foo" })
  expect(mock).toHaveBeenNthCalledWith(5, "success")

  // manually send this??
  toggleService.send({ type: "" })
  expect(mock).toHaveBeenNthCalledWith(6, "idle")

  toggleService.stop()
})
