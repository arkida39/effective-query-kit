import type {
	AnyParamNode,
	GroupNode,
	LeafNode,
	ParamNode,
	Schema,
} from './nodes.ts'
import type { ParamOptions } from './options.ts'
import { GROUP, LEAF, PARAM } from './symbols.ts'
import type { ParamsObject, SafeAny } from './utils.ts'

export interface DSL {
	/** Terminal static query key. */
	leaf(): LeafNode

	/**
	 * Parameterized node. The `build` function declares the parameters shape and names via
	 * its return type.
	 *
	 * Each returned field becomes a `{ key: value }` segment in the query key.
	 * Callers pass a params object matching the return type.
	 * Children (if provided) are resolved under the parameterized prefix.
	 *
	 * Also see: {@link ParamOptions}
	 *
	 * @example
	 * b.param((id: number) => ({ id }))
	 * b.param((id: number) => ({ renamed_id: id }), { details: b.leaf() })
	 * b.param(
	 *   (userId: string, token: string) => ({ userId, token }),
	 *   { activity: b.leaf() },
	 *   { propagate: (key) => key !== "token" },
	 * )
	 */
	param<
		TArgs extends readonly unknown[],
		TParams extends Record<string, unknown>,
		TChildren extends Schema,
	>(
		build: (...args: TArgs) => ParamsObject<TParams>,
		children?: TChildren,
		options?: ParamOptions<TParams>,
	): ParamNode<TArgs, ParamsObject<TParams>, TChildren>

	/**
	 * Namespacing. Children share the group's prefix.
	 *
	 * Pass a {@link DSL.param} as the second argument to enable `$entity(...)` access,
	 * turning the group into a fetchable collection.
	 */
	group<TChildren extends Schema, TEntity extends AnyParamNode | null>(
		children: TChildren,
		entity?: TEntity,
	): GroupNode<TChildren, TEntity>
}

export const dsl: DSL = {
	leaf: () => ({ $kind: LEAF }),
	param: (build, children, options) => ({
		$kind: PARAM,
		$build: build,
		children: children ?? ({} as SafeAny),
		options: options ?? ({} as SafeAny),
	}),
	group: (children, entity) => ({
		$kind: GROUP,
		children,
		entity: entity ?? (null as SafeAny),
	}),
}
