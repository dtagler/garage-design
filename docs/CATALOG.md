# Catalog and pricing maintenance

Garage Design ships with a researched, source-linked product catalog. The catalog is deliberately
conservative: a product fact is included only when a manufacturer or retailer page supports it,
and uncertain shipping or accessory compatibility remains unknown.

## Catalog policy

- Prefer manufacturer pages for dimensions, colors, surface style, and drainage claims.
- Use retailer listings for prices or facts unavailable from the manufacturer.
- Record the source URL, source type, checked date, and supporting quote when useful.
- Preserve vendor product names and color tokens exactly.
- Treat every price as a dated estimate, never a quote.
- Never infer individual-tile availability from a package listing.
- Never classify a closed top as drainable because water can move beneath it.
- Never invent a compatible ramp for a product family.
- Never assume shipping is free.

Product and manufacturer names identify the items being compared. Garage Design has no affiliation
with the listed companies.

## Where catalog data lives

| Data                                | Location                                                               |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Manufacturer and product seeds      | `src/data/manufacturers/`                                              |
| Shared seed types and checked dates | `src/data/seedTypes.ts`                                                |
| Catalog assembly and validation     | `src/data/seedCatalog.ts`                                              |
| Drainable-product selection         | `src/data/seedCatalog.ts` and `src/components/catalog/catalogModel.ts` |
| Ramp accessories                    | `src/data/accessories/rampSeed.ts`                                     |
| Shipping rules                      | `src/data/shippingSeed.ts`                                             |

The planner filters the full seed catalog to products with an `open-drainable` top surface. Closed
products can remain in historical seed data and tests without becoming selectable planner options.
`src/data/drainableCatalog.test.ts` pins the expected selectable product list so filtering changes
cannot silently broaden the catalog.

## Updating a product

1. Open the existing source links and confirm the product still exists.
2. Verify dimensions, thickness, rotation behavior, color names, surface style, drainage evidence,
   package quantities, prices, and product codes.
3. Record a new checked-date constant in `src/data/seedTypes.ts`.
4. Add that date to `CATALOG_CHECKED_DATES`.
5. Update the product seed and every changed source reference.
6. Update or remove stale remote image references. Images must remain remote, visibly attributed,
   and excluded from exports.
7. Check whether a published shipping rule or transition ramp applies.
8. Run the catalog tests and full verification workflow.

Do not update a record's checked date unless its supporting sources were actually reviewed.

## Adding a manufacturer or product

Add a manufacturer seed under `src/data/manufacturers/` and register it in
`src/data/seedCatalog.ts`. Stable IDs must be unique and use kebab case. Source host allowlists must
cover every fact and image URL used by that seed.

Every product needs:

- verified dimensions
- a documented rotation rationale
- a published color list
- a drainage classification with evidence
- at least one dated price observation
- seller and sale-basis details
- source host validation

Add focused tests for the new records. The existing catalog suite checks duplicate IDs, source
hosts, dates, package coverage, palette references, price structure, image rights metadata, and
drainage classification.

## Shipping and tax

Shipping rules live in `src/data/shippingSeed.ts`. Add a rule only when the seller publishes enough
information to determine the charge for the modeled order and destination. Otherwise return an
unknown cost with a plain explanation.

The planner uses the Illinois state rate of 6.25% as a planning assumption. It does not attempt to
model local rates, seller nexus, exemptions, or whether a seller taxes shipping.

## Validation commands

Run all commands inside Docker:

```sh
docker compose run --rm toolchain npm ci
docker compose run --rm toolchain npm test -- src/data
docker compose run --rm toolchain npm run verify
docker compose run --rm e2e
```
