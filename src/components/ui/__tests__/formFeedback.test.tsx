// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from '../Input';
import { Select } from '../Select';

describe('accessible form feedback', () => {
  it('associates input errors while retaining the caller hint and explicit ID', () => {
    const { rerender } = render(<><p id="hint">Use your profile name</p><Input id="name" label="Nickname" error="Name is required" aria-describedby="hint" /></>);
    const input = screen.getByRole('textbox', { name: 'Nickname', description: 'Use your profile name Name is required' });
    expect(input.id).toBe('name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    rerender(<><p id="hint">Use your profile name</p><Input id="name" label="Nickname" aria-describedby="hint" /></>);
    expect(input.getAttribute('aria-describedby')).toBe('hint');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(screen.queryByText('Name is required')).toBeNull();
  });

  it('associates select descriptions and errors without replacing an external hint', () => {
    const { rerender } = render(<><p id="hint">Choose an installed runtime</p><Select label="Java" description="For this pack" error="Runtime unavailable" aria-describedby="hint"><option>Java 21</option></Select></>);
    const select = screen.getByRole('combobox', { name: 'Java', description: 'Choose an installed runtime For this pack Runtime unavailable' });
    expect(select.getAttribute('aria-invalid')).toBe('true');
    rerender(<><p id="hint">Choose an installed runtime</p><Select label="Java" description="For this pack" aria-describedby="hint"><option>Java 21</option></Select></>);
    expect(screen.getByRole('combobox', { description: 'Choose an installed runtime For this pack' })).toBe(select);
    expect(select.hasAttribute('aria-invalid')).toBe(false);
  });

  it('uses independent error references for multiple fields', () => {
    render(<><Input label="First" error="First error" /><Input label="Second" error="Second error" /><Select label="Third" error="Third error"><option>A</option></Select></>);
    const controls = [screen.getByRole('textbox', { description: 'First error' }), screen.getByRole('textbox', { description: 'Second error' }), screen.getByRole('combobox', { description: 'Third error' })];
    expect(new Set(controls.map((control) => control.getAttribute('aria-describedby'))).size).toBe(3);
  });

  it('does not reference absent feedback elements', () => {
    render(<><Input label="Name" /><Select label="Version"><option>1.20.1</option></Select></>);
    expect(screen.getByRole('textbox').hasAttribute('aria-describedby')).toBe(false);
    expect(screen.getByRole('combobox').hasAttribute('aria-describedby')).toBe(false);
  });
});
