import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BrowserLike } from '../../domain/browserSupport';
import { BrowserSupportNotice } from './BrowserSupportNotice';

const workingBrowser: BrowserLike = {
  localStorage: { setItem: () => undefined, removeItem: () => undefined },
  HTMLCanvasElement: { prototype: { toBlob: () => undefined } },
  URL: { createObjectURL: () => 'blob:x' },
  XMLSerializer: function XMLSerializerStub() {
    return undefined;
  },
  CSS: { supports: () => true },
};

describe('BrowserSupportNotice', () => {
  it('renders nothing when the browser supports everything', () => {
    const { container } = render(<BrowserSupportNotice browser={workingBrowser} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('names the missing capabilities and what stops working', () => {
    render(
      <BrowserSupportNotice
        browser={{ ...workingBrowser, localStorage: null, HTMLCanvasElement: { prototype: {} } }}
      />
    );

    const notice = screen.getByRole('region', { name: /cannot run every part/i });

    expect(notice).toHaveTextContent(/Local storage is blocked or unavailable/i);
    expect(notice).toHaveTextContent(/Designs cannot be saved/i);
    expect(notice).toHaveTextContent(/Canvas image export is unavailable/i);
    expect(notice).toHaveTextContent(/printable report/i);
  });
});
