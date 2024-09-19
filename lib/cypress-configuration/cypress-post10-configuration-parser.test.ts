import { inspect } from "util";

import assert from "assert/strict";

import {
  ICypressPost10Configuration,
  TestingType,
} from "./cypress-post10-configuration";

import {
  ConfigurationFile,
  TestConfiguration,
  parsePost10Configuration,
} from "./cypress-post10-configuration-parser";

function createSourceCode<T extends keyof TestConfiguration>(options: {
  type: "cjs" | "esm";
  withDefineCall: boolean;
  testingType: TestingType;
  property: T;
  value: TestConfiguration[T];
}) {
  const {
    type,
    withDefineCall,
    testingType,
    property,
    value: rawValue,
  } = options;

  const value = inspect(rawValue);

  if (type === "cjs") {
    if (withDefineCall) {
      return `module.exports = defineConfig({ ${testingType}: { ${property}: ${value} } });`;
    } else {
      return `module.exports = { ${testingType}: { ${property}: ${value} } };`;
    }
  } else {
    if (withDefineCall) {
      return `export default defineConfig({ ${testingType}: { ${property}: ${value} } });`;
    } else {
      return `export default { ${testingType}: { ${property}: ${value} } };`;
    }
  }
}

function example<T extends keyof TestConfiguration>(options: {
  testingType: TestingType;
  property: T;
  value: TestConfiguration[T];
}) {
  const { testingType, property, value } = options;

  const expected: ConfigurationFile = {
    [testingType]: {
      [property]: value,
    },
  };

  for (const type of ["cjs", "esm"] as const) {
    for (const withDefineCall of [false, true]) {
      const description = `${type}, ${
        withDefineCall ? "with" : "without"
      } defineConfig`;

      it(description, () => {
        assert.deepStrictEqual(
          parsePost10Configuration(
            createSourceCode({
              type,
              withDefineCall,
              testingType,
              property,
              value,
            }),
          ),
          expected,
        );
      });
    }
  }
}

describe("parsePost10Configuration()", () => {
  for (const testingType of ["e2e", "component"] as const) {
    describe(testingType, () => {
      for (const property of ["specPattern", "excludeSpecPattern"] as const) {
        describe(`${property} with string`, () => {
          example({
            testingType,
            property,
            value: "foo/bar",
          });
        });

        describe(`${property} with string-array`, () => {
          example({
            testingType,
            property,
            value: ["foo/bar"],
          });
        });
      }

      describe("reporter", () => {
        example({
          testingType,
          property: "reporter",
          value: "foobar",
        });
      });

      describe("env", () => {
        example({
          testingType,
          property: "env",
          value: { foo: "bar" },
        });
      });
    });
  }
});
