/**
 * basic adt to represent the result of an operation that can fail
 * using typescript’s discriminated unions.
 *
 * see also
 * - fp-ts either
 * - rust result
 * - haskell either
 */
export type Result<A, E> = Success<A> | Failure<E>

interface Success<A> {
  readonly ok: true
  readonly value: A
}

interface Failure<E> {
  readonly ok: false
  readonly reason: E
}

export const success = <A = never, E = never>(value: A): Result<A, E> => ({
  ok: true,
  value,
})

export const failure = <A = never, E = never>(reason: E): Result<A, E> => ({
  ok: false,
  reason,
})
