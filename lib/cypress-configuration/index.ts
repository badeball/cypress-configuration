import fs from "fs";

import path from "path";

import {
  ICypressPost10Configuration,
  resolvePost10TestFiles,
  CONFIG_FILE_NAMES as POST10_CONFIG_FILE_NAMES,
  resolvePost10Configuration,
  TestingType,
} from "./cypress-post10-configuration";

import { CONFIG_FILE_NAME as PRE10_CONFIG_FILE_NAME } from "./cypress-pre10-configuration";

import {
  CypressConfigurationError,
  MissingConfigurationFileError,
  MultipleConfigurationFilesError,
  UnrecognizedConfigurationFileError,
  UnsupportedCypressEra,
} from "./errors";

import { findArgumentValue, resolveProjectPath } from "./helpers";

import debug from "../debug";

export {
  TestingType,
  CypressConfigurationError,
  MissingConfigurationFileError,
  MultipleConfigurationFilesError,
  UnrecognizedConfigurationFileError,
  UnsupportedCypressEra,
};

export type ICypressConfiguration = ICypressPost10Configuration;

export enum CypressEra {
  POST_V10,
  PRE_V10,
}

export function determineCypressEra(options: {
  argv: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
}) {
  const projectRoot = resolveProjectPath(options);

  const explicitConfigFile =
    findArgumentValue(options.argv, "--config-file", true) ??
    findArgumentValue(options.argv, "-C", false);

  if (explicitConfigFile) {
    if (fs.existsSync(explicitConfigFile)) {
      const name = path.basename(explicitConfigFile);

      if (name === PRE10_CONFIG_FILE_NAME) {
        debug(`Determined project ${projectRoot} to be ${CypressEra.PRE_V10}`);
        return CypressEra.PRE_V10;
      } else if (POST10_CONFIG_FILE_NAMES.includes(name)) {
        debug(`Determined project ${projectRoot} to be ${CypressEra.POST_V10}`);
        return CypressEra.POST_V10;
      } else {
        throw new UnrecognizedConfigurationFileError(
          "Unrecognized file " + name
        );
      }
    } else {
      throw new MissingConfigurationFileError(
        "Missing Cypress configuration file."
      );
    }
  } else {
    const files = fs.readdirSync(projectRoot);

    const configFiles = files.filter((file) =>
      [PRE10_CONFIG_FILE_NAME, ...POST10_CONFIG_FILE_NAMES].includes(file)
    );

    if (configFiles.length === 0) {
      throw new MissingConfigurationFileError(
        "Unable to find a Cypress configuration file."
      );
    } else if (configFiles.length > 1) {
      throw new MultipleConfigurationFilesError(
        "Found multiple Cypress configuration files."
      );
    }

    if (configFiles[0] === PRE10_CONFIG_FILE_NAME) {
      debug(`Determined project ${projectRoot} to be ${CypressEra.PRE_V10}`);
      return CypressEra.PRE_V10;
    } else {
      debug(`Determined project ${projectRoot} to be ${CypressEra.POST_V10}`);
      return CypressEra.POST_V10;
    }
  }
}

export function resolveConfiguration(options: {
  argv: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
  parseDangerously?: boolean;
  testingType: TestingType;
}): ICypressConfiguration {
  const era = determineCypressEra(options);

  if (era === CypressEra.PRE_V10) {
    throw new UnsupportedCypressEra(
      "Unable resolve configuration of Cypress versions below v10"
    );
  } else {
    return resolvePost10Configuration(options);
  }
}

export function resolveTestFiles(
  configuration: ICypressConfiguration
): string[] {
  if ("specPattern" in configuration) {
    return resolvePost10TestFiles(configuration);
  } else {
    throw new UnsupportedCypressEra(
      "Unable resolve test files of Cypress versions below v10"
    );
  }
}
