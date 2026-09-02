#!/usr/bin/env python3
"""measure.py — line span of each confirmed dead symbol (declaration through its closing brace),
so the report's line totals are measured rather than estimated."""
import os, re, subprocess, sys

root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
TARGETS = [
    ("apps/api-worker/src/lib/response.ts", "errorResponse"),
    ("apps/api-worker/src/universalis/services/cache-service.ts", "deleteAsync"),
    ("apps/api-worker/src/universalis/services/cache-service.ts", "deleteEntry"),
    ("apps/api-worker/src/universalis/test-setup.ts", "createMockEnv"),
    ("apps/moderation-worker/src/utils/response.ts", "autocompleteResponse"),
    ("apps/moderation-worker/src/utils/response.ts", "embedResponse"),
    ("apps/moderation-worker/src/utils/response.ts", "infoEmbed"),
    ("apps/moderation-worker/src/utils/response.ts", "hexToDiscordColor"),
    ("apps/moderation-worker/src/utils/response.ts", "encodeBase64Url"),
    ("apps/moderation-worker/src/utils/discord-api.ts", "deleteOriginalResponse"),
    ("apps/moderation-worker/src/utils/discord-api.ts", "sendFollowUp"),
    ("apps/moderation-worker/src/services/i18n.ts", "getLocaleInfo"),
    ("apps/moderation-worker/src/services/bot-i18n.ts", "createTranslator"),
    ("apps/moderation-worker/src/services/preset-api.ts", "getModerationHistory"),
    ("apps/moderation-worker/src/services/preset-api.ts", "isApiEnabled"),
    ("apps/moderation-worker/src/middleware/rate-limit.ts", "getRateLimitInfo"),
    ("apps/moderation-worker/src/handlers/buttons/preset-moderation.ts", "isPresetModerationButton"),
    ("apps/moderation-worker/src/types/ban.ts", "toBannedUser"),
    ("apps/presets-api/src/services/moderation-service.ts", "notifyModerators"),
    ("apps/presets-api/src/services/validation-service.ts", "validateStringLength"),
    ("apps/presets-api/src/services/validation-service.ts", "validateArray"),
    ("apps/presets-api/src/services/validation-service.ts", "validateEnum"),
    ("apps/presets-api/src/middleware/ban-check.ts", "checkBanStatus"),
    ("apps/presets-api/src/middleware/ban-check.ts", "requireNotBannedCheck"),
    ("apps/oauth/src/constants/oauth.ts", "DISCORD_REQUIRED_SCOPES"),
    ("apps/oauth/src/utils/state-signing.ts", "isStateSigned"),
    ("apps/oauth/src/services/user-service.ts", "findUserById"),
    ("apps/oauth/src/services/user-service.ts", "findUserByDiscordId"),
    ("apps/oauth/src/services/user-service.ts", "findUserByXIVAuthId"),
    ("apps/image-worker/src/photon.ts", "getImageDimensions"),
    ("apps/web-app/src/components/changelog-modal.ts", "closeChangelogModal"),
    ("apps/web-app/src/services/chara-resolve-service.ts", "clearCharaResolveCache"),
    ("apps/web-app/src/services/config-controller.ts", "getConfigController"),
    ("apps/web-app/src/services/harmony-generator.ts", "findHarmonyDyes"),
    ("apps/web-app/src/services/market-board-service.ts", "getMarketBoardService"),
    ("apps/discord-worker/src/commands/registry.ts", "registryCommandNames"),
    ("apps/stoat-worker/src/commands/parser.ts", "parseMultiDyeArgs"),
    ("apps/stoat-worker/src/config.ts", "isAuthorized"),
]

total = 0
for path, sym in TARGETS:
    src = open(os.path.join(root, path), encoding="utf-8").read().splitlines()
    start = None
    for i, line in enumerate(src):
        if re.search(r"\b(function|const|class|interface|type)\s+" + re.escape(sym) + r"\b", line) or \
           re.match(r"\s*(?:public\s+|static\s+|async\s+)*" + re.escape(sym) + r"\s*\(", line):
            start = i
            break
    if start is None:
        print(f"?? {sym} not found in {path}")
        continue
    # walk back over the jsdoc block
    doc = start
    while doc > 0 and (src[doc - 1].strip().startswith("*") or src[doc - 1].strip().startswith("/**")):
        doc -= 1
    depth, end = 0, start
    seen = False
    for i in range(start, len(src)):
        depth += src[i].count("{") + src[i].count("(") - src[i].count("}") - src[i].count(")")
        if "{" in src[i] or "(" in src[i]:
            seen = True
        if seen and depth <= 0:
            end = i
            break
    n = end - doc + 1
    total += n
    print(f"{n:4}  {path}:{doc+1}-{end+1}  {sym}")
print(f"\nTOTAL measured span: {total} lines")
