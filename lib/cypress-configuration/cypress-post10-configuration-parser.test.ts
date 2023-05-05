import assert from "assert/strict";

import { ICypressPost10Configuration } from "./cypress-post10-configuration";

import {
  ConfigurationFile,
  parsePost10Configuration,
} from "./cypress-post10-configuration-parser";

let examples = 1;

function example(source: string, expected: ConfigurationFile) {
  it(`example #${examples++}`, () => {
    assert.deepStrictEqual(parsePost10Configuration(source), expected);
  });
}

describe("parsePost10Configuration()", () => {
  for (const testingType of ["e2e", "component"]) {
    describe(testingType, () => {
      for (const property of ["specPattern", "excludeSpecPattern"] as const) {
        example(
          `module.exports = { ${testingType}: { ${property}: 'foo/bar' } };`,
          {
            [testingType]: { [property]: "foo/bar" },
          }
        );

        example(
          `module.exports = { ${testingType}: { ${property}: ['foo/bar'] } };`,
          {
            [testingType]: { [property]: ["foo/bar"] },
          }
        );

        example(
          `module.exports = defineConfig({ ${testingType}: { ${property}: 'foo/bar' } });`,
          {
            [testingType]: { [property]: "foo/bar" },
          }
        );

        example(
          `module.exports = defineConfig({ ${testingType}: { ${property}: ['foo/bar'] } });`,
          {
            [testingType]: { [property]: ["foo/bar"] },
          }
        );

        example(
          `export default { ${testingType}: { ${property}: 'foo/bar' } };`,
          {
            [testingType]: { [property]: "foo/bar" },
          }
        );

        example(
          `export default { ${testingType}: { ${property}: ['foo/bar'] } };`,
          {
            [testingType]: { [property]: ["foo/bar"] },
          }
        );

        example(
          `export default defineConfig({ ${testingType}: { ${property}: 'foo/bar' } });`,
          {
            [testingType]: { [property]: "foo/bar" },
          }
        );

        example(
          `export default defineConfig({ ${testingType}: { ${property}: ['foo/bar'] } });`,
          {
            [testingType]: { [property]: ["foo/bar"] },
          }
        );
      }

      example(`module.exports = { ${testingType}: { env: { foo: 'bar' } } };`, {
        [testingType]: { env: { foo: "bar" } },
      });

      example(
        `module.exports = defineConfig({ ${testingType}: { env: { foo: 'bar' } } });`,
        {
          [testingType]: { env: { foo: "bar" } },
        }
      );

      example(`export default { ${testingType}: { env: { foo: 'bar' } } };`, {
        [testingType]: { env: { foo: "bar" } },
      });

      example(
        `export default defineConfig({ ${testingType}: { env: { foo: 'bar' } } });`,
        {
          [testingType]: { env: { foo: "bar" } },
        }
      );
    });
  }
});
