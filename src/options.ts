export interface ParamOptions<TParams extends Record<string, unknown>> {
	/**
	 * Controls which parameters propagate into children's query keys.
	 * Returning `true` keeps the param; `false` drops it.
	 *
	 * The node's own `$key` always contains every param.
	 *
	 * **Default:** `(key) => !key.startsWith('_')` (parameters with names that start with `_` do not propagate).
	 */
	propagate?: (paramKey: keyof TParams & string) => boolean
}

type ResolvedParamOptions<TParams extends Record<string, unknown>> = {
	[K in keyof Required<ParamOptions<TParams>>]: NonNullable<
		ParamOptions<TParams>[K]
	>
}

const DEFAULT_PARAM_OPTIONS: ResolvedParamOptions<Record<string, unknown>> = {
	propagate: (key) => !key.startsWith('_'),
}

export function resolveParamOptions<TParams extends Record<string, unknown>>(
	options: ParamOptions<TParams>,
): ResolvedParamOptions<TParams> {
	return {
		...(DEFAULT_PARAM_OPTIONS as ResolvedParamOptions<TParams>),
		...options,
	}
}
