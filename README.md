# tromp

vscode extension that runs commands based on the file you have open. good for
running tests and arbitrary commands without leaving your editor.

![animation showing commands running](./images/commands-animation.gif)

also lets you quickly open bookmarks associated with a project:

![animation showing bookmarks](./images/bookmarks-animation.gif)

## install

quick open (<kbd>⌘P</kbd>) and enter the following:

```
ext install schpet.tromp
```

or grab it from  
https://marketplace.visualstudio.com/items?itemName=schpet.tromp

### how it works

reads a tromp.json config file that associates commands with glob matches, and
defines bookmarks.

example tromp.json:

```json
{
  "commands": [
    {
      "match": "**/*.jest.ts",
      "command": "yarn jest",
      "mode": "jest"
    },
    {
      "match": "**/*_spec.rb",
      "command": "rspec",
      "mode": "rspec"
    },
    {
      "match": "**/*.js",
      "command": "node"
    }
  ],
  "bookmarks": {
    "marketplace": "https://marketplace.visualstudio.com/items?itemName=schpet.tromp",
    "github": "https://github.com/schpet/tromp",
    "pull requests": "https://github.com/schpet/tromp/pulls",
    "sentry": "https://sentry.io/organizations/tromp/issues/?project=123456"
  }
}
```

### commands

- **tromp.runCommand**  
  allows running the command without arguments, e.g. `yarn test`
- **tromp.runCommandWithFile**  
  run the command with the relative file as the last argument, e.g.
  `yarn test test/foo.spec.js`
- **tromp.runCommandWithNearest**  
  run command with nearest arguments based on the mode  
  e.g. `rspec spec/foo_spec.rb:666`  
  or `yarn jest src/foo.test.js -t "my cool test"`  
  _support for jest and rspec so far_
- **tromp.runPreviousCommand**  
  run the previously executed command again
- **tromp.openBookmark**  
  pop open your list of bookmarks (similar UI as opening a file via cmd-p)

### other notes

- works with
  [Alternate File](https://marketplace.visualstudio.com/items?itemName=will-wow.vscode-alternate-file),
  e.g. if you want to run a test from the non-test code

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

### Publishing

- ensure vsce is installed (npm i -g vsce)
- `vsce package && vsce publish`
- if asked for a token, visit https://dev.azure.com/tromp/_usersSettings/tokens
  for a token, hit "regenerate"
