# tromp

⚠️ work-in-progress

given you have a tromp.json the root of your project, e.g.

```json
{
  "tests": [
    {
      "match": "spec/**/*_spec.rb",
      "command": "bundle exec rspec"
    },
    {
      "match": "__tests__/**/*.js",
      "command": "npm test"
    }
  ]
}
```

`Tromp: run test` will the appropriate command.

recommended companion extension:
https://marketplace.visualstudio.com/items?itemName=will-wow.vscode-alternate-file


## Extension Settings

this extension contributes the following settings:

* `tromp.runTest`: run tests on current file

do you use vscode's vim mode? wire it up to a key binding:

```json
  "vim.normalModeKeyBindingsNonRecursive": [
    {
      "before": ["<leader>", "t"],
      "commands": ["tromp.runTest"]
    }
  ]
```
