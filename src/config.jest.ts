import { decodeConfig } from "./config"

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

  describe(`links`, () => {
    it(`allows links`, () => {
      const config = JSON.stringify({
        links: {
          foo: "https://foo.biz",
          bar: "https://bar.ca",
          baz: "file:///tmp/foo",
        },
      })

      const result = decodeConfig(config)

      expect(result).not.toHaveProperty("reason")
      expect(result.ok).toBe(true)
    })

    it(`validates uris`, () => {
      const config = JSON.stringify({
        links: {
          foo: "not a link",
        },
      })

      const result = decodeConfig(config)

      expect(result).toHaveProperty("reason")
      expect(result.ok).toBe(false)
    })
  })
})
