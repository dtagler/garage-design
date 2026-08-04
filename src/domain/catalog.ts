export type ManufacturerId = string;
export type ProductId = string;
export type ProductColorId = string;
export type PriceId = string;

export type ProductRotationRule = 'fixed' | 'quarter-turn';
export type TileOrientation = 0 | 90 | 180 | 270;
export type SaleUnit = 'tile' | 'pack' | 'square-foot';

export interface Manufacturer {
  readonly id: ManufacturerId;
  readonly name: string;
}

export interface ProductDimensions {
  readonly widthInches: number;
  readonly lengthInches: number;
  readonly thicknessInches: number;
}

export interface CatalogProduct {
  readonly id: ProductId;
  readonly manufacturerId: ManufacturerId;
  readonly name: string;
  readonly dimensions: ProductDimensions;
  readonly rotationRule: ProductRotationRule;
}

export interface ProductColor {
  readonly id: ProductColorId;
  readonly productId: ProductId;
  readonly name: string;
  readonly swatchHex: string;
}

export interface ProductPrice {
  readonly id: PriceId;
  readonly productId: ProductId;
  readonly colorId?: ProductColorId;
  readonly priceCents: number;
  readonly saleUnit: SaleUnit;
  readonly packQuantity?: number;
  readonly sourceUrl: string;
  readonly checkedDate: string;
}

export interface EditablePriceOverride {
  readonly priceId: PriceId;
  readonly priceCents: number;
  readonly saleUnit: SaleUnit;
  readonly packQuantity?: number;
  readonly sourceUrl: string;
  readonly checkedDate: string;
}

export interface CatalogOverrides {
  readonly priceOverridesById: Readonly<Record<PriceId, EditablePriceOverride>>;
}

export const SALE_UNITS = ['tile', 'pack', 'square-foot'] as const;
export const TILE_ORIENTATIONS = [0, 90, 180, 270] as const;

export class DomainValidationError extends Error {
  public readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'DomainValidationError';
    this.path = path;
  }
}

export function parseManufacturer(value: unknown): Manufacturer {
  const record = expectRecord(value, 'manufacturer');

  return {
    id: readId(record, 'id', 'manufacturer.id'),
    name: readNonEmptyString(record, 'name', 'manufacturer.name'),
  };
}

export function parseCatalogProduct(value: unknown): CatalogProduct {
  const record = expectRecord(value, 'product');
  const dimensions = expectRecord(record.dimensions, 'product.dimensions');

  return {
    id: readId(record, 'id', 'product.id'),
    manufacturerId: readId(record, 'manufacturerId', 'product.manufacturerId'),
    name: readNonEmptyString(record, 'name', 'product.name'),
    dimensions: {
      widthInches: readPositiveNumber(dimensions, 'widthInches', 'product.dimensions.widthInches'),
      lengthInches: readPositiveNumber(
        dimensions,
        'lengthInches',
        'product.dimensions.lengthInches'
      ),
      thicknessInches: readPositiveNumber(
        dimensions,
        'thicknessInches',
        'product.dimensions.thicknessInches'
      ),
    },
    rotationRule: readRotationRule(record, 'rotationRule', 'product.rotationRule'),
  };
}

export function parseProductColor(value: unknown): ProductColor {
  const record = expectRecord(value, 'productColor');

  return {
    id: readId(record, 'id', 'productColor.id'),
    productId: readId(record, 'productId', 'productColor.productId'),
    name: readNonEmptyString(record, 'name', 'productColor.name'),
    swatchHex: readHexColor(record, 'swatchHex', 'productColor.swatchHex'),
  };
}

export function parseProductPrice(value: unknown): ProductPrice {
  const record = expectRecord(value, 'productPrice');
  const colorId = readOptionalId(record, 'colorId', 'productPrice.colorId');

  return {
    id: readId(record, 'id', 'productPrice.id'),
    productId: readId(record, 'productId', 'productPrice.productId'),
    ...(colorId === undefined ? {} : { colorId }),
    ...readPriceFields(record, 'productPrice'),
  };
}

export function parseEditablePriceOverride(value: unknown): EditablePriceOverride {
  const record = expectRecord(value, 'editablePriceOverride');

  return {
    priceId: readId(record, 'priceId', 'editablePriceOverride.priceId'),
    ...readPriceFields(record, 'editablePriceOverride'),
  };
}

export function isOrientationAllowed(
  rotationRule: ProductRotationRule,
  orientation: TileOrientation
): boolean {
  return rotationRule === 'quarter-turn' || orientation === 0;
}

function readPriceFields(
  record: UnknownRecord,
  path: string
): Pick<ProductPrice, 'priceCents' | 'saleUnit' | 'packQuantity' | 'sourceUrl' | 'checkedDate'> {
  const saleUnit = readSaleUnit(record, 'saleUnit', `${path}.saleUnit`);
  const packQuantity = readPackQuantity(record, saleUnit, path);

  return {
    priceCents: readPositiveInteger(record, 'priceCents', `${path}.priceCents`),
    saleUnit,
    ...(packQuantity === undefined ? {} : { packQuantity }),
    sourceUrl: readHttpUrl(record, 'sourceUrl', `${path}.sourceUrl`),
    checkedDate: readIsoDate(record, 'checkedDate', `${path}.checkedDate`),
  };
}

function readPackQuantity(
  record: UnknownRecord,
  saleUnit: SaleUnit,
  path: string
): number | undefined {
  if (saleUnit === 'pack') {
    return readPositiveInteger(record, 'packQuantity', `${path}.packQuantity`);
  }

  if (record.packQuantity !== undefined) {
    throw new DomainValidationError(
      `${path}.packQuantity`,
      'is only valid when saleUnit is "pack"'
    );
  }

  return undefined;
}

type UnknownRecord = Record<string, unknown>;

function expectRecord(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainValidationError(path, 'must be an object');
  }

  return value as UnknownRecord;
}

function readId(record: UnknownRecord, key: string, path: string): string {
  const value = readNonEmptyString(record, key, path);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new DomainValidationError(path, 'must be a lowercase kebab-case stable identifier');
  }

  return value;
}

function readOptionalId(record: UnknownRecord, key: string, path: string): string | undefined {
  if (record[key] === undefined) {
    return undefined;
  }

  return readId(record, key, path);
}

function readNonEmptyString(record: UnknownRecord, key: string, path: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainValidationError(path, 'must be a non-empty string');
  }

  return value;
}

function readPositiveNumber(record: UnknownRecord, key: string, path: string): number {
  const value = record[key];

  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new DomainValidationError(path, 'must be a finite number greater than zero');
  }

  return value;
}

function readPositiveInteger(record: UnknownRecord, key: string, path: string): number {
  const value = record[key];

  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new DomainValidationError(path, 'must be a positive safe integer');
  }

  return value;
}

function readRotationRule(record: UnknownRecord, key: string, path: string): ProductRotationRule {
  const value = record[key];

  if (value !== 'fixed' && value !== 'quarter-turn') {
    throw new DomainValidationError(path, 'must be "fixed" or "quarter-turn"');
  }

  return value;
}

function readSaleUnit(record: UnknownRecord, key: string, path: string): SaleUnit {
  const value = record[key];

  if (!SALE_UNITS.includes(value as SaleUnit)) {
    throw new DomainValidationError(path, 'must be "tile", "pack", or "square-foot"');
  }

  return value as SaleUnit;
}

function readHexColor(record: UnknownRecord, key: string, path: string): string {
  const value = readNonEmptyString(record, key, path);

  if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new DomainValidationError(path, 'must be a six-digit hexadecimal color');
  }

  return value;
}

function readHttpUrl(record: UnknownRecord, key: string, path: string): string {
  const value = readNonEmptyString(record, key, path);

  try {
    const url = new URL(value);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new DomainValidationError(path, 'must use http or https');
    }
  } catch (error) {
    if (error instanceof DomainValidationError) {
      throw error;
    }

    throw new DomainValidationError(path, 'must be a valid URL');
  }

  return value;
}

function readIsoDate(record: UnknownRecord, key: string, path: string): string {
  const value = readNonEmptyString(record, key, path);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainValidationError(path, 'must be an ISO calendar date (YYYY-MM-DD)');
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new DomainValidationError(path, 'must be a real calendar date');
  }

  return value;
}
