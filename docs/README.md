# Garage Design documentation

The repository root keeps only files that developers and standard tools expect to find there.
Detailed project documentation lives in this directory.

## Guides

| Document                            | Purpose                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| [Using Garage Design](USAGE.md)     | Measurements, doors, layouts, painting, products, cuts, estimates, and exports |
| [Catalog maintenance](CATALOG.md)   | Source policy, product research, prices, ramps, shipping, and validation       |
| [Project status](PROJECT_STATUS.md) | Completed scope, maintenance priorities, and possible future work              |
| [Contributing](../CONTRIBUTING.md)  | Docker setup, verification commands, project structure, and change guidelines  |

## Repository layout

```text
.
|-- docs/                  Project documentation and README artwork
|-- e2e/                   Chromium workflow and responsive-layout tests
|-- public/                Runtime static assets
|-- src/                   Application source and unit tests
|-- compose.yaml           Docker development and validation services
|-- Dockerfile             Pinned container toolchain and production build
|-- package.json           npm scripts and dependencies
|-- README.md              Product overview and quick start
`-- CONTRIBUTING.md        Contributor entry point
```

Configuration files such as `eslint.config.js`, `playwright.config.ts`, `vite.config.ts`, and the
TypeScript project files remain at the root intentionally. Their tools discover those conventional
locations automatically, and moving them would add command-line configuration without improving
the application structure.
