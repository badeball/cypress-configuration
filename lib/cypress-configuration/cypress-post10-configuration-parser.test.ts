import assert from "assert/strict";

import { ICypressPost10Configuration } from "./cypress-post10-configuration";

import { parsePost10Configuration } from "./cypress-post10-configuration-parser";

let examples = 1;

function example(
  source: string,
  expected: Partial<ICypressPost10Configuration>
) {
  it(`example #${examples++}`, () => {
    assert.deepEqual(parsePost10Configuration(source), expected);
  });
}

describe("parsePost10Configuration()", () => {
  example("module.exports = { e2e: { specPattern: 'foo/bar' } };", {
    specPattern: "foo/bar",
  });

  example(
    "module.exports = defineConfig({ e2e: { specPattern: 'foo/bar' } });",
    {
      specPattern: "foo/bar",
    }
  );

  example("export default { e2e: { specPattern: 'foo/bar' } };", {
    specPattern: "foo/bar",
  });

  example("export default defineConfig({ e2e: { specPattern: 'foo/bar' } });", {
    specPattern: "foo/bar",
  });
});
