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
  }) => any,
  options: {
    cypressConfig?: string;
    cypressConfigPath?: string;
    cypressProjectPath?: string;
    cypressEnvConfig?: CypressEnvConfig;
    argv?: string[];
    env?: NodeJS.ProcessEnv;
    cwd?: string;
  },
  attribute: string,
  expected: any
) {
  it(`should return ${attribute} = "${expected}" for ${util.inspect(
    options
  )}}`, () => {
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

    assert.strictEqual(actual[attribute], expected);
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

  // Override with cypress.config.js
  example(
    resolvePost10Configuration,
    {
      cypressConfig: "module.exports = { specPattern: 'foo/bar' };",
    },
    "specPattern",
    "foo/bar"
  );

  // Override with cypress.config.cjs
  example(
    resolvePost10Configuration,
    {
      argv: ["--config-file", "cypress.config.cjs"],
      cypressConfig: "module.exports = { specPattern: 'foo/bar' };",
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
      cypressConfig: "export default { specPattern: 'foo/bar' };",
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
        "declare const foo: string;\nexport default { specPattern: 'foo/bar' };",
      cypressConfigPath: "cypress.config.ts",
    },
    "specPattern",
    "foo/bar"
  );

  // Override with cypress.config.js in custom location
  example(
    resolvePost10Configuration,
    {
      argv: ["--config-file", "foo.js"],
      cypressConfig: "module.exports = { specPattern: 'foo/bar' };",
      cypressConfigPath: "foo.js",
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--config-file=foo.js"],
      cypressConfig: "module.exports = { specPattern: 'foo/bar' };",
      cypressConfigPath: "foo.js",
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-C", "foo.js"],
      cypressConfig: "module.exports = { specPattern: 'foo/bar' };",
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
      cypressConfig: "module.exports = { specPattern: 'foo/bar' };",
      cypressProjectPath: "foo",
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["--project=foo"],
      cypressConfig: "module.exports = { specPattern: 'foo/bar' };",
      cypressProjectPath: "foo",
    },
    "specPattern",
    "foo/bar"
  );
  example(
    resolvePost10Configuration,
    {
      argv: ["-P", "foo"],
      cypressConfig: "module.exports = { specPattern: 'foo/bar' };",
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
      cypressConfig: "module.exports = { specPattern: 'foo/bar' };",
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
      cypressConfig: "module.exports = { specPattern: 'foo/bar' };",
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
      cypressConfig: "module.exports = { specPattern: 'foo/bar' };",
      cypressConfigPath: "foo.js",
      cypressProjectPath: "foo",
    },
    "specPattern",
    "foo/bar"
  );
});
