// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../scenarios', () => ({
  ManualVerificationNavigation: () => <nav aria-label="Manual verification navigation" />,
  ManualVerificationScenarios: () => <div data-testid="manual-scenario" />,
}));

import { ManualVerificationApp } from '../ManualVerificationApp';
import { CLOSEOUT_VIEWS } from '../views';

function renderView(view: string) {
  window.history.replaceState({}, '', `?view=${view}`);
  return render(<ManualVerificationApp />);
}

describe('ManualVerificationApp viewport containment', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it.each([...CLOSEOUT_VIEWS.map((view) => view.id), 'phase-41-surfaces-en', 'phase-41-surfaces-ru'])(
    'contains %s and its fixed modal backdrop within the product viewport', (view) => {
    const { container } = renderView(view);

    expect(container.firstElementChild?.className).toContain('h-screen');
    expect(container.querySelector('main')?.className).toContain('overflow-hidden');
  });

  it('keeps ordinary manual routes document-scrollable for reachable controls', () => {
    const { container } = renderView('phase-41-ownership-en');

    expect(container.firstElementChild?.className).toContain('min-h-screen');
    expect(container.querySelector('main')?.className).not.toContain('overflow-hidden');
  });
});
