# XIVAuth Integration Plan

> **Status**: Deferred to future session
> **Created**: 2024-12-13
> **Related**: v3 Preset Palettes Tool

## Overview

XIVAuth is an OAuth2 identity provider for FFXIV communities that supports multiple authentication methods including Discord. This document outlines the integration plan for adding XIVAuth as an alternative authentication method alongside our existing Discord OAuth.

### Why XIVAuth?

1. **Community Standard**: Many FFXIV tools use XIVAuth, making it familiar to users
2. **Multiple Auth Methods**: Supports Discord, but also other providers
3. **FFXIV-Specific Features**: Character verification, lodestone integration
4. **Discord Compatibility**: Users can link their Discord via `user:social` scope

## OAuth2 Flow

XIVAuth uses standard OAuth2 Authorization Code flow with PKCE.

### Endpoints

| Endpoint | URL |
|----------|-----|
| Authorization | `https://xivauth.net/oauth/authorize` |
| Token | `https://xivauth.net/oauth/token` |
| User Info | `https://xivauth.net/api/v1/user` |

### Required Scopes

```
user character refresh user:social
```

| Scope | Purpose |
|-------|---------|
| `user` | Basic user info (id, username) |
| `character` | FFXIV character info (optional) |
| `refresh` | Refresh token support |
| `user:social` | Discord ID for moderation compatibility |

### Flow Diagram

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  User   │────▶│  Frontend   │────▶│ XIVAuth.net │────▶│ discord-worker│
└─────────┘     └─────────────┘     └─────────────┘     └──────────────┘
    1. Click Login   2. Redirect to    3. User approves   4. Exchange code
                        XIVAuth                             for token

    ◀────────────────────────────────────────────────────────────────────
    8. Show user                       5. Redirect back   6. Verify token
       profile                            with code       7. Store session
```

## Implementation Checklist

### Phase 1: Backend (discord-worker)

- [ ] Register XIVAuth OAuth application at https://xivauth.net/developer
- [ ] Add XIVAuth client credentials to environment variables
  - `XIVAUTH_CLIENT_ID`
  - `XIVAUTH_CLIENT_SECRET`
- [ ] Create new endpoint: `POST /api/v1/auth/xivauth/callback`
  - Exchange authorization code for tokens
  - Fetch user info from XIVAuth API
  - Extract Discord ID from `social` object (if linked)
  - Create/update user in database
- [ ] Update database schema to support XIVAuth users
  - Add `xivauth_id` column to users table
  - Add `auth_provider` column ('discord' | 'xivauth')
  - Make `discord_id` nullable (XIVAuth-only users won't have it)
- [ ] Handle user merging (same Discord linked to both auth methods)

### Phase 2: Frontend (web-app)

- [ ] Update `auth-service.ts` to support XIVAuth provider
- [ ] Add XIVAuth login button to `auth-button.ts`
- [ ] Update token storage to include provider type
- [ ] Handle XIVAuth refresh token flow
- [ ] Update user profile display for XIVAuth users

### Phase 3: Moderation Compatibility

**Decision: Option A - Allow XIVAuth-only Users**

XIVAuth users without linked Discord can still:
- Submit presets
- Vote on presets
- View community content

Moderation handling:
- XIVAuth users have `xivauth_id` as their identifier
- Moderation actions can target either `discord_id` OR `xivauth_id`
- Admin panel should display both identifiers when available
- Bans can be by XIVAuth ID if no Discord linked

### Phase 4: Testing

- [ ] Test XIVAuth login flow end-to-end
- [ ] Test user with Discord linked via XIVAuth
- [ ] Test user without Discord (XIVAuth-only)
- [ ] Test preset submission from XIVAuth user
- [ ] Test moderation actions on XIVAuth users
- [ ] Test token refresh flow
- [ ] Test error handling (revoked access, expired tokens)

## API Reference

### User Info Response (`/api/v1/user`)

```json
{
  "id": "12345678-1234-1234-1234-123456789012",
  "username": "PlayerName",
  "email": "player@example.com",
  "avatar_url": "https://xivauth.net/avatars/...",
  "social": {
    "discord": {
      "id": "123456789012345678",
      "username": "Player#1234",
      "avatar": "abc123..."
    }
  },
  "characters": [
    {
      "id": 12345678,
      "name": "Firstname Lastname",
      "server": "Gilgamesh",
      "verified": true
    }
  ]
}
```

### Token Response (`/oauth/token`)

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJ...",
  "scope": "user character refresh user:social"
}
```

## Database Schema Changes

### Users Table

```sql
ALTER TABLE users ADD COLUMN xivauth_id UUID;
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'discord';
ALTER TABLE users ALTER COLUMN discord_id DROP NOT NULL;
CREATE UNIQUE INDEX idx_users_xivauth_id ON users(xivauth_id) WHERE xivauth_id IS NOT NULL;
```

### Moderation Table

```sql
ALTER TABLE moderation_actions ADD COLUMN xivauth_id UUID;
-- Allow targeting users by either ID
ALTER TABLE moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_discord_id_not_null;
ADD CONSTRAINT moderation_actions_target_required
  CHECK (discord_id IS NOT NULL OR xivauth_id IS NOT NULL);
```

## Frontend Components

### AuthButton Updates

```typescript
// auth-button.ts
private renderLoginButtons(): void {
  // Discord button (existing)
  const discordBtn = this.createElement('button', {
    className: 'discord-login-btn',
    textContent: 'Login with Discord'
  });

  // XIVAuth button (new)
  const xivAuthBtn = this.createElement('button', {
    className: 'xivauth-login-btn',
    textContent: 'Login with XIVAuth'
  });

  // Separator
  const separator = this.createElement('div', {
    className: 'auth-separator',
    textContent: 'or'
  });
}
```

### AuthService Updates

```typescript
// auth-service.ts
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  expiresAt: number | null;
  provider: 'discord' | 'xivauth' | null; // NEW
}

async loginWithXIVAuth(): Promise<void> {
  const authUrl = new URL('https://xivauth.net/oauth/authorize');
  authUrl.searchParams.set('client_id', XIVAUTH_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', XIVAUTH_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'user character refresh user:social');
  authUrl.searchParams.set('state', generateState());

  window.location.href = authUrl.toString();
}
```

## Security Considerations

1. **State Parameter**: Use cryptographically random state to prevent CSRF
2. **PKCE**: Implement code_verifier/code_challenge for public clients
3. **Token Storage**: Store tokens in httpOnly cookies or secure localStorage
4. **Refresh Flow**: Implement automatic token refresh before expiry
5. **Scope Validation**: Verify returned scopes match requested scopes

## Migration Path for Existing Users

1. Existing Discord users continue working unchanged
2. Users can link XIVAuth account to existing Discord account
3. If Discord ID matches, accounts are merged automatically
4. User can switch between auth methods without losing data

## Resources

- XIVAuth Developer Portal: https://xivauth.net/developer
- XIVAuth API Documentation: https://kazwolfe.notion.site/Documentation-128e77f0016c4901888ea1234678c37d
- OAuth2 RFC 6749: https://datatracker.ietf.org/doc/html/rfc6749
- PKCE RFC 7636: https://datatracker.ietf.org/doc/html/rfc7636

---

## Implementation Notes (Future Session)

When implementing XIVAuth, start with:

1. **Backend first** - Create the OAuth callback endpoint in discord-worker
2. **Database migration** - Add xivauth_id column and update constraints
3. **Frontend button** - Add XIVAuth login option to AuthButton
4. **Test with dev credentials** - XIVAuth provides test application credentials
5. **User merging logic** - Handle case where same Discord is linked both ways

The frontend changes are minimal since we can reuse most of the existing auth flow infrastructure. The main work is in the backend to support dual authentication providers.
