import fs from "fs";

import path from "path";

import util from "util";

import assert from "assert";

import { resolvePost10Configuration } from "./cypress-post10-configuration";

interface CypressEnvConfig {
  [key: string]: string;
}

let ithExample = 1;

function example(
  method: (options: {
    argv: string[];
    env: NodeJS.ProcessEnv;
    cwd: string;
    parseDangerously?: boolean;
  }) => any,
  options: {
    cypressConfig?: string;
    cypressConfigPath?: string;
    cypressProjectPath?: string;
    cypressEnvConfig?: CypressEnvConfig;
    argv?: string[];
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    parseDangerously?: boolean;
  },
  attribute: string,
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

    const actual = method({
      argv: [],
      env: {},
      cwd,
      ...options,
    });

    assert.deepStrictEqual(actual[attribute], expected);
  });
}

describe("resolvePost10Configuration()", () => {
  // Default
  example(
    resolvePost10Configuration,
    {},
    "specPattern",
    "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}"
  );
  example(
    resolvePost10Configuration,
    {},
    "excludeSpecPattern",
    "*.hot-update.js"
  );

  // Simple CLI override
  example(
    resolvePost10Configuration,
    {
      argv: ["--config", "specPattern=foo/bar"],
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--config=specPattern=foo/bar"],
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-c", "specPattern=foo/bar"],
    },
    "specPattern",
    "foo/bar"
  );

  // CLI override with preceding, comma-delimited configuration
  example(
    resolvePost10Configuration,
    {
      argv: ["--config", "foo=bar,specPattern=foo/bar"],
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--config=foo=bar,specPattern=foo/bar"],
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-c", "foo=bar,specPattern=foo/bar"],
    },
    "specPattern",
    "foo/bar"
  );

  // CLI override with succeeding, comma-delimited configuration
  example(
    resolvePost10Configuration,
    {
      argv: ["--config", "specPattern=foo/bar,foo=bar"],
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--config=specPattern=foo/bar,foo=bar"],
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-c", "specPattern=foo/bar,foo=bar"],
    },
    "specPattern",
    "foo/bar"
  );

  // CLI override with last match taking precedence
  example(
    resolvePost10Configuration,
    {
      argv: ["--config", "specPattern=baz", "--config", "specPattern=foo/bar"],
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--config=specPattern=baz", "--config=specPattern=foo/bar"],
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-c", "specPattern=baz", "-c", "specPattern=foo/bar"],
    },
    "specPattern",
    "foo/bar"
  );

  const envTestMatrix: { env: Record<string, string>; expected: string }[] = [
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
      expected: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    },
    {
      env: {
        cypress_specpattern: "foo/bar",
      },
      expected: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    },
  ];

  for (let { env, expected } of envTestMatrix) {
    example(
      resolvePost10Configuration,
      {
        env,
      },
      "specPattern",
      expected
    );
  }

  describe("safe parsing", () => {
    // Override with cypress.config.js
    example(
      resolvePost10Configuration,
      {
        cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
      },
      "specPattern",
      "foo/bar"
    );

    // Override with cypress.config.cjs
    example(
      resolvePost10Configuration,
      {
        argv: ["--config-file", "cypress.config.cjs"],
        cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
        cypressConfigPath: "cypress.config.cjs",
      },
      "specPattern",
      "foo/bar"
    );

    // Override with cypress.config.mjs
    example(
      resolvePost10Configuration,
      {
        argv: ["--config-file", "cypress.config.mjs"],
        cypressConfig: "export default { e2e: { specPattern: 'foo/bar' } };",
        cypressConfigPath: "cypress.config.mjs",
      },
      "specPattern",
      "foo/bar"
    );

    // Override with cypress.config.ts
    example(
      resolvePost10Configuration,
      {
        argv: ["--config-file", "cypress.config.ts"],
        cypressConfig:
          "declare const foo: string;\nexport default { e2e: { specPattern: 'foo/bar' } };",
        cypressConfigPath: "cypress.config.ts",
      },
      "specPattern",
      "foo/bar"
    );
  });

  describe("dangerous parsing", () => {
    // Override with cypress.config.js
    example(
      resolvePost10Configuration,
      {
        cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
        parseDangerously: true,
      },
      "specPattern",
      "foo/bar"
    );

    // Override with cypress.config.cjs
    example(
      resolvePost10Configuration,
      {
        argv: ["--config-file", "cypress.config.cjs"],
        cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
        cypressConfigPath: "cypress.config.cjs",
        parseDangerously: true,
      },
      "specPattern",
      "foo/bar"
    );

    // Override with cypress.config.mjs
    example(
      resolvePost10Configuration,
      {
        argv: ["--config-file", "cypress.config.mjs"],
        cypressConfig: "export default { e2e: { specPattern: 'foo/bar' } };",
        cypressConfigPath: "cypress.config.mjs",
        parseDangerously: true,
      },
      "specPattern",
      "foo/bar"
    );

    // Override with cypress.config.ts
    example(
      resolvePost10Configuration,
      {
        argv: ["--config-file", "cypress.config.ts"],
        cypressConfig:
          "declare const foo: string;\nexport default { e2e: { specPattern: 'foo/bar' } };",
        cypressConfigPath: "cypress.config.ts",
        parseDangerously: true,
      },
      "specPattern",
      "foo/bar"
    );
  });

  // Override with cypress.config.js in custom location
  example(
    resolvePost10Configuration,
    {
      argv: ["--config-file", "foo.js"],
      cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
      cypressConfigPath: "foo.js",
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--config-file=foo.js"],
      cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
      cypressConfigPath: "foo.js",
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-C", "foo.js"],
      cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
      cypressConfigPath: "foo.js",
    },
    "specPattern",
    "foo/bar"
  );

  // Override with cypress.config.js & custom project path.
  example(
    resolvePost10Configuration,
    {
      argv: ["--project", "foo"],
      cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
      cypressProjectPath: "foo",
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--project=foo"],
      cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
      cypressProjectPath: "foo",
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-P", "foo"],
      cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
      cypressProjectPath: "foo",
    },
    "specPattern",
    "foo/bar"
  );

  // Override with cypress.config.js in custom location & custom project path.
  example(
    resolvePost10Configuration,
    {
      argv: ["--config-file", "foo.js", "--project", "foo"],
      cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
      cypressConfigPath: "foo.js",
      cypressProjectPath: "foo",
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--config-file=foo.js", "--project", "foo"],
      cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
      cypressConfigPath: "foo.js",
      cypressProjectPath: "foo",
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-C", "foo.js", "--project", "foo"],
      cypressConfig: "module.exports = { e2e: { specPattern: 'foo/bar' } };",
      cypressConfigPath: "foo.js",
      cypressProjectPath: "foo",
    },
    "specPattern",
    "foo/bar"
  );

  /**
   * Environment part starts here.
   */
  example(resolvePost10Configuration, {}, "env", {});

  // Simple CLI override
  example(
    resolvePost10Configuration,
    {
      argv: ["--env", "FOO=foo"],
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--env=FOO=foo"],
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-e", "FOO=foo"],
    },
    "env",
    { FOO: "foo" }
  );

  // CLI override with preceding, comma-delimited configuration
  example(
    resolvePost10Configuration,
    {
      argv: ["--env", "BAR=bar,FOO=foo"],
    },
    "env",
    { FOO: "foo", BAR: "bar" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--env=BAR=bar,FOO=foo"],
    },
    "env",
    { FOO: "foo", BAR: "bar" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-e", "BAR=bar,FOO=foo"],
    },
    "env",
    { FOO: "foo", BAR: "bar" }
  );

  // CLI override with succeeding, comma-delimited configuration
  example(
    resolvePost10Configuration,
    {
      argv: ["--env", "FOO=foo,BAR=bar"],
    },
    "env",
    { FOO: "foo", BAR: "bar" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--env=FOO=foo,BAR=bar"],
    },
    "env",
    { FOO: "foo", BAR: "bar" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-e", "FOO=foo,BAR=bar"],
    },
    "env",
    { FOO: "foo", BAR: "bar" }
  );

  // CLI override with last match taking precedence
  example(
    resolvePost10Configuration,
    {
      argv: ["--env", "FOO=baz", "--env", "FOO=foo"],
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--env=FOO=baz", "--env=FOO=foo"],
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-e", "FOO=baz", "-e", "FOO=foo"],
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--env", "FOO=foo", "--env", "BAR=bar"],
    },
    "env",
    { BAR: "bar" }
  );

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
        resolvePost10Configuration,
        {
          env,
        },
        "env",
        expected
      );
    }
  }

  // Override with cypress.config.js
  example(
    resolvePost10Configuration,
    {
      cypressConfig: "module.exports = { e2e: { env: { FOO: 'foo' } } };",
    },
    "env",
    { FOO: "foo" }
  );

  // Override with cypress.config.js in custom location
  example(
    resolvePost10Configuration,
    {
      argv: ["--config-file", "foo.js"],
      cypressConfig: "module.exports = { e2e: { env: { FOO: 'foo' } } };",
      cypressConfigPath: "foo.js",
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--config-file=foo.js"],
      cypressConfig: "module.exports = { e2e: { env: { FOO: 'foo' } } };",
      cypressConfigPath: "foo.js",
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-C", "foo.js"],
      cypressConfig: "module.exports = { e2e: { env: { FOO: 'foo' } } };",
      cypressConfigPath: "foo.js",
    },
    "env",
    { FOO: "foo" }
  );

  // Override with cypress.env.json
  example(
    resolvePost10Configuration,
    {
      cypressEnvConfig: { FOO: "foo" },
    },
    "env",
    { FOO: "foo" }
  );

  // Override with cypress.config.js & custom project path.
  example(
    resolvePost10Configuration,
    {
      argv: ["--project", "foo"],
      cypressConfig: "module.exports = { e2e: { env: { FOO: 'foo' } } };",
      cypressProjectPath: "foo",
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--project=foo"],
      cypressConfig: "module.exports = { e2e: { env: { FOO: 'foo' } } };",
      cypressProjectPath: "foo",
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-P", "foo"],
      cypressConfig: "module.exports = { e2e: { env: { FOO: 'foo' } } };",
      cypressProjectPath: "foo",
    },
    "env",
    { FOO: "foo" }
  );

  // Override with cypress.config.js in custom location & custom project path.
  example(
    resolvePost10Configuration,
    {
      argv: ["--project", "foo", "--config-file", "foo.js"],
      cypressConfig: "module.exports = { e2e: { env: { FOO: 'foo' } } };",
      cypressConfigPath: "foo.js",
      cypressProjectPath: "foo",
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--project=foo", "--config-file", "foo.js"],
      cypressConfig: "module.exports = { e2e: { env: { FOO: 'foo' } } };",
      cypressConfigPath: "foo.js",
      cypressProjectPath: "foo",
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-P", "foo", "--config-file", "foo.js"],
      cypressConfig: "module.exports = { e2e: { env: { FOO: 'foo' } } };",
      cypressConfigPath: "foo.js",
      cypressProjectPath: "foo",
    },
    "env",
    { FOO: "foo" }
  );

  // Override with cypress.env.json & custom project path.
  example(
    resolvePost10Configuration,
    {
      argv: ["--project", "foo"],
      cypressEnvConfig: { FOO: "foo" },
      cypressProjectPath: "foo",
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--project=foo"],
      cypressEnvConfig: { FOO: "foo" },
      cypressProjectPath: "foo",
    },
    "env",
    { FOO: "foo" }
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-P", "foo"],
      cypressEnvConfig: { FOO: "foo" },
      cypressProjectPath: "foo",
    },
    "env",
    { FOO: "foo" }
  );
});
