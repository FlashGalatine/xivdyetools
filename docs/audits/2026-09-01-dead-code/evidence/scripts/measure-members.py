#!/usr/bin/env python3
"""measure-members.py — line span of the DEAD-005 test-only class methods, so the report's
totals are measured rather than estimated. Spans run from the method's jsdoc to its closing brace."""
import os, re, subprocess

root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
TARGETS = {
    "apps/web-app/src/services/theme-service.ts": ["getColor", "getThemeVariants", "getLightVariant",
        "getDarkVariant", "getCurrentThemeObject", "toggleDarkMode", "resetToDefault"],
    "apps/web-app/src/services/camera-service.ts": ["isCameraSupported", "requestPermission",
        "onCameraAvailabilityChange", "getCurrentStream", "isStreamActive", "detachStreamFromVideo"],
    "apps/web-app/src/services/collection-service.ts": ["reorderFavorites", "canAddFavorite",
        "getCollectionsByKind", "reorderCollectionDyes", "getCollectionsContainingDye", "getMaxCollections"],
    "apps/web-app/src/services/storage-service.ts": ["resetAvailabilityCache", "getSize", "removeByPrefix"],
    "apps/web-app/src/services/modal-service.ts": ["dismissAll", "getModals"],
    "apps/web-app/src/services/toast-service.ts": ["dismissAll", "getToasts"],
    "apps/web-app/src/services/market-board-service.ts": ["getIsFetching", "getAllPrices"],
    "apps/web-app/src/services/language-service.ts": ["getCurrentLocaleDisplay", "getAvailableLocales"],
    "apps/web-app/src/services/tutorial-service.ts": ["getTutorial", "getCurrentStep"],
    "apps/web-app/src/services/router-service.ts": ["getRoutes"],
    "apps/web-app/src/services/indexeddb-service.ts": ["isIndexedDBSupported"],
    "apps/web-app/src/services/community-preset-service.ts": ["invalidatePresets"],
    "apps/web-app/src/services/api-service-wrapper.ts": ["reinitialize"],
    "apps/web-app/src/shared/error-handler.ts": ["isCritical"],
}
total = n = 0
for path, methods in TARGETS.items():
    src = open(os.path.join(root, path), encoding="utf-8").read().splitlines()
    for m in methods:
        start = None
        for i, line in enumerate(src):
            if re.match(r"\s{2,}(?:public\s+|static\s+|async\s+|get\s+)*" + re.escape(m) + r"\s*(?:<[^>]*>)?\(", line):
                start = i
                break
        if start is None:
            print(f"?? {m} in {path}")
            continue
        doc = start
        while doc > 0 and (src[doc-1].strip().startswith("*") or src[doc-1].strip().startswith("/**")):
            doc -= 1
        depth, end, seen = 0, start, False
        for i in range(start, len(src)):
            depth += src[i].count("{") - src[i].count("}")
            if "{" in src[i]:
                seen = True
            if seen and depth <= 0:
                end = i
                break
        span = end - doc + 1
        total += span; n += 1
        print(f"{span:4}  {path}:{doc+1}-{end+1}  {m}")
print(f"\n{n} methods, {total} lines")
