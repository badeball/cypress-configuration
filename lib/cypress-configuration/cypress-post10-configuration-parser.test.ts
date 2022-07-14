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

describe.only("parsePost10Configuration()", () => {
  // example("module.exports = { specPattern: 'foo/bar' };", {
  //   specPattern: "foo/bar",
  // });

  example("export default { specPattern: 'foo/bar' };", {
    specPattern: "foo/bar",
  });
});
