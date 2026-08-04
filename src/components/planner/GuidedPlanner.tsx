import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  formatInches,
  formatMoney,
  formatUnitMoney,
  listDrainableCatalogEntries,
  normalizeOfferPricing,
  ProductPhoto,
  type CatalogEntry,
} from '../catalog';
import { ExportControls } from '../export';
import {
  AFFILIATION_DISCLAIMER,
  CATALOG_LATEST_CHECKED_DATE,
  IMAGE_ATTRIBUTION_DISCLAIMER,
  PRICING_DISCLAIMER,
} from '../../data';
import { DEFAULT_APPLICATION_SETTINGS } from '../../domain/persistence';
import { isRampPlan } from '../../calculations/ramps';
import {
  ILLINOIS_STATE_DESTINATION,
  describeShippingEstimate,
} from '../../calculations/landedCost';
import {
  createDefaultGarageFrontState,
  describeGarageFrontType,
  GARAGE_FRONT_CONFIGURATION_TYPES,
  getGarageFrontGeometry,
  isGarageFrontConfigurationSupported,
  syncGarageFrontToGarage,
  updateGarageFront,
  type GarageFrontConfigurationType,
  type GarageFrontGeometry,
  type GarageFrontSegmentInput,
  type GarageFrontState,
} from '../../garage-front';
import {
  createRoughPlanStorage,
  EMPTY_PERSISTED_ROUGH_PLANS,
  listRoughPlans,
  removeRoughPlan,
  resolveRoughPlanGarageFront,
  uniqueDesignId,
  uniqueName,
  upsertRoughPlan,
  type PersistedRoughPlansV1,
  type PersistenceError,
  type RoughPlanDocument,
  type StorageLike,
  type VersionedStorageAdapter,
} from '../../persistence';
import {
  createRoughDesignState,
  paintRoughDesignCell,
  ROUGH_DESIGN_ROLES,
  type RoughDesignRole,
  type RoughDesignState,
  type RoughDesignType,
} from '../../rough-design';
import { ExactFloorPreview } from './ExactFloorPreview';
import { GarageDesignCanvas } from './GarageDesignCanvas';
import { PatternChooser } from './PatternChooser';
import {
  ALL_PATTERN_CATEGORIES,
  buildColorPurchasePlans,
  buildProductPlans,
  clearCustomCells,
  conceptualGridFor,
  describeCutRequirement,
  describePurchaseTotals,
  describeRampPlan,
  formatGap,
  listEdgeGaps,
  listPlanSources,
  parseGarageDimensionInput,
  PLANNER_PALETTE,
  ROLE_LABELS,
  withExpansionClearance,
  withGarageDimensions,
  withPatternType,
  withRoleColor,
  type ColorPurchasePlan,
  type PatternCategoryFilter,
  type ProductPlan,
} from './plannerModel';
import './GuidedPlanner.css';

export interface GuidedPlannerProps {
  /** Storage backend for saved rough plans. Pass `null` to simulate unavailable storage. */
  readonly storage?: StorageLike | null;
  /** Adapter override, mainly for tests. */
  readonly adapter?: VersionedStorageAdapter<PersistedRoughPlansV1>;
  /** Clock override so saved timestamps stay deterministic in tests. */
  readonly now?: () => Date;
}

const DEFAULT_WASTE_ALLOWANCE_PERCENT = DEFAULT_APPLICATION_SETTINGS.wasteAllowancePercent;

interface FrontDraft {
  readonly doorWidth: string;
  readonly centerWall: string;
  readonly leftWall: string;
  readonly rightWall: string;
}

interface CustomSegmentDraft {
  readonly kind: 'wall' | 'opening';
  readonly length: string;
}

/**
 * The whole planner on one page.
 *
 * There is no stepper and no stage navigation: the garage, its doors, and the rough design are one
 * section, drainable tiles are the next, and the exact summary is the last. Later sections appear
 * as the decisions that make them meaningful are made, and every section is a two-column
 * worksheet - controls on the left, exactly one drawing on the right.
 */
export function GuidedPlanner({ storage, adapter, now }: GuidedPlannerProps = {}) {
  const [planStorage] = useState<VersionedStorageAdapter<PersistedRoughPlansV1>>(
    () =>
      adapter ??
      (storage === undefined ? createRoughPlanStorage() : createRoughPlanStorage(storage))
  );
  const [clock] = useState<() => Date>(() => now ?? (() => new Date()));
  const [restored] = useState(() => planStorage.read());
  // An unreadable payload (corrupt, or written by a newer version of this app) is never
  // overwritten by a background write. The user sees the error and can still save explicitly.
  const [canMirrorToStorage] = useState(() => restored.ok);

  const entries = useMemo(() => listDrainableCatalogEntries(), []);
  const [plans, setPlans] = useState<PersistedRoughPlansV1>(() =>
    restored.ok ? (restored.value ?? EMPTY_PERSISTED_ROUGH_PLANS) : EMPTY_PERSISTED_ROUGH_PLANS
  );
  const [storageError, setStorageError] = useState<PersistenceError | null>(() =>
    restored.ok ? null : restored.error
  );
  const [design, setDesign] = useState<RoughDesignState>(
    () => activePlanOf(restored)?.design ?? createRoughDesignState()
  );
  const [garageFront, setGarageFront] = useState<GarageFrontState>(() => {
    const active = activePlanOf(restored);
    return active === null
      ? createDefaultGarageFrontState(createRoughDesignState().garage.widthInches)
      : syncGarageFrontToGarage(resolveRoughPlanGarageFront(active), active.design.garage);
  });
  const [selectedProductId, setSelectedProductId] = useState<string | null>(() => {
    const requested = activePlanOf(restored)?.selectedProductId ?? null;
    return requested !== null && isPlannerProduct(requested) ? requested : null;
  });
  const [wasteAllowancePercent, setWasteAllowancePercent] = useState(
    () => activePlanOf(restored)?.wasteAllowancePercent ?? DEFAULT_WASTE_ALLOWANCE_PERCENT
  );
  const [planName, setPlanName] = useState(() => activePlanOf(restored)?.name ?? '');
  const [status, setStatus] = useState<string | null>(() =>
    describeRestore(activePlanOf(restored))
  );

  const [widthInput, setWidthInput] = useState(() => String(design.garage.widthInches));
  const [lengthInput, setLengthInput] = useState(() => String(design.garage.lengthInches));
  const [clearanceInput, setClearanceInput] = useState(() =>
    String(design.expansionClearance.leftInches)
  );
  const [clearanceMessage, setClearanceMessage] = useState<string | null>(null);
  const [frontDraft, setFrontDraft] = useState<FrontDraft>(() => toFrontDraft(garageFront));
  const [customSegments, setCustomSegments] = useState<readonly CustomSegmentDraft[]>(() =>
    toCustomDraft(garageFront)
  );
  const [frontMessage, setFrontMessage] = useState<string | null>(null);
  const [patternCategory, setPatternCategory] =
    useState<PatternCategoryFilter>(ALL_PATTERN_CATEGORIES);
  const [patternSearch, setPatternSearch] = useState('');
  const [paintRole, setPaintRole] = useState<RoughDesignRole>('accent');
  const [cursor, setCursor] = useState({ column: 0, row: 0 });
  const [previewProductId, setPreviewProductId] = useState<string | null>(selectedProductId);
  const [focusToken, setFocusToken] = useState(0);
  const pendingFocusRef = useRef<'tiles' | 'summary' | null>(null);

  const tilesRef = useRef<HTMLElement | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);
  const summarySvgRef = useRef<SVGSVGElement | null>(null);

  const widthResult = parseGarageDimensionInput(widthInput, 'width');
  const lengthResult = parseGarageDimensionInput(lengthInput, 'length');
  const hasValidGarage = widthResult.ok && lengthResult.ok;
  const isDesignReady = hasValidGarage && clearanceMessage === null;

  const frontGeometry = useMemo(() => getGarageFrontGeometry(garageFront), [garageFront]);
  const productPlans = useMemo(
    () => buildProductPlans(design, entries, wasteAllowancePercent, { frontGeometry }),
    [design, entries, frontGeometry, wasteAllowancePercent]
  );
  const selectedPlan = useMemo(
    () => productPlans.find((plan) => plan.productId === selectedProductId) ?? null,
    [productPlans, selectedProductId]
  );
  const previewPlan = useMemo(
    () =>
      productPlans.find((plan) => plan.productId === previewProductId) ??
      selectedPlan ??
      productPlans[0] ??
      null,
    [productPlans, previewProductId, selectedPlan]
  );
  const savedPlans = useMemo(() => listRoughPlans(plans), [plans]);

  // The plan on screen is mirrored into storage so a reload resumes where the user left off.
  const plansRef = useRef(plans);
  const planNameRef = useRef(planName);
  // Comparing against the last persisted values keeps a re-run of this effect (React strict mode
  // mounts twice) from writing the same plan again.
  const lastPersistedRef = useRef({
    design,
    garageFront,
    selectedProductId,
    wasteAllowancePercent,
  });

  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  useEffect(() => {
    planNameRef.current = planName;
  }, [planName]);

  useEffect(() => {
    if (!canMirrorToStorage) return;

    const previous = lastPersistedRef.current;
    if (
      previous.design === design &&
      previous.garageFront === garageFront &&
      previous.selectedProductId === selectedProductId &&
      previous.wasteAllowancePercent === wasteAllowancePercent
    ) {
      return;
    }

    const current = plansRef.current;
    const active = current.activePlan;
    const timestamp = clock().toISOString();
    const next: PersistedRoughPlansV1 = {
      ...current,
      activePlan: {
        id: active?.id ?? 'active-plan',
        name: active?.name ?? (planNameRef.current.trim() || 'Unsaved plan'),
        createdAt: active?.createdAt ?? timestamp,
        updatedAt: timestamp,
        design,
        garageFront,
        selectedProductId,
        wasteAllowancePercent,
      },
    };
    const write = planStorage.write(next);
    if (!write.ok) {
      setStorageError(write.error);
      return;
    }

    lastPersistedRef.current = {
      design,
      garageFront,
      selectedProductId,
      wasteAllowancePercent,
    };
    plansRef.current = next;
    setPlans(next);
  }, [
    design,
    garageFront,
    selectedProductId,
    wasteAllowancePercent,
    planStorage,
    clock,
    canMirrorToStorage,
  ]);

  // A revealed section is focused and scrolled to after it has actually rendered. The request
  // lives in a ref so the effect only reads it, and the token is what schedules the effect.
  useEffect(() => {
    const requested = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (requested === null) return;

    const target = requested === 'tiles' ? tilesRef.current : summaryRef.current;
    if (target === null) return;
    target.focus();
    target.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [focusToken]);

  const requestFocus = useCallback((section: 'tiles' | 'summary') => {
    pendingFocusRef.current = section;
    setFocusToken((token) => token + 1);
  }, []);

  const applyDimensions = useCallback(
    (rawWidth: string, rawLength: string) => {
      const width = parseGarageDimensionInput(rawWidth, 'width');
      const length = parseGarageDimensionInput(rawLength, 'length');
      if (!width.ok || !length.ok) return;

      const garage = { widthInches: width.value, lengthInches: length.value };
      try {
        const nextDesign = withGarageDimensions(design, garage);
        const nextFront = syncGarageFrontToGarage(garageFront, garage);
        setDesign(nextDesign);
        setGarageFront(nextFront);
        setFrontDraft(toFrontDraft(nextFront));
        setCustomSegments(toCustomDraft(nextFront));
        setClearanceMessage(null);
        setFrontMessage(null);
      } catch (error) {
        setClearanceMessage(
          error instanceof RangeError
            ? error.message
            : 'Those dimensions leave no usable tile field.'
        );
      }
    },
    [design, garageFront]
  );

  const applyClearance = useCallback(
    (raw: string) => {
      setClearanceInput(raw);
      const trimmed = raw.trim();
      if (trimmed.length === 0 || !/^\d*(?:\.\d+)?$/.test(trimmed)) {
        setClearanceMessage('Enter the expansion clearance in inches, for example 1.');
        return;
      }

      const value = Number(trimmed);
      try {
        const nextDesign = withExpansionClearance(design, {
          leftInches: value,
          rightInches: value,
          frontInches: value,
          backInches: value,
        });
        setDesign(nextDesign);
        setClearanceMessage(null);
      } catch (error) {
        setClearanceMessage(
          error instanceof RangeError ? error.message : 'That clearance leaves no tile field.'
        );
      }
    },
    [design]
  );

  const applyFrontChange = (field: keyof FrontDraft, raw: string): void => {
    setFrontDraft((current) => ({ ...current, [field]: raw }));
    const trimmed = raw.trim();
    if (trimmed.length === 0 || !/^\d*(?:\.\d+)?$/.test(trimmed)) {
      setFrontMessage('Enter a width in inches, for example 94.');
      return;
    }

    const value = Number(trimmed);
    const change =
      field === 'doorWidth'
        ? { doorWidthInches: value }
        : field === 'centerWall'
          ? { centerWallInches: value }
          : field === 'leftWall'
            ? { leftWallInches: value }
            : { rightWallInches: value };

    try {
      const next = updateGarageFront(garageFront, change);
      setGarageFront(next);
      setFrontDraft({ ...toFrontDraft(next), [field]: raw });
      setFrontMessage(null);
    } catch (error) {
      setFrontMessage(error instanceof RangeError ? error.message : 'That front does not fit.');
    }
  };

  const applyFrontType = (type: GarageFrontConfigurationType): void => {
    try {
      const next =
        type === 'custom'
          ? updateGarageFront(garageFront, {
              type,
              customSegments: toSegmentInputs(customSegments, garageFront),
            })
          : updateGarageFront(garageFront, { type });
      setGarageFront(next);
      setFrontDraft(toFrontDraft(next));
      setCustomSegments(toCustomDraft(next));
      setFrontMessage(null);
    } catch (error) {
      setFrontMessage(
        error instanceof RangeError
          ? error.message
          : 'That door configuration does not fit this garage width.'
      );
    }
  };

  const applyCustomSegments = (next: readonly CustomSegmentDraft[]): void => {
    setCustomSegments(next);
    const parsed = next.map((segment) => ({
      kind: segment.kind,
      lengthInches: Number(segment.length.trim()),
    }));
    if (parsed.some((segment) => !Number.isFinite(segment.lengthInches))) {
      setFrontMessage('Enter every segment width in inches.');
      return;
    }

    try {
      const updated = updateGarageFront(garageFront, { type: 'custom', customSegments: parsed });
      setGarageFront(updated);
      setFrontDraft(toFrontDraft(updated));
      setFrontMessage(null);
    } catch (error) {
      setFrontMessage(
        error instanceof RangeError ? error.message : 'That custom front is not usable.'
      );
    }
  };

  const handleSelectProduct = (plan: ProductPlan): void => {
    setPreviewProductId(plan.productId);
    if (!plan.canSelect) return;
    setSelectedProductId(plan.productId);
    setStatus(null);
    requestFocus('summary');
  };

  const handleSavePlan = (): void => {
    const trimmed = planName.trim();
    if (trimmed.length === 0) {
      setStatus(null);
      setStorageError({ kind: 'invalid-input', message: 'Name this plan before saving it.' });
      return;
    }

    const existing = savedPlans.find((plan) => plan.name === trimmed);
    const timestamp = clock().toISOString();
    const name = existing
      ? trimmed
      : uniqueName(trimmed, new Set(savedPlans.map((plan) => plan.name)));
    const document: RoughPlanDocument = {
      id: existing?.id ?? uniqueDesignId(name, new Set(savedPlans.map((plan) => plan.id))),
      name,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      design,
      garageFront,
      selectedProductId,
      wasteAllowancePercent,
    };
    const next = upsertRoughPlan(plans, document);
    const write = planStorage.write(next);
    if (!write.ok) {
      setStatus(null);
      setStorageError(write.error);
      return;
    }

    plansRef.current = next;
    setPlans(next);
    setPlanName(name);
    setStorageError(null);
    setStatus(`Saved "${name}".`);
  };

  const handleOpenPlan = (plan: RoughPlanDocument): void => {
    const opened: RoughPlanDocument = { ...plan, updatedAt: clock().toISOString() };
    const next = upsertRoughPlan(plans, opened);
    const write = planStorage.write(next);
    if (!write.ok) {
      setStatus(null);
      setStorageError(write.error);
      return;
    }

    const front = syncGarageFrontToGarage(resolveRoughPlanGarageFront(plan), plan.design.garage);
    // A saved plan can name a tile this planner no longer offers, either because the catalog
    // dropped it or because it is a closed-surface product the drainable filter now hides.
    const keepsProduct =
      plan.selectedProductId !== null && isPlannerProduct(plan.selectedProductId);

    plansRef.current = next;
    setPlans(next);
    setDesign(plan.design);
    setGarageFront(front);
    setFrontDraft(toFrontDraft(front));
    setCustomSegments(toCustomDraft(front));
    setSelectedProductId(keepsProduct ? plan.selectedProductId : null);
    setPreviewProductId(keepsProduct ? plan.selectedProductId : null);
    setWasteAllowancePercent(plan.wasteAllowancePercent);
    setPlanName(plan.name);
    setWidthInput(String(plan.design.garage.widthInches));
    setLengthInput(String(plan.design.garage.lengthInches));
    setClearanceInput(String(plan.design.expansionClearance.leftInches));
    setClearanceMessage(null);
    setFrontMessage(null);
    setStorageError(null);
    setStatus(
      plan.selectedProductId !== null && !keepsProduct
        ? `Opened "${plan.name}". Its tile is not one of the drainable options this planner ` +
            'offers, so choose a drainable tile below.'
        : `Opened "${plan.name}".`
    );
    requestFocus(keepsProduct ? 'summary' : 'tiles');
  };

  const handleDeletePlan = (plan: RoughPlanDocument): void => {
    const next = removeRoughPlan(plans, plan.id);
    const write = planStorage.write(next);
    if (!write.ok) {
      setStatus(null);
      setStorageError(write.error);
      return;
    }

    plansRef.current = next;
    setPlans(next);
    setStorageError(null);
    setStatus(`Deleted "${plan.name}".`);
  };

  return (
    <div className="planner">
      {status === null ? null : (
        <p
          aria-live="polite"
          className="planner__status"
          data-testid="planner-status"
          role="status"
        >
          {status}
        </p>
      )}
      {storageError === null ? null : (
        <p className="planner__error" role="alert">
          {storageError.message}
        </p>
      )}

      <section aria-labelledby="planner-design-heading" className="planner__section">
        <header className="planner__section-heading">
          <h2 id="planner-design-heading">Garage &amp; design</h2>
          <p className="planner__lede">
            Measure the room, set the door openings on the front wall, and draw a brand-neutral
            rough design. Everything after this fits inside these numbers.
          </p>
        </header>

        <div className="planner__two-column">
          <div className="planner__controls">
            <fieldset className="planner__group">
              <legend>Garage size</legend>
              <div className="planner__field">
                <label htmlFor="planner-garage-width">Garage width (inches, front wall)</label>
                <input
                  aria-describedby={widthResult.ok ? undefined : 'planner-garage-width-error'}
                  aria-invalid={!widthResult.ok}
                  autoComplete="off"
                  id="planner-garage-width"
                  inputMode="decimal"
                  onChange={(event) => {
                    setWidthInput(event.target.value);
                    applyDimensions(event.target.value, lengthInput);
                  }}
                  value={widthInput}
                />
                {widthResult.ok ? null : (
                  <p className="planner__error" id="planner-garage-width-error" role="alert">
                    {widthResult.message}
                  </p>
                )}
              </div>

              <div className="planner__field">
                <label htmlFor="planner-garage-length">Garage length (inches, front to back)</label>
                <input
                  aria-describedby={lengthResult.ok ? undefined : 'planner-garage-length-error'}
                  aria-invalid={!lengthResult.ok}
                  autoComplete="off"
                  id="planner-garage-length"
                  inputMode="decimal"
                  onChange={(event) => {
                    setLengthInput(event.target.value);
                    applyDimensions(widthInput, event.target.value);
                  }}
                  value={lengthInput}
                />
                {lengthResult.ok ? null : (
                  <p className="planner__error" id="planner-garage-length-error" role="alert">
                    {lengthResult.message}
                  </p>
                )}
              </div>

              <div className="planner__field">
                <label htmlFor="planner-clearance">Expansion clearance (inches per side)</label>
                <input
                  aria-describedby={
                    clearanceMessage === null ? undefined : 'planner-clearance-error'
                  }
                  aria-invalid={clearanceMessage !== null}
                  autoComplete="off"
                  id="planner-clearance"
                  inputMode="decimal"
                  onChange={(event) => {
                    applyClearance(event.target.value);
                  }}
                  value={clearanceInput}
                />
                {clearanceMessage === null ? null : (
                  <p className="planner__error" id="planner-clearance-error" role="alert">
                    {clearanceMessage}
                  </p>
                )}
              </div>

              <p className="planner__hint" data-testid="planner-tile-field">
                {`Tile field ${formatInches(design.garage.widthInches - design.expansionClearance.leftInches - design.expansionClearance.rightInches)} × ${formatInches(design.garage.lengthInches - design.expansionClearance.frontInches - design.expansionClearance.backInches)} inside ${formatInches(design.garage.widthInches)} × ${formatInches(design.garage.lengthInches)} walls.`}
              </p>
            </fieldset>

            <DoorControls
              customSegments={customSegments}
              draft={frontDraft}
              front={garageFront}
              garageWidthInches={design.garage.widthInches}
              geometry={frontGeometry}
              message={frontMessage}
              onCustomSegmentsChange={applyCustomSegments}
              onFieldChange={applyFrontChange}
              onTypeChange={applyFrontType}
            />

            <PatternChooser
              category={patternCategory}
              colors={design.colors}
              onCategoryChange={setPatternCategory}
              onSearchChange={setPatternSearch}
              onSelect={(type: RoughDesignType) => {
                setDesign((current) => withPatternType(current, type));
              }}
              search={patternSearch}
              selectedType={design.type}
            />

            <fieldset className="planner__group">
              <legend>Colors</legend>
              <div className="planner__colors">
                {ROUGH_DESIGN_ROLES.map((role) => (
                  <div className="planner__field" key={role}>
                    <label htmlFor={`planner-color-${role}`}>{`${ROLE_LABELS[role]} color`}</label>
                    <select
                      id={`planner-color-${role}`}
                      onChange={(event) => {
                        const color = PLANNER_PALETTE.find(
                          (candidate) => candidate.hex === event.target.value
                        );
                        if (color === undefined) return;
                        setDesign((current) => withRoleColor(current, role, color));
                      }}
                      value={design.colors[role].hex}
                    >
                      {PLANNER_PALETTE.map((color) => (
                        <option key={color.hex} value={color.hex}>
                          {color.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p className="planner__hint">
                These are brand-neutral display colors. Each one is matched to a real product color
                only when you pick a tile below.
              </p>
            </fieldset>

            {design.type === 'custom' ? (
              <fieldset className="planner__group">
                <legend>Paint with</legend>
                <div className="planner__inline-choices">
                  {ROUGH_DESIGN_ROLES.map((role) => (
                    <label key={role}>
                      <input
                        checked={paintRole === role}
                        name="planner-paint-role"
                        onChange={() => {
                          setPaintRole(role);
                        }}
                        type="radio"
                        value={role}
                      />
                      {ROLE_LABELS[role]}
                    </label>
                  ))}
                </div>
                <p className="planner__hint">
                  Click one square or drag across several. You can also focus the plan and use the
                  arrow keys and Enter.
                </p>
                <button
                  onClick={() => {
                    setDesign((current) => clearCustomCells(current));
                  }}
                  type="button"
                >
                  Clear painted squares
                </button>
              </fieldset>
            ) : null}
          </div>

          <figure className="planner__canvas" data-testid="planner-canvas">
            <GarageDesignCanvas
              activeRole={paintRole}
              cursor={cursor}
              front={frontGeometry}
              grid={conceptualGridFor(design)}
              isPaintEnabled={design.type === 'custom'}
              onCursorChange={setCursor}
              onPaintCell={(column, row) => {
                setDesign((current) => {
                  const grid = conceptualGridFor(current);
                  // The grid changes with the garage proportions, so a cursor parked near an old
                  // edge is clamped back inside it instead of throwing.
                  const safeColumn = Math.min(Math.max(column, 0), grid.columns - 1);
                  const safeRow = Math.min(Math.max(row, 0), grid.rows - 1);
                  return paintRoughDesignCell(current, grid, safeColumn, safeRow, paintRole);
                });
              }}
              state={design}
            />
            <figcaption>
              One plan: outer walls, the shaded expansion clearance, the rough pattern on the tile
              field, and the door openings along the front (top) edge. The squares are a drawing
              grid, not a tile count.
            </figcaption>
          </figure>
        </div>

        {isDesignReady ? (
          <p className="planner__cue">Drainable tile options for this design are below.</p>
        ) : (
          <p className="planner__cue planner__cue--blocked">
            Fix the highlighted measurements to see drainable tile options.
          </p>
        )}
      </section>

      {isDesignReady ? (
        <section
          aria-labelledby="planner-tiles-heading"
          className="planner__section"
          ref={tilesRef}
          tabIndex={-1}
        >
          <header className="planner__section-heading">
            <h2 id="planner-tiles-heading">Drainable tile options</h2>
            <p className="planner__lede">
              Only verified open-grid, self-draining tiles are listed: a garage floor that gets wet
              needs the water to go somewhere. Pick one on the left, read it on the right.
            </p>
          </header>

          <div className="planner__two-column">
            <ProductList
              onPreview={setPreviewProductId}
              onSelect={handleSelectProduct}
              plans={productPlans}
              previewProductId={previewPlan?.productId ?? null}
              selectedProductId={selectedProductId}
            />
            {previewPlan === null ? (
              <p className="planner__hint">No drainable tile is available to preview.</p>
            ) : (
              <ProductDetail
                design={design}
                isSelected={previewPlan.productId === selectedProductId}
                onSelect={handleSelectProduct}
                plan={previewPlan}
              />
            )}
          </div>
        </section>
      ) : null}

      {isDesignReady && selectedPlan !== null && selectedPlan.canSelect ? (
        <SummarySection
          design={design}
          front={frontGeometry}
          onDeletePlan={handleDeletePlan}
          onOpenPlan={handleOpenPlan}
          onPlanNameChange={setPlanName}
          onSavePlan={handleSavePlan}
          plan={selectedPlan}
          planName={planName}
          savedPlans={savedPlans}
          sectionRef={summaryRef}
          summarySvgRef={summarySvgRef}
        />
      ) : null}

      {isDesignReady &&
      (selectedPlan === null || !selectedPlan.canSelect) &&
      savedPlans.length > 0 ? (
        <section aria-labelledby="planner-saved-heading" className="planner__section">
          <header className="planner__section-heading">
            <h2 id="planner-saved-heading">Saved plans</h2>
            <p className="planner__lede">
              Reopen a saved plan, or pick a tile above to build the project summary.
            </p>
          </header>
          <SavedPlans
            onDeletePlan={handleDeletePlan}
            onOpenPlan={handleOpenPlan}
            savedPlans={savedPlans}
          />
        </section>
      ) : null}
    </div>
  );
}

interface DoorControlsProps {
  readonly front: GarageFrontState;
  readonly geometry: GarageFrontGeometry;
  readonly draft: FrontDraft;
  readonly customSegments: readonly CustomSegmentDraft[];
  readonly garageWidthInches: number;
  readonly message: string | null;
  readonly onTypeChange: (type: GarageFrontConfigurationType) => void;
  readonly onFieldChange: (field: keyof FrontDraft, raw: string) => void;
  readonly onCustomSegmentsChange: (segments: readonly CustomSegmentDraft[]) => void;
}

/** Door openings on the front wall. The segment widths always add up to the garage width. */
function DoorControls({
  front,
  geometry,
  draft,
  customSegments,
  garageWidthInches,
  message,
  onTypeChange,
  onFieldChange,
  onCustomSegmentsChange,
}: DoorControlsProps) {
  return (
    <fieldset className="planner__group">
      <legend>Garage doors (front wall)</legend>

      <div className="planner__field">
        <label htmlFor="planner-door-type">Door configuration</label>
        <select
          id="planner-door-type"
          onChange={(event) => {
            onTypeChange(event.target.value as GarageFrontConfigurationType);
          }}
          value={front.type}
        >
          {GARAGE_FRONT_CONFIGURATION_TYPES.filter(
            (type) =>
              type === 'custom' || isGarageFrontConfigurationSupported(type, garageWidthInches)
          ).map((type) => (
            <option key={type} value={type}>
              {capitalize(describeGarageFrontType(type))}
            </option>
          ))}
        </select>
      </div>

      {front.type === 'custom' ? (
        <div className="planner__segments">
          <p className="planner__hint">
            {`Segments run left to right and must total ${formatInches(garageWidthInches)}.`}
          </p>
          <ul>
            {customSegments.map((segment, index) => (
              <li key={index}>
                <select
                  aria-label={`Segment ${String(index + 1)} kind`}
                  onChange={(event) => {
                    onCustomSegmentsChange(
                      customSegments.map((candidate, position) =>
                        position === index
                          ? { ...candidate, kind: event.target.value as 'wall' | 'opening' }
                          : candidate
                      )
                    );
                  }}
                  value={segment.kind}
                >
                  <option value="wall">Wall</option>
                  <option value="opening">Door opening</option>
                </select>
                <input
                  aria-label={`Segment ${String(index + 1)} width in inches`}
                  inputMode="decimal"
                  onChange={(event) => {
                    onCustomSegmentsChange(
                      customSegments.map((candidate, position) =>
                        position === index
                          ? { ...candidate, length: event.target.value }
                          : candidate
                      )
                    );
                  }}
                  value={segment.length}
                />
                <button
                  onClick={() => {
                    onCustomSegmentsChange(
                      customSegments.filter((_unused, position) => position !== index)
                    );
                  }}
                  type="button"
                >
                  {`Remove segment ${String(index + 1)}`}
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              onCustomSegmentsChange([
                ...customSegments,
                { kind: customSegments.at(-1)?.kind === 'wall' ? 'opening' : 'wall', length: '12' },
              ]);
            }}
            type="button"
          >
            Add segment
          </button>
        </div>
      ) : (
        <>
          <div className="planner__field">
            <label htmlFor="planner-door-width">Each door opening (inches)</label>
            <input
              id="planner-door-width"
              inputMode="decimal"
              onChange={(event) => {
                onFieldChange('doorWidth', event.target.value);
              }}
              value={draft.doorWidth}
            />
          </div>
          {front.centerWallInches === null ? null : (
            <div className="planner__field">
              <label htmlFor="planner-center-wall">Wall between doors (inches)</label>
              <input
                id="planner-center-wall"
                inputMode="decimal"
                onChange={(event) => {
                  onFieldChange('centerWall', event.target.value);
                }}
                value={draft.centerWall}
              />
            </div>
          )}
          <div className="planner__field">
            <label htmlFor="planner-left-wall">Left wall (inches)</label>
            <input
              id="planner-left-wall"
              inputMode="decimal"
              onChange={(event) => {
                onFieldChange('leftWall', event.target.value);
              }}
              value={draft.leftWall}
            />
          </div>
          <div className="planner__field">
            <label htmlFor="planner-right-wall">Right wall (inches)</label>
            <input
              id="planner-right-wall"
              inputMode="decimal"
              onChange={(event) => {
                onFieldChange('rightWall', event.target.value);
              }}
              value={draft.rightWall}
            />
          </div>
        </>
      )}

      {message === null ? null : (
        <p className="planner__error" role="alert">
          {message}
        </p>
      )}
      <p className="planner__hint" data-testid="planner-front-summary">
        {geometry.description}
      </p>
    </fieldset>
  );
}

interface ProductListProps {
  readonly plans: readonly ProductPlan[];
  readonly selectedProductId: string | null;
  readonly previewProductId: string | null;
  readonly onSelect: (plan: ProductPlan) => void;
  readonly onPreview: (productId: string) => void;
}

/** The scrollable left column: every drainable choice, with its real photo and its real facts. */
function ProductList({
  plans,
  selectedProductId,
  previewProductId,
  onSelect,
  onPreview,
}: ProductListProps) {
  return (
    <ul className="planner__product-list" data-testid="planner-product-list">
      {plans.map((plan) => {
        const seedProduct = plan.entry.seedProduct;
        const product = seedProduct.product;
        const isPreviewed = plan.productId === previewProductId;

        return (
          <li
            className={`planner__product-option${isPreviewed ? ' planner__product-option--active' : ''}`}
            data-testid={`planner-product-option-${plan.productId}`}
            key={plan.productId}
            onMouseEnter={() => {
              onPreview(plan.productId);
            }}
          >
            <label>
              <input
                aria-describedby={`planner-product-details-${plan.productId}`}
                aria-labelledby={`planner-product-name-${plan.productId}`}
                checked={plan.productId === selectedProductId}
                disabled={!plan.canSelect}
                name="planner-product"
                onChange={() => {
                  onSelect(plan);
                }}
                onFocus={() => {
                  onPreview(plan.productId);
                }}
                type="radio"
                value={plan.productId}
              />
              <span className="planner__product-photo">
                <ProductPhoto
                  image={seedProduct.image}
                  productName={product.name}
                  sellerName={plan.entry.manufacturer.name}
                  surfaceOpenness={seedProduct.drainage.surfaceOpenness}
                  swatchHex={seedProduct.colors[0]?.color.swatchHex}
                />
              </span>
              <span
                className="planner__product-body"
                id={`planner-product-details-${plan.productId}`}
              >
                <span
                  className="planner__product-brand"
                  id={`planner-product-brand-${plan.productId}`}
                >
                  {plan.entry.manufacturer.name}
                </span>{' '}
                <span
                  className="planner__product-name"
                  id={`planner-product-name-${plan.productId}`}
                >
                  {product.name}
                </span>
                <span className="planner__product-style">
                  {seedProduct.surfaceStyle?.label ?? 'Style not published by the source'}
                </span>
                <span className="planner__product-fact">
                  {`${formatInches(product.dimensions.widthInches)} × ${formatInches(product.dimensions.lengthInches)} × ${formatInches(product.dimensions.thicknessInches)} thick`}
                </span>
                <span className="planner__product-fact">
                  {`${String(seedProduct.colors.length)} colors: ${seedProduct.colors
                    .map((color) => color.color.name)
                    .join(', ')}`}
                </span>
                <span className="planner__product-fact">{describeStartingCost(plan)}</span>
                <span className="planner__product-fact">{describeSaleOptions(plan.entry)}</span>
                <span className="planner__product-drainage">
                  {`Open-grid, self-draining. ${seedProduct.drainage.evidence}`}
                </span>
                {seedProduct.plannerCaveat === undefined ? null : (
                  <span className="planner__product-issue">{seedProduct.plannerCaveat}</span>
                )}
                {plan.canSelect ? null : (
                  <span className="planner__product-issue">{plan.issues[0]}</span>
                )}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

interface ProductDetailProps {
  readonly plan: ProductPlan;
  readonly design: RoughDesignState;
  readonly isSelected: boolean;
  readonly onSelect: (plan: ProductPlan) => void;
}

/** The single right-hand preview: this rough design mapped onto exactly one product. */
function ProductDetail({ plan, design, isSelected, onSelect }: ProductDetailProps) {
  const seedProduct = plan.entry.seedProduct;
  const product = seedProduct.product;
  const grid = plan.design.materialTileGrid;
  const purchases = buildColorPurchasePlans(plan);
  const clearance = design.expansionClearance;

  return (
    <div className="planner__product-detail" data-testid="planner-product-detail">
      <h3>{`${plan.entry.manufacturer.name} ${product.name}`}</h3>

      <figure className="planner__canvas" data-testid="planner-canvas">
        <ExactFloorPreview
          garage={design.garage}
          plan={plan}
          testId="planner-product-preview"
          variant="compact"
        />
        <figcaption>
          {`Your rough design mapped onto ${formatInches(product.dimensions.widthInches)} tiles. Hatched edges are cut pieces.`}
        </figcaption>
      </figure>

      <ProductPhoto
        image={seedProduct.image}
        productName={product.name}
        sellerName={plan.entry.manufacturer.name}
        surfaceOpenness={seedProduct.drainage.surfaceOpenness}
        swatchHex={seedProduct.colors[0]?.color.swatchHex}
      />

      <dl className="planner__facts">
        <Fact label="Mapped colors">
          <ul className="planner__color-list">
            {plan.roleColors.map((roleColor) => (
              <li key={roleColor.role}>
                <span
                  aria-hidden="true"
                  className="planner__swatch"
                  style={{ backgroundColor: roleColor.mapping.color?.swatchHex ?? 'transparent' }}
                />
                {`${ROLE_LABELS[roleColor.role]}: ${roleColor.mapping.color?.name ?? 'no matching color'}`}
                {roleColor.mapping.status === 'substituted' ? ' (substituted)' : ''}
              </li>
            ))}
          </ul>
        </Fact>
        <Fact label="Exact grid">
          {`${String(grid.fullColumns)} × ${String(grid.fullRows)} whole tiles, ${String(plan.design.grid.columns)} × ${String(plan.design.grid.rows)} including cut edges`}
        </Fact>
        <Fact label="Expansion clearance">
          {`${formatInches(clearance.leftInches)} left, ${formatInches(clearance.rightInches)} right, ${formatInches(clearance.frontInches)} front, ${formatInches(clearance.backInches)} back; tile field ${formatInches(plan.design.tileField.widthInches)} × ${formatInches(plan.design.tileField.lengthInches)}`}
        </Fact>
        <Fact label="Cuts">{describeCutRequirement(design.garage, plan)}</Fact>
        <Fact label="Packages">
          {purchases.length === 0
            ? 'No tiles required.'
            : purchases
                .map(
                  (purchase) =>
                    `${purchase.colorName}: ${describePackages(purchase)} · ${
                      purchase.canBuyIndividually
                        ? `${String(purchase.individualTileCount)} individual tiles`
                        : 'no verified individual-tile listing'
                    } · ${String(purchase.leftoverTileCount)} left over`
                )
                .join(' ')}
        </Fact>
        <Fact label="Estimated floor cost">
          {plan.estimatedTotalCostCents === null
            ? 'Unavailable from verified offers'
            : formatMoney(plan.estimatedTotalCostCents)}
        </Fact>
        <Fact label="Front ramps">
          {plan.ramp !== null && isRampPlan(plan.ramp)
            ? `${plan.ramp.accessory.name}: ${formatMoney(plan.ramp.totalCostCents)} estimated`
            : describeRampPlan(plan.ramp)}
        </Fact>
        <Fact label={`Tax (${ILLINOIS_STATE_DESTINATION.label})`}>
          {plan.destinationCost === null
            ? 'Unavailable'
            : `${formatMoney(plan.destinationCost.estimatedTaxCents)} estimated at 6.25%`}
        </Fact>
        <Fact label="Shipping">
          {`${describeShippingEstimate(plan.destinationCost?.shippingCostCents ?? null)}. ${plan.shipping.explanation}`}
        </Fact>
        <Fact label="Total before shipping">
          {plan.destinationCost === null
            ? 'Unavailable'
            : formatMoney(plan.destinationCost.totalBeforeShippingCents)}
        </Fact>
        <Fact label="Source checked">
          {`${seedProduct.checkedDate} (dimensions and colors), prices ${seedProduct.prices[0]?.price.checkedDate ?? 'unavailable'}`}
        </Fact>
      </dl>

      <button
        className="planner__primary"
        disabled={!plan.canSelect}
        onClick={() => {
          onSelect(plan);
        }}
        type="button"
      >
        {isSelected ? `${product.name} selected` : `Use ${product.name}`}
      </button>
      <p className="planner__disclaimer">{IMAGE_ATTRIBUTION_DISCLAIMER}</p>
    </div>
  );
}

interface SummarySectionProps {
  readonly plan: ProductPlan;
  readonly design: RoughDesignState;
  readonly front: GarageFrontGeometry;
  readonly planName: string;
  readonly savedPlans: readonly RoughPlanDocument[];
  readonly sectionRef: RefObject<HTMLElement | null>;
  readonly summarySvgRef: RefObject<SVGSVGElement | null>;
  readonly onPlanNameChange: (value: string) => void;
  readonly onSavePlan: () => void;
  readonly onOpenPlan: (plan: RoughPlanDocument) => void;
  readonly onDeletePlan: (plan: RoughPlanDocument) => void;
}

/** The exact, buildable answer: what to buy, what to cut, and what it costs. */
function SummarySection({
  plan,
  design,
  front,
  planName,
  savedPlans,
  sectionRef,
  summarySvgRef,
  onPlanNameChange,
  onSavePlan,
  onOpenPlan,
  onDeletePlan,
}: SummarySectionProps) {
  const product = plan.entry.seedProduct.product;
  const purchases = buildColorPurchasePlans(plan);
  const sources = listPlanSources(plan);
  const clearance = design.expansionClearance;
  const edgeGaps = listEdgeGaps(plan.design);
  const ramp = plan.ramp;
  const checkedDates = [...new Set(sources.map((source) => source.checkedDate))].sort();
  const rampCaveats = ramp !== null && isRampPlan(ramp) ? ramp.caveats : [];
  const legendExtras = [
    describePurchaseTotals(plan),
    `Ramps: ${describeRampPlan(ramp)}`,
    ...(rampCaveats.length === 0 ? [] : [`Ramp notes: ${rampCaveats.join(' ')}`]),
    `Shipping: ${describeShippingEstimate(plan.destinationCost?.shippingCostCents ?? null)}. ${plan.shipping.explanation}`,
    `Sources checked: ${checkedDates.join(', ')}`,
  ];
  const reportSections = [
    {
      heading: 'Garage front and door openings',
      rows: [
        { label: 'Configuration', value: capitalize(describeGarageFrontType(front.type)) },
        {
          label: 'Segments',
          value: front.segments
            .map((segment) => `${segment.label} ${formatInches(segment.lengthInches)}`)
            .join(', '),
        },
        {
          label: 'Door openings',
          value: `${String(front.openingCount)} openings totalling ${formatInches(front.totalOpeningInches)}`,
        },
        { label: 'Front edge', value: 'The horizontal top edge of every drawing in this report.' },
      ],
    },
    {
      heading: 'Expansion clearance and tile field',
      rows: [
        {
          label: 'Expansion clearance',
          value: `${formatInches(clearance.leftInches)} left, ${formatInches(clearance.rightInches)} right, ${formatInches(clearance.frontInches)} front, ${formatInches(clearance.backInches)} back`,
        },
        {
          label: 'Outer garage',
          value: `${formatInches(design.garage.widthInches)} × ${formatInches(design.garage.lengthInches)}`,
        },
        {
          label: 'Tile field',
          value: `${formatInches(plan.design.tileField.widthInches)} × ${formatInches(plan.design.tileField.lengthInches)}`,
        },
        { label: 'Cutting', value: describeCutRequirement(design.garage, plan) },
      ],
    },
    {
      heading: 'Packages, leftovers, and ramps',
      rows: [
        ...purchases.map((purchase) => ({
          label: `${purchase.roleLabel} ${purchase.colorName}`,
          value:
            `${String(purchase.requiredTileCount)} tiles with waste · ${describePackages(purchase)} · ` +
            `${String(purchase.totalPurchasedTileCount)} purchased · ${String(purchase.leftoverTileCount)} left over · ` +
            purchase.individualAvailabilityNote,
        })),
        { label: 'Ramps', value: describeRampPlan(ramp) },
        ...(ramp !== null && isRampPlan(ramp)
          ? [
              {
                label: 'Ramp surplus',
                value: `${String(ramp.surplusSegments)} unused straight pieces after buying whole kits or sale units.`,
              },
              { label: 'Ramp notes', value: rampCaveats.join(' ') },
            ]
          : []),
        ...(plan.entry.seedProduct.plannerCaveat === undefined
          ? []
          : [{ label: 'Product caveat', value: plan.entry.seedProduct.plannerCaveat }]),
        {
          label: 'Totals',
          value:
            `Tiles ${plan.estimatedTotalCostCents === null ? 'unavailable' : formatMoney(plan.estimatedTotalCostCents)}, ` +
            `ramps ${plan.rampCostCents === null ? 'unavailable' : formatMoney(plan.rampCostCents)}, ` +
            `combined ${plan.combinedTotalCostCents === null ? 'unavailable' : formatMoney(plan.combinedTotalCostCents)}`,
        },
        {
          label: `Estimated tax (${ILLINOIS_STATE_DESTINATION.label})`,
          value:
            plan.destinationCost === null
              ? 'Unavailable'
              : `${formatMoney(plan.destinationCost.estimatedTaxCents)} at 6.25% on known merchandise`,
        },
        {
          label: 'Shipping',
          value: `${describeShippingEstimate(plan.destinationCost?.shippingCostCents ?? null)}. ${plan.shipping.explanation}`,
        },
        {
          label: 'Total before shipping',
          value:
            plan.destinationCost === null
              ? 'Unavailable'
              : formatMoney(plan.destinationCost.totalBeforeShippingCents),
        },
        {
          label: 'Estimated checkout total',
          value:
            plan.destinationCost?.estimatedCheckoutTotalCents === null ||
            plan.destinationCost === null
              ? 'Unavailable until shipping is known'
              : formatMoney(plan.destinationCost.estimatedCheckoutTotalCents),
        },
        { label: 'Sources checked', value: checkedDates.join(', ') },
      ],
    },
  ];

  return (
    <section
      aria-labelledby="planner-summary-heading"
      className="planner__section"
      ref={sectionRef}
      tabIndex={-1}
    >
      <header className="planner__section-heading">
        <h2 id="planner-summary-heading">Project summary</h2>
        <p className="planner__lede">
          {`${plan.entry.manufacturer.name} ${product.name}, laid out exactly as it fits this garage.`}
        </p>
      </header>

      <div className="planner__two-column">
        <div className="planner__details-column">
          <section aria-labelledby="planner-product-heading" className="planner__panel">
            <h3 id="planner-product-heading">Product and style</h3>
            <dl className="planner__facts">
              <Fact label="Brand">{plan.entry.manufacturer.name}</Fact>
              <Fact label="Product">{product.name}</Fact>
              <Fact label="Style">
                {plan.entry.seedProduct.surfaceStyle?.label ?? 'Not published by the source'}
              </Fact>
              <Fact label="Exact tile size">
                {`${formatInches(product.dimensions.widthInches)} × ${formatInches(product.dimensions.lengthInches)} × ${formatInches(product.dimensions.thicknessInches)} thick`}
              </Fact>
              <Fact label="Surface">
                {`Open-grid, self-draining. ${plan.entry.seedProduct.drainage.evidence}`}
              </Fact>
              {plan.entry.seedProduct.plannerCaveat === undefined ? null : (
                <Fact label="Caveat">{plan.entry.seedProduct.plannerCaveat}</Fact>
              )}
            </dl>
          </section>

          <section aria-labelledby="planner-geometry-heading" className="planner__panel">
            <h3 id="planner-geometry-heading">Garage, clearance, and openings</h3>
            <dl className="planner__facts">
              <Fact label="Outer garage">
                {`${formatInches(design.garage.widthInches)} across the front × ${formatInches(design.garage.lengthInches)} deep`}
              </Fact>
              <Fact label="Tile field">
                {`${formatInches(plan.design.tileField.widthInches)} × ${formatInches(plan.design.tileField.lengthInches)}`}
              </Fact>
              <Fact label="Expansion clearance">
                {`${formatInches(clearance.leftInches)} left, ${formatInches(clearance.rightInches)} right, ${formatInches(clearance.frontInches)} front, ${formatInches(clearance.backInches)} back`}
              </Fact>
              <Fact label="Front edge">
                The horizontal top edge of the diagram, where the garage doors are.
              </Fact>
              <Fact label="Front segments">
                <ul className="planner__plain-list" data-testid="planner-front-segments">
                  {front.segments.map((segment) => (
                    <li key={segment.id}>
                      {`${segment.label}: ${formatInches(segment.lengthInches)}`}
                    </li>
                  ))}
                </ul>
              </Fact>
              <Fact label="Edge gaps">
                <ul className="planner__plain-list">
                  {edgeGaps.map((gap) => (
                    <li key={gap.edge}>{`${gap.label}: ${formatGap(gap.inches)}`}</li>
                  ))}
                </ul>
              </Fact>
            </dl>
          </section>

          <section aria-labelledby="planner-purchase-heading" className="planner__panel">
            <h3 id="planner-purchase-heading">What to buy</h3>
            <table className="planner__table" data-testid="planner-purchase-table">
              <caption>
                {`Least-cost verified combination per color, including a ${String(plan.wasteAllowancePercent)}% waste allowance.`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Role and color</th>
                  <th scope="col">Tiles needed</th>
                  <th scope="col">Packages</th>
                  <th scope="col">Individual tiles</th>
                  <th scope="col">Purchased</th>
                  <th scope="col">Left over</th>
                  <th scope="col">Cost</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.key}>
                    <th scope="row">
                      <span
                        aria-hidden="true"
                        className="planner__swatch"
                        style={{ backgroundColor: purchase.swatchHex }}
                      />
                      {`${purchase.roleLabel} · ${purchase.colorName}`}
                    </th>
                    <td>
                      {`${String(purchase.requiredTileCount)} (${String(purchase.placedTileCount)} placed + ${String(purchase.wasteTileCount)} waste)`}
                    </td>
                    <td>{describePackages(purchase)}</td>
                    <td>
                      {purchase.canBuyIndividually
                        ? `${String(purchase.individualTileCount)} verified`
                        : 'No verified individual listing'}
                    </td>
                    <td>{String(purchase.totalPurchasedTileCount)}</td>
                    <td>{String(purchase.leftoverTileCount)}</td>
                    <td>
                      {purchase.totalCostCents === null
                        ? 'Unavailable'
                        : formatMoney(purchase.totalCostCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="planner__plain-list">
              {purchases.map((purchase) => (
                <li key={`${purchase.key}-explanation`}>
                  {`${purchase.colorName}: ${purchase.explanation} Seller: ${purchase.sellers.join(', ') || 'unavailable'}.`}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="planner-ramp-heading" className="planner__panel">
            <h3 id="planner-ramp-heading">Front transition ramps</h3>
            {ramp !== null && isRampPlan(ramp) ? (
              <>
                <dl className="planner__facts">
                  <Fact label="Accessory">
                    {`${ramp.accessory.name} from ${ramp.accessory.seller}`}
                  </Fact>
                  <Fact label="Sold as">
                    {`${ramp.accessory.saleUnit === 'kit' ? `kits of ${String(ramp.accessory.piecesPerSaleUnit)} pieces` : 'individual pieces'}, ${String(ramp.saleUnitsRequired)} required`}
                  </Fact>
                  <Fact label="Leftover">
                    {`${String(ramp.totalLeftoverInches)} in total, including ${String(ramp.surplusSegments)} unused straight pieces`}
                  </Fact>
                  <Fact label="Ramp cost">{formatMoney(ramp.totalCostCents)}</Fact>
                </dl>
                <ul className="planner__plain-list" data-testid="planner-ramp-openings">
                  {ramp.openings.map((opening) => (
                    <li key={opening.openingId}>{opening.description}</li>
                  ))}
                </ul>
                <p className="planner__hint">{ramp.expansionClearanceFact}</p>
                <ul className="planner__plain-list" data-testid="planner-ramp-caveats">
                  {ramp.caveats.map((caveat) => (
                    <li key={caveat}>{caveat}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="planner__error" data-testid="planner-ramp-unavailable">
                {describeRampPlan(ramp)}
              </p>
            )}
          </section>

          <section aria-labelledby="planner-cuts-heading" className="planner__panel">
            <h3 id="planner-cuts-heading">Cuts and totals</h3>
            <dl className="planner__facts">
              <Fact label="Full tiles">{String(plan.materials.fullTileCount)}</Fact>
              <Fact label="Cut source tiles">{String(plan.materials.cutTileCount)}</Fact>
              <Fact label="Cut strips">
                <ul className="planner__plain-list">
                  {plan.layout.edgeCutPieces.map((piece) => (
                    <li key={piece.edge}>
                      {`${String(piece.quantity)} × ${piece.edge}: ${formatInches(piece.widthInches)} × ${formatInches(piece.lengthInches)}`}
                    </li>
                  ))}
                </ul>
              </Fact>
              <Fact label="Cutting required">{plan.layout.cuttingRequired ? 'Yes' : 'No'}</Fact>
              <Fact label="Estimated tile cost">
                {plan.estimatedTotalCostCents === null
                  ? 'Unavailable'
                  : formatMoney(plan.estimatedTotalCostCents)}
              </Fact>
              <Fact label="Ramp cost">
                {plan.rampCostCents === null ? 'Unavailable' : formatMoney(plan.rampCostCents)}
              </Fact>
              <Fact label="Combined total">
                <span data-testid="planner-total-cost">
                  {plan.combinedTotalCostCents === null
                    ? 'Unavailable'
                    : formatMoney(plan.combinedTotalCostCents)}
                </span>
              </Fact>
              <Fact label={`Estimated tax (${ILLINOIS_STATE_DESTINATION.label})`}>
                {plan.destinationCost === null
                  ? 'Unavailable'
                  : `${formatMoney(plan.destinationCost.estimatedTaxCents)} at 6.25%`}
              </Fact>
              <Fact label="Shipping">
                {`${describeShippingEstimate(plan.destinationCost?.shippingCostCents ?? null)}. ${plan.shipping.explanation}`}
              </Fact>
              <Fact label="Total before shipping">
                <span data-testid="planner-total-before-shipping">
                  {plan.destinationCost === null
                    ? 'Unavailable'
                    : formatMoney(plan.destinationCost.totalBeforeShippingCents)}
                </span>
              </Fact>
              <Fact label="Estimated checkout total">
                {plan.destinationCost?.estimatedCheckoutTotalCents === null ||
                plan.destinationCost === null
                  ? 'Unavailable until shipping is known'
                  : formatMoney(plan.destinationCost.estimatedCheckoutTotalCents)}
              </Fact>
            </dl>
            <p className="planner__cut-note" data-testid="planner-cut-statement">
              {describeCutRequirement(design.garage, plan)}
            </p>
          </section>

          <section aria-labelledby="planner-sources-heading" className="planner__panel">
            <h3 id="planner-sources-heading">Sources and checked dates</h3>
            <ul className="planner__plain-list">
              {sources.map((source) => (
                <li key={`${source.label}-${source.url}`}>
                  {`${source.label}: `}
                  <a href={source.url} rel="noreferrer noopener" target="_blank">
                    {source.url}
                  </a>
                  {` (checked ${source.checkedDate})`}
                </li>
              ))}
            </ul>
            <p className="planner__disclaimer">{PRICING_DISCLAIMER}</p>
            <p className="planner__disclaimer">{AFFILIATION_DISCLAIMER}</p>
            <p className="planner__disclaimer">{plan.entry.trademarkNotice}</p>
            <p className="planner__disclaimer">
              {`Catalog last checked ${CATALOG_LATEST_CHECKED_DATE}.`}
            </p>
          </section>

          <section aria-labelledby="planner-plans-heading" className="planner__panel">
            <h3 id="planner-plans-heading">Save this plan</h3>
            <div className="planner__field">
              <label htmlFor="planner-plan-name">Plan name</label>
              <input
                id="planner-plan-name"
                onChange={(event) => {
                  onPlanNameChange(event.target.value);
                }}
                value={planName}
              />
            </div>
            <button className="planner__primary" onClick={onSavePlan} type="button">
              Save plan
            </button>
            <SavedPlans
              onDeletePlan={onDeletePlan}
              onOpenPlan={onOpenPlan}
              savedPlans={savedPlans}
            />
          </section>

          <ExportControls
            garage={design.garage}
            getLayoutSvg={() => summarySvgRef.current}
            reportSections={reportSections}
            reportSources={sources}
            selectedEntry={plan.entry}
            summary={plan.summary}
          />
        </div>

        <figure className="planner__canvas planner__canvas--wide" data-testid="planner-canvas">
          <ExactFloorPreview
            front={front}
            garage={design.garage}
            legendExtras={legendExtras}
            plan={plan}
            ramp={ramp}
            svgRef={(svg) => {
              summarySvgRef.current = svg;
            }}
            testId="summary-floor-preview"
            variant="detailed"
          />
          <figcaption>
            {`Front edge at the top with ${String(front.openingCount)} door ${front.openingCount === 1 ? 'opening' : 'openings'} and ramps across the openings only. Hatched edges are cut tiles; the shaded ring is expansion clearance.`}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

interface SavedPlansProps {
  readonly savedPlans: readonly RoughPlanDocument[];
  readonly onOpenPlan: (plan: RoughPlanDocument) => void;
  readonly onDeletePlan: (plan: RoughPlanDocument) => void;
}

function SavedPlans({ savedPlans, onOpenPlan, onDeletePlan }: SavedPlansProps) {
  if (savedPlans.length === 0) {
    return <p className="planner__hint">No plans are saved in this browser yet.</p>;
  }

  return (
    <ul className="planner__saved-plans">
      {savedPlans.map((plan) => (
        <li key={plan.id}>
          <span>{plan.name}</span>
          <button
            onClick={() => {
              onOpenPlan(plan);
            }}
            type="button"
          >
            {`Open ${plan.name}`}
          </button>
          <button
            onClick={() => {
              onDeletePlan(plan);
            }}
            type="button"
          >
            {`Delete ${plan.name}`}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface FactProps {
  readonly label: string;
  readonly children: ReactNode;
}

function Fact({ label, children }: FactProps) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function describePackages(purchase: ColorPurchasePlan): string {
  if (purchase.packs.length === 0) {
    return 'No verified package offer';
  }

  return purchase.packs
    .map(
      (pack) =>
        `${String(pack.packCount)} × ${pack.offerLabel} (${String(pack.tilesPerPack)} tiles each) from ${pack.seller}`
    )
    .join(' + ');
}

function describeStartingCost(plan: ProductPlan): string {
  const dimensions = plan.entry.seedProduct.product.dimensions;
  const perTile = plan.entry.seedProduct.prices.map(
    (price) => normalizeOfferPricing(price.price, dimensions).perTileCents
  );
  if (perTile.length === 0) {
    return 'No published price';
  }

  const estimate =
    plan.estimatedTotalCostCents === null
      ? 'floor estimate unavailable'
      : `${formatMoney(plan.estimatedTotalCostCents)} for this design`;
  return `From ${formatUnitMoney(Math.min(...perTile))} per tile · ${estimate}`;
}

function describeSaleOptions(entry: CatalogEntry): string {
  const options = [
    ...new Set(
      entry.seedProduct.prices.map(
        (price) =>
          `${price.basisLabel} from ${price.seller}${price.canBuyIndividually ? ' (individual tiles verified)' : ''}`
      )
    ),
  ];
  return options.length === 0 ? 'No verified sale option' : options.join('; ');
}

function toFrontDraft(state: GarageFrontState): FrontDraft {
  return {
    doorWidth: state.doorWidthInches === null ? '' : String(state.doorWidthInches),
    centerWall: state.centerWallInches === null ? '' : String(state.centerWallInches),
    leftWall: state.leftWallInches === null ? '' : String(state.leftWallInches),
    rightWall: state.rightWallInches === null ? '' : String(state.rightWallInches),
  };
}

function toCustomDraft(state: GarageFrontState): readonly CustomSegmentDraft[] {
  return getGarageFrontGeometry(state).segments.map((segment) => ({
    kind: segment.kind,
    length: String(segment.lengthInches),
  }));
}

function toSegmentInputs(
  segments: readonly CustomSegmentDraft[],
  fallback: GarageFrontState
): readonly GarageFrontSegmentInput[] {
  const parsed = segments.map((segment) => ({
    kind: segment.kind,
    lengthInches: Number(segment.length.trim()),
  }));

  return parsed.every(
    (segment) => Number.isFinite(segment.lengthInches) && segment.lengthInches > 0
  )
    ? parsed
    : getGarageFrontGeometry(fallback).segments.map((segment) => ({
        kind: segment.kind,
        lengthInches: segment.lengthInches,
      }));
}

function isPlannerProduct(productId: string): boolean {
  return listDrainableCatalogEntries().some((entry) => entry.seedProduct.product.id === productId);
}

function describeRestore(active: RoughPlanDocument | null): string | null {
  if (active === null) return null;
  return active.selectedProductId !== null && !isPlannerProduct(active.selectedProductId)
    ? `Restored "${active.name}". Its tile is not one of the drainable options this planner ` +
        'offers, so choose a drainable tile below.'
    : `Restored your last plan, "${active.name}".`;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function activePlanOf(
  read: ReturnType<VersionedStorageAdapter<PersistedRoughPlansV1>['read']>
): RoughPlanDocument | null {
  return read.ok ? (read.value?.activePlan ?? null) : null;
}
