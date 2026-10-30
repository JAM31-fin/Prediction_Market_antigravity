# Implementation Plan: Color Palette Refinement & Frontend-Slides Integration

### Task Type
- [x] Frontend (→ Antigravity)

### Objective
Eliminate saturated neon "IA slop" colors (`#00f0a0`, `#00d2ff`, `#ff3b69`, glowing halo drop shadows) across CentraMarkets and replace them with mature, institutional financial color palettes. Integrate `frontend-slides` as both an interactive standalone visual preview deck and an in-app interactive slide component.

---

### Three Flavor Options

#### Plan A: "Linear / Vercel Modern Obsidian" (Recommended)
- Base background: `#090d16` (deep cool obsidian)
- Card surface: `#0e1424` with hairline border `rgba(255, 255, 255, 0.07)`
- YES / Gains: `#10b981` (sober emerald)
- NO / Losses: `#e11d48` (refined crimson)
- Accents: `#38bdf8` (slate sky blue)
- Lighting: Zero neon glow shadows, crisp 1px borders.

#### Plan B: "Polymarket Institutional Clean"
- Base background: `#0b1120` (slate navy)
- Card surface: `#111a30`
- YES / Gains: `#059669` (Polymarket reliable jade)
- NO / Losses: `#ef4444` (coral red)
- Accents: `#2563eb` & `#60a5fa`
- Badges: Low-opacity matte fills (10-15%).

#### Plan C: "Apple Pro Charcoal & Matte Metal"
- Base background: `#12161f` (anthracite charcoal)
- Card surface: `#1a202c`
- YES / Gains: `#34d399` / `#30d158` (organic green)
- NO / Losses: `#f43f5e` (terracotta red)
- Tournament Accents: `#f59e0b` / `#d97706` (aged amber gold)

---

### Implementation Steps (Once Approved)
1. **Token System (`src/index.css`)**:
   - Replace `--color-mint`, `--color-accent`, `--color-crimson` with selected sober palette.
   - Delete `.glow-mint`, `.glow-cyan`, `.glow-crimson`.
   - Update focus ring and card border styling.
2. **Interactive Chart (`PriceChart.tsx`)**:
   - Update stroke colors to selected sober palette.
   - Replace saturated fill gradients with subtle opacity fades (15% to 0%).
   - Retain 100% of LMSR calculations, time axis scaling, and live point updates.
3. **Trading Engine UI (`TradingPanel.tsx`, `MarketCard.tsx`)**:
   - Update BUY / SELL buttons and outcome chips with high-contrast text on matte backgrounds.
4. **App & Navigation (`App.tsx`, `Navbar.tsx`, `HeroSection.tsx`)**:
   - Update canvas background from harsh `#04070d` to selected palette base.
   - Remove neon pills and replace with refined badges.
5. **In-App Frontend-Slides Feature**:
   - Add "Cómo Funciona" interactive slide tour in `HeroSection.tsx` or `TournamentsPage.tsx`.

### Deliverables Already Built
- Standalone HTML presentation: `design-presentation.html` (run `start "" design-presentation.html` in PowerShell/terminal to inspect).
