import path from "path";

import util from "util";

import glob from "glob";

import minimatch from "minimatch";

import { assertIsString } from "./assertions";

import { ICypressConfiguration } from "./cypress-configuration";

const MINIMATCH_OPTIONS = { dot: true, matchBase: true };

export function resolveTestFiles(
  configuration: ICypressConfiguration
): string[] {
  const {
    projectRoot,
    fixturesFolder,
    supportFile,
    specPattern,
    excludeSpecPattern,
  } = configuration;

  const specPatterns = [specPattern].flat();
  const excludeSpecPatterns = [excludeSpecPattern].flat();

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
    cwd: projectRoot,
    ignore: globIgnore.flat(),
  };

  return specPatterns
    .flatMap((pattern) => glob.sync(pattern, globOptions))
    .filter((file) =>
      excludeSpecPatterns.every(
        (pattern) =>
          !minimatch(file, pattern, MINIMATCH_OPTIONS)
      )
    );
}
