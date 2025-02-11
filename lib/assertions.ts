import { isString } from "./type-guards";

const homepage = "https://github.com/badeball/cypress-configuration";

export function fail(message: string) {
  throw new Error(
    `${message} (this might be a bug, please report at ${homepage})`
  );
}

export function assert(value: any, message?: string): asserts value {
  if (value) {
    return;
  }

  fail(message ?? `Expected a truthy value, but got ${value}`);
}

export function assertAndReturn<T>(
  value: T,
  message?: string
): Exclude<T, false | null | undefined> {
  assert(value, message);
  return value as Exclude<T, false | null | undefined>;
}

export function assertIsString(
  value: any,
  message: string
): asserts value is string {
  assert(isString(value), message);
}
