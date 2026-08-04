import {
  DomainValidationError,
  parseEditablePriceOverride,
  type CatalogOverrides,
  type ProductColorId,
  type ProductId,
  type TileOrientation,
} from './catalog';

export type DesignId = string;
export type LayoutCellId = string;
export type ReferenceTemplateId = string;

export interface ReferenceRoleColors {
  readonly base?: string;
  readonly border?: string;
  readonly accent?: string;
  readonly secondary?: string;
}

export interface GarageDimensions {
  readonly widthInches: number;
  readonly lengthInches: number;
}

export interface ApplicationSettings {
  readonly wasteAllowancePercent: number;
}

export interface ProductSelection {
  readonly productId: ProductId;
  readonly colorId?: ProductColorId;
  readonly orientation: TileOrientation;
}

export interface LayoutCell extends ProductSelection {
  readonly id: LayoutCellId;
  readonly column: number;
  readonly row: number;
}

export interface FloorLayout {
  readonly cellSizeInches: number;
  readonly cellsById: Readonly<Record<LayoutCellId, LayoutCell>>;
  readonly selectedProduct: ProductSelection | null;
}

export interface DesignMetadata {
  readonly id: DesignId;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly referenceTemplateId?: ReferenceTemplateId;
  readonly referenceRoleColors?: ReferenceRoleColors;
}

export interface DesignDocument {
  readonly metadata: DesignMetadata;
  readonly garage: GarageDimensions;
  readonly layout: FloorLayout;
}

export interface PersistedAppStateV0 {
  readonly schemaVersion: 0;
  readonly settings?: ApplicationSettings;
  readonly activeDraft?: DesignDocument | null;
  readonly savedDesigns?: readonly DesignDocument[];
  readonly catalogOverrides?: CatalogOverrides;
}

export interface PersistedAppStateV1 {
  readonly schemaVersion: 1;
  readonly settings: ApplicationSettings;
  readonly activeDraft: DesignDocument | null;
  readonly savedDesignsById: Readonly<Record<DesignId, DesignDocument>>;
  readonly catalogOverrides: CatalogOverrides;
}

export type PersistedAppState = PersistedAppStateV1;

export const PERSISTED_APP_STATE_SCHEMA_VERSION = 1;

export const DEFAULT_GARAGE_DIMENSIONS: Readonly<GarageDimensions> = Object.freeze({
  widthInches: 230,
  lengthInches: 246,
});

export const DEFAULT_APPLICATION_SETTINGS: Readonly<ApplicationSettings> = Object.freeze({
  wasteAllowancePercent: 10,
});

export const DEFAULT_CATALOG_OVERRIDES: Readonly<CatalogOverrides> = Object.freeze({
  priceOverridesById: Object.freeze({}),
});

export class PersistenceVersionError extends Error {
  public readonly version: unknown;

  constructor(version: unknown, message: string) {
    super(message);
    this.name = 'PersistenceVersionError';
    this.version = version;
  }
}

export function parsePersistedAppState(value: unknown): PersistedAppState {
  const record = expectRecord(value, 'persistedAppState');
  const schemaVersion = record.schemaVersion;

  if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion)) {
    throw new PersistenceVersionError(
      schemaVersion,
      'Persisted state must declare an integer schemaVersion.'
    );
  }

  if (schemaVersion === PERSISTED_APP_STATE_SCHEMA_VERSION) {
    return parsePersistedAppStateV1(record);
  }

  if (schemaVersion === 0) {
    return migratePersistedAppStateV0(parsePersistedAppStateV0(record));
  }

  if (schemaVersion > PERSISTED_APP_STATE_SCHEMA_VERSION) {
    throw new PersistenceVersionError(
      schemaVersion,
      `Persisted state version ${schemaVersion} is newer than supported version ${PERSISTED_APP_STATE_SCHEMA_VERSION}.`
    );
  }

  throw new PersistenceVersionError(
    schemaVersion,
    `Persisted state version ${schemaVersion} is unsupported.`
  );
}

export function migratePersistedAppStateV0(value: PersistedAppStateV0): PersistedAppStateV1 {
  const savedDesignsById = createRecord<DesignId, DesignDocument>();

  for (const design of value.savedDesigns ?? []) {
    const id = design.metadata.id;
    if (savedDesignsById[id] !== undefined) {
      throw new DomainValidationError(
        'persistedAppState.savedDesigns',
        `contains duplicate id "${id}"`
      );
    }
    savedDesignsById[id] = design;
  }

  return {
    schemaVersion: PERSISTED_APP_STATE_SCHEMA_VERSION,
    settings: value.settings ?? DEFAULT_APPLICATION_SETTINGS,
    activeDraft: value.activeDraft ?? null,
    savedDesignsById,
    catalogOverrides: value.catalogOverrides ?? DEFAULT_CATALOG_OVERRIDES,
  };
}

function parsePersistedAppStateV0(record: UnknownRecord): PersistedAppStateV0 {
  return {
    schemaVersion: 0,
    ...(record.settings === undefined
      ? {}
      : { settings: parseApplicationSettings(record.settings, 'persistedAppState.settings') }),
    ...(record.activeDraft === undefined
      ? {}
      : { activeDraft: parseActiveDraft(record.activeDraft, 'persistedAppState.activeDraft') }),
    ...(record.savedDesigns === undefined
      ? {}
      : { savedDesigns: parseSavedDesignsArray(record.savedDesigns) }),
    ...(record.catalogOverrides === undefined
      ? {}
      : {
          catalogOverrides: parseCatalogOverrides(
            record.catalogOverrides,
            'persistedAppState.catalogOverrides'
          ),
        }),
  };
}

function parsePersistedAppStateV1(record: UnknownRecord): PersistedAppStateV1 {
  return {
    schemaVersion: PERSISTED_APP_STATE_SCHEMA_VERSION,
    settings: parseApplicationSettings(record.settings, 'persistedAppState.settings'),
    activeDraft: parseActiveDraft(record.activeDraft, 'persistedAppState.activeDraft'),
    savedDesignsById: parseSavedDesignMap(
      record.savedDesignsById,
      'persistedAppState.savedDesignsById'
    ),
    catalogOverrides: parseCatalogOverrides(
      record.catalogOverrides,
      'persistedAppState.catalogOverrides'
    ),
  };
}

function parseApplicationSettings(value: unknown, path: string): ApplicationSettings {
  const record = expectRecord(value, path);
  const wasteAllowancePercent = record.wasteAllowancePercent;

  if (
    typeof wasteAllowancePercent !== 'number' ||
    !Number.isFinite(wasteAllowancePercent) ||
    wasteAllowancePercent < 0 ||
    wasteAllowancePercent > 100
  ) {
    throw new DomainValidationError(
      `${path}.wasteAllowancePercent`,
      'must be a finite percentage from 0 to 100'
    );
  }

  return { wasteAllowancePercent };
}

function parseActiveDraft(value: unknown, path: string): DesignDocument | null {
  return value === null ? null : parseDesignDocument(value, path);
}

function parseSavedDesignsArray(value: unknown): readonly DesignDocument[] {
  if (!Array.isArray(value)) {
    throw new DomainValidationError('persistedAppState.savedDesigns', 'must be an array');
  }

  return value.map((design, index) =>
    parseDesignDocument(design, `persistedAppState.savedDesigns[${index}]`)
  );
}

function parseSavedDesignMap(
  value: unknown,
  path: string
): Readonly<Record<DesignId, DesignDocument>> {
  const record = expectRecord(value, path);
  const parsedDesigns = createRecord<DesignId, DesignDocument>();

  for (const [id, design] of Object.entries(record)) {
    validateStableId(id, `${path} key`);
    const parsedDesign = parseDesignDocument(design, `${path}.${id}`);

    if (parsedDesign.metadata.id !== id) {
      throw new DomainValidationError(
        `${path}.${id}.metadata.id`,
        'must match its saved design map key'
      );
    }

    parsedDesigns[id] = parsedDesign;
  }

  return parsedDesigns;
}

function parseCatalogOverrides(value: unknown, path: string): CatalogOverrides {
  const record = expectRecord(value, path);
  const priceOverrides = expectRecord(record.priceOverridesById, `${path}.priceOverridesById`);
  const priceOverridesById = createRecord<string, ReturnType<typeof parseEditablePriceOverride>>();

  for (const [id, override] of Object.entries(priceOverrides)) {
    validateStableId(id, `${path}.priceOverridesById key`);
    const parsedOverride = parseEditablePriceOverride(override);

    if (parsedOverride.priceId !== id) {
      throw new DomainValidationError(
        `${path}.priceOverridesById.${id}.priceId`,
        'must match its override map key'
      );
    }

    priceOverridesById[id] = parsedOverride;
  }

  return { priceOverridesById };
}

function parseDesignDocument(value: unknown, path: string): DesignDocument {
  const record = expectRecord(value, path);

  return {
    metadata: parseDesignMetadata(record.metadata, `${path}.metadata`),
    garage: parseGarageDimensions(record.garage, `${path}.garage`),
    layout: parseFloorLayout(record.layout, `${path}.layout`),
  };
}

function parseDesignMetadata(value: unknown, path: string): DesignMetadata {
  const record = expectRecord(value, path);
  const referenceTemplateId =
    record.referenceTemplateId === undefined
      ? undefined
      : readStableId(record.referenceTemplateId, `${path}.referenceTemplateId`);
  const referenceRoleColors =
    record.referenceRoleColors === undefined
      ? undefined
      : parseReferenceRoleColors(record.referenceRoleColors, `${path}.referenceRoleColors`);

  return {
    id: readStableId(record.id, `${path}.id`),
    name: readNonEmptyString(record.name, `${path}.name`),
    createdAt: readIsoTimestamp(record.createdAt, `${path}.createdAt`),
    updatedAt: readIsoTimestamp(record.updatedAt, `${path}.updatedAt`),
    ...(referenceTemplateId === undefined ? {} : { referenceTemplateId }),
    ...(referenceRoleColors === undefined ? {} : { referenceRoleColors }),
  };
}

function parseReferenceRoleColors(value: unknown, path: string): ReferenceRoleColors {
  const record = expectRecord(value, path);
  const base = readOptionalReferenceRoleColor(record.base, `${path}.base`);
  const border = readOptionalReferenceRoleColor(record.border, `${path}.border`);
  const accent = readOptionalReferenceRoleColor(record.accent, `${path}.accent`);
  const secondary = readOptionalReferenceRoleColor(record.secondary, `${path}.secondary`);

  return {
    ...(base === undefined ? {} : { base }),
    ...(border === undefined ? {} : { border }),
    ...(accent === undefined ? {} : { accent }),
    ...(secondary === undefined ? {} : { secondary }),
  };
}

function readOptionalReferenceRoleColor(value: unknown, path: string): string | undefined {
  if (value === undefined || (typeof value === 'string' && value.trim().length === 0)) {
    return undefined;
  }
  return readNonEmptyString(value, path);
}

function parseGarageDimensions(value: unknown, path: string): GarageDimensions {
  const record = expectRecord(value, path);

  return {
    widthInches: readPositiveNumber(record.widthInches, `${path}.widthInches`),
    lengthInches: readPositiveNumber(record.lengthInches, `${path}.lengthInches`),
  };
}

function parseFloorLayout(value: unknown, path: string): FloorLayout {
  const record = expectRecord(value, path);
  const cells = expectRecord(record.cellsById, `${path}.cellsById`);
  const cellsById = createRecord<LayoutCellId, LayoutCell>();

  for (const [id, cell] of Object.entries(cells)) {
    validateStableId(id, `${path}.cellsById key`);
    const parsedCell = parseLayoutCell(cell, `${path}.cellsById.${id}`);

    if (parsedCell.id !== id) {
      throw new DomainValidationError(`${path}.cellsById.${id}.id`, 'must match its cell map key');
    }

    cellsById[id] = parsedCell;
  }

  return {
    cellSizeInches: readPositiveNumber(record.cellSizeInches, `${path}.cellSizeInches`),
    cellsById,
    selectedProduct: parseSelectedProduct(record.selectedProduct, `${path}.selectedProduct`),
  };
}

function parseLayoutCell(value: unknown, path: string): LayoutCell {
  const record = expectRecord(value, path);

  return {
    id: readStableId(record.id, `${path}.id`),
    column: readNonNegativeInteger(record.column, `${path}.column`),
    row: readNonNegativeInteger(record.row, `${path}.row`),
    ...parseProductSelection(record, path),
  };
}

function parseSelectedProduct(value: unknown, path: string): ProductSelection | null {
  return value === null ? null : parseProductSelection(expectRecord(value, path), path);
}

function parseProductSelection(record: UnknownRecord, path: string): ProductSelection {
  const colorId =
    record.colorId === undefined ? undefined : readStableId(record.colorId, `${path}.colorId`);

  return {
    productId: readStableId(record.productId, `${path}.productId`),
    ...(colorId === undefined ? {} : { colorId }),
    orientation: readTileOrientation(record.orientation, `${path}.orientation`),
  };
}

type UnknownRecord = Record<string, unknown>;

function createRecord<TKey extends string, TValue>(): Record<TKey, TValue> {
  return Object.create(null) as Record<TKey, TValue>;
}

function expectRecord(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainValidationError(path, 'must be an object');
  }

  return value as UnknownRecord;
}

function readNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainValidationError(path, 'must be a non-empty string');
  }

  return value;
}

function readStableId(value: unknown, path: string): string {
  const id = readNonEmptyString(value, path);
  validateStableId(id, path);
  return id;
}

function validateStableId(value: string, path: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new DomainValidationError(path, 'must be a lowercase kebab-case stable identifier');
  }
}

function readPositiveNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new DomainValidationError(path, 'must be a finite number greater than zero');
  }

  return value;
}

function readNonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new DomainValidationError(path, 'must be a non-negative safe integer');
  }

  return value;
}

function readTileOrientation(value: unknown, path: string): TileOrientation {
  if (value !== 0 && value !== 90 && value !== 180 && value !== 270) {
    throw new DomainValidationError(path, 'must be 0, 90, 180, or 270');
  }

  return value;
}

function readIsoTimestamp(value: unknown, path: string): string {
  const timestamp = readNonEmptyString(value, path);
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime()) || date.toISOString() !== timestamp) {
    throw new DomainValidationError(path, 'must be an ISO 8601 UTC timestamp');
  }

  return timestamp;
}
