import * as assert from "assert"
import * as sinon from "sinon"

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode"

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.")

  test("shows no workspace error message", async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors")
    await vscode.commands.executeCommand("workbench.action.closeFolder")

    const spy = sinon.spy(vscode.window, "showErrorMessage")

    await vscode.commands.executeCommand("tromp.runCommandWithFile")

    assert.ok(spy.called, "an error message is shown")
    assert.equal(
      spy.getCall(0).args[0],
      "Tromp needs a workspace to run",
      "shows error message"
    )

    spy.restore()
  })
})
