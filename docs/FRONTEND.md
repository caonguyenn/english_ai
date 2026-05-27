# FRONTEND.md — EnglishAI Platform UI/UX Specification

> Read this alongside `CLAUDE.md` before writing any frontend code.
> This document is the single source of truth for all visual, interaction, and component design decisions.

---

## 1. Design Philosophy

**One sentence:** A premium, calm-dark learning sanctuary where the AI feels like a trusted mentor, not a chatbot.

**Aesthetic direction:** Refined dark luxury — deep navy-blacks, warm gold accents, soft glassmorphism panels, and typography with editorial authority. Think: Bloomberg Terminal meets Duolingo, if Duolingo had taste.

**The experience promise:** Every screen should make a student feel like they are sitting in a high-end private tutoring studio — focused, professional, encouraging. Zero noise, zero clutter. The conversation IS the product.

**What makes it unforgettable:** The live session screen — the animated waveform that breathes with the AI's voice, the dual-column transcript that feels like a premium subtitles feed, and the micro-celebration when a level-up fires.

---

## 2. Design Tokens

### 2.1 Color System

```css
:root {
  /* === BACKGROUNDS === */
  --bg-base:        #0A0D14;   /* Page background — deep navy black */
  --bg-surface:     #111520;   /* Cards, panels */
  --bg-elevated:    #181D2C;   /* Modals, drawers, dropdowns */
  --bg-glass:       rgba(255, 255, 255, 0.04);  /* Glassmorphic layers */
  --bg-glass-hover: rgba(255, 255, 255, 0.07);

  /* === ACCENT — Gold === */
  --accent-gold:        #C9A84C;   /* Primary accent */
  --accent-gold-bright: #F0C96A;   /* Hover / active states */
  --accent-gold-muted:  rgba(201, 168, 76, 0.15);  /* Tinted backgrounds */
  --accent-gold-glow:   rgba(201, 168, 76, 0.25);  /* Glow shadows */

  /* === SEMANTIC ACCENT — Teal === */
  --accent-teal:        #2DD4BF;   /* AI responses, status indicators */
  --accent-teal-muted:  rgba(45, 212, 191, 0.12);
  --accent-teal-glow:   rgba(45, 212, 191, 0.20);

  /* === TEXT === */
  --text-primary:   #F0EDE6;   /* Main copy — warm white */
  --text-secondary: #8A8FA8;   /* Labels, metadata */
  --text-muted:     #4A506A;   /* Disabled, placeholder */
  --text-inverse:   #0A0D14;   /* Text on gold/bright backgrounds */

  /* === SKILL TYPE COLORS === */
  --skill-speaking:      #C9A84C;   /* Gold */
  --skill-listening:     #2DD4BF;   /* Teal */
  --skill-grammar:       #818CF8;   /* Indigo */
  --skill-pronunciation: #F472B6;   /* Rose */

  /* === STATUS === */
  --status-success: #34D399;
  --status-warning: #FBBF24;
  --status-error:   #F87171;
  --status-info:    #60A5FA;

  /* === BORDERS === */
  --border-subtle:  rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.10);
  --border-strong:  rgba(255, 255, 255, 0.18);
  --border-gold:    rgba(201, 168, 76, 0.35);

  /* === SHADOWS === */
  --shadow-sm:   0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-md:   0 4px 16px rgba(0, 0, 0, 0.5);
  --shadow-lg:   0 12px 40px rgba(0, 0, 0, 0.6);
  --shadow-gold: 0 0 24px var(--accent-gold-glow);
  --shadow-teal: 0 0 20px var(--accent-teal-glow);

  /* === RADIUS === */
  --radius-sm:  6px;
  --radius-md:  12px;
  --radius-lg:  18px;
  --radius-xl:  24px;
  --radius-pill: 999px;

  /* === SPACING (8pt grid) === */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;

  /* === TRANSITIONS === */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-slow: 400ms;
}
```

### 2.2 Typography

**Fonts to import from Google Fonts:**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

```css
:root {
  /* Display / headings — editorial, prestigious */
  --font-display: 'Playfair Display', Georgia, serif;

  /* Body / UI — clean, legible, modern */
  --font-body:    'DM Sans', system-ui, sans-serif;

  /* Monospace — transcripts, scores, code */
  --font-mono:    'DM Mono', 'Fira Code', monospace;
}

/* Type Scale */
--text-xs:   0.75rem;    /* 12px — micro labels */
--text-sm:   0.875rem;   /* 14px — captions, metadata */
--text-base: 1rem;       /* 16px — body */
--text-lg:   1.125rem;   /* 18px — lead text */
--text-xl:   1.25rem;    /* 20px — section titles */
--text-2xl:  1.5rem;     /* 24px — card headings */
--text-3xl:  1.875rem;   /* 30px — page headings */
--text-4xl:  2.25rem;    /* 36px — hero headings */
--text-5xl:  3rem;       /* 48px — display */
```

**Usage rules:**
- `--font-display` only for: page heroes, module titles, celebration screens, IELTS band badge
- `--font-body` for all UI: labels, buttons, body copy, nav
- `--font-mono` for: transcript text, scores, timers, XP numbers
- Headings use `font-weight: 600` (display) or `500` (body)
- Body uses `font-weight: 400`, labels `500`
- Line-height: `1.2` for display, `1.6` for body, `1.4` for UI

---

## 3. Component Library

### 3.1 Buttons

```
Hierarchy: Primary → Secondary → Ghost → Danger

Primary (gold-filled):
  background: var(--accent-gold)
  color: var(--text-inverse)
  font: 500 14px/1 var(--font-body)
  padding: 10px 20px
  border-radius: var(--radius-pill)
  box-shadow: 0 0 0 0 var(--accent-gold-glow)
  transition: all 200ms var(--ease-out-expo)
  hover: background: var(--accent-gold-bright), box-shadow: var(--shadow-gold)
  active: scale(0.97)

Secondary (glass):
  background: var(--bg-glass)
  border: 1px solid var(--border-default)
  color: var(--text-primary)
  hover: background: var(--bg-glass-hover), border-color: var(--border-strong)

Ghost:
  background: transparent
  color: var(--text-secondary)
  hover: color: var(--text-primary), background: var(--bg-glass)

Danger:
  background: rgba(248, 113, 113, 0.12)
  border: 1px solid rgba(248, 113, 113, 0.3)
  color: var(--status-error)
  hover: background: rgba(248, 113, 113, 0.20)

Sizes: sm (8px 16px, text-sm), md (10px 20px, text-sm), lg (12px 24px, text-base)
Loading state: spin animation on a small circle icon, text hidden
Disabled: opacity 0.4, cursor not-allowed, no hover effects
```

### 3.2 Cards

```
Base Card:
  background: var(--bg-surface)
  border: 1px solid var(--border-subtle)
  border-radius: var(--radius-lg)
  padding: var(--space-6)
  transition: border-color 200ms, box-shadow 200ms

Hover Card (clickable):
  hover: border-color: var(--border-default), box-shadow: var(--shadow-md)
  cursor: pointer

Active / Selected Card:
  border-color: var(--border-gold)
  box-shadow: var(--shadow-gold)
  background: linear-gradient(135deg, var(--bg-surface), rgba(201, 168, 76, 0.04))

Glass Card (for modals, overlays):
  background: rgba(17, 21, 32, 0.85)
  backdrop-filter: blur(24px) saturate(1.4)
  border: 1px solid var(--border-default)
```

### 3.3 Badges / Tags

```
Skill badges:
  Speaking:      background: rgba(201, 168, 76, 0.15), color: #C9A84C, border: 1px solid rgba(201, 168, 76, 0.3)
  Listening:     background: rgba(45, 212, 191, 0.12), color: #2DD4BF, border: 1px solid rgba(45, 212, 191, 0.25)
  Grammar:       background: rgba(129, 140, 248, 0.12), color: #818CF8, border: 1px solid rgba(129, 140, 248, 0.25)
  Pronunciation: background: rgba(244, 114, 182, 0.12), color: #F472B6, border: 1px solid rgba(244, 114, 182, 0.25)

Shape: pill (border-radius: 999px)
Size: padding 3px 10px, font-size 12px, font-weight 500, letter-spacing 0.02em, uppercase
```

### 3.4 Progress Bars

```
XP Progress Bar:
  Track: background: var(--border-subtle), border-radius: var(--radius-pill), height: 6px
  Fill: background: linear-gradient(90deg, var(--accent-gold), var(--accent-gold-bright))
        border-radius: inherit
        box-shadow: 0 0 8px var(--accent-gold-glow)
        transition: width 600ms var(--ease-out-expo)
  Label above right: "{xp_earned} / {xp_threshold} XP" — text-xs, text-secondary

Score Bar (per skill):
  Same as above but fill color uses the skill color var
  Height: 4px
```

### 3.5 Input Fields

```
Base:
  background: var(--bg-elevated)
  border: 1px solid var(--border-default)
  border-radius: var(--radius-md)
  padding: 11px 16px
  color: var(--text-primary)
  font: 400 15px var(--font-body)
  transition: border-color 200ms, box-shadow 200ms

Focus:
  border-color: var(--accent-gold)
  box-shadow: 0 0 0 3px var(--accent-gold-muted)
  outline: none

Error:
  border-color: var(--status-error)
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.15)

Placeholder: color: var(--text-muted)
Label: text-sm, font-weight 500, color: var(--text-secondary), margin-bottom 6px
Error message: text-xs, color: var(--status-error), margin-top 4px
```

### 3.6 Toasts / Notifications

```
Position: bottom-right, 16px from edge
Stack: up to 3, newest on top, gap 8px
Width: 320px max

Success: left border 3px solid var(--status-success)
Error:   left border 3px solid var(--status-error)
Info:    left border 3px solid var(--status-info)
Warning: left border 3px solid var(--status-warning)

Base:
  background: var(--bg-elevated)
  border: 1px solid var(--border-default)
  border-radius: var(--radius-md)
  padding: 14px 16px
  box-shadow: var(--shadow-lg)

Animation: slide in from right (translateX: 20px → 0), fade in 250ms ease-out
Dismiss: auto after 4s, or on click. Slide out right.
```

---

## 4. Layout System

### 4.1 App Shell

```
Overall structure (authenticated):

┌──────────────────────────────────────────────────────┐
│ Sidebar (240px fixed) │ Main Content Area (flex-1)   │
│                       │                              │
│  [Logo + wordmark]    │  [TopBar — 64px]             │
│                       │  ─────────────────           │
│  [Nav items]          │  [Page content]              │
│                       │  padding: 32px               │
│  [User info + XP]     │                              │
└──────────────────────────────────────────────────────┘

Sidebar:
  background: var(--bg-surface)
  border-right: 1px solid var(--border-subtle)
  position: fixed, full height
  padding: 24px 16px

Main content:
  margin-left: 240px
  min-height: 100vh
  background: var(--bg-base)

Mobile (< 768px):
  Sidebar collapses to bottom tab bar (5 icons)
  Main content full width, padding: 16px
  Bottom safe area: 80px
```

### 4.2 Sidebar Navigation

```
Logo area (top):
  "EnglishAI" — font-display, 20px, color: text-primary
  Tagline: "Speak. Learn. Level up." — text-xs, text-muted, font-body

Nav items:
  ┌─────────────────────────────┐
  │  🎯  Dashboard              │
  │  📚  My Modules             │
  │  🎮  Speaking Playground    │
  │  👤  Profile                │
  └─────────────────────────────┘

Nav item style:
  display: flex, align-items: center, gap: 12px
  padding: 10px 12px, border-radius: var(--radius-md)
  font: 500 14px var(--font-body), color: var(--text-secondary)
  transition: all 200ms
  cursor: pointer

  hover:
    background: var(--bg-glass)
    color: var(--text-primary)

  active/current:
    background: var(--accent-gold-muted)
    color: var(--accent-gold)
    border: 1px solid var(--border-gold)

  icon: 18px, opacity 0.7 on default, 1.0 on active

User section (bottom of sidebar):
  border-top: 1px solid var(--border-subtle)
  padding-top: 16px
  Shows: avatar circle (initials), name, current IELTS band badge
  XP bar (compact, 4px height) below name
```

### 4.3 TopBar

```
Height: 64px
background: transparent (page background shows through)
border-bottom: 1px solid var(--border-subtle)
padding: 0 32px
display: flex, align-items: center, justify-content: space-between

Left: Page title (text-xl, font-weight 600, text-primary) + optional breadcrumb
Right: Notification bell + avatar menu
```

### 4.4 Grid System

```
Page content max-width: 1200px (centered on large screens)
Grid: CSS Grid with 12 columns, gap: 24px
Standard layouts:
  Dashboard: 8 + 4 col split
  Module page: 3-col card grid
  Profile: 6 + 6
  Session: full width (no sidebar-equivalent — use in-session layout)
```

---

## 5. Page Designs

### 5.1 Login Page (`/login`)

**Full-screen split layout:**

```
Left half (50%):
  background: var(--bg-surface)
  Centered vertically:
    Logo + "EnglishAI" wordmark (font-display, 48px)
    Tagline: "Master English through real conversation." (text-xl, text-secondary)
    3 feature callouts with icon + short text:
      • "Live AI tutor — speaks, listens, corrects"
      • "Adapts to your IELTS level"
      • "Track your progress, session by session"

  Decorative background:
    Faint radial gradient: gold glow top-left, teal glow bottom-right (very subtle, opacity 0.08)
    Thin animated horizontal line across middle — slow pulse (8s loop)

Right half (50%):
  background: var(--bg-base)
  Centered card (480px wide):
    Title: "Welcome back" or "Create account" (text-3xl, font-display)
    Toggle: [Sign In] [Sign Up] — pill toggle, gold underline indicator

    Form fields: Email, Password (+ Confirm password for sign-up)
    CTA button: Full width primary gold button "Continue"
    Footer: "Forgot password?" link (text-sm, accent-gold)

    Divider: "—— or ——"
    Social options (if configured)

Animation: Card fades in + slides up 16px on mount (300ms ease-out)
```

### 5.2 Dashboard (`/dashboard`)

```
Header section:
  Greeting: "Good morning, {name}" — text-4xl, font-display
  Sub: "You're on a 7-day streak. Keep it up." — text-lg, text-secondary
  (streak icon — fire emoji or custom SVG)

Main grid (8+4):

  LEFT (8 col):
    Current Module Card (prominent):
      background: linear-gradient(135deg, var(--bg-surface), rgba(201, 168, 76, 0.05))
      border: 1px solid var(--border-gold)
      Shows: Module title (font-display, text-2xl), IELTS band range, description
      XP Progress bar (full width, gold fill)
      Label: "340 / 800 XP · ~3 sessions to level up"
      CTA: "Continue Learning →" (primary button)

    Recent Sessions (last 5):
      Section title: "Recent Sessions" — text-xl, font-weight 600
      List of session rows:
        [type badge] [class/topic title]   [date]   [XP earned +80]
        Row hover: bg-glass
        Skill score dots (4 colored dots, filled = scored)

    Upcoming Classes:
      Horizontal scroll of class cards (see Module Page card style)

  RIGHT (4 col):
    Skill Radar / Score Summary:
      4 skill bars (speaking, listening, grammar, pronunciation)
      Each shows avg score from last 5 sessions
      Bar: 4px height, colored per skill, label + "72/100" right-aligned

    Quick Action Cards (stacked):
      "Speaking Playground" card:
        Dark teal tint, icon, "Jump into free talk →"
      "Today's Goal" card:
        "Complete 1 class · earn 80 XP" with checkbox
```

### 5.3 Module Page (`/modules/:id`)

```
Page header:
  Module title — text-4xl, font-display, text-primary
  Band badge: "IELTS 4.0 – 5.0" — large pill, border-gold, text-accent-gold
  Description paragraph
  Overall progress bar + "2 of 4 classes complete"

Class cards grid (2-col on desktop, 1-col on mobile):
  Each card:
    background: var(--bg-surface)
    border: 1px solid var(--border-subtle)
    border-left: 3px solid [skill color] (replaces left border-radius)
    border-radius: 0 var(--radius-lg) var(--radius-lg) 0
    padding: 20px 24px

    Top row: [Skill badge] [XP pill: "+80 XP"] [✓ if complete]
    Title: Class name (text-lg, font-weight 600)
    Description: 2-line cap (text-sm, text-secondary)
    Bottom: "Start Class →" ghost button OR "Completed" faded text

  Completed card: opacity 0.6, green ✓ icon, dashed border

Weak areas callout (if data exists):
  Subtle alert box:
    "Your recent scores suggest focusing on: third conditional, article usage"
    icon: ⚠ amber
    background: rgba(251, 191, 36, 0.08), border: 1px solid rgba(251, 191, 36, 0.2)
```

### 5.4 Classroom / Session UI (`/class/:id` and `/playground/:topic`)

> This is the most important screen. Every pixel matters.

**Full-screen immersive layout (no sidebar during session):**

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Exit]    "Present Perfect Practice"    [00:12:34] [+80 XP] │  ← SessionBar (64px)
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  TRANSCRIPT PANE                          │  │
│  │  (scrollable, dual-column, takes up 60% of height)        │  │
│  │                                                           │  │
│  │     [AI turn — left aligned]    00:01                    │  │
│  │     Let's begin. Tell me about a time you had            │  │
│  │     to wait a long time for something.                   │  │
│  │                                                           │  │
│  │                    [Student turn — right aligned] 00:32  │  │
│  │                    I waited for three hours at the       │  │
│  │                    airport last year...                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  CONTROL BAR (bottom)                     │  │
│  │                                                           │  │
│  │      [AI STATUS]        [MIC BUTTON]        [···]        │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**SessionBar:**
```
  height: 64px
  background: var(--bg-surface)
  border-bottom: 1px solid var(--border-subtle)
  padding: 0 24px
  display: flex, align-items: center, justify-content: space-between

  Left: "← Exit Session" ghost button (shows confirm modal)
  Center: Session title (text-base, font-weight 600, truncated)
  Right: Timer (font-mono, text-sm, text-secondary) + XP badge

  XP badge: "0 XP" → animates upward when XP is awarded mid-session (count-up)
```

**Transcript Pane:**
```
  flex: 1
  overflow-y: auto
  padding: 24px 40px
  background: var(--bg-base)

  Auto-scroll to bottom on new message
  Smooth scroll behavior: scroll-behavior: smooth

  AI turn (left):
    max-width: 65%
    margin-right: auto
    background: var(--bg-surface)
    border: 1px solid var(--border-subtle)
    border-radius: 4px 16px 16px 16px
    padding: 12px 16px
    font: 400 15px/1.6 var(--font-body)
    color: var(--text-primary)
    position relative
    ::before avatar: small "N" circle (teal, 28px) top-left corner, overlapping

  Student turn (right):
    max-width: 65%
    margin-left: auto
    background: var(--accent-gold-muted)
    border: 1px solid var(--border-gold)
    border-radius: 16px 4px 16px 16px
    padding: 12px 16px
    font: 400 15px/1.6 var(--font-mono)    ← mono for student voice
    color: var(--text-primary)

  Timestamp: text-xs, text-muted, below each bubble, right-aligned for student, left for AI

  New message entrance animation:
    AI: fade in + slide from left 8px (200ms ease-out)
    Student: fade in + slide from right 8px (200ms ease-out)

  Correction highlight (when AI corrects):
    The wrong phrase in student's bubble gets subtle red underline
    The AI's correction bubble has a faint teal-left-border + "Correction:" label in text-xs teal
```

**AI Status Indicator:**
```
  Centered in control bar, 120px wide pill

  States:
    Listening:  Pulsing teal circle (2px border, keyframe pulse 1.5s) + "Listening"
    Speaking:   Animated bars (4 bars, heights animate up/down like equalizer) + "Speaking"
                bars color: var(--accent-teal)
    Thinking:   Three dots bouncing (staggered, 400ms) + "Thinking"
    Idle:       Static grey circle + "Ready"

  Container:
    background: var(--bg-elevated)
    border: 1px solid var(--border-default)
    border-radius: var(--radius-pill)
    padding: 8px 20px
    display: flex, align-items: center, gap: 10px
    font: 500 13px var(--font-body)
```

**Microphone Button:**
```
  Large circular button: 72px diameter
  Default (idle):
    background: var(--bg-elevated)
    border: 2px solid var(--border-default)
    icon: mic icon, 28px, text-secondary

  VAD active / student speaking:
    background: rgba(201, 168, 76, 0.15)
    border: 2px solid var(--accent-gold)
    box-shadow: 0 0 0 8px rgba(201, 168, 76, 0.08), 0 0 0 16px rgba(201, 168, 76, 0.04)
    icon: color var(--accent-gold)
    Outer rings pulse: keyframe ripple (scale 1→1.5, opacity 0.3→0), 1.5s loop

  Push-to-talk mode (held):
    Same as speaking state but only while pointer is held down

  Toggle pill (above mic button):
    "Push to Talk" | "Voice Detection" — small toggle
    font-size: 12px, text-muted
    selected mode: text-primary
```

**Waveform Visualization:**
```
  Canvas element: 200px wide × 48px tall, centered above mic button
  When AI is speaking: render 32 bars animated by simulated amplitude data
    bar color: var(--accent-teal), 3px wide, 4px gap, rounded tops
    smooth animation using requestAnimationFrame + sine wave offset
  When student is speaking: bars gold-colored, driven by actual mic RMS data
  When idle: flat line, text-muted color
```

### 5.5 Placement Session (`/placement`)

```
Identical to ClassRoom layout with these changes:

  SessionBar center: "Placement Assessment" (no exit button — only minimize)

  Progress stepper replaces XP display:
    "Question 3 of 8"
    Visual: 8 small dots, filled in gold up to current, grey after
    font-mono, text-sm

  Transcript hint text (first load only):
    Centered placeholder before any conversation:
    Large icon (headphones SVG), 48px
    "Your assessment will begin shortly" — text-lg, text-secondary
    "Speak clearly and naturally. There are no wrong answers." — text-sm, text-muted

  End screen (replaces SessionSummary modal):
    Full page overlay:
      Centered: large IELTS band badge (font-display, 72px, gold)
      "Your IELTS Level: 4.5"
      Module recommendation: "You'll start with Pre-Intermediate (Module 3)"
      Description of what that module covers
      Primary CTA: "Begin Your Learning Journey →"
```

### 5.6 Playground Home (`/playground`)

```
Header:
  "Speaking Playground" — text-4xl, font-display
  "Choose a topic. Just talk. No pressure." — text-lg, text-secondary

Topic card grid (3 cols desktop, 2 tablet, 1 mobile):
  Each card:
    background: var(--bg-surface)
    border: 1px solid var(--border-subtle)
    border-radius: var(--radius-xl)
    padding: 28px 24px
    cursor: pointer
    overflow: hidden
    position: relative

    Decorative element: large emoji (48px) or abstract SVG icon top-right, opacity 0.15, rotated 15deg
    Topic title: text-xl, font-weight 600, font-display
    Description: text-sm, text-secondary, 2-line cap
    Difficulty indicator: "All levels" | "Band 4+" etc. — text-xs badge, bottom-left
    Arrow: "→" text-secondary, bottom-right, transitions right 4px on hover

  hover:
    border-color: var(--border-gold)
    box-shadow: var(--shadow-gold)
    background: linear-gradient(135deg, var(--bg-surface), rgba(201, 168, 76, 0.03))
    transform: translateY(-2px)
    transition: all 250ms var(--ease-out-expo)

Topic emoji map:
  nature-environment:    🌿
  family-relationships:  👨‍👩‍👧
  travel-places:         ✈️
  technology-science:    🔬
  food-culture:          🍜
  current-events:        📰
  health-wellbeing:      💚
  sports-hobbies:        🏄
  work-career:           💼
  animals-wildlife:      🦋

Daily XP cap indicator:
  At top-right of page:
  "Playground XP today: 240 / 480" — small stat pill
  Mini progress bar (gold fill, 4px)
  tooltip on hover: "You can earn up to 480 XP from playground each day"
```

### 5.7 Profile Page (`/profile`)

```
Two-column layout (6+6):

LEFT:
  Avatar circle: 80px, initials, gold border, gradient background
  Name: text-3xl, font-display
  "Member since {date}" — text-sm, text-muted
  Email — text-sm

  Stats grid (2x2):
    Total Sessions | Total XP
    Current Streak | Avg Score
    Each: large number (font-mono, text-3xl, gold) + label (text-sm, text-muted)

  Edit profile section (collapsible):
    Name field + Save button

RIGHT:
  Level History section:
    Title: "Level Journey" — text-xl, font-weight 600
    Timeline (vertical):
      Each entry:
        ● (colored circle) Module name + date
        └─ "Advanced from X to Y" — text-sm
           Evidence: avg scores as mini badge pills
           Reason text: italic, text-sm, text-secondary
        Entries newest first. Max show 5, "Show all" expander.

    Timeline connector: 2px dashed line, var(--border-subtle)
    Current position: pulsing gold dot

  Skill Performance:
    Last 10 sessions avg per skill
    4 horizontal bars with percentage
    Mini trend arrow (↑ ↓ →) if trending vs previous 10
```

### 5.8 Level-Up Celebration

```
Full-screen overlay (z-index: 9999):
  background: rgba(10, 13, 20, 0.95)
  backdrop-filter: blur(12px)
  display: flex, align-items: center, justify-content: center

Central panel (480px wide):
  animation: scale from 0.8 + fade in, 400ms spring ease

  [Confetti animation — canvas overlay, 3 seconds, gold + teal particles]

  Top: large trophy or ⬆ arrow icon (64px, gold, animated bounce)
  "Level Up!" — text-5xl, font-display, gold
  Subtitle: "You've mastered Module 3: Pre-Intermediate"

  New module card (appearing with delay 600ms):
    Module 4 card, gold border glow
    "Starting next: Intermediate Fluency (4.0–5.0)"

  Stats summary:
    "Sessions completed: 7  •  Avg score: 78/100"
    font-mono, text-sm, text-muted

  CTA (delay 900ms):
    Primary: "Begin Module 4 →"
    Ghost: "View my progress"

  [Auto-dismiss after 8 seconds with countdown ring on dismiss button]
```

---

## 6. Micro-Interactions & Animations

### 6.1 Page Transitions

```css
/* All page mounts */
@keyframes page-enter {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.page-enter {
  animation: page-enter 300ms var(--ease-out-expo) forwards;
}

/* Stagger children on dashboard */
.stagger-children > * {
  animation: page-enter 300ms var(--ease-out-expo) forwards;
  opacity: 0;
}
.stagger-children > *:nth-child(1) { animation-delay: 0ms; }
.stagger-children > *:nth-child(2) { animation-delay: 60ms; }
.stagger-children > *:nth-child(3) { animation-delay: 120ms; }
.stagger-children > *:nth-child(4) { animation-delay: 180ms; }
```

### 6.2 XP Counter Animation

```
When XP is awarded (session or mid-session):
  Counter increments from old value to new value
  Duration: 800ms, easing: ease-out
  Implementation: requestAnimationFrame loop
  Number display: font-mono
  Flash: text-color briefly pulses gold (300ms)
```

### 6.3 Score Bar Fill

```
On mount / when score changes:
  Bar width animates from 0 to target in 600ms ease-out-expo
  Delay: 100ms per bar for stagger effect
  Glow appears at end: box-shadow pulses once
```

### 6.4 Mic Button States

```
Idle → Active (speaking):
  border-color: transition 150ms to gold
  box-shadow: expand outward, 200ms ease-out
  ripple rings: appear with 0ms, 300ms, 600ms delays

Active → Idle:
  All reverse, 200ms ease-in
```

### 6.5 Transcript Scroll

```
New message added:
  Element inserted with opacity: 0, transform: translateY(8px)
  Animate to opacity: 1, translateY: 0 in 200ms ease-out
  Scroll container smoothly scrolls to bottom (scrollIntoView with smooth behavior)
  If user has scrolled up manually: show "↓ New message" chip at bottom
    chip: small gold pill, fade in, click to scroll down
```

---

## 7. Responsive Breakpoints

```css
/* Design for desktop-first; session UI is primarily desktop */
--bp-sm:  640px;
--bp-md:  768px;
--bp-lg:  1024px;
--bp-xl:  1280px;

/* Mobile adaptations */
@media (max-width: 768px) {
  /* Sidebar → bottom nav tabs */
  /* Transcript pane: full width, no padding */
  /* Mic button: sticky bottom center */
  /* Playground grid: 1 col */
  /* Dashboard: stacked single col */
}
```

---

## 8. Accessibility

- All interactive elements: visible focus ring (`outline: 2px solid var(--accent-gold), outline-offset: 3px`)
- Color contrast: all text meets WCAG AA (4.5:1 minimum)
- Mic button: aria-label changes based on state ("Start speaking", "Stop speaking", "AI is responding — please wait")
- Transcript pane: `aria-live="polite"` region so screen readers announce new messages
- Keyboard navigation: Tab through all controls, Enter/Space to activate
- Skip-to-content link at top of each page (visually hidden, appears on focus)
- Reduced-motion: `@media (prefers-reduced-motion: reduce)` removes animations, keeps transitions under 100ms

---

## 9. Loading States

### Skeleton Screens

```
Use skeleton loaders (NOT spinners) for:
  - Dashboard initial load: skeleton cards matching dashboard layout
  - Module page class list: 4 skeleton class card rows
  - Profile: skeleton for stats grid + timeline

Skeleton style:
  background: linear-gradient(90deg, var(--bg-surface), var(--bg-elevated), var(--bg-surface))
  background-size: 200% 100%
  animation: shimmer 1.5s infinite linear
  border-radius: matching the real element

@keyframes shimmer {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}
```

### Session Loading

```
Before WebSocket connects:
  Centered on screen:
    Animated logo mark (subtle pulse)
    "Connecting to your tutor..."
    Spinner (teal, thin, 24px)

If connection fails:
  Replace with: error icon + "Couldn't connect. Check your internet connection."
  "Try Again" button
```

---

## 10. Global CSS Setup

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: 1.6;
  min-height: 100vh;
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }

/* Selection */
::selection {
  background: var(--accent-gold-muted);
  color: var(--text-primary);
}

/* Focus visible */
:focus-visible {
  outline: 2px solid var(--accent-gold);
  outline-offset: 3px;
  border-radius: 4px;
}
```

---

## 11. Implementation Notes for Claude Code

### Technology decisions

- Use **Tailwind CSS** with a custom `tailwind.config.ts` that maps all design tokens above as CSS variables AND Tailwind utilities
- Alternatively use **CSS Modules** — one `.module.css` per component. Avoid inline styles except for dynamic values.
- Use **GSAP** (via gsap npm package) for all animations — page transitions, level-up celebration, waveform, and micro-interactions. Use gsap.context() for React cleanup. Use ScrollTrigger plugin where needed. Do NOT install Framer Motion.
- Use **Lucide React** for all icons — consistent 18px stroke icons, `strokeWidth={1.5}`
- Use **Recharts** for any score charts / skill radar

### Component creation order

```
1. Design tokens (globals.css / tokens.ts)
2. ui/ primitives: Button, Badge, Card, ProgressBar, Input, Toast
3. layout/: AppShell, Sidebar, TopBar
4. session/: AIStatus, MicButton, Transcript, SessionBar, SessionSummary
5. pages: LoginPage, Dashboard, ModulePage, ClassRoom, PlaygroundHome, PlaygroundSession, PlacementSession, ProfilePage
```

### State colocation

- Toast notifications: global store in `authStore` or a dedicated `uiStore`
- Session UI state: `sessionStore` — never lifted to authStore
- Server state: React Query only — no local duplication in Zustand

### Do NOT

- Do NOT use `Inter` or `Roboto` — use `DM Sans` + `Playfair Display` as specified
- Do NOT use purple or generic blue gradients
- Do NOT use solid white or pure black backgrounds
- Do NOT use Material UI or Chakra UI component libraries — build from the primitives in this doc
- Do NOT animate everything — apply motion only where specified
- Do NOT use `localStorage` for tokens — memory only for AccessToken, HttpOnly cookie for RefreshToken
- Do NOT render raw transcript JSON in any UI element
```

---

*FRONTEND.md version 1.0 — April 2026*
*Always read alongside CLAUDE.md and the platform spec*