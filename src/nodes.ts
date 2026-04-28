import type { ParamOptions } from './options.ts'
import type { GROUP, LEAF, PARAM } from './symbols.ts'
import type { SafeAny } from './utils.ts'

export interface LeafNode {
	readonly $kind: typeof LEAF
}

export interface ParamNode<
	TArgs extends readonly unknown[],
	TParams extends Record<string, unknown>,
	TChildren extends Schema,
> {
	readonly $kind: typeof PARAM
	readonly $build: (...args: TArgs) => TParams
	readonly children: TChildren
	readonly options: ParamOptions<TParams>
}

export type AnyParamNode = ParamNode<SafeAny, SafeAny, SafeAny>

export interface GroupNode<
	TChildren extends Schema,
	TEntity extends AnyParamNode | null,
> {
	readonly $kind: typeof GROUP
	readonly children: TChildren
	readonly entity: TEntity
}

export type AnyGroupNode = GroupNode<SafeAny, SafeAny>

export type Node = LeafNode | AnyParamNode | AnyGroupNode

export interface Schema {
	[key: string]: Node
}
