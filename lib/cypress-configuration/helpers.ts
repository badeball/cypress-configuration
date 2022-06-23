import debug from "../debug";

import { ensureIsAbsolute } from "../path-helpers";

export function findLastIndex<T>(
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

export function* traverseArgvMatching(
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

export function* combine<T>(...generators: Generator<T, unknown, unknown>[]) {
  for (const generator of generators) {
    yield* generator;
  }
}

export function findArgumentValue(
  argv: string[],
  name: string,
  allowEqual: boolean
): string | undefined {
  for (const value of traverseArgvMatching(argv, name, allowEqual)) {
    return value;
  }
}

export function toSnakeCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function capitalize(word: string) {
  return word.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

export function toCamelCase(value: string) {
  return value
    .split("_")
    .map((word, index) =>
      index === 0 ? word.toLocaleLowerCase() : capitalize(word)
    )
    .join("");
}

export function resolveProjectPath(options: {
  argv: string[];
  cwd: string;
}): string {
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
