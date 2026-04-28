import type { QueryFunction, QueryFunctionContext } from '@tanstack/query-core'
import type {
	AnyParamNode,
	GroupNode,
	LeafNode,
	Node,
	ParamNode,
	Schema,
} from './nodes.ts'
import { type ParamOptions, resolveParamOptions } from './options.ts'
import type {
	DynamicFetcher,
	QueryOptionsResult,
	StaticFetcher,
} from './query.ts'
import { GROUP, LEAF, PARAM } from './symbols.ts'
import type { SafeAny } from './utils.ts'

/**
 * Appends parameter values to a prefix. Each param becomes its own `{ key: value }`
 * object segment.
 */
export type AppendParams<
	TPrefix extends readonly unknown[],
	TParams extends Record<string, unknown>,
> = readonly [
	...TPrefix,
	...{ [K in keyof TParams]: { [P in K]: TParams[P] } }[keyof TParams][],
]

interface ParamsExtractor<TParams extends Record<string, unknown>> {
	$params: (ctx: QueryFunctionContext) => TParams
}

interface StaticEntry<TPrefix extends readonly unknown[]> {
	$key: TPrefix
	$queryOptions: <TData>(
		fetcher: StaticFetcher<TPrefix, TData>,
	) => QueryOptionsResult<TPrefix, TData>
}

interface DynamicEntry<
	TPrefix extends readonly unknown[],
	TParams extends Record<string, unknown>,
> {
	$key: TPrefix
	$queryOptions: <TData>(
		fetcher: DynamicFetcher<TPrefix, TParams, TData>,
	) => QueryOptionsResult<TPrefix, TData>
}

type ResolveChildren<
	TPrefix extends readonly unknown[],
	TSchema extends Schema,
> = {
	[K in keyof TSchema & string]: ResolveNode<
		readonly [...TPrefix, K],
		TSchema[K]
	>
}

type ResolveGroup<
	TPrefix extends readonly unknown[],
	TChildren extends Schema,
	TEntity extends AnyParamNode | null,
> =
	TEntity extends ParamNode<SafeAny, infer TParams, infer TEntityChildren>
		? StaticEntry<TPrefix> &
				ResolveChildren<TPrefix, TChildren> &
				ParamsExtractor<TParams> & {
					$entity: (
						params: TParams,
					) => DynamicEntry<AppendParams<TPrefix, TParams>, TParams> &
						ResolveChildren<AppendParams<TPrefix, TParams>, TEntityChildren>
				}
		: { $key: TPrefix } & ResolveChildren<TPrefix, TChildren>

type ResolveNode<
	TPrefix extends readonly unknown[],
	TNode extends Node,
> = TNode extends LeafNode
	? StaticEntry<TPrefix>
	: TNode extends ParamNode<SafeAny, infer TParams, infer TChildren>
		? ParamsExtractor<TParams> &
				((
					params: TParams,
				) => DynamicEntry<AppendParams<TPrefix, TParams>, TParams> &
					ResolveChildren<AppendParams<TPrefix, TParams>, TChildren>)
		: TNode extends GroupNode<infer TChildren, infer TEntity>
			? ResolveGroup<TPrefix, TChildren, TEntity>
			: never

export type ResolvedSchema<TSchema extends Schema> = {
	[K in keyof TSchema & string]: ResolveNode<readonly [K], TSchema[K]>
}

function makeParamsExtractor(
	paramKeys: string[],
	offset: number,
): (context: QueryFunctionContext) => Record<string, unknown> {
	return (context) => {
		const result = {} as Record<string, unknown>
		paramKeys.forEach((key, i) => {
			const segment = context.queryKey[offset + i] as Record<string, unknown>
			result[key] = segment[key]
		})
		return result
	}
}

function makeStaticQueryOptions(queryKey: readonly unknown[]) {
	return <TData>(fetcher: QueryFunction<TData>) => ({
		queryKey,
		queryFn: async (context: QueryFunctionContext) => fetcher(context),
	})
}

function makeDynamicQueryOptions(
	queryKey: readonly unknown[],
	extractParams: (context: QueryFunctionContext) => Record<string, unknown>,
) {
	return <TData>(
		fetcher: (
			context: QueryFunctionContext,
			params: Record<string, unknown>,
		) => TData | Promise<TData>,
	) => ({
		queryKey,
		queryFn: async (context: QueryFunctionContext) =>
			fetcher(context, extractParams(context)),
	})
}

/**
 * Builds the resolved entry for a `param`/`collection` node invocation.
 */
function buildParamEntry(
	prefix: readonly unknown[],
	name: string,
	paramsObject: Record<string, unknown>,
	children: Schema,
	options: ParamOptions<Record<string, unknown>>,
): Record<string, unknown> {
	const paramKeys = Object.keys(paramsObject)
	const wrappedParams = paramKeys.map((k) => ({ [k]: paramsObject[k] }))

	const ownPrefix = [...prefix, name, ...wrappedParams]

	const { propagate } = resolveParamOptions(options)
	const childPrefix = [
		...prefix,
		name,
		...wrappedParams.filter((_, i) => {
			const key = paramKeys[i]
			// TODO: Do we discard the 'undefined'?
			return key !== undefined && propagate(key)
		}),
	]

	const extractParams = makeParamsExtractor(paramKeys, prefix.length + 1)

	return {
		...buildChildren(childPrefix, children),
		$key: ownPrefix,
		$queryOptions: makeDynamicQueryOptions(ownPrefix, extractParams),
	}
}

/**
 * Extracts parameter names.
 */
function discoverParamKeys(
	build: (...args: SafeAny) => Record<string, unknown>,
): string[] {
	const sample = build()
	return Object.keys(sample)
}

/** Builds the resolved children for a schema at a given prefix. */
export function buildChildren(
	prefix: readonly unknown[],
	schema: Schema,
): Record<string, unknown> {
	const result: Record<string, unknown> = {}

	for (const [name, def] of Object.entries(schema)) {
		switch (def.$kind) {
			case LEAF: {
				const leafKey = [...prefix, name]
				result[name] = {
					$key: leafKey,
					$queryOptions: makeStaticQueryOptions(leafKey),
				}
				break
			}
			case PARAM: {
				const paramKeys = discoverParamKeys(def.$build)
				const offset = prefix.length + 1

				result[name] = Object.assign(
					(params: Record<string, unknown>) => {
						return buildParamEntry(
							prefix,
							name,
							params,
							def.children,
							def.options,
						)
					},
					{ $params: makeParamsExtractor(paramKeys, offset) },
				)
				break
			}
			case GROUP: {
				const groupKey = [...prefix, name]
				const groupChildren = buildChildren(groupKey, def.children)
				const entity: AnyParamNode | null = def.entity

				if (entity) {
					const paramKeys = discoverParamKeys(entity.$build)
					const offset = prefix.length + 1

					result[name] = {
						$key: groupKey,
						$queryOptions: makeStaticQueryOptions(groupKey),
						$params: makeParamsExtractor(paramKeys, offset),
						...groupChildren,
						$entity: (params: Record<string, unknown>) => {
							return buildParamEntry(
								prefix,
								name,
								params,
								entity.children,
								entity.options,
							)
						},
					}
				} else {
					result[name] = {
						$key: groupKey,
						...groupChildren,
					}
				}
				break
			}
		}
	}

	return result
}
