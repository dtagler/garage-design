[![Garage Design](docs/assets/garagedesign-logo.svg)](docs/assets/garagedesign-logo.svg)

```text
  GARAGE DESIGN
  ============================================================
  [ ][ ][ ][ ]   Measure the garage.
  [ ][##][##][ ] Design the floor.
  [ ][##][##][ ] Compare real tile products.
  [ ][ ][ ][ ]   Price the complete plan before ordering.
  ============================================================
```

# Plan the floor before buying the tiles

Garage Design is a browser-based planner for modular garage flooring. Enter the garage dimensions,
choose a layout, compare verified drainable tile products, and get an order estimate that accounts
for cuts, waste, package sizes, ramps, Illinois tax, and known shipping rules.

The default plan is sized for a 230 by 246 inch garage, but every measurement can be changed.

## What it does

- Models one, two, three, or custom garage-door openings.
- Includes 250 original border, checker, parking, racing, and showroom layouts.
- Supports tile-by-tile painting and drag painting with mouse, touch, or pen.
- Keeps full tiles along the front and right edges of the clearance-reduced tile field, moving
  required cuts to the back and left.
- Compares verified open-grid products from Swisstrax, RaceDeck, VEVOR, ModuTile, Greatmats,
  FlooringInc, and TrueLock.
- Maps the selected design to colors each product actually offers.
- Calculates tile quantities by color, waste, packages, leftovers, ramps, tax, and shipping status.
- Saves plans in browser storage and exports a PNG or printable project report.

## From measurements to an order estimate

```text
Garage dimensions and doors
              |
              v
Choose one of 250 layouts
              |
              v
Customize colors or paint individual tiles
              |
              v
Compare compatible drainable products
              |
              v
Review cuts, packages, ramps, tax, and shipping
              |
              v
Save or export the plan
```

The entire workflow stays on one page. Each section appears when the decisions above it are
complete, so the garage, design, product comparison, and estimate remain visible together.

## Run with Docker

Garage Design is intentionally container-only. Node, npm dependencies, and browser-test tooling
stay inside Docker. The project directory is mounted for source editing, while `node_modules` is
stored in a Docker named volume instead of on the host.

Prerequisite: Docker Engine or Docker Desktop with Docker Compose v2.

```sh
docker compose build toolchain
docker compose run --rm toolchain npm ci
docker compose up dev
```

Open <http://localhost:5173>.

Stop the application with:

```sh
docker compose down
```

To remove the dependency volume as well:

```sh
docker compose down --volumes
```

This deletes the installed dependencies. Run
`docker compose run --rm toolchain npm ci` before starting the app again.

## Product and pricing notes

Catalog facts are point-in-time observations from linked manufacturer and retailer pages. Prices
are estimates, not quotes. Garage Design uses the Illinois state sales-tax rate of 6.25% for
planning and applies a shipping charge only when a seller publishes a rule the catalog can verify.
An unknown shipping charge keeps the estimated checkout total unavailable.

After expansion clearance is removed, full tiles begin at the front edge of the usable tile field
and finish at its right edge. Any required cut strips are placed along the back and left edges of
that field. Confirm current price, stock, color availability, ramp compatibility, tax treatment,
and final shipping with the seller before ordering.

Garage Design is independent and is not affiliated with or endorsed by any flooring manufacturer
or retailer. Product names and trademarks are used only to identify compared products.

## Documentation

- [Documentation index](docs/README.md)
- [Contributing and Docker workflow](CONTRIBUTING.md)

## Privacy and browser support

There are no accounts, analytics, backend services, or cloud synchronization. Saved plans remain
in browser storage on the current device. Clearing site data removes them.

Remote product photos are requested directly from their attributed source hosts and are never
included in exports. The interface supports desktop layouts from approximately 1024 to 1920 pixels
wide, keyboard navigation, visible focus states, reduced motion, and non-color tile symbols.

## Current limits

Garage Design handles rectangular garages with configurable openings along the front wall. It does
not model cabinets, lifts, drains, columns, stairs, recesses, irregular rooms, installation labor,
live inventory, or retailer checkout. Shipping remains unknown unless a published rule can be
verified for the selected product and order.

## License

Garage Design is available under the [MIT License](LICENSE).
