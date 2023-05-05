import fs from "fs";

import path from "path";

import util from "util";

import glob, { IOptions } from "glob";

import hook from "node-hook";

import * as esbuild from "esbuild";

import debug from "../debug";

import { assert, assertAndReturn } from "../assertions";

import {
  isString,
  isStringOrFalse,
  isStringOrStringArray,
} from "../type-guards";

import { ensureIsAbsolute } from "../path-helpers";

import {
  ConfigurationFile,
  parsePost10Configuration,
} from "./cypress-post10-configuration-parser";

import {
  combine,
  traverseArgvMatching,
  toCamelCase,
  findArgumentValue,
  resolveProjectPath,
} from "./helpers";

import {
  MissingConfigurationFileError,
  MultipleConfigurationFilesError,
} from "./errors";

export const CONFIG_FILE_NAMES = [
  "cypress.config.js",
  "cypress.config.cjs",
  "cypress.config.mjs",
  "cypress.config.ts",
];

export type TestingType = "e2e" | "component";

export interface ICypressPost10Configuration {
  testingType: TestingType;
  projectRoot: string;
  specPattern: string | string[];
  excludeSpecPattern: string | string[];
  env: Record<string, any>;
}

function isStringEntry(entry: [any, any]): entry is [string, string] {
  return typeof entry[0] === "string" && typeof entry[1] === "string";
}

function isPlainObject(value: any): value is object {
  return value?.constructor === Object;
}

function validateConfigurationEntry(
  key: string,
  value: unknown
): Partial<ICypressPost10Configuration> {
  switch (key) {
    case "projectRoot":
      if (!isString(value)) {
        throw new Error(
          `Expected a string (projectRoot), but got ${util.inspect(value)}`
        );
      }
      return { [key]: value };
    case "specPattern":
      if (!isStringOrStringArray(value)) {
        throw new Error(
          `Expected a string or array of strings (specPattern), but got ${util.inspect(
            value
          )}`
        );
      }
      return { [key]: value };
    case "excludeSpecPattern":
      if (!isStringOrStringArray(value)) {
        throw new Error(
          `Expected a string or array of strings (excludeSpecPattern), but got ${util.inspect(
            value
          )}`
        );
      }
      return { [key]: value };
    case "env":
      if (!isPlainObject(value)) {
        throw new Error(
          `Expected a plain object (env), but got ${util.inspect(value)}`
        );
      }
      return { [key]: value };
    default:
      return {};
  }
}

export function resolvePost10Configuration(options: {
  argv: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
  parseDangerously?: boolean;
  testingType: TestingType;
}): ICypressPost10Configuration {
  debug(
    `attempting to resolve Cypress configuration using ${util.inspect(options)}`
  );

  const { argv, env, testingType } = options;

  const projectPath = resolveProjectPath(options);

  const cliOrigin: Partial<ICypressPost10Configuration> = Object.assign(
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
        const entries: Partial<ICypressPost10Configuration>[] = [];
        let match;

        while ((match = keypairExpr.exec(argument)) !== null) {
          entries.push(validateConfigurationEntry(match[1], match[2]));
        }

        return entries;
      })
  );

  const envPrefixExpr = /^cypress_(.+)/i;

  const envOrigin: Partial<ICypressPost10Configuration> = Object.assign(
    {},
    ...Object.entries(env)
      .filter((entry) => {
        return envPrefixExpr.test(entry[0]);
      })
      .filter(isStringEntry)
      .map<[string, string]>((entry) => {
        const match = entry[0].match(envPrefixExpr);

        assert(
          match,
          "cypress-cucumber-preprocessor: expected match after test, this is likely a bug."
        );

        return [assertAndReturn(match[1]), entry[1]];
      })
      .map((entry) => {
        return validateConfigurationEntry(
          entry[0].includes("_") ? toCamelCase(entry[0]) : entry[0],
          entry[1]
        );
      })
  );

  const cypressConfigPath = ensureIsAbsolute(
    projectPath,
    resolveConfigurationFile(options)
  );

  const configOrigin: Partial<ICypressPost10Configuration> = Object.assign(
    {},
    ...Object.entries(
      parseConfigurationFile(
        cypressConfigPath,
        options.parseDangerously ?? false
      )[testingType] ?? {}
    ).map((entry) => validateConfigurationEntry(...entry))
  );

  const defaults =
    testingType === "e2e"
      ? {
          specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
          excludeSpecPattern: "*.hot-update.js",
        }
      : {
          specPattern: "**/*.cy.{js,jsx,ts,tsx}",
          excludeSpecPattern: ["/snapshots/*", "/image_snapshots/*"],
        };

  const configuration: ICypressPost10Configuration = Object.assign(
    {
      testingType,
      projectRoot: resolveProjectPath(options),
      env: {},
      ...defaults,
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

function resolvePre10Environment(options: {
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

function resolveConfigurationFile(options: {
  argv: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
}): string {
  const { argv } = options;

  return (
    findArgumentValue(argv, "--config-file", true) ||
    findArgumentValue(argv, "-C", false) ||
    findConfigurationInFS(options)
  );
}

function findConfigurationInFS(options: {
  argv: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
}) {
  const projectRoot = resolveProjectPath(options);

  const files = fs.readdirSync(projectRoot);

  const configFiles = files.filter((file) => CONFIG_FILE_NAMES.includes(file));

  if (configFiles.length === 0) {
    throw new MissingConfigurationFileError(
      "Unable to find a Cypress configuration file."
    );
  } else if (configFiles.length > 1) {
    throw new MultipleConfigurationFilesError(
      "Found multiple Cypress configuration files."
    );
  }

  return configFiles[0];
}

function parseConfigurationFile(
  configFile: string,
  parseDangerously: boolean
): ConfigurationFile {
  if (parseDangerously) {
    return parseConfigurationFileDangerously(configFile);
  } else {
    return parsePost10Configuration(fs.readFileSync(configFile).toString());
  }
}

function parseConfigurationFileDangerously(
  configFile: string
): ConfigurationFile {
  if (!fs.existsSync(configFile)) {
    throw new MissingConfigurationFileError(
      "Missing Cypress configuration file."
    );
  }

  const extension = path.extname(configFile);

  const transformer = (source: string, filename: string): string => {
    if (filename !== configFile) {
      return source;
    }

    if ([".js", ".cjs"].includes(extension)) {
      return source;
    } else if (extension === ".mjs") {
      return esbuild.transformSync(source, {
        format: "cjs",
      }).code;
    } else if (extension === ".ts") {
      return esbuild.transformSync(source, {
        loader: "ts",
        format: "cjs",
      }).code;
    } else {
      throw new Error("Unknown extension " + extension);
    }
  };

  hook.hook(extension, transformer);

  const result = require(configFile);

  hook.unhook(extension);

  return result.default ?? result;
}

export function resolvePost10TestFiles(
  configuration: ICypressPost10Configuration
): string[] {
  let {
    projectRoot,
    specPattern: specPatterns,
    excludeSpecPattern: excludeSpecPatterns,
  } = configuration;

  specPatterns = [specPatterns].flat();

  excludeSpecPatterns = [excludeSpecPatterns]
    .flat()
    .concat("**/node_modules/**");

  const globOptions: IOptions = {
    absolute: true,
    nodir: true,
    cwd: projectRoot,
    ignore: excludeSpecPatterns,
  };

  return specPatterns.flatMap((specPattern) =>
    glob.sync(specPattern, globOptions)
  );
}
