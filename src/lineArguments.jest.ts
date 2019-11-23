import { jest, rspec } from "./lineArguments"

describe("rspec", () => {
  it("returns a colon and line number", () => {
    const result = rspec({
      line: 69,
      file: "foo_spec.rb",
      getLine: () => undefined,
    })

    expect(result.ok && result.value).toBe(`foo_spec.rb:69`)
  })
})

describe("jest", () => {
  const getLine = (file: string) => (num: number) =>
    file.split(`\n`)[num] || undefined

  it("returns the nearest it", () => {
    const file = `it('does a thing', () => {
        foo.bar
    `
    const result = jest({
      file: "foo.spec.js",
      line: 1,
      getLine: getLine(file),
    })

    expect(result.ok).toBe(true)
    expect(result.ok && result.value).toBe(`foo.spec.js -t 'does a thing'`)
  })

  it(`handles quotes`, () => {
    const file = `
      it(\`does a 'quote' and "dblquote" thing\`, () => {
        foo.bar
    `

    const result = jest({
      file: "foo.spec.js",
      line: 2,
      getLine: getLine(file),
    })

    expect(result.ok).toBe(true)
    expect(result.ok && result.value).toMatchInlineSnapshot(
      `"foo.spec.js -t \\"does a 'quote' and \\\\\\"dblquote\\\\\\" thing\\""`
    )
  })

  it(`handles filenames with spaces`, () => {
    const file = `it('does a thing', () => {
        foo.bar
    `
    const result = jest({
      file: "foo bar.spec.js",
      line: 1,
      getLine: getLine(file),
    })

    expect(result.ok).toBe(true)
    expect(result.ok && result.value).toBe(
      `'foo bar.spec.js' -t 'does a thing'`
    )
  })
})
