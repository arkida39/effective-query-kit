/**
 * Excludes arrays from the parameters constraint.
 *
 * ***See***: https://stackoverflow.com/questions/71422178/typescript-record-accepts-array-why
 */
export type ParamsObject<T> = T extends readonly unknown[]
	? never
	: T & Record<string, unknown>

// biome-ignore lint/suspicious/noExplicitAny: required for some generics
export type SafeAny = any
