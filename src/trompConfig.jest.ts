import { decodeConfig } from "./trompConfig"

describe(`decodeConfig`, () => {
  it(`reads a valid config`, () => {
    const config = `
      {
        "commands": [
          {
            "match": "**/*.js",
            "command": "npm test"
          }
        ]
      }
    `

    const result = decodeConfig(config)

    expect(result).not.toHaveProperty("reason")
    expect(result.ok).toBe(true)
  })

  it(`doesnt accept invalid json`, () => {
    const config = `{ foo: "bar" }`

    const result = decodeConfig(config)

    expect(result.ok).toBe(false)
    expect(result).toMatchInlineSnapshot(`
      Object {
        "ok": false,
        "reason": "invalid json",
      }
    `)
  })
})
