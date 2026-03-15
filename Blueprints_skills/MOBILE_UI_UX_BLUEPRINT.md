# MOBILE UI/UX BLUEPRINT

## 1. Purpose

This blueprint defines a specialized strategy for **Mobile-First** and **Mobile-Only** interfaces. It complements general UI/UX guidelines but enforces strict constraints specific to handheld devices.

The focus is:
- **Ergonomics & Reachability** (The "Thumb Zone").
- **Device Rotation & Orientation** (Adaptive layouts).
- **Touch Interaction** (Gestures, targets, haptics).
- **Mobile Context** (On-the-go usage, variable connectivity, interruptions).

---

## 2. Core Principles

### 2.1 The Thumb Zone Rule
Mobile interfaces must be designed around human physiology.
- **Natural Zone:** Bottom-center of the screen. Primary actions (FABs, main navigation) belong here.
- **Reach Zone:** Middle of the screen. Content consumption area.
- **Hard Zone:** Top corners. Avoid placing critical, frequent actions here (like "Back" buttons without swipe alternatives).

### 2.2 Rotation & Orientation Intelligence
The UI must not just "stretch" when rotated; it must **adapt**.
- **Portrait:** Vertical scrolling, stacked content, bottom navigation.
- **Landscape:**
  - **Split Views:** Master-detail layouts (e.g., email list on left, content on right).
  - **Media Mode:** Full-screen video/image with overlay controls.
  - **Keyboard Awareness:** Ensure input fields are not covered by the landscape keyboard (often takes 50%+ of height).

### 2.3 Touch Targets & Gestures
- **Minimum Target Size:** 44x44pt (iOS) / 48x48dp (Android).
- **Safe Spacing:** Minimum 8dp between interactive elements to prevent "fat finger" errors.
- **Gesture-First:**
  - "Back" should always be accessible via edge-swipe, not just a top-left button.
  - Lists should support pull-to-refresh and swipe-to-action.

---

## 3. Detailed Guidelines

### 3.1 Ergonomics & Layout
| Zone | Usage | Component Examples |
| :--- | :--- | :--- |
| **Bottom (Easy)** | Primary Navigation, Key Actions | Bottom Tab Bar, Floating Action Button (FAB), Bottom Sheets |
| **Middle (Reach)** | Content, Scrollable Lists | Cards, Feed Items, Input Fields |
| **Top (Stretch)** | Context, Status, Destructive/Rare Actions | Page Titles, Filter Toggles, Settings Icons |

**Hand Positions to Consider:**
1.  **One-Handed (Right/Left Thumb):** Most common. Critical paths must be thumb-accessible.
2.  **Cradled (Two Hands):** Typing or precise interaction.
3.  **Desktop/Stand:** Passive consumption.

### 3.2 Rotation & Responsive Behavior
Define behavior for `w < h` (Portrait) vs `w > h` (Landscape).

**Portrait Mode:**
- **Stack:** Vertical column.
- **Navigation:** Bottom Bar visible.

**Landscape Mode:**
- **Grid/Columns:** Reflow single column into 2 columns (e.g., Form inputs side-by-side).
- **Navigation:** Move Bottom Bar to **Side Rail** (Left/Right) to save vertical space.
- **Modalities:** Full-screen modals may become centered dialogs or side sheets.

### 3.3 System UI & Safe Areas
- **Notch/Dynamic Island:** Never place interactive elements behind the top status bar area.
- **Home Indicator:** Leave padding at the bottom (approx 34pt) to avoid conflict with system swipe-home gestures.
- **Keyboard Handling:**
  - UI must scroll content *above* the keyboard when focused.
  - "Done" or "Next" buttons on the keyboard toolbar are essential.

### 3.4 Feedback & Micro-interactions
- **Haptics:** Use subtle haptic feedback for success, error, and significant toggle states.
- **Transitions:**
  - **Push/Pop:** Lateral movement for hierarchy depth.
  - **Modal:** Vertical slide-up for temporary tasks.
  - **Shared Element:** Morph images from list to detail view to maintain context.

---

## 4. Accessibility (Mobile Specific)
- **Dynamic Type:** UI must scale layouts when user increases font size (do not use fixed height containers for text).
- **Contrast:** High contrast is vital for outdoor/sunlight usage.
- **Touch Areas:** Extend touchable areas beyond the visible icon bounds.

---

## 5. Implementation Checklist

- [ ] **Thumb Test:** Can the primary action be reached with one hand?
- [ ] **Rotation Test:** Does the layout break or become unusable in landscape?
- [ ] **Fat Finger Test:** Are buttons at least 48dp apart?
- [ ] **Dark Mode:** Is there a true black (OLED) or dark grey theme?
- [ ] **Offline State:** Is there a clear indicator when connectivity is lost?
