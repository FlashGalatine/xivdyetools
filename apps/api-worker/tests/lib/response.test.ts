import { describe, it, expect } from 'vitest';
import { buildPagination } from '../../src/lib/response.js';

describe('buildPagination', () => {
  it('calculates pagination for first page', () => {
    const result = buildPagination(1, 50, 136);
    expect(result).toEqual({
      page: 1,
      perPage: 50,
      total: 136,
      totalPages: 3,
      hasNext: true,
      hasPrev: false,
    });
  });

  it('calculates pagination for middle page', () => {
    const result = buildPagination(2, 50, 136);
    expect(result).toEqual({
      page: 2,
      perPage: 50,
      total: 136,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('calculates pagination for last page', () => {
    const result = buildPagination(3, 50, 136);
    expect(result).toEqual({
      page: 3,
      perPage: 50,
      total: 136,
      totalPages: 3,
      hasNext: false,
      hasPrev: true,
    });
  });

  it('handles single page', () => {
    const result = buildPagination(1, 200, 10);
    expect(result).toEqual({
      page: 1,
      perPage: 200,
      total: 10,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('handles empty results', () => {
    const result = buildPagination(1, 50, 0);
    expect(result).toEqual({
      page: 1,
      perPage: 50,
      total: 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });
});
