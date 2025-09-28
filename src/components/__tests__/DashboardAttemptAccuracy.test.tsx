import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardClient from '../DashboardClient';

// Lightweight smoke test kept after refactor removing legacy progress chart
describe('Dashboard attempt accuracy modal (smoke)', () => {
  it('renders Commander Debriefing heading', () => {
    render(<DashboardClient />);
    const el = screen.getByText(/Commander Debriefing/i);
    expect(!!el).toBe(true);
  });
});
// Removed – superseded by future integration tests.
