import { useState } from 'react';
import {
  detectMissingCapabilities,
  type BrowserCapability,
  type BrowserLike,
} from '../../domain/browserSupport';

export interface BrowserSupportNoticeProps {
  /** Injected browser for tests; defaults to the real `window`. */
  readonly browser?: BrowserLike;
}

/**
 * Says up front which parts of the app this browser cannot run, instead of letting Save or
 * Export fail later with a generic error. Renders nothing when everything is supported.
 *
 * It is a named region rather than an alert: the notice exists from the first paint, and
 * several screen readers only announce a live region when its content changes afterwards,
 * so an alert here would be silent. In reading order it sits directly under the title.
 */
export function BrowserSupportNotice({ browser }: BrowserSupportNoticeProps = {}) {
  const [missing] = useState<readonly BrowserCapability[]>(() =>
    detectMissingCapabilities(browser ?? (typeof window === 'undefined' ? {} : window))
  );

  if (missing.length === 0) return null;

  return (
    <section aria-labelledby="browser-support-heading" className="browser-support" role="region">
      <h2 className="browser-support__heading" id="browser-support-heading">
        <span aria-hidden="true" className="browser-support__icon">
          !
        </span>{' '}
        This browser cannot run every part of the app
      </h2>
      <ul className="browser-support__list">
        {missing.map((capability) => (
          <li key={capability.id}>
            <strong>{capability.label}.</strong> {capability.impact}
          </li>
        ))}
      </ul>
      <p className="browser-support__note">
        Everything else still works. A current desktop version of Chrome, Edge, Firefox, or Safari
        supports all of it.
      </p>
    </section>
  );
}
