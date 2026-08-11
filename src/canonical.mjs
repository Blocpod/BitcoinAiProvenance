import { ProtocolError, invariant } from './errors.mjs';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertValidUnicode(value, path) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      invariant(next >= 0xdc00 && next <= 0xdfff, 'INVALID_UNICODE', `Unpaired high surrogate at ${path}`);
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new ProtocolError('INVALID_UNICODE', `Unpaired low surrogate at ${path}`);
    }
  }
}

function encode(value, path, seen) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') {
    assertValidUnicode(value, path);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    invariant(Number.isFinite(value), 'NON_FINITE_NUMBER', `Non-finite number at ${path}`);
    invariant(Number.isSafeInteger(value), 'UNSAFE_NUMBER', `Only safe integers are allowed at ${path}`);
    return JSON.stringify(value);
  }
  invariant(typeof value !== 'bigint', 'BIGINT_NOT_ALLOWED', `Encode big integers as decimal strings at ${path}`);
  invariant(typeof value !== 'undefined' && typeof value !== 'function' && typeof value !== 'symbol', 'UNSUPPORTED_VALUE', `Unsupported value at ${path}`);
  invariant(typeof value === 'object', 'UNSUPPORTED_VALUE', `Unsupported value at ${path}`);
  invariant(!seen.has(value), 'CYCLIC_VALUE', `Cyclic value at ${path}`);
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry, index) => encode(entry, `${path}[${index}]`, seen)).join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    invariant(prototype === Object.prototype || prototype === null, 'NON_PLAIN_OBJECT', `Only plain objects are allowed at ${path}`);
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      assertValidUnicode(key, `${path}.<key>`);
      invariant(!FORBIDDEN_KEYS.has(key), 'FORBIDDEN_KEY', `Forbidden object key at ${path}.${key}`);
      invariant(value[key] !== undefined, 'UNDEFINED_VALUE', `Undefined value at ${path}.${key}`);
    }
    return `{${keys.map((key) => `${JSON.stringify(key)}:${encode(value[key], `${path}.${key}`, seen)}`).join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

export function canonicalize(value) {
  return encode(value, '$', new Set());
}

export function canonicalBytes(value) {
  return Buffer.from(canonicalize(value), 'utf8');
}

export function parseCanonical(text) {
  const value = JSON.parse(text);
  invariant(canonicalize(value) === text, 'NON_CANONICAL_JSON', 'JSON bytes are not in canonical form');
  return value;
}
