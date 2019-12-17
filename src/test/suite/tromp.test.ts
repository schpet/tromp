import * as assert from "assert"
import * as vscode from "vscode"
import * as path from "path"
import * as sinon from "sinon"
import * as util from "../../util"

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.")

  test("it runs a command successfully", async () => {
    const errorMessageSpy = sinon.spy(vscode.window, "showErrorMessage")

    const { workspaceFolders = [] } = vscode.workspace
    assert.equal(workspaceFolders.length, 1, "one workspace is open")
    const workspace = workspaceFolders[0]

    await vscode.commands.executeCommand("tromp.runCommandWithFile")

    assert.ok(errorMessageSpy.called, "an error message is shown")
    assert.equal(
      errorMessageSpy.getCall(0).args[0],
      "Tromp needs an editor to run",
      "shows editor error message"
    )

    await vscode.window.showTextDocument(
      vscode.Uri.file(path.join(workspace.uri.fsPath, "cool.txt"))
    )

    const terminal = util.trompTerminal()

    return new Promise(resolve => {
      sinon.replace(terminal, "sendText", text => {
        assert.equal(text, "cat cool.txt")
        sinon.restore()
        resolve()
      })

      vscode.commands.executeCommand("tromp.runCommandWithFile")
    })
  })
})
