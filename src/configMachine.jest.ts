import { configMachine } from "./configMachine"
import { interpret } from "@xstate/fsm"

it(`subscribes to state changes`, () => {
  const service = interpret(configMachine).start()

  const stateMock = jest.fn()
  service.subscribe(state => {
    stateMock(state.value, state.changed)
  })

  expect(stateMock).toHaveBeenNthCalledWith(1, "idle", undefined)

  service.send({ type: "RUN" })
  expect(stateMock).toHaveBeenNthCalledWith(2, "invoked", true)

  // invalid events
  service.send({ type: "EDIT" })
  expect(stateMock).toHaveBeenNthCalledWith(3, "invoked", false)

  service.send({ type: "SUCCESS" })
  expect(stateMock).toHaveBeenNthCalledWith(4, "idle", true)
})

it(`executes`, done => {
  const service = interpret(configMachine).start()
  done()
})
