import { describe, expect, it } from 'vitest';
import type { CatalogProduct, ProductPrice } from '../domain/catalog';
import {
  calculateCoverage,
  calculatePurchaseEstimate,
  calculateTileGrid,
  countLayoutTilesByProductAndColor,
  countTilesByProductAndColor,
  estimateTotalCost,
  getSelectedProductOrientation,
} from './estimate';

const squareTile: CatalogProduct = {
  id: 'square-tile',
  manufacturerId: 'example',
  name: 'Square Tile',
  dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.5 },
  rotationRule: 'quarter-turn',
};

const rectangularTile: CatalogProduct = {
  ...squareTile,
  id: 'rectangular-tile',
  dimensions: { widthInches: 12, lengthInches: 24, thicknessInches: 0.5 },
};

const tilePrice: ProductPrice = {
  id: 'square-tile-tile',
  productId: 'square-tile',
  priceCents: 799,
  saleUnit: 'tile',
  sourceUrl: 'https://example.com/tile',
  checkedDate: '2026-07-28',
};

describe('getSelectedProductOrientation', () => {
  it('rotates rectangular quarter-turn products and preserves the original dimensions otherwise', () => {
    expect(
      getSelectedProductOrientation(rectangularTile, {
        productId: 'rectangular-tile',
        orientation: 90,
      })
    ).toEqual({ widthInches: 24, lengthInches: 12 });
    expect(
      getSelectedProductOrientation(rectangularTile, {
        productId: 'rectangular-tile',
        orientation: 180,
      })
    ).toEqual({ widthInches: 12, lengthInches: 24 });
  });

  it('rejects invalid product matches and fixed-product rotations', () => {
    expect(() =>
      getSelectedProductOrientation(
        { ...rectangularTile, rotationRule: 'fixed' },
        { productId: 'rectangular-tile', orientation: 90 }
      )
    ).toThrow(RangeError);
    expect(() =>
      getSelectedProductOrientation(rectangularTile, {
        productId: 'another-tile',
        orientation: 0,
      })
    ).toThrow(RangeError);
  });
});

describe('calculateTileGrid', () => {
  it('calculates full rows, columns, edge cuts, and classifications for the default garage', () => {
    const grid = calculateTileGrid(
      { widthInches: 230, lengthInches: 246 },
      { widthInches: 12, lengthInches: 12 }
    );

    expect(grid).toEqual({
      fullColumns: 19,
      fullRows: 20,
      fullTileCount: 380,
      widthRemainderInches: 2,
      lengthRemainderInches: 6,
      rightEdgeCutTileCount: 20,
      bottomEdgeCutTileCount: 19,
      cornerCutTileCount: 1,
      interiorTileCount: 342,
      perimeterTileCount: 38,
      cutTileCount: 40,
      totalTileCount: 420,
    });
  });

  it('does not create cuts when a garage is exactly divisible by the tile dimensions', () => {
    expect(
      calculateTileGrid(
        { widthInches: 240, lengthInches: 240 },
        { widthInches: 12, lengthInches: 12 }
      )
    ).toMatchObject({
      fullColumns: 20,
      fullRows: 20,
      widthRemainderInches: 0,
      lengthRemainderInches: 0,
      perimeterTileCount: 76,
      cutTileCount: 0,
      totalTileCount: 400,
    });
  });

  it('treats exactly divisible decimal dimensions as full tiles', () => {
    expect(
      calculateTileGrid(
        { widthInches: 236.2, lengthInches: 236.2 },
        { widthInches: 23.62, lengthInches: 23.62 }
      )
    ).toMatchObject({
      fullColumns: 10,
      fullRows: 10,
      widthRemainderInches: 0,
      lengthRemainderInches: 0,
      cutTileCount: 0,
      totalTileCount: 100,
    });
  });

  it('handles a garage smaller than one tile and rejects zero or invalid dimensions', () => {
    expect(
      calculateTileGrid(
        { widthInches: 10, lengthInches: 10 },
        { widthInches: 12, lengthInches: 12 }
      )
    ).toMatchObject({ fullTileCount: 0, cutTileCount: 1, totalTileCount: 1 });
    expect(() =>
      calculateTileGrid({ widthInches: 0, lengthInches: 10 }, { widthInches: 12, lengthInches: 12 })
    ).toThrow(RangeError);
    expect(() =>
      calculateTileGrid(
        { widthInches: 10, lengthInches: 10 },
        { widthInches: Number.NaN, lengthInches: 12 }
      )
    ).toThrow(RangeError);
  });
});

describe('calculateCoverage', () => {
  it('reports exact garage coverage in square inches and square feet', () => {
    expect(
      calculateCoverage(
        { widthInches: 230, lengthInches: 246 },
        { widthInches: 12, lengthInches: 12 }
      )
    ).toMatchObject({
      garageSquareInches: 56580,
      garageSquareFeet: 392.9166666666667,
      fullTileSquareInches: 54720,
      cutTileSquareInches: 1860,
      totalCoveredSquareInches: 56580,
    });
  });
});

describe('tile counts', () => {
  it('combines same product colors, retains distinct colors, and sorts deterministically', () => {
    expect(
      countTilesByProductAndColor([
        { selection: { productId: 'tile', colorId: 'blue', orientation: 0 }, tileCount: 3 },
        { selection: { productId: 'tile', colorId: 'red', orientation: 0 }, tileCount: 2 },
        { selection: { productId: 'tile', colorId: 'blue', orientation: 90 }, tileCount: 4 },
      ])
    ).toEqual([
      { productId: 'tile', colorId: 'blue', tileCount: 7 },
      { productId: 'tile', colorId: 'red', tileCount: 2 },
    ]);
  });

  it('counts each populated layout cell without adding derived data to the layout', () => {
    expect(
      countLayoutTilesByProductAndColor({
        cellsById: {
          'cell-0-0': {
            id: 'cell-0-0',
            column: 0,
            row: 0,
            productId: 'tile',
            colorId: 'blue',
            orientation: 0,
          },
          'cell-1-0': {
            id: 'cell-1-0',
            column: 1,
            row: 0,
            productId: 'tile',
            colorId: 'red',
            orientation: 0,
          },
        },
      })
    ).toEqual([
      { productId: 'tile', colorId: 'blue', tileCount: 1 },
      { productId: 'tile', colorId: 'red', tileCount: 1 },
    ]);
  });
});

describe('calculatePurchaseEstimate and estimateTotalCost', () => {
  it('rounds waste and all sale units deterministically', () => {
    expect(calculatePurchaseEstimate(10, 10, squareTile, tilePrice)).toMatchObject({
      requiredTileCount: 11,
      wasteTileCount: 1,
      saleUnitQuantity: 11,
    });
    expect(
      calculatePurchaseEstimate(10, 10, squareTile, {
        ...tilePrice,
        saleUnit: 'pack',
        packQuantity: 6,
      })
    ).toMatchObject({ saleUnitQuantity: 2 });
    expect(
      calculatePurchaseEstimate(10, 10, squareTile, { ...tilePrice, saleUnit: 'square-foot' })
    ).toMatchObject({ saleUnitQuantity: 11 });
    expect(
      calculatePurchaseEstimate(
        3,
        10,
        {
          ...squareTile,
          dimensions: { ...squareTile.dimensions, widthInches: 24, lengthInches: 24 },
        },
        {
          ...tilePrice,
          saleUnit: 'square-foot',
        }
      )
    ).toMatchObject({ requiredTileCount: 4, saleUnitQuantity: 16 });
  });

  it('returns zero cost for zero tiles and integer cents for a priced purchase', () => {
    expect(estimateTotalCost(0, 0, squareTile, tilePrice)).toMatchObject({
      saleUnitQuantity: 0,
      totalCostCents: 0,
    });
    expect(estimateTotalCost(10, 10, squareTile, tilePrice)).toMatchObject({
      saleUnitQuantity: 11,
      totalCostCents: 8789,
    });
  });

  it('rejects invalid quantities, waste, and pack metadata', () => {
    expect(() => calculatePurchaseEstimate(-1, 10, squareTile, tilePrice)).toThrow(RangeError);
    expect(() => calculatePurchaseEstimate(1, 101, squareTile, tilePrice)).toThrow(RangeError);
    expect(() =>
      calculatePurchaseEstimate(1, 0, squareTile, { ...tilePrice, saleUnit: 'pack' })
    ).toThrow(RangeError);
  });
});
