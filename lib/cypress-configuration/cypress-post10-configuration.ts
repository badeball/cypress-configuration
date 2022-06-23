import fs from "fs";

import path from "path";

import util from "util";

import glob from "glob";

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

export interface ICypressPost10Configuration {
  projectRoot: string;
  specPattern: string | string[];
  excludeSpecPattern: string | string[];
  env: Record<string, any>;
}

function isStringEntry(entry: [any, any]): entry is [string, string] {
  return typeof entry[0] === "string" && typeof entry[1] === "string";
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
    default:
      return {};
  }
}

function findLastIndex<T>(
  collection: ArrayLike<T>,
  predicate: (value: T) => boolean,
  beforeIndex = collection.length
): number {
  for (let i = beforeIndex - 1; i >= 0; --i) {
    if (predicate(collection[i])) {
      return i;
    }
  }

  return -1;
}

function* traverseArgvMatching(
  argv: string[],
  name: string,
  allowEqual: boolean
) {
  let beforeIndex = argv.length,
    matchingIndex;

  while (
    (matchingIndex = findLastIndex(
      argv,
      (arg) => arg.startsWith(name),
      beforeIndex
    )) !== -1
  ) {
    if (argv[matchingIndex] === name) {
      if (argv.length - 1 === matchingIndex) {
        debug(`'${name}' argument missing`);
      } else {
        yield argv[matchingIndex + 1];
      }
    } else if (allowEqual && argv[matchingIndex][name.length] === "=") {
      yield argv[matchingIndex].slice(name.length + 1);
    }

    beforeIndex = matchingIndex;
  }
}

function* combine<T>(...generators: Generator<T, unknown, unknown>[]) {
  for (const generator of generators) {
    yield* generator;
  }
}

function findArgumentValue(
  argv: string[],
  name: string,
  allowEqual: boolean
): string | undefined {
  for (const value of traverseArgvMatching(argv, name, allowEqual)) {
    return value;
  }
}

function toSnakeCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function capitalize(word: string) {
  return word.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

function toCamelCase(value: string) {
  return value
    .split("_")
    .map((word, index) =>
      index === 0 ? word.toLocaleLowerCase() : capitalize(word)
    )
    .join("");
}

export function resolvePost10Configuration(options: {
  argv: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
}): ICypressPost10Configuration {
  debug(
    `attempting to resolve Cypress configuration using ${util.inspect(options)}`
  );

  const { argv, env } = options;

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
    ...Object.entries(parseConfigurationFile(cypressConfigPath)).map((entry) =>
      validateConfigurationEntry(...entry)
    )
  );

  const configuration = Object.assign(
    {
      projectRoot: resolveProjectPath(options),
      specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
      excludeSpecPattern: "*.hot-update.js",
    },
    configOrigin,
    envOrigin,
    cliOrigin
  );

  debug(`resolved configuration of ${util.inspect(configuration)}`);

  return { ...configuration, env: {} };
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

  const validConfigFiles = [
    "cypress.config.js",
    "cypress.config.cjs",
    "cypress.config.mjs",
    "cypress.config.ts",
  ];

  const configFiles = files.filter((file) => validConfigFiles.includes(file));

  if (configFiles.length === 0) {
    throw new Error("Unable to find a Cypress configuration file.");
  } else if (configFiles.length > 1) {
    throw new Error("Found multiple Cypress configuration files.");
  }

  return configFiles[0];
}

function parseConfigurationFile(
  configFile: string
): Partial<ICypressPost10Configuration> {
  if (!fs.existsSync(configFile)) {
    throw Error("Missing Cypress configuration file.");
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

function resolveProjectPath(options: { argv: string[]; cwd: string }): string {
  const { argv, cwd } = options;

  const customProjectPath =
    findArgumentValue(argv, "--project", true) ||
    findArgumentValue(argv, "-P", false);

  if (customProjectPath) {
    return ensureIsAbsolute(cwd, customProjectPath);
  } else {
    return cwd;
  }
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

  excludeSpecPatterns = [excludeSpecPatterns].flat();

  const globOptions = {
    sort: true,
    absolute: true,
    nodir: true,
    cwd: projectRoot,
    ignore: excludeSpecPatterns,
  };

  return specPatterns.flatMap((specPattern) =>
    glob.sync(specPattern, globOptions)
  );
}
