import { faker } from '@faker-js/faker'
import { QueryClient, type QueryFunctionContext } from '@tanstack/query-core'
import { describe, expect, it } from 'vitest'
import { defineQuerySchema } from '../src/index.ts'

function createMockContext<TKey extends readonly unknown[]>(
	queryKey: TKey,
): QueryFunctionContext<TKey> {
	return {
		queryKey: queryKey,
		client: new QueryClient(),
		meta: undefined,
		pageParam: undefined,
		signal: new AbortController().signal,
	}
}

describe('defineQuerySchema', () => {
	const q = defineQuerySchema((b) => ({
		users: b.group({
			me: b.leaf(),
			profile: b.param((id: number) => ({ id })),
		}),
		posts: b.group({
			item: b.param((id: number) => ({ id }), {
				comments: b.param((page: number) => ({ page })),
				details: b.leaf(),
			}),
		}),
		todos: b.group(
			{ recent: b.leaf() },
			b.param((id: number) => ({ id }), {
				details: b.leaf(),
			}),
		),
		sessions: b.param(
			(userId: string, token: string) => ({ userId, token }),
			{ activity: b.leaf() },
			{ propagate: (key) => key !== 'token' },
		),
		settings: b.group({
			theme: b.leaf(),
			notifications: b.leaf(),
		}),
	}))

	describe('leaf', () => {
		it('has a static key', () => {
			expect(q.users.me.$key).toEqual(['users', 'me'])
		})

		it('has $queryOptions', () => {
			const opts = q.users.me.$queryOptions(async () => ({}))
			expect(opts.queryKey).toEqual(['users', 'me'])
			expect(typeof opts.queryFn).toBe('function')
		})
	})

	describe('group', () => {
		it('has a group-level key', () => {
			expect(q.users.$key).toEqual(['users'])
		})

		it('has no $queryOptions on a plain group', () => {
			expect(q.settings).not.toHaveProperty('$queryOptions')
		})

		it('resolves nested children', () => {
			expect(q.settings.theme.$key).toEqual(['settings', 'theme'])
			expect(q.settings.notifications.$key).toEqual([
				'settings',
				'notifications',
			])
		})
	})

	describe('param', () => {
		const mockParam = { id: faker.number.int() }
		it('has a parameterized key with wrapped objects', () => {
			const entry = q.users.profile(mockParam)
			expect(entry.$key).toEqual(['users', 'profile', mockParam])
		})

		it('has $params that extracts parameters from context', () => {
			const entry = q.users.profile(mockParam)
			expect(q.users.profile.$params(createMockContext(entry.$key))).toEqual(
				mockParam,
			)
		})

		it('has $queryOptions that passes parameters to the fetcher', async () => {
			const entry = q.users.profile(mockParam)
			const opts = entry.$queryOptions(async (_, params) => params)
			const result = await opts.queryFn(createMockContext(entry.$key))
			expect(result).toEqual(mockParam)
		})
	})

	describe('param with children', () => {
		const mockParam1 = { id: faker.number.int() }
		const mockParam2 = { page: faker.number.int() }
		it('resolves nested children with the parameterized prefix', () => {
			const post = q.posts.item(mockParam1)
			expect(post.$key).toEqual(['posts', 'item', mockParam1])
			expect(post.details.$key).toEqual([
				'posts',
				'item',
				mockParam1,
				'details',
			])
		})

		it('resolves nested parameters under children', () => {
			const comments = q.posts.item(mockParam1).comments(mockParam2)
			expect(comments.$key).toEqual([
				'posts',
				'item',
				mockParam1,
				'comments',
				mockParam2,
			])
		})
	})

	describe('collection (group with $entity)', () => {
		const mockParam = { id: faker.number.int() }
		it('has a static group-level key', () => {
			expect(q.todos.$key).toEqual(['todos'])
		})

		it('has $queryOptions on the collection', () => {
			const opts = q.todos.$queryOptions(async () => [])
			expect(opts.queryKey).toEqual(['todos'])
		})

		it('has static children', () => {
			expect(q.todos.recent.$key).toEqual(['todos', 'recent'])
		})

		it('resolves $entity with parameterized key', () => {
			const entity = q.todos.$entity(mockParam)
			expect(entity.$key).toEqual(['todos', mockParam])
		})

		it('resolves entity children', () => {
			const entity = q.todos.$entity(mockParam)
			expect(entity.details.$key).toEqual(['todos', mockParam, 'details'])
		})

		it('has $params that extracts entity parameters from context', () => {
			const entity = q.todos.$entity(mockParam)
			expect(q.todos.$params(createMockContext(entity.$key))).toEqual(mockParam)
		})
	})

	describe('propagate option', () => {
		const mockParam1 = { userId: faker.internet.username() }
		const mockParam2 = { token: faker.internet.jwt() }
		it("has all params in the node's own key", () => {
			const s = q.sessions({ ...mockParam1, ...mockParam2 })
			expect(s.$key).toEqual(['sessions', mockParam1, mockParam2])
		})

		it("has no filtered parameters in the children's keys", () => {
			const s = q.sessions({ ...mockParam1, ...mockParam2 })
			expect(s.activity.$key).toEqual(['sessions', mockParam1, 'activity'])
		})
	})
})
