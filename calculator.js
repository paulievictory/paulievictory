// Overtime Financial Impact Calculator
// Productivity-loss presets are illustrative approximations of the shape reported by
// classic sustained-overtime productivity studies (NECA "Overtime and Productivity in
// Electrical Construction"; Business Roundtable Report C-2, "Scheduled Overtime Effect
// on Construction Projects"). Curves are fully editable so exact published figures for
// a specific schedule can be substituted.

const PRESETS = {
  "48": { label: "48 hrs/wk (6x8)", hours: 48, loss: [1, 2, 3, 4, 5, 5, 6, 6, 6, 6, 6, 6] },
  "50": { label: "50 hrs/wk (5x10)", hours: 50, loss: [2, 4, 6, 7, 8, 9, 10, 10, 10, 10, 10, 10] },
  "54": { label: "54 hrs/wk (6x9)", hours: 54, loss: [5, 8, 11, 13, 14, 15, 16, 16, 16, 16, 16, 16] },
  "60": { label: "60 hrs/wk (6x10 / 5x12)", hours: 60, loss: [8, 12, 16, 19, 21, 22, 23, 24, 24, 24, 24, 24] },
  "70": { label: "70 hrs/wk (7x10)", hours: 70, loss: [12, 18, 22, 25, 27, 28, 29, 29, 29, 29, 29, 29] },
  "72": { label: "72 hrs/wk (6x12)", hours: 72, loss: [14, 20, 25, 28, 30, 31, 32, 32, 32, 32, 32, 32] },
  "84": { label: "84 hrs/wk (7x12)", hours: 84, loss: [18, 25, 30, 33, 35, 36, 37, 37, 37, 37, 37, 37] },
  "custom": { label: "Custom", hours: 60, loss: [8, 12, 16, 19, 21, 22, 23, 24, 24, 24, 24, 24] }
};

let currentCurve = null; // { hours, loss: [] }

const $ = (id) => document.getElementById(id);

function fmtMoney(n) {
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPct(n) {
  return n.toFixed(1) + "%";
}

function populateScheduleSelect() {
  const sel = $("scheduleSelect");
  sel.innerHTML = "";
  Object.entries(PRESETS).forEach(([key, preset]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = preset.label;
    sel.appendChild(opt);
  });
  sel.value = "60";
}

function loadCurveFromPreset(key) {
  const preset = PRESETS[key];
  currentCurve = { hours: preset.hours, loss: [...preset.loss] };
  $("scheduleSelect").value = key;
  renderCurveTable();
  recalculate();
}

function renderCurveTable() {
  const table = $("curveTable");
  const weeks = currentCurve.loss.length;
  let thead = "<thead><tr><th>Week</th>";
  for (let w = 1; w <= weeks; w++) thead += `<th>${w}</th>`;
  thead += "</tr></thead>";

  let rowLoss = "<tr><td>Cumulative productivity loss (%)</td>";
  for (let w = 0; w < weeks; w++) {
    rowLoss += `<td><input type="number" class="loss-input" data-week="${w}" value="${currentCurve.loss[w]}" min="0" max="95" step="0.5"></td>`;
  }
  rowLoss += "</tr>";

  table.innerHTML = thead + "<tbody>" + rowLoss + "</tbody>";

  table.querySelectorAll(".loss-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.week, 10);
      const val = parseFloat(e.target.value);
      currentCurve.loss[idx] = isNaN(val) ? 0 : val;
      recalculate();
    });
  });
}

function lossForWeek(weekIndex) {
  const arr = currentCurve.loss;
  if (weekIndex < arr.length) return arr[weekIndex];
  return arr[arr.length - 1];
}

function computeWeeklyData() {
  const crewSize = parseFloat($("crewSize").value) || 0;
  const baseRate = parseFloat($("baseRate").value) || 0;
  const otMult = parseFloat($("otMultiplier").value) || 1;
  const regHours = parseFloat($("regHours").value) || 40;
  const scheduledHours = currentCurve.hours;
  const duration = Math.max(1, parseInt($("duration").value, 10) || 1);

  const otHoursPerWeek = Math.max(0, scheduledHours - regHours);
  const regHoursApplied = Math.min(scheduledHours, regHours);

  const weeks = [];
  let cumCostPaid = 0;
  let cumEffectiveHoursCrew = 0; // total across crew
  let cumScheduledHoursCrew = 0;

  for (let w = 0; w < duration; w++) {
    const lossPct = lossForWeek(w);
    const effectiveHoursPerWorker = scheduledHours * (1 - lossPct / 100);
    const weeklyWagePerWorker = regHoursApplied * baseRate + otHoursPerWeek * baseRate * otMult;

    const weekCostCrew = weeklyWagePerWorker * crewSize;
    const weekEffectiveHoursCrew = effectiveHoursPerWorker * crewSize;
    const weekScheduledHoursCrew = scheduledHours * crewSize;

    cumCostPaid += weekCostCrew;
    cumEffectiveHoursCrew += weekEffectiveHoursCrew;
    cumScheduledHoursCrew += weekScheduledHoursCrew;

    const equivalentStraightCost = cumEffectiveHoursCrew * baseRate;
    const overtimeImpact = cumCostPaid - equivalentStraightCost;

    weeks.push({
      week: w + 1,
      lossPct,
      scheduledHours,
      effectiveHoursPerWorker,
      weekCostCrew,
      cumCostPaid,
      cumEffectiveHoursCrew,
      equivalentStraightCost,
      overtimeImpact,
      netNegative: effectiveHoursPerWorker < regHours
    });
  }

  return { weeks, crewSize, baseRate, otMult, regHours, scheduledHours, otHoursPerWeek, duration };
}

function renderResults(data) {
  const { weeks, baseRate } = data;
  const last = weeks[weeks.length - 1];

  const totalPaid = last.cumCostPaid;
  const equivCost = last.equivalentStraightCost;
  const impact = last.overtimeImpact;
  const impactPct = equivCost > 0 ? (impact / equivCost) * 100 : 0;

  const negativeWeeks = weeks.filter((w) => w.netNegative);
  const firstNegativeWeek = negativeWeeks.length ? negativeWeeks[0].week : null;

  const cards = [
    { label: "Total wages paid", value: fmtMoney(totalPaid), cls: "" },
    { label: "Equivalent cost at straight time (no OT)", value: fmtMoney(equivCost), cls: "good" },
    { label: "Financial impact of overtime", value: fmtMoney(impact), cls: impact > 0 ? "bad" : "good" },
    { label: "Impact as % of equivalent cost", value: fmtPct(impactPct), cls: impactPct > 0 ? "warn" : "good" },
  ];

  if (firstNegativeWeek) {
    cards.push({
      label: "Net-negative overtime begins",
      value: `Week ${firstNegativeWeek}`,
      cls: "bad"
    });
  }

  $("resultCards").innerHTML = cards
    .map((c) => `<div class="card ${c.cls}"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>`)
    .join("");

  const table = $("weeklyTable");
  let head = `<thead><tr>
    <th>Week</th><th>Loss %</th><th>Effective hrs/worker</th>
    <th>Weekly cost (crew)</th><th>Cumulative cost paid</th>
    <th>Cumulative equiv. cost</th><th>Cumulative OT impact</th>
  </tr></thead>`;
  let body = "<tbody>" + weeks.map((w) => `
    <tr class="${w.netNegative ? "row-negative" : ""}">
      <td>${w.week}</td>
      <td>${fmtPct(w.lossPct)}</td>
      <td>${w.effectiveHoursPerWorker.toFixed(1)}</td>
      <td>${fmtMoney(w.weekCostCrew)}</td>
      <td>${fmtMoney(w.cumCostPaid)}</td>
      <td>${fmtMoney(w.equivalentStraightCost)}</td>
      <td>${fmtMoney(w.overtimeImpact)}</td>
    </tr>`).join("") + "</tbody>";
  table.innerHTML = head + body;

  drawChart(weeks);
}

function drawChart(weeks) {
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 60, padR = 20, padT = 20, padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxCost = Math.max(...weeks.map((w) => w.cumCostPaid), 1);
  const maxLoss = Math.max(...weeks.map((w) => w.lossPct), 1);

  const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const gridColor = isDark ? "#2a313d" : "#e2e6ec";
  const textColor = isDark ? "#9aa5b3" : "#5b6675";

  ctx.strokeStyle = gridColor;
  ctx.fillStyle = textColor;
  ctx.font = "11px sans-serif";
  ctx.lineWidth = 1;

  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padT + (plotH * i) / gridLines;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    const val = maxCost - (maxCost * i) / gridLines;
    ctx.fillText("$" + Math.round(val).toLocaleString(), 4, y + 4);
  }

  const n = weeks.length;
  const xStep = n > 1 ? plotW / (n - 1) : 0;
  const xAt = (i) => padL + i * xStep;

  function plotLine(getVal, color) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    weeks.forEach((w, i) => {
      const x = xAt(i);
      const y = padT + plotH - (getVal(w) / maxCost) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  plotLine((w) => w.cumCostPaid, "#2f6fed");
  plotLine((w) => w.equivalentStraightCost, "#1f9d55");

  ctx.beginPath();
  ctx.strokeStyle = "#d64545";
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.5;
  weeks.forEach((w, i) => {
    const x = xAt(i);
    const y = padT + plotH - (w.lossPct / maxLoss) * (plotH * 0.4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = textColor;
  weeks.forEach((w, i) => {
    if (n <= 20 || i % Math.ceil(n / 20) === 0) {
      ctx.fillText("W" + w.week, xAt(i) - 8, H - padB + 16);
    }
  });
}

function recalculate() {
  if (!currentCurve) return;
  const data = computeWeeklyData();
  renderResults(data);
}

function init() {
  populateScheduleSelect();
  loadCurveFromPreset("60");

  $("scheduleSelect").addEventListener("change", (e) => {
    loadCurveFromPreset(e.target.value);
  });

  $("resetCurve").addEventListener("click", () => {
    const key = $("scheduleSelect").value;
    loadCurveFromPreset(key);
  });

  ["crewSize", "baseRate", "otMultiplier", "regHours", "duration"].forEach((id) => {
    $(id).addEventListener("input", recalculate);
  });

  $("duration").addEventListener("input", () => {
    const duration = Math.max(1, parseInt($("duration").value, 10) || 1);
    while (currentCurve.loss.length < duration) {
      currentCurve.loss.push(currentCurve.loss[currentCurve.loss.length - 1]);
    }
    renderCurveTable();
    recalculate();
  });
}

document.addEventListener("DOMContentLoaded", init);
