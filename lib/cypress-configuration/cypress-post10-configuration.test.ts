import fs from "fs";

import path from "path";

import util from "util";

import assert from "assert";

import {
  ICypressPost10Configuration,
  TestingType,
  resolvePost10Configuration,
} from "./cypress-post10-configuration";

interface CypressEnvConfig {
  [key: string]: string;
}

let ithExample = 1;

function example(
  options: {
    testingType: TestingType;
    cypressConfig?: string;
    cypressConfigPath?: string;
    cypressProjectPath?: string;
    cypressEnvConfig?: CypressEnvConfig;
    argv?: string[];
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    parseDangerously?: boolean;
  },
  attribute: keyof ICypressPost10Configuration,
  expected: any
) {
  it(`should return ${attribute} = "${util.inspect(
    expected
  )}" for ${util.inspect(options)}}`, () => {
    const {
      cypressConfig = "module.exports = {};",
      cypressConfigPath = "cypress.config.js",
      cypressEnvConfig,
      cypressProjectPath,
    } = options;

    const cwd = path.join(process.cwd(), "tmp", "unit", String(ithExample++));

    const fullCypressProjectPath = cypressProjectPath
      ? path.join(cwd, cypressProjectPath)
      : cwd;

    fs.rmSync(cwd, { recursive: true, force: true });
    fs.mkdirSync(fullCypressProjectPath, { recursive: true });

    fs.writeFileSync(
      path.join(fullCypressProjectPath, cypressConfigPath),
      cypressConfig
    );

    if (cypressEnvConfig) {
      fs.writeFileSync(
        path.join(fullCypressProjectPath, "cypress.env.json"),
        JSON.stringify(cypressEnvConfig, null, 2)
      );
    }

    const actual = resolvePost10Configuration({
      argv: [],
      env: {},
      cwd,
      ...options,
    });

    assert.deepStrictEqual(actual[attribute], expected);
  });
}

describe("resolvePost10Configuration()", () => {
  for (const testingType of ["e2e", "component"] as const) {
    const defaultSpecPattern =
      testingType === "e2e"
        ? "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}"
        : "**/*.cy.{js,jsx,ts,tsx}";

    const defaultExcludeSpecPattern =
      testingType === "e2e"
        ? "*.hot-update.js"
        : ["/snapshots/*", "/image_snapshots/*"];

    describe(testingType, () => {
      // Default
      example({ testingType }, "specPattern", defaultSpecPattern);
      example({ testingType }, "excludeSpecPattern", defaultExcludeSpecPattern);
      example({ testingType }, "reporter", "spec");

      // Simple CLI override
      for (const argv of [
        ["--config", "specPattern=foo/bar"],
        ["--config=specPattern=foo/bar"],
        ["-c", "specPattern=foo/bar"],
      ]) {
        example(
          {
            testingType,
            argv,
          },
          "specPattern",
          "foo/bar"
        );
      }

      // CLI override with preceding, comma-delimited configuration
      for (const argv of [
        ["--config", "foo=bar,specPattern=foo/bar"],
        ["--config=foo=bar,specPattern=foo/bar"],
        ["-c", "foo=bar,specPattern=foo/bar"],
      ]) {
        example(
          {
            testingType,
            argv,
          },
          "specPattern",
          "foo/bar"
        );
      }

      // CLI override with succeeding, comma-delimited configuration
      for (const argv of [
        ["--config", "specPattern=foo/bar,foo=bar"],
        ["--config=specPattern=foo/bar,foo=bar"],
        ["-c", "specPattern=foo/bar,foo=bar"],
      ]) {
        example(
          {
            testingType,
            argv,
          },
          "specPattern",
          "foo/bar"
        );
      }

      // CLI override with last match taking precedence
      for (const argv of [
        ["--config", "specPattern=baz", "--config", "specPattern=foo/bar"],
        ["--config=specPattern=baz", "--config=specPattern=foo/bar"],
        ["-c", "specPattern=baz", "-c", "specPattern=foo/bar"],
      ]) {
        example(
          {
            testingType,
            argv,
          },
          "specPattern",
          "foo/bar"
        );
      }

      const envTestMatrix: { env: Record<string, string>; expected: string }[] =
        [
          {
            env: {
              CYPRESS_specPattern: "foo/bar",
            },
            expected: "foo/bar",
          },
          {
            env: {
              cypress_specPattern: "foo/bar",
            },
            expected: "foo/bar",
          },
          {
            env: {
              CYPRESS_spec_pattern: "foo/bar",
            },
            expected: "foo/bar",
          },
          {
            env: {
              cypress_spec_pattern: "foo/bar",
            },
            expected: "foo/bar",
          },
          {
            env: {
              CYPRESS_SPEC_PATTERN: "foo/bar",
            },
            expected: "foo/bar",
          },
          {
            env: {
              cypress_SPEC_PATTERN: "foo/bar",
            },
            expected: "foo/bar",
          },
          // Erroneous camelcase
          {
            env: {
              CYPRESS_specpattern: "foo/bar",
            },
            expected: defaultSpecPattern,
          },
          {
            env: {
              cypress_specpattern: "foo/bar",
            },
            expected: defaultSpecPattern,
          },
        ];

      for (let { env, expected } of envTestMatrix) {
        example(
          {
            testingType,
            env,
          },
          "specPattern",
          expected
        );
      }

      describe("safe parsing", () => {
        // Override with cypress.config.js
        example(
          {
            testingType,
            cypressConfig: `module.exports = { ${testingType}: { specPattern: 'foo/bar' } };`,
          },
          "specPattern",
          "foo/bar"
        );

        // Override with cypress.config.cjs
        example(
          {
            testingType,
            argv: ["--config-file", "cypress.config.cjs"],
            cypressConfig: `module.exports = { ${testingType}: { specPattern: 'foo/bar' } };`,
            cypressConfigPath: "cypress.config.cjs",
          },
          "specPattern",
          "foo/bar"
        );

        // Override with cypress.config.mjs
        example(
          {
            testingType,
            argv: ["--config-file", "cypress.config.mjs"],
            cypressConfig: `export default { ${testingType}: { specPattern: 'foo/bar' } };`,
            cypressConfigPath: "cypress.config.mjs",
          },
          "specPattern",
          "foo/bar"
        );

        // Override with cypress.config.ts
        example(
          {
            testingType,
            argv: ["--config-file", "cypress.config.ts"],
            cypressConfig: `declare const foo: string;\nexport default { ${testingType}: { specPattern: 'foo/bar' } };`,
            cypressConfigPath: "cypress.config.ts",
          },
          "specPattern",
          "foo/bar"
        );
      });

      describe("dangerous parsing", () => {
        // Override with cypress.config.js
        example(
          {
            testingType,
            cypressConfig: `module.exports = { ${testingType}: { specPattern: 'foo/bar' } };`,
            parseDangerously: true,
          },
          "specPattern",
          "foo/bar"
        );

        // Override with cypress.config.cjs
        example(
          {
            testingType,
            argv: ["--config-file", "cypress.config.cjs"],
            cypressConfig: `module.exports = { ${testingType}: { specPattern: 'foo/bar' } };`,
            cypressConfigPath: "cypress.config.cjs",
            parseDangerously: true,
          },
          "specPattern",
          "foo/bar"
        );

        // Override with cypress.config.mjs
        example(
          {
            testingType,
            argv: ["--config-file", "cypress.config.mjs"],
            cypressConfig: `export default { ${testingType}: { specPattern: 'foo/bar' } };`,
            cypressConfigPath: "cypress.config.mjs",
            parseDangerously: true,
          },
          "specPattern",
          "foo/bar"
        );

        // Override with cypress.config.ts
        example(
          {
            testingType,
            argv: ["--config-file", "cypress.config.ts"],
            cypressConfig: `declare const foo: string;\nexport default { ${testingType}: { specPattern: 'foo/bar' } };`,
            cypressConfigPath: "cypress.config.ts",
            parseDangerously: true,
          },
          "specPattern",
          "foo/bar"
        );
      });

      // Override with cypress.config.js in custom location
      for (const argv of [
        ["--config-file", "foo.js"],
        ["--config-file=foo.js"],
        ["-C", "foo.js"],
      ]) {
        example(
          {
            testingType,
            argv,
            cypressConfig: `module.exports = { ${testingType}: { specPattern: 'foo/bar' } };`,
            cypressConfigPath: "foo.js",
          },
          "specPattern",
          "foo/bar"
        );
      }

      // Override with cypress.config.js & custom project path.
      for (const argv of [
        ["--project", "foo"],
        ["--project=foo"],
        ["-P", "foo"],
      ]) {
        example(
          {
            testingType,
            argv,
            cypressConfig: `module.exports = { ${testingType}: { specPattern: 'foo/bar' } };`,
            cypressProjectPath: "foo",
          },
          "specPattern",
          "foo/bar"
        );
      }

      // Override with cypress.config.js in custom location & custom project path.
      for (const argv of [
        ["--config-file", "foo.js", "--project", "foo"],
        ["--config-file=foo.js", "--project", "foo"],
        ["-C", "foo.js", "--project", "foo"],
      ]) {
        example(
          {
            testingType,
            argv,
            cypressConfig: `module.exports = { ${testingType}: { specPattern: 'foo/bar' } };`,
            cypressConfigPath: "foo.js",
            cypressProjectPath: "foo",
          },
          "specPattern",
          "foo/bar"
        );
      }

      /**
       * Environment part starts here.
       */
      example(
        {
          testingType,
        },
        "env",
        {}
      );

      // Simple CLI override
      for (const argv of [
        ["--env", "FOO=foo"],
        ["--env=FOO=foo"],
        ["-e", "FOO=foo"],
      ]) {
        example(
          {
            testingType,
            argv,
          },
          "env",
          { FOO: "foo" }
        );
      }

      // CLI override with comma-delimited configuration
      for (const argv of [
        ["--env", "FOO=foo,BAR=bar"],
        ["--env=FOO=foo,BAR=bar"],
        ["-e", "FOO=foo,BAR=bar"],
      ]) {
        example(
          {
            testingType,
            argv,
          },
          "env",
          { FOO: "foo", BAR: "bar" }
        );
      }

      // CLI override with last match taking precedence
      for (const argv of [
        ["--env", "BAR=bar", "--env", "FOO=foo"],
        ["--env=BAR=bar", "--env=FOO=foo"],
        ["-e", "BAR=bar", "-e", "FOO=foo"],
      ]) {
        example(
          {
            testingType,
            argv,
          },
          "env",
          { FOO: "foo" }
        );
      }

      {
        const envTestMatrix: {
          env: Record<string, string>;
          expected: Record<string, string>;
        }[] = [
          {
            env: {
              CYPRESS_FOO: "foo",
            },
            expected: { FOO: "foo" },
          },
          {
            env: {
              cypress_FOO: "foo",
            },
            expected: { FOO: "foo" },
          },
          {
            env: {
              CYPRESS_foo: "foo",
            },
            expected: { foo: "foo" },
          },
          {
            env: {
              cypress_foo: "foo",
            },
            expected: { foo: "foo" },
          },
        ];

        for (let { env, expected } of envTestMatrix) {
          example(
            {
              testingType,
              env,
            },
            "env",
            expected
          );
        }
      }

      // Override with cypress.config.js
      example(
        {
          testingType,
          cypressConfig: `module.exports = { ${testingType}: { env: { FOO: 'foo' } } };`,
        },
        "env",
        { FOO: "foo" }
      );

      // Override with cypress.config.js in custom location
      for (const argv of [
        ["--config-file", "foo.js"],
        ["--config-file=foo.js"],
        ["-C", "foo.js"],
      ]) {
        example(
          {
            testingType,
            argv,
            cypressConfig: `module.exports = { ${testingType}: { env: { FOO: 'foo' } } };`,
            cypressConfigPath: "foo.js",
          },
          "env",
          { FOO: "foo" }
        );
      }

      // Override with cypress.env.json
      example(
        {
          testingType,
          cypressEnvConfig: { FOO: "foo" },
        },
        "env",
        { FOO: "foo" }
      );

      // Override with cypress.config.js & custom project path.
      for (const argv of [
        ["--project", "foo"],
        ["--project=foo"],
        ["-P", "foo"],
      ]) {
        example(
          {
            testingType,
            argv,
            cypressConfig: `module.exports = { ${testingType}: { env: { FOO: 'foo' } } };`,
            cypressProjectPath: "foo",
          },
          "env",
          { FOO: "foo" }
        );
      }

      // Override with cypress.config.js in custom location & custom project path.
      for (const argv of [
        ["--project", "foo", "--config-file", "foo.js"],
        ["--project=foo", "--config-file", "foo.js"],
        ["-P", "foo", "--config-file", "foo.js"],
      ]) {
        example(
          {
            testingType,
            argv,
            cypressConfig: `module.exports = { ${testingType}: { env: { FOO: 'foo' } } };`,
            cypressConfigPath: "foo.js",
            cypressProjectPath: "foo",
          },
          "env",
          { FOO: "foo" }
        );
      }

      // Override with cypress.env.json & custom project path.
      for (const argv of [
        ["--project", "foo"],
        ["--project=foo"],
        ["-P", "foo"],
      ]) {
        example(
          {
            testingType,
            argv,
            cypressEnvConfig: { FOO: "foo" },
            cypressProjectPath: "foo",
          },
          "env",
          { FOO: "foo" }
        );
      }
    });
  }
});
