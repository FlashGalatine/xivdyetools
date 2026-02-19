# [FINDING-008]: APIService Cache Not Cleared on Logout

## Severity
LOW

## Category
CWE-212: Improper Removal of Sensitive Information Before Storage or Transfer

## Location
- File: `apps/web-app/src/services/auth-service.ts` (logout function)
- File: `apps/web-app/src/services/api-service.ts` (singleton pattern)

## Description
The web application's `APIService` is a singleton that caches Universalis market data. When a user logs out, the JWT is removed from localStorage but the APIService singleton and its cached data persist. While the cached data (dye prices) is not user-specific or sensitive, this pattern could become a problem if the APIService ever caches user-specific data in the future.

## Evidence
```typescript
// Logout clears auth state but not API cache
// APIService.getInstance() remains in memory with cached data
localStorage.removeItem('jwt_token');
localStorage.removeItem('jwt_expires_at');
// No call to APIService.clearCache() or APIService.resetInstance()
```

## Impact
- Currently low: cached data is public market prices, not user-specific
- Future risk: if user-specific data is ever cached, it could leak between sessions
- The IndexedDB cache backend persists across sessions by design

## Recommendation
1. Add `APIService.clearCache()` call to the logout function
2. Consider resetting the APIService singleton on logout
3. Document which data is cached and whether it's user-specific
4. Add a test verifying cache is cleared on logout

## References
- [CWE-212](https://cwe.mitre.org/data/definitions/212.html)
