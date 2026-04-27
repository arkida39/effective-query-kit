import { type DSL, dsl } from './dsl.ts'
import type { Schema } from './nodes.ts'
import { buildChildren, type ResolvedSchema } from './resolution.ts'

/**
 * Creates a typed, recursively nested query-key store using a builder {@link DSL}.
 *
 * - Every fetchable entry carries `$key` and `$queryOptions(fetcher)`.
 * - Parameterized entries carry `$params(ctx)`.
 * - Groups without an entity are namespaces only (no `$queryOptions`).
 *
 * For more details: {@link https://github.com/arkida39/effective-query-kit/}
 *
 * @example <caption>Basic usage:</caption>
 * const q = defineQuerySchema((b) => ({
 *   users: b.group({
 *     me: b.leaf(),
 *     profile: b.param((id: number) => ({ id })),
 *   }),
 *   settings: b.group({
 *     theme: b.leaf(),
 *   }),
 * }))
 *
 * q.users.$key                                 // ['users']
 * q.users.me.$key                              // ['users', 'me']
 * q.users.profile({ id: 1 }).$key             	// ['users', 'profile', { id: 1 }]
 * q.users.profile.$params(ctx)    				// { id: number }
 */
export function defineQuerySchema<TSchema extends Schema>(
	define: (b: DSL) => TSchema,
): ResolvedSchema<TSchema> {
	return buildChildren([], define(dsl)) as ResolvedSchema<TSchema>
}
