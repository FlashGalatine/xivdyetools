# Missing Translation Keys: Korean & Chinese Locales

**Date:** January 20, 2026
**Affected Files:** `ko.json`, `zh.json`
**Severity:** High

---

## Overview

Both Korean (`ko.json`) and Chinese (`zh.json`) locale files are missing 17 translation keys in the `config` section. These keys are related to the Advanced Settings feature.

---

## Missing Keys

The following keys from `en.json` are not present in `ko.json` and `zh.json`:

### Advanced Settings Section (config.*)

| Key | English Value | Context |
|-----|---------------|---------|
| `config.advancedSettings` | "Advanced Settings" | Section header |
| `config.resetSettings` | "Reset Settings" | Button label |
| `config.resetSettingsConfirm` | "Reset all settings to defaults? This cannot be undone." | Confirmation dialog |
| `config.clearDyes` | "Clear Dyes" | Button label |
| `config.clearDyesConfirm` | "Clear all selected dyes across all tools?" | Confirmation dialog |
| `config.clearFavorites` | "Clear Favorites" | Button label |
| `config.clearFavoritesConfirm` | "Clear all favorite dyes? This cannot be undone." | Confirmation dialog |
| `config.clearPalettes` | "Clear Saved Palettes" | Button label |
| `config.clearPalettesConfirm` | "Clear all saved palettes? This cannot be undone." | Confirmation dialog |
| `config.resetTutorial` | "Reset Tutorial" | Button label |
| `config.performanceMode` | "Performance Mode" | Toggle label |
| `config.performanceModeDesc` | "Reduce animations and effects for better performance on slower devices" | Description |
| `config.enableAnalytics` | "Enable Analytics" | Toggle label |
| `config.analyticsDesc` | "Help improve XIV Dye Tools by sharing anonymous usage data" | Description |
| `config.exportSettings` | "Export" | Button label |
| `config.importSettings` | "Import" | Button label |
| `config.importError` | "Failed to import settings. Please check the file format." | Error message |

---

## Recommended Translations

### Korean (ko.json)

Add after `"logout": "로그아웃"` (line 288):

```json
    "advancedSettings": "고급 설정",
    "resetSettings": "설정 초기화",
    "resetSettingsConfirm": "모든 설정을 기본값으로 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
    "clearDyes": "염료 지우기",
    "clearDyesConfirm": "모든 도구에서 선택한 염료를 지우시겠습니까?",
    "clearFavorites": "즐겨찾기 지우기",
    "clearFavoritesConfirm": "모든 즐겨찾기 염료를 지우시겠습니까? 이 작업은 되돌릴 수 없습니다.",
    "clearPalettes": "저장된 팔레트 지우기",
    "clearPalettesConfirm": "모든 저장된 팔레트를 지우시겠습니까? 이 작업은 되돌릴 수 없습니다.",
    "resetTutorial": "튜토리얼 초기화",
    "performanceMode": "성능 모드",
    "performanceModeDesc": "느린 기기에서 더 나은 성능을 위해 애니메이션과 효과를 줄입니다",
    "enableAnalytics": "분석 활성화",
    "analyticsDesc": "익명 사용 데이터를 공유하여 XIV 염색 도구 개선에 도움을 주세요",
    "exportSettings": "내보내기",
    "importSettings": "가져오기",
    "importError": "설정을 가져오지 못했습니다. 파일 형식을 확인해 주세요."
```

### Chinese (zh.json)

Add after `"logout": "退出登录"` (line 308):

```json
    "advancedSettings": "高级设置",
    "resetSettings": "重置设置",
    "resetSettingsConfirm": "将所有设置重置为默认值？此操作无法撤销。",
    "clearDyes": "清除染剂",
    "clearDyesConfirm": "清除所有工具中选择的染剂？",
    "clearFavorites": "清除收藏夹",
    "clearFavoritesConfirm": "清除所有收藏的染剂？此操作无法撤销。",
    "clearPalettes": "清除已保存的调色板",
    "clearPalettesConfirm": "清除所有已保存的调色板？此操作无法撤销。",
    "resetTutorial": "重置教程",
    "performanceMode": "性能模式",
    "performanceModeDesc": "减少动画和效果，以在较慢的设备上获得更好的性能",
    "enableAnalytics": "启用分析",
    "analyticsDesc": "通过分享匿名使用数据来帮助改进 XIV 染色工具",
    "exportSettings": "导出",
    "importSettings": "导入",
    "importError": "导入设置失败。请检查文件格式。"
```

---

## User Impact

Users with Korean or Chinese language settings will experience:

1. **Visual Inconsistency**: English text appearing in an otherwise Korean/Chinese UI
2. **Confusion**: Action buttons and confirmations in English
3. **Trust Issues**: Incomplete translation may appear unprofessional

### Affected UI Areas

- Settings sidebar → Advanced Settings section
- Reset/Clear confirmation dialogs
- Performance mode toggle
- Analytics preference toggle
- Settings import/export buttons
- Import error messages

---

## Root Cause Analysis

**Probable Cause:** The Advanced Settings feature was added after the initial translation effort for Korean and Chinese locales. When the new keys were added to `en.json`, they were not propagated to `ko.json` and `zh.json`.

**Contributing Factors:**
1. No automated check for missing keys across locales
2. Manual translation process without checklists
3. Validation script only checks keys referenced in code, not structural completeness

---

## Remediation Steps

### Immediate (P1)

1. Open `ko.json` in VS Code
2. Navigate to line 288 (after `"logout": "로그아웃"`)
3. Add the Korean translations above
4. Run `npm run validate:i18n` to verify
5. Repeat for `zh.json`

### Preventive (P2)

1. Enhance `validate:i18n` script to compare all locale files
2. Add CI check to flag missing keys in PRs
3. Create translation checklist for new features

---

## Verification

After adding the missing keys, verify:

```bash
# Line count should be approximately equal
wc -l src/locales/*.json

# Validation should pass
npm run validate:i18n

# Key count comparison (use jq or similar)
jq 'paths | length' src/locales/en.json
jq 'paths | length' src/locales/ko.json
jq 'paths | length' src/locales/zh.json
```
