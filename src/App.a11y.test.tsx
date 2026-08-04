import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { AFFILIATION_DISCLAIMER, CATALOG_LATEST_CHECKED_DATE, PRICING_DISCLAIMER } from './data';

describe('App shell accessibility', () => {
  it('offers a skip link that points at a real landmark and takes focus first', async () => {
    const user = userEvent.setup();
    render(<App />);

    const links = screen.getAllByRole('link', { name: /^Skip to/ });
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#planner-main']);

    for (const link of links) {
      const target = document.getElementById((link.getAttribute('href') ?? '').slice(1));
      expect(target).not.toBeNull();
    }

    await user.tab();
    expect(links[0]).toHaveFocus();
  });

  it('gives the later planner sections a focus target so a selection can land on them', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('radio', { name: 'RaceDeck Free-Flow' }));

    expect(screen.getByRole('region', { name: 'Drainable tile options' })).toHaveAttribute(
      'tabindex',
      '-1'
    );
    expect(screen.getByRole('region', { name: 'Project summary' })).toHaveAttribute(
      'tabindex',
      '-1'
    );
  });

  it('keeps the pricing, checked-date, and affiliation disclaimers in the footer', () => {
    render(<App />);

    const footer = screen.getByRole('contentinfo');

    expect(footer).toHaveTextContent(PRICING_DISCLAIMER);
    expect(footer).toHaveTextContent(AFFILIATION_DISCLAIMER);
    expect(footer).toHaveTextContent(`last checked on ${CATALOG_LATEST_CHECKED_DATE}`);
  });

  it('exposes one main landmark that holds the planner', () => {
    render(<App />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'planner-main');
    expect(main).toContainElement(screen.getByRole('region', { name: 'Garage & design' }));
    expect(main).toContainElement(screen.getAllByTestId('planner-canvas')[0]);
  });
});
