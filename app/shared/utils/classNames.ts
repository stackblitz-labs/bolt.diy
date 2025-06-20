/**
 * Copyright (c) 2018 Jed Watson.
 * Licensed under the MIT License (MIT), see:
 *
 * @link http://jedwatson.github.io/classnames
 */

type ClassNamesArg = undefined | string | Record<string, boolean> | ClassNamesArg[];

/**
 * A simple JavaScript utility for conditionally joining classNames together.
 *
 * @param args A series of classes or object with key that are class and values
 * that are interpreted as boolean to decide whether or not the class
 * should be included in the final class.
 */
export function classNames(...args: ClassNamesArg[]): string {
  let classes = '';

  for (const arg of args) {
    classes = appendClass(classes, parseValue(arg));
  }

  return classes;
}

function parseValue(arg: ClassNamesArg) {
  if (typeof arg === 'string' || typeof arg === 'number') {
    return arg;
  }

  if (typeof arg !== 'object') {
    return '';
  }

  if (Array.isArray(arg)) {
    return classNames(...arg);
  }

  let classes = '';

  for (const key in arg) {
    if (arg[key]) {
      classes = appendClass(classes, key);
    }
  }

  return classes;
}

function appendClass(value: string, newClass: string | undefined) {
  if (!newClass) {
    return value;
  }

  if (value) {
    return value + ' ' + newClass;
  }

  return value + newClass;
}
