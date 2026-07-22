# Overtime Financial Impact Calculator

A standalone, offline-capable calculator that estimates the true financial impact of
sustained scheduled overtime on a project, combining:

1. **The overtime wage premium** — straight cost of paying OT-multiplier rates for hours
   beyond the regular work week.
2. **The productivity-loss effect** — the well-documented tendency for crews on sustained
   overtime schedules to become progressively less efficient, so that paid hours produce
   less and less actual output over time.

This second effect is the core of the classic construction-industry overtime studies,
most notably:

- **NECA**, *Overtime and Productivity in Electrical Construction* (National Electrical
  Contractors Association)
- The **Business Roundtable** Construction Industry Cost Effectiveness study, Report
  C-2, *Scheduled Overtime Effect on Construction Projects* (1980)

Both publish curves of cumulative productivity loss (%) by week, for various sustained
overtime schedules (e.g. 50, 54, 60, 72, 84 hours/week), showing loss rising sharply in
the first several weeks and then leveling off.

## Important note on the data

The productivity-loss percentages built into this tool (`calculator.js`, `PRESETS`) are
**illustrative approximations** of the general shape reported in that literature — they
are not a reproduction of the exact copyrighted tables published by NECA or the Business
Roundtable. The curve table in the calculator is fully editable: for any binding,
contractual, claims, or legal use, replace the default numbers with the exact figures
from your specific NECA (or other authoritative) reference table for the schedule and
duration in question.

## Running it

No build step or server required — it's plain HTML/CSS/JS.

```
open index.html
```

or serve the directory with any static file server, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## How the math works

For each week of sustained overtime:

- **Scheduled hours** = regular hours/week + overtime hours/week (from the selected
  schedule preset, or a custom value).
- **Wages paid** = (regular hours × base rate) + (overtime hours × base rate × OT
  multiplier), per worker, times crew size.
- **Effective (productive) hours** = scheduled hours × (1 − cumulative productivity loss
  % for that week). This mirrors how the NECA/Business Roundtable curves express
  efficiency loss across the whole sustained-overtime week, not just the extra hours.

Across the full duration, the tool then computes:

- **Total wages paid** — what the crew actually costs, OT premium included.
- **Equivalent cost at straight time** — what it would cost, at the base hourly rate with
  no overtime and no productivity loss, to produce the *same amount of actual (effective)
  work*.
- **Financial impact of overtime** = total wages paid − equivalent straight-time cost.
  This isolates the cost of choosing sustained overtime as a delivery strategy, on top of
  the wage premium itself, caused purely by lost efficiency.
- **Net-negative weeks** — weeks where effective hours per worker fall *below* a standard
  regular work week, meaning that week's overtime schedule produced less usable output
  than simply working regular hours would have. This flags the point of diminishing (and
  ultimately negative) returns from extending overtime further.

## Files

- `index.html` — page structure / inputs / results layout
- `style.css` — styling (light/dark aware)
- `calculator.js` — calculation logic, curve presets, chart rendering
- `README.md` — this file

## Limitations

This is a planning aid, not a certified cost-claim tool. It does not model:

- Absenteeism or turnover induced by extended overtime
- Safety-incident costs
- Rework/quality costs beyond the modeled productivity loss
- Schedule patterns beyond the built-in presets (5x10, 6x8, 6x9, 6x10/5x12, 7x10, 6x12,
  7x12) — use "Custom" and edit the curve table for other patterns
