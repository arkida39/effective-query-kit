<h1 align="center">
    Effective Query Kit
</h1>

<p align="center">
A typesafe key schema builder for <a href="https://tanstack.com/query" target="\_parent">@tanstack/query</a>. Inspired by TkDodo's "Effective Query Keys" pattern.
</p>

## Install

```bash
npm install @arkida39/effective-query-kit
```

## Quick Start

Start by defining the schema:

```ts
import { defineQuerySchema } from "@arkida39/effective-query-kit";

export const queries = defineQuerySchema((b) => ({
  users: b.group({
    me: b.leaf(),
    profile: b.param((id: number) => ({ id })),
  }),
  todos: b.group(
    { recent: b.leaf() },
    b.param((id: number) => ({ id }), {
      details: b.leaf(),
      comments: b.param((page: number) => ({ page })),
    }),
  ),
}));
```

Usage:

```ts
// Static keys

q.users.me.$key
// ↳ ['users', 'me']

q.todos.$key
// ↳ ['todos']

q.todos.recent.$key
// ↳ ['todos', 'recent']
```

```ts
// Parameterized keys

q.users.profile({ id: 1 }).$key
// ↳ ['users', 'profile', { id: 1 }]
```

```ts
// Collection keys

q.todos.$entity({ id: 2 }).$key
// ↳ ['todos', { id: 2 }]

q.todos.$entity({ id: 2 }).details.$key 
// ↳ ['todos', { id: 2 }, 'details']

q.todos.$entity({ id: 2 }).comments({ page: 2 }).$key  
// ↳ ['todos', { id: 2 }, 'comments', { page: 2 }]
```

## DSL

The DSL has 3 constructors that are used to compose the schema.

### `b.leaf()`
 
A terminal static key.
 
```ts
const q = defineQuerySchema((b) => ({
  health: b.leaf(),
}))
 
q.health.$key
// ↳ ['health']
```

### `b.param(build, children?, options?)`
 
A parameterized node. The `build` function declares the parameters shape via its return type.
 
```ts
const q = defineQuerySchema((b) => ({
  user: b.param((id: number) => ({ id })),
}))
 
q.user({ id: 1 }).$key
// ↳ ['user', { id: 1 }]
```

With children, it becomes a scope - children are nested under the parameterized prefix:
 
```ts
const q = defineQuerySchema((b) => ({
  post: b.param((id: number) => ({ id }), {
    comments: b.param((page: number) => ({ page })),
    details: b.leaf(),
  }),
}))
 
q.post({ id: 1 }).details.$key
// ↳ ['post', { id: 1 }, 'details']
q.post({ id: 1 }).comments({ page: 2 }).$key
// ↳ ['post', { id: 1 }, 'comments', { page: 2 }]
```

### `b.group(children, entity?)`
 
A static grouping. Children share the group's prefix. Groups are just namespaces.
 
```ts
const q = defineQuerySchema((b) => ({
  settings: b.group({
    theme: b.leaf(),
    notifications: b.leaf(),
  }),
}))
 
q.settings.$key
// ↳ ['settings']
q.settings.theme.$key
// ↳ ['settings', 'theme']
q.settings.notifications.$key
// ↳ ['settings', 'notifications']
```
 
Pass a `b.param(...)` as the second argument to create a **collection** - a group that's both fetchable as a whole and has parameterized entity access via `$entity(...)`:
 
```ts
const q = defineQuerySchema((b) => ({
  todos: b.group(
    { recent: b.leaf() },
    b.param((id: number) => ({ id }), {
      details: b.leaf(),
    }),
  ),
}))
 
q.todos.$key
// ↳ ['todos'] - whole collection
q.todos.recent.$key
// ↳ ['todos', 'recent'] - static child
q.todos.$entity({ id: 1 }).$key
// ↳ ['todos', { id: 1 }] - particular entity
q.todos.$entity({ id: 1 }).details.$key
// ↳ ['todos', { id: 1 }, 'details'] - dynamic child
```

## Object-wrapped key segments
 
Parameter values are wrapped as `{ key: value }` objects in the query key, not spread as bare values. This prevents ambiguity between path segments and parameter values:
 
```ts
const q = defineQuerySchema((b) => ({
  todos: b.group(
    { recent: b.leaf() },
    b.param((board: string, id: number) => ({ board, id }), {
      details: b.leaf(),
    }),
  ),
}))


q.todos.recent.$key
// ↳ ['todos', 'recent'] - two path segments
q.todos.$entity({ board: 'a', id: 1 }).$key
// ↳ ['todos', { board: 'a' }, { id: 1 }] - path + param + param
q.todos.$entity({ board: 'a', id: 1 }).details.$key
// ↳ ['todos', { board: 'a' }, { id: 1 }, 'details'] - path + param + param + path
```

## Parameter extraction with `$params`
 
Every parameterized schema node has a `$params(ctx)` method that extracts the typed parameters object from a `QueryFunctionContext`:

```ts
const q = defineQuerySchema((b) => ({
  users: b.group({
    profile: b.param((id: number) => ({ id })),
  }),
  todos: b.group(
    { recent: b.leaf() },
    b.param((board: string, id: number) => ({ board, id }), {
      details: b.leaf(),
    }),
  ),
}))

queryOptions({
    // ...
    queryFn: (ctx) => {
        // On a param node - no need to call with parameters first
        const parameters = q.users.profile.$params(ctx)
        // ↳ { id: number }
        // ...
    }
    // ...
})

queryOptions({
    // ...
    queryFn: (ctx) => {
        // On a collection - extracts entity parameters
        const parameters = q.todos.$params(ctx)
        // ↳ { board: string, id: number }
        // ...
    }
    // ...
})
```

## Query options with `$queryOptions`
 
Every fetchable entry (leaf, param, collection) exposes `$queryOptions(fetcher)`, which returns `{ queryKey, queryFn }` ready to be used in `useQuery`:
 
```ts
// Static entry - fetcher receives (QueryFunctionContext)
useQuery(
  q.users.me.$queryOptions(async (context) => {
    const res = await fetch('/api/me')
    return res.json()
  }),
)
 
// Dynamic entry - fetcher receives (QueryFunctionContext, params)
useQuery(
  q.todos.$entity({ board: 'a', id: 1 }).$queryOptions(async (context, { board, id }) => {
    const res = await fetch(`/api/todos/${board}-${id}`)
    return res.json()
  }),
)
 
// Spread with additional options
useQuery({
  ...q.todos.$entity({ board: 'a', id: 1 }).$queryOptions(fetchTodo),
  staleTime: 60_000,
})
```

## Param propagation
 
By default, all parameters, except the ones that start with `_`, from a scope propagate into children's keys. Use `propagate` predicate to override this behavior:
 
```ts
const q = defineQuerySchema((b) => ({
  sessions: b.param(
    (userId: string, token: string) => ({ userId, token }),
    { activity: b.leaf() },
    { propagate: (key) => key !== 'token' },
  ),
}))
 
const s = q.sessions({ userId: 'u_1', token: 't_abc' })
s.$key
// ↳ ['sessions', { userId: 'u_1' }, { token: 't_abc' }]
s.activity.$key
// ↳ ['sessions', { userId: 'u_1' }, 'activity'] - 'token' excluded from children
```
 
The scope's own `$key` always contains every parameter. `propagate` only affects what children inherit.

## Modular schemas
 
Define schemas per feature and merge with spread:
 
```ts
// features/users.ts
export const users = defineQuerySchema((b) => ({
  users: b.group({
    me: b.leaf(),
    profile: b.param((id: number) => ({ id })),
  }),
}))
 
// features/todos.ts
export const todos = defineQuerySchema((b) => ({
  todos: b.group(
    { recent: b.leaf() },
    b.param((id: number) => ({ id })),
  ),
}))
 
// queries.ts
import { users } from './features/users'
import { todos } from './features/todos'
 
export const q = { ...users, ...todos }
```
 
Types merge via intersection. No special utility needed.

## License

Licensed under the [MIT license](https://github.com/arkida39/effective-query-kit/blob/main/LICENSE).