import { describe, expect, it } from 'vitest';
import { findSeedProduct } from '../data';
import type { ProductPrice } from '../domain/catalog';
import { optimizeTilePurchase, type TilePurchaseOffer } from './purchaseOptions';

const PRODUCT_ID = 'example-tile';
const COLOR_ID = 'example-tile-blue';

function offer(
  id: string,
  priceCents: number,
  saleUnit: ProductPrice['saleUnit'],
  packQuantity?: number,
  colorId: string | undefined = COLOR_ID
): TilePurchaseOffer {
  return {
    price: {
      id,
      productId: PRODUCT_ID,
      ...(colorId === undefined ? {} : { colorId }),
      priceCents,
      saleUnit,
      ...(packQuantity === undefined ? {} : { packQuantity }),
      sourceUrl: `https://example.com/${id}`,
      checkedDate: '2026-07-28',
    },
    seller: 'Example seller',
    sourceKind: 'retailer-listing',
    basisLabel:
      saleUnit === 'tile'
        ? 'per tile'
        : saleUnit === 'pack'
          ? `per pack of ${String(packQuantity)} tiles`
          : 'per square foot',
  };
}

function seedProduct(productId: string) {
  const product = findSeedProduct(productId);
  if (!product) throw new Error(`Expected ${productId} in the seed catalog.`);
  return product;
}

describe('optimizeTilePurchase', () => {
  it('uses verified premium individual-tile offers without inventing a pack', () => {
    const swisstrax = seedProduct('swisstrax-ribtrax-pro');
    const result = optimizeTilePurchase({
      productId: swisstrax.product.id,
      colorId: `${swisstrax.product.id}-jet-black`,
      requiredTileCount: 3,
      offers: swisstrax.prices,
    });

    expect(result).toMatchObject({
      status: 'optimized',
      canBuyIndividually: true,
      individualTileCount: 3,
      totalPurchasedTileCount: 3,
      leftoverTileCount: 0,
      totalCostCents: 2574,
    });
    expect(result.packPurchases).toEqual([]);
    expect(result.individualPurchases[0]?.offer.seller).toBe('Swisstrax');
  });

  it('mixes VEVOR’s verified 25- and 50-packs when that is cheapest', () => {
    const vevor = seedProduct('vevor-garage-tiles-interlocking-12in');
    const result = optimizeTilePurchase({
      productId: vevor.product.id,
      colorId: `${vevor.product.id}-blue`,
      requiredTileCount: 75,
      offers: vevor.prices,
    });

    expect(result.canBuyIndividually).toBe(false);
    expect(
      result.packPurchases.map((purchase) => [purchase.tilesPerPack, purchase.packCount])
    ).toEqual([
      [25, 1],
      [50, 1],
    ]);
    expect(result.totalCostCents).toBe(13480);
    expect(result.leftoverTileCount).toBe(0);
  });

  it('optimizes the VEVOR drainage mat’s color-specific pack sizes and leftovers', () => {
    const vevor = seedProduct('vevor-interlocking-drainage-mat-12in');

    const lightGray = optimizeTilePurchase({
      productId: vevor.product.id,
      colorId: `${vevor.product.id}-light-gray`,
      requiredTileCount: 75,
      offers: vevor.prices,
    });
    const black = optimizeTilePurchase({
      productId: vevor.product.id,
      colorId: `${vevor.product.id}-black`,
      requiredTileCount: 75,
      offers: vevor.prices,
    });

    expect(
      lightGray.packPurchases.map((purchase) => [purchase.tilesPerPack, purchase.packCount])
    ).toEqual([
      [24, 1],
      [55, 1],
    ]);
    expect(lightGray).toMatchObject({
      canBuyIndividually: false,
      totalPurchasedTileCount: 79,
      leftoverTileCount: 4,
      totalCostCents: 12_580,
    });
    expect(
      black.packPurchases.map((purchase) => [purchase.tilesPerPack, purchase.packCount])
    ).toEqual([
      [24, 1],
      [55, 1],
    ]);
    expect(black).toMatchObject({
      canBuyIndividually: false,
      totalPurchasedTileCount: 79,
      leftoverTileCount: 4,
      totalCostCents: 12_480,
    });
  });

  it('rounds TechFloor cartons up and reports leftovers', () => {
    const techfloor = seedProduct('techfloor-solid-raised-squares');
    const result = optimizeTilePurchase({
      productId: techfloor.product.id,
      colorId: `${techfloor.product.id}-red`,
      requiredTileCount: 23,
      offers: techfloor.prices,
    });

    expect(result.packPurchases).toMatchObject([{ packCount: 3, tilesPerPack: 10 }]);
    expect(result.totalPurchasedTileCount).toBe(30);
    expect(result.leftoverTileCount).toBe(7);
    expect(result.totalCostCents).toBe(8208);
  });

  it('combines packs and individual tiles when that costs less than another pack', () => {
    const result = optimizeTilePurchase({
      productId: PRODUCT_ID,
      colorId: COLOR_ID,
      requiredTileCount: 13,
      offers: [offer('pack-10', 800, 'pack', 10), offer('individual', 100, 'tile')],
    });

    expect(result.packPurchases).toMatchObject([{ packCount: 1, tilesPerPack: 10 }]);
    expect(result.individualTileCount).toBe(3);
    expect(result.totalCostCents).toBe(1100);
  });

  it('chooses among multiple pack sizes and minimizes pack-only leftovers', () => {
    const result = optimizeTilePurchase({
      productId: PRODUCT_ID,
      colorId: COLOR_ID,
      requiredTileCount: 11,
      offers: [offer('pack-10', 500, 'pack', 10), offer('pack-6', 330, 'pack', 6)],
    });

    expect(result.packPurchases).toMatchObject([
      { offer: { price: { id: 'pack-6' } }, packCount: 2 },
    ]);
    expect(result.totalPurchasedTileCount).toBe(12);
    expect(result.leftoverTileCount).toBe(1);
    expect(result.totalCostCents).toBe(660);
  });

  it('never applies another color’s offer and reports square-foot offers explicitly', () => {
    const result = optimizeTilePurchase({
      productId: PRODUCT_ID,
      colorId: COLOR_ID,
      requiredTileCount: 4,
      offers: [
        offer('red-pack', 100, 'pack', 10, 'example-tile-red'),
        offer('generic-square-foot', 299, 'square-foot', undefined, undefined),
      ],
    });

    expect(result.status).toBe('no-fixed-tile-offers');
    expect(result.totalCostCents).toBeNull();
    expect(result.excludedSquareFootOffers.map((entry) => entry.price.id)).toEqual([
      'generic-square-foot',
    ]);
  });

  it('handles zero quantities, rejects invalid offers, and breaks ties by offer id', () => {
    const invalid = offer('invalid-pack', 500, 'pack');
    const malformed = {
      ...invalid,
      price: { ...invalid.price, packQuantity: undefined },
    } as unknown as TilePurchaseOffer;
    const zero = optimizeTilePurchase({
      productId: PRODUCT_ID,
      colorId: COLOR_ID,
      requiredTileCount: 0,
      offers: [offer('beta', 500, 'pack', 10), offer('alpha', 500, 'pack', 10), malformed],
    });

    expect(zero.totalCostCents).toBe(0);
    expect(zero.packPurchases).toEqual([]);
    expect(zero.invalidOffers).toMatchObject([{ offer: { price: { id: 'invalid-pack' } } }]);

    expect(
      optimizeTilePurchase({
        productId: PRODUCT_ID,
        colorId: COLOR_ID,
        requiredTileCount: 0,
        offers: [offer('square-foot-only', 299, 'square-foot')],
      })
    ).toMatchObject({ status: 'optimized', totalCostCents: 0 });

    const tied = optimizeTilePurchase({
      productId: PRODUCT_ID,
      colorId: COLOR_ID,
      requiredTileCount: 10,
      offers: [offer('beta', 500, 'pack', 10), offer('alpha', 500, 'pack', 10)],
    });
    expect(tied.packPurchases[0]?.offer.price.id).toBe('alpha');
  });

  it('rejects an oversized pack instead of allocating an unbounded purchase table', () => {
    const result = optimizeTilePurchase({
      productId: PRODUCT_ID,
      colorId: COLOR_ID,
      requiredTileCount: 1,
      offers: [offer('oversized', 10_000, 'pack', 100_001)],
    });

    expect(result.status).toBe('no-applicable-offers');
    expect(result.invalidOffers[0]?.reason).toMatch(/optimization limit/);
  });
});
