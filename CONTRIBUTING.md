# Contributing

Garage Design uses a Docker-only development workflow. Do not install Node, npm packages,
Playwright browsers, or project tooling on the host.

## Set up the container environment

```sh
docker compose build toolchain
docker compose run --rm toolchain npm ci
```

The source tree is bind-mounted at `/app`. Dependencies are stored in the Docker
`node_modules` named volume, so the repository does not accumulate a host-side dependency tree.
The toolchain defaults to the non-root user `1000:1000`.

On Linux, if `id -u` or `id -g` returns a different value, copy `.env.example` to `.env` and set
`LOCAL_UID` and `LOCAL_GID` to those values before running Compose. Docker Desktop users can keep
the defaults.

Start the development server:

```sh
docker compose up dev
```

Open <http://localhost:5173>.

## Development commands

| Task                    | Command                                                  |
| ----------------------- | -------------------------------------------------------- |
| Format files            | `docker compose run --rm toolchain npm run format`       |
| Check formatting        | `docker compose run --rm toolchain npm run format:check` |
| Lint                    | `docker compose run --rm toolchain npm run lint`         |
| Type check              | `docker compose run --rm toolchain npm run typecheck`    |
| Unit tests              | `docker compose run --rm toolchain npm test`             |
| Production build        | `docker compose run --rm toolchain npm run build`        |
| Standard verification   | `docker compose run --rm toolchain npm run verify`       |
| Browser tests           | `docker compose run --rm e2e`                            |
| Remove generated output | `docker compose run --rm toolchain npm run clean`        |

`npm run verify` checks formatting, lint, types, unit tests, and the production build. Run the
browser suite separately because it uses the pinned Playwright image.

After pulling a changed `package-lock.json`, refresh the named volume:

```sh
docker compose run --rm toolchain npm ci
```

When intentionally changing dependencies, run npm inside the toolchain container so both
`package.json` and `package-lock.json` are updated together:

```sh
docker compose run --rm toolchain npm install <package-name>
```

## Project structure

| Path                      | Purpose                                                   |
| ------------------------- | --------------------------------------------------------- |
| `src/components/planner/` | Planner interface, canvas, and product-specific estimate  |
| `src/rough-design/`       | Preset library, custom painting, and tile-grid mapping    |
| `src/garage-front/`       | Garage-door and wall geometry                             |
| `src/calculations/`       | Tile, package, ramp, tax, shipping, and cost calculations |
| `src/data/`               | Source-linked catalog, accessories, and shipping rules    |
| `src/domain/`             | Validated domain types and browser-support rules          |
| `src/persistence/`        | Browser storage and saved-plan migration                  |
| `src/export/`             | PNG and print-report generation                           |
| `e2e/`                    | Chromium workflow and responsive-layout tests             |

## Change guidelines

- Keep calculations in pure functions and cover behavior changes with focused tests.
- Preserve stable product, pattern, and browser-storage identifiers.
- The legacy `garage-floor-design/*` storage keys are intentional and protect existing saved plans.
- Keep product claims source-linked and dated.
- Do not copy or bundle third-party product photos.
- Keep the planner usable with keyboard navigation and reduced motion.
- Do not weaken validation or replace unknown price, shipping, or compatibility data with guesses.

## Cleanup

Generated build and test output is ignored by Git. Remove it with:

```sh
docker compose run --rm toolchain npm run clean
```

Remove containers and the dependency volume with:

```sh
docker compose down --volumes
```

The next development or validation command requires reinstalling dependencies:

```sh
docker compose run --rm toolchain npm ci
```
