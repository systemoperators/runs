# @systemoperator/runs

Execution tracking for workflows, syncs, and background jobs. 3-level model: Run > Step > Call.

## development

- run tests: `npm test`
- build: `npm run build`
- publish dry run: `npm publish --dry-run`

## publishing

tag-based via GitHub Actions:
1. bump version in package.json
2. commit and tag: `git tag v0.1.0`
3. push tag: `git push --tags`
4. CI runs tests, builds, publishes to npm

## code conventions

- TypeScript, ESM only
- zero runtime dependencies
- works in Workers, Node, Deno, Bun
- no database dependency - users implement RunStore interface
- keep files under 500 lines
