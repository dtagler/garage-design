import { describe, expect, it } from 'vitest';
import {
  DomainValidationError,
  parseCatalogProduct,
  parseProductPrice,
  parseProductColor,
} from './catalog';

describe('parseCatalogProduct', () => {
  it('accepts a product with a stable id and quarter-turn rotation', () => {
    expect(
      parseCatalogProduct({
        id: 'swisstrax-ribtrax-pro',
        manufacturerId: 'swisstrax',
        name: 'Ribtrax Pro',
        dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.75 },
        rotationRule: 'quarter-turn',
      })
    ).toEqual({
      id: 'swisstrax-ribtrax-pro',
      manufacturerId: 'swisstrax',
      name: 'Ribtrax Pro',
      dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.75 },
      rotationRule: 'quarter-turn',
    });
  });

  it('rejects an invalid product rotation rule', () => {
    expect(() =>
      parseCatalogProduct({
        id: 'swisstrax-ribtrax-pro',
        manufacturerId: 'swisstrax',
        name: 'Ribtrax Pro',
        dimensions: { widthInches: 12, lengthInches: 12, thicknessInches: 0.75 },
        rotationRule: 'diagonal',
      })
    ).toThrow(DomainValidationError);
  });

  it('accepts product colors and pack prices with integer cents', () => {
    expect(
      parseProductColor({
        id: 'swisstrax-ribtrax-pro-graphite',
        productId: 'swisstrax-ribtrax-pro',
        name: 'Graphite',
        swatchHex: '#3D3D3D',
      })
    ).toMatchObject({ id: 'swisstrax-ribtrax-pro-graphite', swatchHex: '#3D3D3D' });

    expect(
      parseProductPrice({
        id: 'swisstrax-ribtrax-pro-graphite-pack',
        productId: 'swisstrax-ribtrax-pro',
        colorId: 'swisstrax-ribtrax-pro-graphite',
        priceCents: 4599,
        saleUnit: 'pack',
        packQuantity: 6,
        sourceUrl: 'https://example.com/ribtrax-pro',
        checkedDate: '2026-07-28',
      })
    ).toMatchObject({ priceCents: 4599, saleUnit: 'pack', packQuantity: 6 });
  });

  it('omits an absent optional color id from a tile price', () => {
    expect(
      parseProductPrice({
        id: 'swisstrax-ribtrax-pro-tile',
        productId: 'swisstrax-ribtrax-pro',
        priceCents: 799,
        saleUnit: 'tile',
        sourceUrl: 'https://example.com/ribtrax-pro',
        checkedDate: '2026-07-28',
      })
    ).not.toHaveProperty('colorId');
  });

  it('rejects fractional cents and pack quantities on individual tile prices', () => {
    expect(() =>
      parseProductPrice({
        id: 'swisstrax-ribtrax-pro-tile',
        productId: 'swisstrax-ribtrax-pro',
        priceCents: 7.99,
        saleUnit: 'tile',
        sourceUrl: 'https://example.com/ribtrax-pro',
        checkedDate: '2026-07-28',
      })
    ).toThrow('productPrice.priceCents');

    expect(() =>
      parseProductPrice({
        id: 'swisstrax-ribtrax-pro-tile',
        productId: 'swisstrax-ribtrax-pro',
        priceCents: 799,
        saleUnit: 'tile',
        packQuantity: 6,
        sourceUrl: 'https://example.com/ribtrax-pro',
        checkedDate: '2026-07-28',
      })
    ).toThrow('productPrice.packQuantity');
  });
});
