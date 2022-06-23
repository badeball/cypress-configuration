import fs from "fs";

import path from "path";

import util from "util";

import minimatch from "minimatch";

import glob from "glob";

import debug from "../debug";

import { assert, assertAndReturn, assertIsString } from "../assertions";

import {
  isString,
  isStringOrFalse,
  isStringOrStringArray,
} from "../type-guards";

import { ensureIsAbsolute } from "../path-helpers";

import {
  combine,
  traverseArgvMatching,
  toCamelCase,
  findArgumentValue,
  resolveProjectPath,
} from "./helpers";

function isStringEntry(entry: [any, any]): entry is [string, string] {
  return typeof entry[0] === "string" && typeof entry[1] === "string";
}

export const CONFIG_FILE_NAME = "cypress.json";

/**
 * This is obviously a non-exhaustive list.
 *
 * Definitions can found in https://github.com/cypress-io/cypress/blob/develop/cli/schema/cypress.schema.json.
 */
export interface ICypressPre10Configuration {
  projectRoot: string;
  integrationFolder: string;
  fixturesFolder: string | false;
  supportFile: string | false;
  testFiles: string | string[];
  ignoreTestFiles: string | string[];
  env: Record<string, any>;
}

function isObject(o: any) {
  return Object.prototype.toString.call(o) === "[object Object]";
}

export function isPlainObject(o: any): o is Record<string, any> {
  var ctor, prot;

  if (isObject(o) === false) return false;

  // If has modified constructor
  ctor = o.constructor;
  if (ctor === undefined) return true;

  // If has modified prototype
  prot = ctor.prototype;
  if (isObject(prot) === false) return false;

  // If constructor does not have an Object-specific method
  if (prot.hasOwnProperty("isPrototypeOf") === false) {
    return false;
  }

  // Most likely a plain Object
  return true;
}

function validateConfigurationEntry(
  key: string,
  value: unknown
): Partial<ICypressPre10Configuration> {
  switch (key) {
    case "projectRoot":
      if (!isString(value)) {
        throw new Error(
          `Expected a string (projectRoot), but got ${util.inspect(value)}`
        );
      }
      return { [key]: value };
    case "integrationFolder":
      if (!isString(value)) {
        throw new Error(
          `Expected a string (integrationFolder), but got ${util.inspect(
            value
          )}`
        );
      }
      return { [key]: value };
    case "fixturesFolder":
      if (!isStringOrFalse(value)) {
        throw new Error(
          `Expected a string or false (fixturesFolder), but got ${util.inspect(
            value
          )}`
        );
      }
      return { [key]: value };
    case "supportFile":
      if (!isStringOrFalse(value)) {
        throw new Error(
          `Expected a string or false (supportFile), but got ${util.inspect(
            value
          )}`
        );
      }
      return { [key]: value };
    case "testFiles":
      if (!isStringOrStringArray(value)) {
        throw new Error(
          `Expected a string or array of strings (testFiles), but got ${util.inspect(
            value
          )}`
        );
      }
      return { [key]: value };
    case "ignoreTestFiles":
      if (!isStringOrStringArray(value)) {
        throw new Error(
          `Expected a string or array of strings (ignoreTestFiles), but got ${util.inspect(
            value
          )}`
        );
      }
      return { [key]: value };
    case "env": {
      if (!isPlainObject(value)) {
        throw new Error(
          `Expected a plain object (env), but got ${util.inspect(value)}`
        );
      }
      return { [key]: value };
    }
    default:
      return {};
  }
}

function parseJsonFile(filepath: string) {
  const content = fs.readFileSync(filepath).toString("utf8");

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Malformed ${filepath}, expected JSON`);
  }
}

export function resolvePre10Configuration(options: {
  argv: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
}): ICypressPre10Configuration {
  debug(
    `attempting to resolve Cypress configuration using ${util.inspect(options)}`
  );

  const { argv, env } = options;

  const projectPath = resolveProjectPath(options);

  const cliOrigin: Partial<ICypressPre10Configuration> = Object.assign(
    {},
    ...Array.from(
      combine(
        traverseArgvMatching(argv, "--config", true),
        traverseArgvMatching(argv, "-c", false)
      )
    )
      .reverse()
      .flatMap((argument) => {
        const keypairExpr = /(?:^|,)([^=]+)=([^,$]+)/g;
        const entries: Partial<ICypressPre10Configuration>[] = [];
        let match;

        while ((match = keypairExpr.exec(argument)) !== null) {
          entries.push(validateConfigurationEntry(match[1], match[2]));
        }

        return entries;
      })
  );

  const envPrefixExpr = /^cypress_(.+)/i;

  const envOrigin: Partial<ICypressPre10Configuration> = Object.assign(
    {},
    ...Object.entries(env)
      .filter((entry) => {
        return envPrefixExpr.test(entry[0]);
      })
      .filter(isStringEntry)
      .map<[string, string]>((entry) => {
        const match = entry[0].match(envPrefixExpr);

        assert(match, "expected match after test");

        return [assertAndReturn(match[1]), entry[1]];
      })
      .map((entry) => {
        return validateConfigurationEntry(
          entry[0].includes("_") ? toCamelCase(entry[0]) : entry[0],
          entry[1]
        );
      })
  );

  let configOrigin: Partial<ICypressPre10Configuration> = {};

  const cypressConfigPath = ensureIsAbsolute(
    projectPath,
    resolveConfigurationFile(options)
  );

  if (fs.existsSync(cypressConfigPath)) {
    const cypressConfig = parseJsonFile(cypressConfigPath);

    if (typeof cypressConfig !== "object" || cypressConfig == null) {
      throw new Error(`Malformed ${cypressConfigPath}, expected an object`);
    }

    configOrigin = Object.assign(
      {},
      ...Object.entries(cypressConfig).map((entry) =>
        validateConfigurationEntry(...entry)
      )
    );
  }

  const configuration: ICypressPre10Configuration = Object.assign(
    {
      projectRoot: resolveProjectPath(options),
      integrationFolder: "cypress/integration",
      fixturesFolder: "cypress/fixtures",
      supportFile: "cypress/support/index.js",
      testFiles: "**/*.*",
      ignoreTestFiles: "*.hot-update.js",
      env: {},
    },
    configOrigin,
    envOrigin,
    cliOrigin
  );

  debug(`resolved configuration of ${util.inspect(configuration)}`);

  return {
    ...configuration,
    env: resolvePre10Environment({
      ...options,
      projectPath,
      configOrigin: configuration.env,
    }),
  };
}

export function resolvePre10Environment(options: {
  argv: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
  projectPath: string;
  configOrigin: Record<string, any>;
}): Record<string, any> {
  debug(
    `attempting to resolve Cypress environment using ${util.inspect(options)}`
  );

  const { argv, env, projectPath, configOrigin } = options;

  const envEntries = Array.from(
    combine(
      traverseArgvMatching(argv, "--env", true),
      traverseArgvMatching(argv, "-e", false)
    )
  );

  if (envEntries.length > 1) {
    console.warn(
      "You have specified -e / --env multiple times. This is likely a mistake, as only the last one will take affect. Multiple values should instead be comma-separated."
    );
  }

  const cliOrigin: Record<string, string> = Object.fromEntries(
    envEntries.slice(0, 1).flatMap((argument) => {
      const keypairExpr = /(?:^|,)([^=]+)=([^,$]+)/g;
      const entries: [string, string][] = [];
      let match;

      while ((match = keypairExpr.exec(argument)) !== null) {
        entries.push([match[1], match[2]]);
      }

      return entries;
    })
  );

  const envPrefixExpr = /^cypress_(.+)/i;

  const envOrigin: Record<string, string> = Object.fromEntries(
    Object.entries(env)
      .filter((entry) => {
        return envPrefixExpr.test(entry[0]);
      })
      .filter(isStringEntry)
      .map<[string, string]>((entry) => {
        const match = entry[0].match(envPrefixExpr);

        assert(match, "expected match after test");

        return [assertAndReturn(match[1]), entry[1]];
      })
  );

  const cypressEnvironmentFilePath = path.join(projectPath, "cypress.env.json");

  let cypressEnvOrigin: Record<string, any> = {};

  if (fs.existsSync(cypressEnvironmentFilePath)) {
    const content = fs
      .readFileSync(cypressEnvironmentFilePath)
      .toString("utf8");

    cypressEnvOrigin = JSON.parse(content);
  }

  const environment = Object.assign(
    {},
    cypressEnvOrigin,
    configOrigin,
    envOrigin,
    cliOrigin
  );

  debug(`resolved environment of ${util.inspect(environment)}`);

  return environment;
}

function resolveConfigurationFile(options: { argv: string[] }): string {
  const { argv } = options;

  return (
    findArgumentValue(argv, "--config-file", true) ||
    findArgumentValue(argv, "-C", false) ||
    CONFIG_FILE_NAME
  );
}

const MINIMATCH_OPTIONS = { dot: true, matchBase: true };

export function resolvePre10TestFiles(
  configuration: ICypressPre10Configuration
): string[] {
  const {
    projectRoot,
    integrationFolder,
    fixturesFolder,
    supportFile,
    testFiles,
    ignoreTestFiles,
  } = configuration;

  const testFilesPatterns = [testFiles].flat();
  const ignoreTestFilesPatterns = [ignoreTestFiles].flat();

  assertIsString(
    integrationFolder,
    `Expected "integrationFolder" to be a string, got ${util.inspect(
      integrationFolder
    )}`
  );

  const globIgnore = [];

  if (supportFile) {
    globIgnore.push(supportFile);
  }

  if (fixturesFolder) {
    assertIsString(
      fixturesFolder,
      `Expected "fixturesFolder" to be a string or false, got ${util.inspect(
        fixturesFolder
      )}`
    );

    globIgnore.push(path.join(fixturesFolder, "**", "*"));
  }

  const globOptions = {
    sort: true,
    absolute: true,
    nodir: true,
    cwd: ensureIsAbsolute(projectRoot, integrationFolder),
    ignore: globIgnore.flat(),
  };

  const resolvedTestFiles = testFilesPatterns
    .flatMap((testFilesPattern) => glob.sync(testFilesPattern, globOptions))
    .filter((file) =>
      ignoreTestFilesPatterns.every(
        (ignoreTestFilesPattern) =>
          !minimatch(file, ignoreTestFilesPattern, MINIMATCH_OPTIONS)
      )
    );

  debug(`resolved test files ${util.inspect(resolvedTestFiles)}`);

  return resolvedTestFiles;
}
