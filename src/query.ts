import type { QueryFunction, QueryFunctionContext } from '@tanstack/query-core'

export interface QueryOptionsResult<TKey extends readonly unknown[], TData> {
	queryKey: TKey
	queryFn: QueryFunction<TData, TKey & readonly unknown[]>
}

export type StaticFetcher<
	TKey extends readonly unknown[],
	TData,
> = QueryFunction<TData, TKey & readonly unknown[]>

export type DynamicFetcher<
	TKey extends readonly unknown[],
	TParams extends Record<string, unknown>,
	TData,
> = (
	context: QueryFunctionContext<TKey & readonly unknown[]>,
	params: TParams,
) => ReturnType<QueryFunction<TData>>
