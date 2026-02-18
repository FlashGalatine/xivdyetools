/**
 * MSW (Mock Service Worker) handlers for API testing
 * These handlers intercept network requests and return mock responses
 */
import { http, HttpResponse } from 'msw';

// API base URL - must match the URL in community-preset-service.ts
const API_URL = 'https://api.xivdyetools.app';

// ============================================
// Mock Data
// ============================================

export const mockPresets = [
  {
    id: 'preset-1',
    name: 'Warrior of Light',
    description: 'A heroic color palette inspired by the Warriors of Light',
    category_id: 'jobs',
    dyes: [1, 5, 10],
    tags: ['warrior', 'light', 'heroic'],
    author_discord_id: '123456789',
    author_name: 'TestUser',
    vote_count: 42,
    status: 'approved',
    is_curated: false,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'preset-2',
    name: 'Dark Knight',
    description: 'Dark and brooding colors for the Dark Knight job',
    category_id: 'jobs',
    dyes: [15, 20, 25],
    tags: ['dark', 'knight', 'tank'],
    author_discord_id: '987654321',
    author_name: 'AnotherUser',
    vote_count: 28,
    status: 'approved',
    is_curated: true,
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-01-12T14:30:00Z',
  },
];

export const mockCategories = [
  {
    id: 'jobs',
    name: 'Jobs',
    description: 'Color palettes themed after FFXIV jobs',
    icon: null,
    is_curated: true,
    preset_count: 25,
  },
  {
    id: 'grand-companies',
    name: 'Grand Companies',
    description: 'Colors representing the three Grand Companies',
    icon: null,
    is_curated: true,
    preset_count: 12,
  },
  {
    id: 'community',
    name: 'Community',
    description: 'User-submitted color palettes',
    icon: null,
    is_curated: false,
    preset_count: 100,
  },
];

// ============================================
// Handlers
// ============================================

export const handlers = [
  // Health check
  http.get(`${API_URL}/health`, () => {
    return HttpResponse.json({ status: 'ok' });
  }),

  // Get presets with filtering
  http.get(`${API_URL}/api/v1/presets`, ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const page = parseInt(url.searchParams.get('page') || '1', 10);

    let filtered = [...mockPresets];

    // Apply filters
    if (category) {
      filtered = filtered.filter((p) => p.category_id === category);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower) ||
          p.tags.some((t) => t.toLowerCase().includes(searchLower))
      );
    }
    if (status) {
      filtered = filtered.filter((p) => p.status === status);
    }

    // Pagination
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return HttpResponse.json({
      presets: paginated,
      total: filtered.length,
      page,
      limit,
      has_more: start + limit < filtered.length,
    });
  }),

  // Get featured presets
  http.get(`${API_URL}/api/v1/presets/featured`, () => {
    const featured = [...mockPresets].sort((a, b) => b.vote_count - a.vote_count);
    return HttpResponse.json({ presets: featured });
  }),

  // Get single preset
  http.get(`${API_URL}/api/v1/presets/:id`, ({ params }) => {
    const { id } = params;
    const preset = mockPresets.find((p) => p.id === id);

    if (!preset) {
      // Message must include '404' for the service to return null instead of throwing
      return HttpResponse.json({ message: '404 - Preset not found' }, { status: 404 });
    }

    return HttpResponse.json(preset);
  }),

  // Get categories
  http.get(`${API_URL}/api/v1/categories`, () => {
    return HttpResponse.json({ categories: mockCategories });
  }),

  // Submit preset (authenticated)
  http.post(`${API_URL}/api/v1/presets`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      name: string;
      description: string;
      category_id: string;
      dyes: number[];
      tags: string[];
    };

    const newPreset = {
      id: `preset-${Date.now()}`,
      name: body.name,
      description: body.description,
      category_id: body.category_id,
      dyes: body.dyes,
      tags: body.tags,
      author_discord_id: '123456789',
      author_name: 'TestUser',
      vote_count: 0,
      status: 'pending' as const,
      is_curated: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      preset: newPreset,
      moderation_status: 'pending',
    });
  }),

  // Vote for preset
  http.post(`${API_URL}/api/v1/votes/:presetId`, ({ request, params }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { presetId } = params;
    const preset = mockPresets.find((p) => p.id === presetId);

    if (!preset) {
      return HttpResponse.json({ message: 'Preset not found' }, { status: 404 });
    }

    return HttpResponse.json({
      success: true,
      new_vote_count: preset.vote_count + 1,
    });
  }),

  // Remove vote
  http.delete(`${API_URL}/api/v1/votes/:presetId`, ({ request, params }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { presetId } = params;
    const preset = mockPresets.find((p) => p.id === presetId);

    if (!preset) {
      return HttpResponse.json({ message: 'Preset not found' }, { status: 404 });
    }

    return HttpResponse.json({
      success: true,
      new_vote_count: Math.max(0, preset.vote_count - 1),
    });
  }),

  // Check vote status
  http.get(`${API_URL}/api/v1/votes/:presetId/check`, ({ request, params }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ has_voted: false, vote_count: 0 });
    }

    const { presetId } = params;
    const preset = mockPresets.find((p) => p.id === presetId);

    return HttpResponse.json({
      has_voted: false,
      vote_count: preset?.vote_count || 0,
    });
  }),

  // Get user's submissions
  http.get(`${API_URL}/api/v1/presets/mine`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userPresets = mockPresets.filter((p) => p.author_discord_id === '123456789');
    return HttpResponse.json({
      presets: userPresets,
      total: userPresets.length,
    });
  }),

  // Rate limit check
  http.get(`${API_URL}/api/v1/presets/rate-limit`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ remaining: 10, limit: 10, reset_at: null });
    }

    return HttpResponse.json({
      remaining: 8,
      limit: 10,
      reset_at: new Date(Date.now() + 3600000).toISOString(),
    });
  }),

  // Delete preset
  http.delete(`${API_URL}/api/v1/presets/:presetId`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    return HttpResponse.json({ success: true });
  }),

  // Edit preset
  http.patch(`${API_URL}/api/v1/presets/:presetId`, async ({ request, params }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { presetId } = params;
    const preset = mockPresets.find((p) => p.id === presetId);

    if (!preset) {
      return HttpResponse.json({ message: 'Preset not found' }, { status: 404 });
    }

    const updates = (await request.json()) as Record<string, unknown>;

    const updatedPreset = {
      ...preset,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      preset: updatedPreset,
      moderation_status: 'pending',
    });
  }),
];

// ============================================
// Error Handlers (for testing error scenarios)
// ============================================

export const errorHandlers = {
  networkError: http.get(`${API_URL}/health`, () => {
    return HttpResponse.error();
  }),

  serverError: http.get(`${API_URL}/api/v1/presets`, () => {
    return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
  }),

  timeout: http.get(`${API_URL}/api/v1/presets`, async () => {
    // Simulate a long delay (longer than the service timeout)
    await new Promise((resolve) => setTimeout(resolve, 15000));
    return HttpResponse.json({ presets: [] });
  }),
};
