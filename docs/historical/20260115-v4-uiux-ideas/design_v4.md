# XIVDyeTools V4 UI Design Concepts

This document outlines the proposed UI/UX changes for the version 4.0 overhaul. The goal is a more premium, consolidated, and efficient user interface.

## 1. App Header (formerly Mini-Hero)
**Status**: [Revised based on Feedback]

- **Feedback**: The previous "Mini-Hero" concept was too "portal-like" and intrusive.
- **New Direction**: Simple, non-intrusive, compact.
- **Content**:
    - **Left**: SVG Logo (Open paint bucket with dipped brush, flat single color) + "XIV Dye Tools" text.
    - **Right**: "About", "Language", and "Theme" (Icon-only).
- **Aesthetics**: Clean, minimal vertical height. Deep dark background. Logo color adapts via CSS theme.

## 2. Tool Selection Banner (Desktop)
**Status**: [Approved with Note]

- **Description**: A persistent toolbar for quick access to the eight main tools on Desktop.
- **Note**: Must support Light and Dark themes (CSS variables).
- **Inspiration**: Similar to the mobile bottom navigation bar but adapted for the top (or prominent position) on desktop.
- **Content**: A row of 8 SVG icons.
    - Hover effects should be prominent (glow, scale, or color shift) to indicate interactivity.
    - Active tool should be clearly highlighted.

## 3. Dye Selection Component
**Status**: [Approved - Updating Specs]

- **Placement**: Right side of the screen.
- **Behavior**: Collapsible menu / drawer.
- **New Features**:
    - **Multi-select Support**: The component must handle varying selection limits based on the active tool:
        - *Harmony Explorer*: 1 dye
        - *Color Matcher*: 1 image -> 10 results (Output view)
        - *Accessibility Checker*: 1-4 dyes
        - *Dye Comparison*: 2-4 dyes
        - *Dye Mixer*: 2 dyes
        - *Preset Palettes*: 3-5 dyes
        - *Budget Suggestions*: 1 dye
        - *Swatch Matcher*: 1 color input -> 3 results
    - **Favorites**: Ability to add/remove dyes to a "Favorites" collection within the drawer.
    - **Filters**: Filter button to show categories like:
        - Metallic
        - Pastel
        - Dark
        - etc.
- **Content**:
    - Color swatches for dye selection.
    - Categorized for easy scanning.
- **Goal**: Free up main content area by moving palette selection to a dedicated, hideable panel.

## 4. Tool Configuration Components
**Status**: [Unchanged Layout]

- **Placement**: Left side of the screen (typically).
- **Behavior**: Persistent settings for the currently active tool.

## 5. Palette Extractor (formerly Color Matcher)
**Status**: [Mockup Complete - V4 Prototype]

- **Concept**: A tool to extract a color palette from an uploaded image and find matching in-game dyes.
- **UI Layout**:
    - **Sidebar Configuration**:
        - "Vibrancy Boost" toggle.
        - "Max Colors" slider (control number of results).
    - **Main Content**: Split view or vertical stack.
        - **Input Section**:
            - Large "Drag & Drop" zone with Glassmorphism styling (`backdrop-filter: blur`).
            - **Zoom Controls**: Floating toolbar overlay (Fit, Width, Zoom In/Out, Reset).
        - **Output Section**:
            - **Centered Flex Box**: Results grid uses `display: flex; justify-content: center` for perfect alignment.
            - **Uniform Cards**: Fixed width (`320px`), auto height (`min-height: 316px`).
            - **Data**: Full Harmony-style card data (Technical + Acquisition).


## 6. Interaction Models
**Status**: [New Addition]

### Harmony Result Cards
- **Primary Action ("Select Dye")**: 
    - Sets the selected dye as the new **Base Color** for the tool. 
    - The central visualization (Ring/Circle) updates to this color.
    - Harmony calculations are re-run based on this new center, allowing users to "traverse" through color relationships.
- **Secondary Action (Context Menu)**:
- **Secondary Action (Context Menu)**:
    - Provides specific operations: "Add to Mixer", "Compare", "Check Accessibility", etc.
    - **Visuals**: "Kebob" menu icon (vertical dots). 16px size.
    - **Items**:
        - Add to Comparison
        - Add to Mixer
        - Add to Accessibility Check
        - See Color Harmonies
        - Budget Suggestions
        - Copy Hex Code

## 7. Component Specifications
**Status**: [Drafting]

### Responsive Grid Layout (Result Lists)
- **Application**: Applied to both Harmony Explorer and Gradient Builder result lists.
- **Behavior**:
    - **Flex Wrap**: Cards naturally wrap to the next line based on available width.
    - **Centering**: Grid is always centered within the content area.
    - **Max Width**: Containers constrained (e.g., ~1400px) to prevent excessive spreading on ultra-wide monitors.
- **Scrolling**: Vertical scrolling handled by the main content area or container if height exceeds viewport.

### Uniform Results Card (Shared Component)
> [!NOTE]
> This is a refactored, shared component used across **Harmony Explorer**, **Gradient Builder**, **Swatch Matcher**, **Budget Suggestions**, **v4 Dye Mixer**, **Palette Extractor**, and **Community Presets** (when viewing individual palette presets) to ensure consistent visual language and data presentation.

- **Dimensions**: Fixed width (320px).
- **Layout**: Two-column data grid below split preview.
- **Preview**: 
    - Split 50/50: Left (Original/Input Color), Right (Matched Dye).
    - Labels: "Original" and "Match" overlaid at bottom.
- **Data Columns**:
    - **Technical**: ΔE (Delta-E), HEX, RGB, HSV.
    - **Acquisition**: Source (e.g., Vendor, Crafted), Cost, Market (Server/Region + Price).
- **Actions**:
    - Primary: "Select Dye" (Full width block or large button).
    - Secondary: Context Menu (Top right or inline with actions).

### Harmony Visual Ring
- **Structure**: Conic gradient ring.
- **Nodes**:
    - Small circular nodes representing result positions.
    - Connected to center by dashed lines.
    - Hover tooltip displays Dye Name.
- **Center**: Current Base Color.

## 8. New Tool Definitions
**Status**: [New Addition]

### Gradient Builder (Refined Prototype)
- **Former Name**: "Dye Mixer"
- **Concept**: Users select a **Start Dye** and an **End Dye**.
- **Configuration**:
    - **Step Count**: Slider to adjust gradient smoothness (e.g., 3 to 8+ steps).
    - **Interpolation**: Options for color space calculation (RGB, HSV, LAB).
- **Visuals**:
    - **Track**: Linear path visualisation showing the color transition nodes.
    - **Results**: **Grid Layout** (4 columns x 2 rows on desktop) of detailed acquisition cards.
- **Card Data**: Same rich data as Harmony cards (Technical + Acquisition including Market server).

### v4 Dye Mixer (Mockup Complete - V4 Prototype)
- **Concept**: "Crafting" style interface.
- **Input**: User puts two dyes into "slots".
- **Output**: A single resulting color that represents the mix of the two inputs.
- **Visuals**: 
    - "Inventory" style containers (100x100px input slots, 120x120px result slot).
    - Visual indicators: plus sign (+), mixing arrow (->).
    - Aesthetic: Dark, premium, glassmorphism.
- **Configuration Panel**:
    - **Max Results**: Slider (Control number of dye suggestions, default 3, range 3-8).
- **Results View**:
     - **Layout**: Centered list of "Top N" matches.
     - **Card Data**: Detailed Technical (RGB, HSV) and Acquisition (Market) data.



### Budget Suggestions (Mockup Complete - V4 Prototype)
- **Concept**: Find cheaper lookalikes for expensive dyes (e.g., finding a 500g alternative for a 500,000g Jet Black dye).
- **Configuration Panel**:
    - **Max Results**: Slider (Control number of suggestions, default 8, range 1-20).
    - **Max Price**: Slider (Cap the acquisition cost, default 200,000g).
    - **Max Delta-E**: Slider (Tolerance for color difference, default 75).
- **Quick Picks**:
    - "One-click" access to popular high-value targets: Pure White, Jet Black.
    - Curated "New/Popular" picks (e.g., Cosmic Exploration dyes: Pearl White, Metallic Brass).
- **Results View**:
    - **Grid Layout**: Displays uniform result cards (same component as Harmony/Gradient).
    - **Data Focus**: 
        - Highlighting "Saved" amount (e.g., "Saved 74,000g").
        - Technical comparison (Delta-E) clearly visible.

### Swatch Matcher (Mockup Complete - V4 Prototype)
- **Concept**: Find dyes that match in-game character customization colors (Eye, Hair, Skin).
- **Data Source**: Datamined color sheets (e.g., `EyeColors.csv` with 192 colors per race/gender).
- **Configuration Panel**:
    - **Color Sheet**: Dropdown to select the data source (EyeColors, HairColors, SkinColors).
    - **Race**: Dropdown for character race selection.
    - **Gender**: Dropdown for character gender selection.
    - **Max Results**: Slider (1-8, default 3).
- **UI Layout**:
    - **Centered Flexbox**: Main content uses `align-items: center` and `justify-content: center`.
    - **Left Panel (Color Grid)**:
        - 8-column grid displaying all 192 colors from the selected sheet.
        - Swatches are 32x32px with hover effects (scale, glow).
        - Selected swatch highlighted with accent-colored border.
    - **Right Panel (Results Area)**:
        - **Selected Color Card**: Displays technical info (HEX, RGB, HSV) and grid position (Index, Row, Col). Includes "Copy Values" button.
        - **Matching Dyes Section**: 3-column grid of Uniform Results Cards showing closest dye matches with ΔE, Technical, and Acquisition data.

### Accessibility Checker (Mockup Complete - V4 Prototype)
- **Concept**: Simulate colorblindness vision types, check WCAG compliance, and compare contrast between selected dyes.
> [!NOTE]
> This tool does NOT use Unified Results Cards but adopts the same design language (dark panels, glassmorphism, gold accents).

- **Configuration Panel**:
    - **Vision Types**: Toggles for Normal, Deuteranopia, Protanopia, Tritanopia, Achromatopsia.
    - **Display Options**: Show Labels, Show Hex Values, High Contrast Mode toggles.
- **UI Layout**:
    - **Vision Simulations Section**:
        - 5 glassmorphism cards in responsive grid.
        - Each card shows: Vision type label, prevalence statistic, 4 color swatches with dye labels.
        - Cards for: Normal Vision (reference), Deuteranopia (~6% males), Protanopia (~2% males), Tritanopia (~0.01%), Achromatopsia (~0.003%).
    - **WCAG Contrast Ratios Section**:
        - Table with columns: Dye (swatch + name), vs White (ratio + badge), vs Black (ratio + badge).
        - WCAG badges: `AAA` (green), `AA` (gold), `Fail` (red).
    - **Pairwise Contrast Comparison Section**:
        - Matrix table comparing all selected dyes against each other.
        - Diagonal cells display "—" (self-comparison).
        - Color-coded percentages: `good` (green >50%), `warning` (gold 20-50%), `critical` (red <20%).
        - Warning callouts below for problem pairs.

## 9. Themes and Visual Customization
**Status**: [Implemented in Prototype]

The application supports a robust theming system to cater to different user preferences and lighting conditions.

### Theme Definitions
- **Default (Premium Dark)**: The core V4 identity. Dark grey/black background with gold accents. Optimized for high contrast and "premium" feel.
- **Standard Light**: Based on legacy V3 Light theme. Light grey/white backgrounds, Burgundy (`#8B1A1A`) primary color.
- **Standard Dark**: Based on legacy V3 Dark theme. Dark grey background, Light Red (`#E85A5A`) primary color.
- **Hydaelyn**: "Light Mode" alternative. Blue/White/Silver palette inspired by Hydaelyn. Blue-grey gradients (`#B2C4CE` to `#F9F8F4`).
- **OG Classic**: "Dark Mode" alternative. Deep Indigo/Black palette. Very high contrast (`#1E40AF` primary).

### Implementation Details
- **CSS Variables**: The system uses a comprehensive set of CSS variables defined in `.theme-*` classes applied to the `<body>` tag.
- **Gradient Support**: `app-container` and `card-details` use theme-aware gradients (`--bg-gradient-start/end` and `--card-gradient-end`) to ensure depth and visual interest across all themes, replacing hardcoded dark gradients.
- **Header Contrast**: Text colors in the header (`--text-header`, `--text-header-muted`) adjust dynamically to ensure readability on both dark (Default, OG) and colored (Hydaelyn Blue) headers.
- **Global Switcher**: Accessible via the "Theme" icon in the header (cycles through themes) or the "Theme" dropdown in the core Configuration sidebar.
