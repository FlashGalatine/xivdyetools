# What's New in Version 4.1.5

*Released: January 26, 2026*

---

## 🎨 Gradient Tool Visual Fix

**Gradient Bar Now Matches Your Color Space Selection**
- The gradient bar (the track behind the step markers) now correctly shows the color transition for your chosen color space
- Previously it always showed a straight RGB blend, even when you selected OKLCH or LCH
- Now when you pick LCH and go from blue to yellow, you'll see the bar travel through purples and reds—just like the step markers do
- This makes it much easier to visualize how different color spaces create different gradient paths

---

## 📰 What's New Gets Friendlier

**User-Friendly Release Notes**
- The "What's New" popup now shows these easy-to-read release notes instead of technical developer jargon
- You're actually reading content from this very file!

---

## ⚡ Behind-the-Scenes Improvements

**Faster Collection Lookups**
- Your saved palettes and collections now load faster
- Looking up which collections contain a specific dye is now instant

**Code Cleanup**
- Internal housekeeping and code organization - no visible changes, just tidier code under the hood

---

*For the full technical changelog, see [CHANGELOG.md](./CHANGELOG.md)*

---

# What's New in Version 4.1.1

*Released: January 21, 2026*

---

## 🐛 Mobile Experience Improvements

We've made the mobile version of XIV Dye Tools much easier to use! This update fixes several annoying issues that made the app harder to use on phones and tablets.

### What's Better Now

**Closing the Color Palette is Easier**
- You can now tap outside the color palette drawer to close it (just like you'd expect)
- The area behind the drawer is slightly darkened to make it clear you can tap to dismiss
- This works the same way as other panels in the app for consistency

**Tool Navigation Fixed on Small Screens**
- The first tool (Harmony) was being cut off on the left side of the screen
- Now all tools stay visible, and you can scroll right to see the rest
- You won't miss any tools when browsing on mobile anymore

**Drawer Stays Closed When Switching Tools**
- Fixed a bug where the color palette would pop back open when switching between tools
- The drawer now remembers whether you closed it and stays closed
- This makes navigating between tools much smoother

**Tables Scroll Properly**
- In the Vision tool, contrast tables were pushing the whole page sideways on mobile
- Tables now scroll within their own area instead of breaking the page layout
- You can view all the data without the page shifting around

**Charts Stack Better on Mobile**
- In the Compare tool, two charts were cramped side-by-side on small screens
- Charts now stack vertically on phones for easier viewing
- On larger screens (tablets/desktop), they still appear side-by-side

**Swatch Tool Fits Your Screen**
- The color grid was too wide and bled off the edges on mobile
- The grid now automatically resizes to fit your screen perfectly
- When you select a color, the results appear below the grid (no more awkward scrolling)
- The app automatically scrolls to show your results after selecting a color
- Fixed an issue where you couldn't scroll back up to the color grid after making a selection

**Gradient Tool is Less Cramped**
- The gradient builder circles and markers were too large for mobile screens
- Everything scales down nicely on phones while staying easy to use
- More comfortable to build gradients on smaller devices

**Image Tool Doesn't Hog Space**
- The image upload area was taking up too much vertical space on mobile
- The upload area is now smaller so you can see your results without scrolling as much
- You'll see at least one full result card immediately after extracting colors from an image

---

## 🔍 What This Means for You

If you use XIV Dye Tools on your phone or tablet, the app should feel **much more natural and comfortable** now. We've fixed the annoying layout issues that made it hard to use certain tools on mobile, and everything should feel smoother and more intuitive.

---

*For the full technical changelog, see [CHANGELOG.md](./CHANGELOG.md)*
