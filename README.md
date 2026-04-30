# Mockplane

A monorepo containing the `mockplane` library and a working example application.

## Packages

| Package                                                 | Description                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| [`packages/mockplane`](./packages/mockplane)            | The library — install this in your project                        |
| [`examples/tanstack-start/`](./examples/tanstack-start) | A TanStack Start demo app with Playwright tests using the library |

## Background

See the [library README](./packages/mockplane/README.md) for full documentation and setup instructions.

## Development

```sh
pnpm install

# Run the example app
pnpm --filter mockplane-example dev

# Run the example app tests
pnpm --filter mockplane-example test

# Build the library
pnpm --filter mockplane build
```
