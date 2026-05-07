---
name: Frontend Visual Design Guide
description: Visual design standards for the unified React admin interface. Written for AI coding assistants.
type: design
audience: ai
---

# Frontend Visual Design Guide

## Purpose

This document defines the visual direction for the frontend. It should guide UI decisions while building or refactoring the React application. It is not a product roadmap and should not describe migration steps.

The interface is an operational dashboard: users review data, manage accounts, inspect records, and approve or reject withdrawals. The design should feel warm, calm, focused, and reliable. Keep the distinctive warm cream and coral palette from the previous design reference, but translate it into a practical admin system.

## UI Stack

- Use **shadcn/ui** as the component foundation.
- Use **Tailwind CSS** for styling and design tokens.
- Use **Radix UI** primitives through shadcn/ui for accessible interactions.
- Use **lucide-react** for icons.
- Use **TanStack Table** for complex tables when needed.
- Use **react-hook-form + zod** for form behavior and validation when forms are implemented.

Avoid HeroUI in new work.

## Design Direction

The visual language is **warm operational minimalism**.

- Warm, cream-tinted backgrounds instead of pure white or cold gray.
- Coral as the primary action color, used with restraint.
- Dark warm ink text instead of harsh black.
- Clear table-first layouts for repeated work.
- Subtle borders and background shifts instead of heavy shadows.
- Compact but comfortable spacing.
- Rounded corners around 6-10px for controls and containers.
- Motion should be quiet and functional, never decorative.

Do not build marketing-style pages, oversized hero sections, decorative gradient backgrounds, or ornamental card stacks for the admin interface.

## Color Tokens

Use these tokens as the default palette.

```css
:root {
  --background: #faf9f5;
  --foreground: #141413;

  --surface: #ffffff;
  --surface-soft: #f5f0e8;
  --surface-muted: #efe9de;

  --border: #e6dfd8;
  --border-strong: #d8cec1;

  --muted: #6c6a64;
  --muted-soft: #8e8b82;

  --primary: #cc785c;
  --primary-hover: #a9583e;
  --primary-soft: #f4ded5;

  --success: #4f9f65;
  --success-soft: #e4f3e8;
  --warning: #d4a017;
  --warning-soft: #fbf0cc;
  --danger: #c64545;
  --danger-soft: #f7dddd;

  --info: #4f83a8;
  --info-soft: #e3eef5;

  --dark-surface: #181715;
  --dark-surface-elevated: #252320;
  --on-dark: #faf9f5;
}
```

### Color Usage

- `background`: app shell and page floor.
- `surface`: tables, panels, dialogs, forms, dropdowns.
- `surface-soft`: page sections, filter bars, subtle grouped areas.
- `surface-muted`: selected states, secondary cards, warm empty states.
- `primary`: primary buttons, active navigation, selected tabs, key confirmations.
- `primary-soft`: selected row tint, gentle callouts, non-destructive highlighted areas.
- `danger`: destructive actions, rejection, validation errors.
- `success`: approved, completed, enabled, paid states.
- `warning`: pending review, caution, unusual state.
- `info`: informational state, neutral system notices.
- `dark-surface`: rare emphasis surfaces such as summary strips or high-contrast stat modules.

Coral should not dominate the screen. Most pages should read as cream, white, ink, and border, with coral appearing only where the user needs to notice a primary action or active location.

## Typography

Use a simple system sans stack:

```css
font-family:
  Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
```

Do not require licensed editorial fonts. Do not use serif display typography for admin screens.

Recommended type scale:

| Token | Size | Weight | Line Height | Use |
| --- | ---: | ---: | ---: | --- |
| `page-title` | 24px | 650 | 1.25 | Page title |
| `section-title` | 18px | 600 | 1.35 | Panel or table title |
| `body` | 14px | 400 | 1.5 | Default UI text |
| `body-strong` | 14px | 600 | 1.5 | Emphasized table text |
| `caption` | 12px | 500 | 1.4 | Metadata, badges, helper text |
| `button` | 14px | 600 | 1 | Button labels |

Keep letter spacing at `0` except small uppercase labels, which may use `0.04em`.

## Layout

### App Shell

Use a persistent admin shell:

- Left sidebar for primary navigation on desktop.
- Top bar for page title context, account actions, and global controls.
- Main content area on the warm background.
- Content panels use white surfaces and subtle borders.
- Mobile collapses the sidebar into a drawer.

### Page Structure

Typical page order:

1. Page header: title, short context, primary action.
2. Optional summary metrics.
3. Filter/search bar.
4. Main table or list.
5. Drawer/dialog for details or editing.

Avoid landing-page composition. The first screen should be useful immediately.

### Spacing

Use a 4px spacing rhythm.

- Page padding: 24px desktop, 16px tablet, 12-16px mobile.
- Panel padding: 16-20px.
- Form row gap: 12-16px.
- Table cell padding: 10-12px vertical, 12-16px horizontal.
- Toolbar gap: 8-12px.

Keep dense operational pages scannable. Do not use 64-96px marketing whitespace inside dashboard screens.

## Shape, Border, And Elevation

- Default radius: 8px.
- Small controls: 6px.
- Dialogs and major panels: 10px.
- Pills and badges: 999px.
- Use `1px solid var(--border)` for most separation.
- Shadows should be rare and soft. Prefer borders and background changes.
- Do not nest cards inside cards unless there is a clear component boundary such as a dialog containing a repeated item list.

## Component Visual Rules

### Buttons

Use clear intent:

- Primary: coral fill, white text. Only for the main page action or confirmation.
- Secondary: white or transparent surface with border.
- Ghost: transparent for low-emphasis toolbar actions.
- Destructive: danger fill or danger text, depending on severity.
- Icon buttons: use lucide icons and accessible labels.

Button height:

- Default: 36-40px.
- Compact table actions: 32px.
- Touch-oriented mobile actions: at least 40px.

### Navigation

Sidebar items:

- Active item uses `primary-soft` background and `primary-hover` or `primary` text.
- Avoid fully saturated coral blocks for every active state; reserve full coral for high-confidence active states if needed.
- Icons should be lucide icons at 18-20px.

Navigation should feel quiet. It should not compete with table content.

### Tables

Tables are central to this product.

- Header background: `surface-soft` or white with bottom border.
- Sticky headers are preferred for long lists.
- Row hover: `surface-soft`.
- Selected row: `primary-soft`.
- Use tabular numbers for money, counts, percentages, and dates.
- Align numeric columns right when comparison matters.
- Keep action columns compact and predictable.
- Use status badges instead of raw numeric states.

For mobile, prefer horizontal scroll for dense admin tables. For review workflows, a card list is acceptable if it improves action clarity.

### Filters And Search

Filter bars should be practical and compact:

- White or `surface-soft` background.
- 8px radius.
- Controls in a single row on desktop.
- Wrap naturally on tablet.
- Collapse into stacked controls or a filter drawer on mobile.

Use clear labels. Avoid placeholder-only controls for important filters.

### Forms

Forms should be calm and explicit:

- Label above input.
- Helper or error text below input.
- Focus ring uses coral at low opacity.
- Required state is indicated by text or validation, not by aggressive red styling.
- Group related fields with small section titles and borders, not large decorative cards.

### Dialogs And Drawers

Use dialogs for short confirmations and drawers for detail-heavy review workflows.

- Dialog surface: white.
- Backdrop: black at 35-45% opacity.
- Header, body, footer should be visually separated.
- Destructive confirmations require clear danger styling.
- Withdrawal approval/rejection must show the target user, amount, and payment identity before confirmation.

### Badges

Use semantic status colors:

- Pending: warning-soft background, warning text.
- Approved/completed: success-soft background, success text.
- Rejected/failed: danger-soft background, danger text.
- Disabled/inactive: surface-muted background, muted text.
- Info/processing: info-soft background, info text.

Badges should be small, readable, and consistent. Avoid bright saturated fills for routine statuses.

### Toasts

Toasts should be short and state the result:

- Success: completed action.
- Danger: failed action with a human-readable reason.
- Warning: action completed with caveat.
- Info: background process started.

Do not use toasts as the only place to show important validation errors.

### Empty And Loading States

- Empty state should explain what is missing and offer the next relevant action when possible.
- Loading states should use skeletons for tables and panels.
- Avoid full-screen spinners unless the entire app is blocked.

## Data And Money Display

- Money should use consistent decimal precision.
- Dates should use a consistent local format.
- Long identifiers should be truncated with copy action where useful.
- Sensitive values should be masked by default if not required for the current task.
- Use color for state, not for arbitrary numeric decoration.

## Responsive Behavior

Breakpoints:

- Mobile: below 768px.
- Tablet: 768-1024px.
- Desktop: 1024px and above.

Rules:

- Sidebar becomes drawer on mobile.
- Tables may scroll horizontally.
- Action bars should remain reachable.
- Dialogs become near-full-width on mobile.
- Text must not overflow buttons, badges, or table cells.
- Do not scale font sizes with viewport width.

## Accessibility

- Preserve Radix/shadcn keyboard behavior.
- Every icon-only button needs an accessible label.
- Focus states must be visible.
- Color contrast must remain readable on cream surfaces.
- Do not communicate state by color alone; pair color with labels or icons.
- Destructive actions must be confirmable and reversible where practical.

## Do

- Use the warm palette consistently.
- Keep pages table-first and task-first.
- Use borders, spacing, and typography for hierarchy.
- Keep actions predictable and close to their records.
- Use lucide icons where icons improve scanning.
- Prefer drawers for detailed record review.
- Keep the UI calm during repetitive operations.

## Don't

- Do not recreate the old Claude marketing-page style.
- Do not use large hero sections in the dashboard.
- Do not overuse coral.
- Do not introduce purple-blue gradients or decorative blobs.
- Do not use heavy shadows or nested decorative cards.
- Do not make every page visually unique.
- Do not hide key workflow information inside hover-only UI.
- Do not create custom components when a shadcn/ui component fits.

## Implementation Notes For AI

When creating UI:

1. Start from shadcn/ui components.
2. Apply tokens through Tailwind theme variables or CSS variables.
3. Build reusable wrappers only after two or more pages need the same pattern.
4. Use tables, filter bars, dialogs, drawers, badges, and compact forms as the primary vocabulary.
5. Keep visual changes scoped and consistent with this guide.
6. Before finishing a frontend change, check desktop and mobile layouts for text overflow, overlapping controls, and unusable action areas.

If a requirement conflicts with this guide, prefer task clarity and usability over visual decoration.
