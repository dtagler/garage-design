import { describe, expect, it } from 'vitest';
import {
  buildGridFit,
  buildMaterialSummary,
  filterCatalogEntries,
  findCatalogEntry,
  listApplicableOffers,
  listCatalogEntries,
  listTileSizeOptions,
  normalizeOfferPricing,
  offerSelectionKey,
  parsePriceOverrideDraft,
  parseWasteAllowance,
  resolveEffectiveOffer,
  selectOfferForColor,
  DEFAULT_CATALOG_FILTER,
} from './catalogModel';
import { findSeedProduct } from '../../data';
import { DEFAULT_CATALOG_OVERRIDES, DEFAULT_GARAGE_DIMENSIONS } from '../../domain/persistence';
import type { CatalogOverrides } from '../../domain/catalog';
import type { LayoutCell } from '../../domain/persistence';

const entries = listCatalogEntries();

function requireSeedProduct(productId: string) {
  const seedProduct = findSeedProduct(productId);
  if (!seedProduct) throw new Error(`The seed catalog should contain "${productId}".`);
  return seedProduct;
}

function layoutOf(cells: readonly Omit<LayoutCell, 'id'>[]) {
  return {
    cellsById: Object.fromEntries(
      cells.map((cell) => {
        const id = `${String(cell.column)}-${String(cell.row)}`;
        return [id, { ...cell, id }];
      })
    ),
  };
}

describe('catalogModel', () => {
  it('lists every seeded manufacturer and the distinct tile sizes', () => {
    expect(new Set(entries.map((entry) => entry.manufacturer.name))).toEqual(
      new Set([
        'Swisstrax',
        'RaceDeck',
        'VEVOR',
        'TechFloor',
        'ModuTile',
        'Greatmats',
        'FlooringInc',
        'TrueLock',
      ])
    );
    expect(listTileSizeOptions(entries)).toEqual([12, 12.12, 15.75, 18, 20.2]);
  });

  it('filters by manufacturer, tile size, and free text', () => {
    expect(
      filterCatalogEntries(entries, { ...DEFAULT_CATALOG_FILTER, manufacturerId: 'racedeck' })
    ).toHaveLength(7);
    expect(
      filterCatalogEntries(entries, { ...DEFAULT_CATALOG_FILTER, tileSize: '20.2' }).map(
        (entry) => entry.seedProduct.product.id
      )
    ).toEqual(['vevor-garage-floor-tiles-interlocking-20in']);
    expect(
      filterCatalogEntries(entries, { ...DEFAULT_CATALOG_FILTER, search: 'techfloor' }).map(
        (entry) => entry.seedProduct.product.id
      )
    ).toEqual(['techfloor-solid-raised-squares']);
    expect(findCatalogEntry(entries, 'not-a-product')).toBeNull();
  });

  it('normalizes per-tile and per-square-foot prices for tile and pack listings', () => {
    const ribtrax = requireSeedProduct('swisstrax-ribtrax-pro');
    const perTile = normalizeOfferPricing(ribtrax.prices[0].price, ribtrax.product.dimensions);

    expect(perTile.perTileCents).toBe(858);
    // A 15.75 inch square tile covers 1.7227 sq ft.
    expect(perTile.perSquareFootCents).toBeCloseTo(498.07, 2);

    const techfloor = requireSeedProduct('techfloor-solid-raised-squares');
    const perPack = normalizeOfferPricing(techfloor.prices[0].price, techfloor.product.dimensions);

    expect(perPack.perTileCents).toBeCloseTo(273.6, 5);
    expect(perPack.perSquareFootCents).toBeCloseTo(273.6, 5);
  });

  it('only offers color-specific listings to the color they were read for', () => {
    const vevor = requireSeedProduct('vevor-garage-tiles-interlocking-12in');
    const blackId = 'vevor-garage-tiles-interlocking-12in-black';
    const redId = 'vevor-garage-tiles-interlocking-12in-red';

    const blackOffer = selectOfferForColor(vevor, blackId, undefined);
    expect(blackOffer?.price.colorId).toBe(blackId);

    // A red listing must not be applied to the black tile.
    const rejected = selectOfferForColor(
      vevor,
      blackId,
      'vevor-garage-tiles-interlocking-12in-pack-50-red'
    );
    expect(rejected?.price.colorId).toBe(blackId);

    const redOffer = selectOfferForColor(vevor, redId, undefined);
    expect(redOffer?.price.colorId).toBe(redId);

    // A tile with no color chosen must not borrow any color's listing.
    expect(selectOfferForColor(vevor, undefined, undefined)).toBeUndefined();
    expect(listApplicableOffers(vevor, undefined)).toEqual([]);
  });

  it('exposes verified purchase options instead of treating a pack price as a tile price', () => {
    const productId = 'vevor-garage-tiles-interlocking-12in';
    const summary = buildMaterialSummary({
      layout: layoutOf([
        {
          column: 0,
          row: 0,
          productId,
          colorId: `${productId}-blue`,
          orientation: 0,
        },
      ]),
      wasteAllowancePercent: 0,
      overrides: DEFAULT_CATALOG_OVERRIDES,
      offerIdBySelection: {},
    });

    const purchase = summary.lines[0]?.purchase;
    expect(purchase).toMatchObject({
      requiredTileCount: 1,
      totalPurchasedTileCount: 25,
      leftoverTileCount: 24,
      totalCostCents: 4690,
      canBuyIndividually: false,
    });
    expect(purchase?.packPurchases[0]?.offer.price.id).toBe(`${productId}-pack-25-blue`);
  });

  it('applies a price override without losing the seeded source metadata', () => {
    const ribtrax = requireSeedProduct('swisstrax-ribtrax-pro');
    const seeded = ribtrax.prices[0];
    const overrides: CatalogOverrides = {
      priceOverridesById: {
        [seeded.price.id]: {
          priceId: seeded.price.id,
          priceCents: 999,
          saleUnit: 'tile',
          sourceUrl: seeded.price.sourceUrl,
          checkedDate: '2026-07-28',
        },
      },
    };

    const effective = resolveEffectiveOffer(seeded, overrides);

    expect(effective.isOverridden).toBe(true);
    expect(effective.offer.price.priceCents).toBe(999);
    expect(effective.offer.basisLabel).toBe('per tile');
    expect(effective.offer.seller).toBe(seeded.seller);
    expect(effective.seeded.price.priceCents).toBe(858);
    expect(resolveEffectiveOffer(seeded, DEFAULT_CATALOG_OVERRIDES).isOverridden).toBe(false);
  });

  it('reports grid fit for the 230 by 246 inch garage', () => {
    const fit = buildGridFit(
      DEFAULT_GARAGE_DIMENSIONS,
      requireSeedProduct('vevor-garage-floor-tiles-interlocking-20in'),
      0
    );

    expect(fit.grid.fullColumns).toBe(11);
    expect(fit.grid.fullRows).toBe(12);
    expect(fit.grid.widthRemainderInches).toBeCloseTo(7.8, 6);
    expect(fit.grid.lengthRemainderInches).toBeCloseTo(3.6, 6);
    expect(fit.grid.cutTileCount).toBe(24);
    expect(fit.editorGrid).toEqual({ columns: 11, rows: 12 });
  });

  it('totals materials by product and color using the calculation engine', () => {
    const summary = buildMaterialSummary({
      layout: layoutOf([
        {
          column: 0,
          row: 0,
          productId: 'swisstrax-ribtrax-pro',
          colorId: 'swisstrax-ribtrax-pro-pearl-silver',
          orientation: 0,
        },
        {
          column: 1,
          row: 0,
          productId: 'swisstrax-ribtrax-pro',
          colorId: 'swisstrax-ribtrax-pro-pearl-silver',
          orientation: 0,
        },
        {
          column: 2,
          row: 0,
          productId: 'swisstrax-ribtrax-pro',
          colorId: 'swisstrax-ribtrax-pro-jet-black',
          orientation: 0,
        },
      ]),
      wasteAllowancePercent: 10,
      overrides: DEFAULT_CATALOG_OVERRIDES,
      offerIdBySelection: {},
    });

    expect(summary.placedTileCount).toBe(3);
    expect(summary.lines.map((line) => line.colorName)).toEqual(['Jet Black', 'Pearl Silver']);
    // Two tiles plus 10% rounds up to three; one tile plus 10% rounds up to two.
    expect(summary.requiredTileCount).toBe(5);
    expect(summary.totalCostCents).toBe(5 * 858);
    expect(summary.issues).toEqual([]);
  });

  it('keeps offer choices per color so one pick cannot re-price another color', () => {
    const productId = 'vevor-garage-tiles-interlocking-12in';
    const silverId = `${productId}-silver`;
    const blackId = `${productId}-black`;

    const summary = buildMaterialSummary({
      layout: layoutOf([
        { column: 0, row: 0, productId, colorId: silverId, orientation: 0 },
        { column: 1, row: 0, productId, colorId: blackId, orientation: 0 },
      ]),
      wasteAllowancePercent: 0,
      overrides: DEFAULT_CATALOG_OVERRIDES,
      offerIdBySelection: {
        [offerSelectionKey(productId, silverId)]: `${productId}-pack-25-silver`,
      },
    });

    const [black, silver] = summary.lines;
    expect(black?.offer?.price.id).toBe(`${productId}-pack-50-black`);
    expect(silver?.offer?.price.id).toBe(`${productId}-pack-25-silver`);
    // The selected offer remains visible for traceability, while the total uses every verified
    // offer that applies to the same color. A Black 25-pack is cheaper than its selected 50-pack.
    expect(summary.totalCostCents).toBe(5190 + 5090);
  });

  it('flags tiles left at a different size after a grid conversion', () => {
    const summary = buildMaterialSummary({
      layout: layoutOf([
        {
          column: 0,
          row: 0,
          productId: 'swisstrax-ribtrax-pro',
          colorId: 'swisstrax-ribtrax-pro-pearl-silver',
          orientation: 0,
        },
      ]),
      wasteAllowancePercent: 0,
      overrides: DEFAULT_CATALOG_OVERRIDES,
      offerIdBySelection: {},
      cellSizeInches: 12,
    });

    expect(summary.issues).toEqual([
      'Ribtrax PRO (Standard Colors) is 15.75 in wide but the grid is 12 in, so 1 Pearl Silver ' +
        'tile carried over from an earlier conversion. Repaint them to price the floor as it ' +
        'will be built.',
    ]);
    // The tiles are still priced as themselves rather than being dropped.
    expect(summary.totalCostCents).toBe(858);
  });

  it('reports a catalog product that no longer exists instead of silently dropping it', () => {
    const summary = buildMaterialSummary({
      layout: layoutOf([{ column: 0, row: 0, productId: 'retired-tile', orientation: 0 }]),
      wasteAllowancePercent: 10,
      overrides: DEFAULT_CATALOG_OVERRIDES,
      offerIdBySelection: {},
    });

    expect(summary.issues).toEqual([
      '"retired-tile" is no longer in the catalog, so it cannot be priced.',
    ]);
    expect(summary.totalCostCents).toBeNull();
  });

  it('does not borrow a catalog-wide offer for a color removed from the catalog', () => {
    const summary = buildMaterialSummary({
      layout: layoutOf([
        {
          column: 0,
          row: 0,
          productId: 'swisstrax-ribtrax-pro',
          colorId: 'swisstrax-ribtrax-pro-retired-color',
          orientation: 0,
        },
      ]),
      wasteAllowancePercent: 0,
      overrides: DEFAULT_CATALOG_OVERRIDES,
      offerIdBySelection: {},
    });

    expect(summary.totalCostCents).toBeNull();
    expect(summary.lines[0]?.issue).toMatch(/not a current color/i);
  });

  it('validates price override input', () => {
    const draft = {
      priceId: 'swisstrax-ribtrax-pro-tile',
      amount: '9.25',
      packQuantity: '',
      saleUnit: 'tile' as const,
      sourceUrl: 'https://store.swisstrax.com/products/ribtrax',
      checkedDate: '2026-07-28',
    };

    const accepted = parsePriceOverrideDraft(draft);
    expect(accepted).toEqual({
      ok: true,
      value: {
        priceId: draft.priceId,
        priceCents: 925,
        saleUnit: 'tile',
        sourceUrl: draft.sourceUrl,
        checkedDate: draft.checkedDate,
      },
    });

    expect(parsePriceOverrideDraft({ ...draft, amount: '' })).toEqual({
      ok: false,
      message: 'Enter a price in dollars, for example 8.58.',
    });
    expect(parsePriceOverrideDraft({ ...draft, amount: '-4' })).toEqual({
      ok: false,
      message: 'Enter a price in dollars with at most two decimal places.',
    });
    expect(parsePriceOverrideDraft({ ...draft, amount: '0' })).toEqual({
      ok: false,
      message: 'Enter a price greater than zero.',
    });
    expect(parsePriceOverrideDraft({ ...draft, saleUnit: 'pack', packQuantity: 'ten' })).toEqual({
      ok: false,
      message: 'Enter how many tiles are in one pack, as a whole number greater than zero.',
    });
  });

  it('validates the waste allowance with the persistence rule', () => {
    expect(parseWasteAllowance('12.5')).toEqual({ ok: true, value: 12.5 });
    expect(parseWasteAllowance('0')).toEqual({ ok: true, value: 0 });
    expect(parseWasteAllowance('101')).toEqual({
      ok: false,
      message: 'Waste allowance must be between 0 and 100 percent.',
    });
    expect(parseWasteAllowance('abc')).toEqual({
      ok: false,
      message: 'Waste allowance must be between 0 and 100 percent.',
    });
  });
});
