# tromp

vscode extension that runs commands based on the file you have open. good for
running tests and arbitrary commands without leaving your editor.

### how it works

reads a tromp.json config file that connects glob matches with commands to run.

### commands

- **tromp.runCommand** allows running the command without arguments, e.g.
  `yarn test`
- **tromp.runCommandWithFile** run the command with the relative file as the
  last argument, e.g. `yarn test test/foo.spec.js`
- **tromp.runCommandWithNearest** run command with nearest arguments based on
  the mode, e.g. `rspec spec/foo_spec.rb:666` or
  `yarn jest src/foo.test.js -c "my cool test"` (support for jest and rspec so
  far)
- **tromp.runPreviousCommand** run the previously executed command again

### other notes

- works with
  [Alternate File](https://marketplace.visualstudio.com/items?itemName=will-wow.vscode-alternate-file),
  e.g. if you want to run a test from the non-test code

### install and setup

_todo: link to vscode marketplace_

#### regular keybindings

Preferences → Keyboard Shortcuts → Search for tromp

#### vim keybindings

update your settings.json with something like this

```json
{
  "vim.normalModeKeyBindingsNonRecursive": [
    {
      "before": ["<leader>", "a"],
      "commands": ["tromp.runCommand"]
    },
    {
      "before": ["<leader>", "t"],
      "commands": ["tromp.runCommandWithFile"]
    },
    {
      "before": ["<leader>", "s"],
      "commands": ["tromp.runCommandWithNearest"]
    },
    {
      "before": ["<leader>", "r"],
      "commands": ["tromp.runPreviousCommand"]
    }
  ]
}
```
