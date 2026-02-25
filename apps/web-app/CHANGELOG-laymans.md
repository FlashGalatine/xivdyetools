# What's New (Unreleased)

---

## 🎨 No More Duplicate Results

**Harmony Explorer & Palette Extractor**
- Both the Harmony Explorer and Palette Extractor now prevent the same dye from appearing in multiple result cards — you'll see a wider variety of dye suggestions
- A new "Prevent Duplicates" toggle has been added to the OPTIONS sidebar for each tool (on by default) so you can turn it off if you prefer the old behavior

---

# What's New in Version 4.1.8

*Released: February 21, 2026*

---

## 🔒 Security Audit Fixes

**Stronger Login Protection**
- Fixed a rare edge case where the login flow could accept an incomplete security check — it now properly rejects the request if any verification step is missing
- This was found during a comprehensive security audit; no evidence it was ever exploited

---

## 🛠️ Under-the-Hood Improvements

**Dye Matching is Faster**
- Color matching calculations are now cached, so finding your closest dye match is snappier — especially noticeable if you're comparing lots of colors in a session

**SVG Card Improvements**
- Fixed a display issue where Japanese, Korean, and Chinese dye category labels could appear clipped or incorrectly sized on dye info cards
- Special characters like `&` in dye names no longer appear garbled (e.g., `&amp;amp;`) on generated cards

**Code Quality**
- Fixed all linting warnings and auto-formatted the entire codebase
- No visible changes to users — just cleaner, more maintainable code

---

*For the full technical changelog, see [CHANGELOG.md](./CHANGELOG.md)*
