type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype &&
    !Array.isArray(value)
  );
}

export type DeepMergeOptions = {
  /** Concatenate arrays instead of replacing them. */
  concatArrays?: boolean,

  /** Only merge matching keys. */
  matchingOnly?: boolean
};

/**
 * Deeply merges two values into a new value.
 * - Arrays are concatenated.
 * - Plain objects are merged recursively.
 * - Other values are replaced by `source`.
 */
export function deepMerge<T, U>(
  target: T,
  source: U,
  options: DeepMergeOptions = { concatArrays: true, matchingOnly: false }
): T & U {
  if (target === undefined) return source as T & U;
  if (source === undefined) return target as T & U;

  if (Array.isArray(target) && Array.isArray(source) && options.concatArrays) {
    return [...target, ...source] as unknown as T & U;
  }

  if (isPlainObject(target) && isPlainObject(source)) {
    const result: PlainObject = { ...target };
    const targetIsEmpty = Object.keys(target).length === 0;
    const keys = options.matchingOnly && !targetIsEmpty
      ? Object.keys(source).filter(k => k in target)
      : Object.keys(source);

    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

      result[key] = key in target
        ? deepMerge(target[key], source[key], options)
        : source[key];
    }

    return result as T & U;
  }

  return source as T & U;
}

/**
 * Returns a new array with elements of the input array shuffled.
 * Uses something-something shuffle algorithm by splicing from a cloned array.
 */
export function shuffleArray(array: string[]) {
  const temp: string[] = JSON.parse(JSON.stringify(array));
  const ret: string[] = [];

  while (temp.length > 0) {
    const d = Math.floor(Math.random() * temp.length);
    ret.push(temp[d]);
    temp.splice(d, 1);
  }

  return ret;
}

/**
 * Exports a value to the global object under a nested namespace path.
 * Creates intermediate objects if they do not exist.
 * 
 * Example: `exportToGlobal('MyMod.Utils', value)` creates `globalThis.MyMod.Utils = value`.
 */
export function exportToGlobal(name: string, value: any): void {
  const keys = name.split('.');
  let current = globalThis as any;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
}

/** Checks if the given property has a getter defined on the object or its prototype chain. */
export function hasGetter<T extends object>(obj: T, prop: keyof T | string): boolean {
  while (obj && obj !== Object.prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
    if (descriptor?.get) return true;
    obj = Object.getPrototypeOf(obj);
  }
  return false;
}

/** Checks if the given property has a setter defined on the object or its prototype chain. */
export function hasSetter<T extends object>(obj: T, prop: keyof T | string): boolean {
  while (obj && obj !== Object.prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
    if (descriptor?.set) return true;
    obj = Object.getPrototypeOf(obj);
  }
  return false;
}

/**
 * Converts bytes to kilobytes. 
 */
export const byteToKB = (nByte: number) => Math.round(nByte / 100) / 10;

export type Ok<T> = { ok: true; value: T };
export type Err<E = unknown> = { ok: false; error: E };
export type Result<T, E = unknown> = Ok<T> | Err<E>;

export function tryCatch<T, E = unknown>(
  fn: () => T,
  mapError?: (e: unknown) => E
): Result<T, E> {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, error: mapError ? mapError(e) : (e as E) };
  }
}

export async function tryCatchAsync<T, E = unknown>(
  fn: () => Promise<T>,
  mapError?: (e: unknown) => E
): Promise<Result<T, E>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, error: mapError ? mapError(e) : (e as E) };
  }
}
