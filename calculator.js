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

  const otShareInput = parseFloat($("otShare").value);
  const otSharePct = isNaN(otShareInput) ? 100 : Math.min(100, Math.max(0, otShareInput));
  const otCrewSize = crewSize * (otSharePct / 100);
  const regCrewSize = crewSize - otCrewSize;

  const otHoursPerWeek = Math.max(0, scheduledHours - regHours);
  const regHoursApplied = Math.min(scheduledHours, regHours);

  const weeks = [];
  let cumCostPaid = 0;
  let cumEffectiveHoursCrew = 0; // total across crew

  for (let w = 0; w < duration; w++) {
    const lossPct = lossForWeek(w);
    const effectiveHoursPerWorker = scheduledHours * (1 - lossPct / 100);
    const weeklyWagePerOtWorker = regHoursApplied * baseRate + otHoursPerWeek * baseRate * otMult;
    const weeklyWagePerRegWorker = regHours * baseRate;

    const weekCostOtCrew = weeklyWagePerOtWorker * otCrewSize;
    const weekCostRegCrew = weeklyWagePerRegWorker * regCrewSize;
    const weekCostCrew = weekCostOtCrew + weekCostRegCrew;

    const weekEffectiveHoursOtCrew = effectiveHoursPerWorker * otCrewSize;
    const weekEffectiveHoursRegCrew = regHours * regCrewSize;
    const weekEffectiveHoursCrew = weekEffectiveHoursOtCrew + weekEffectiveHoursRegCrew;

    cumCostPaid += weekCostCrew;
    cumEffectiveHoursCrew += weekEffectiveHoursCrew;

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

  return {
    weeks, crewSize, otCrewSize, regCrewSize, otSharePct,
    baseRate, otMult, regHours, scheduledHours, otHoursPerWeek, duration
  };
}

function renderResults(data) {
  const { weeks, baseRate, crewSize, otCrewSize, regCrewSize, otSharePct } = data;
  const last = weeks[weeks.length - 1];

  const totalPaid = last.cumCostPaid;
  const equivCost = last.equivalentStraightCost;
  const impact = last.overtimeImpact;
  const impactPct = equivCost > 0 ? (impact / equivCost) * 100 : 0;

  const negativeWeeks = weeks.filter((w) => w.netNegative);
  const firstNegativeWeek = negativeWeeks.length ? negativeWeeks[0].week : null;

  const heroCls = impact > 0 ? "bad" : "good";
  $("heroStat").innerHTML = `
    <div class="hero-figure ${heroCls}">
      <div class="hero-label">Financial impact of overtime<br>over ${weeks.length} week${weeks.length === 1 ? "" : "s"}</div>
      <div class="hero-value">${fmtMoney(impact)}</div>
      <div class="hero-sub">${fmtPct(impactPct)} above the equivalent straight-time cost</div>
    </div>`;

  const cards = [
    { label: "Total wages paid", value: fmtMoney(totalPaid), cls: "" },
    { label: "Equivalent cost at straight time (no OT)", value: fmtMoney(equivCost), cls: "good" },
    {
      label: "Crew on OT schedule",
      value: `${fmtPct(otSharePct)} (${otCrewSize.toFixed(1)} of ${crewSize})`,
      cls: ""
    },
  ];

  if (firstNegativeWeek) {
    cards.push({
      label: "Net-negative overtime begins",
      value: `Week ${firstNegativeWeek}`,
      cls: "bad"
    });
  } else {
    cards.push({ label: "Net-negative overtime begins", value: "Not reached", cls: "good" });
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

  const style = getComputedStyle(document.documentElement);
  const gridColor = style.getPropertyValue("--line").trim() || "#c6d0da";
  const textColor = style.getPropertyValue("--muted").trim() || "#5c697b";
  const accentColor = style.getPropertyValue("--accent").trim() || "#2f5d8a";
  const goodColor = style.getPropertyValue("--good").trim() || "#3f7d58";
  const signalColor = style.getPropertyValue("--signal").trim() || "#c8622d";

  ctx.strokeStyle = gridColor;
  ctx.fillStyle = textColor;
  ctx.font = "11px ui-monospace, monospace";
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

  plotLine((w) => w.cumCostPaid, accentColor);
  plotLine((w) => w.equivalentStraightCost, goodColor);

  ctx.beginPath();
  ctx.strokeStyle = signalColor;
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

function renderPrintMeta(data) {
  const scheduleLabel = PRESETS[$("scheduleSelect").value]
    ? PRESETS[$("scheduleSelect").value].label
    : `${data.scheduledHours} hrs/wk`;
  const generated = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
  $("printMeta").innerHTML = `
    <div class="print-meta-row">
      <span><strong>Crew:</strong> ${data.crewSize} workers</span>
      <span><strong>On OT:</strong> ${fmtPct(data.otSharePct)} (${data.otCrewSize.toFixed(1)} workers)</span>
      <span><strong>Base rate:</strong> $${data.baseRate.toFixed(2)}/hr</span>
      <span><strong>OT multiplier:</strong> ${data.otMult}x</span>
      <span><strong>Schedule:</strong> ${scheduleLabel}</span>
      <span><strong>Duration:</strong> ${data.duration} week${data.duration === 1 ? "" : "s"}</span>
    </div>
    <div class="print-meta-row"><span>Report generated ${generated}</span></div>`;
}

function recalculate() {
  if (!currentCurve) return;
  const data = computeWeeklyData();
  renderResults(data);
  renderPrintMeta(data);
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

  ["crewSize", "baseRate", "otMultiplier", "regHours", "otShare", "duration"].forEach((id) => {
    $(id).addEventListener("input", recalculate);
  });

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", recalculate);
  }

  $("duration").addEventListener("input", () => {
    const duration = Math.max(1, parseInt($("duration").value, 10) || 1);
    while (currentCurve.loss.length < duration) {
      currentCurve.loss.push(currentCurve.loss[currentCurve.loss.length - 1]);
    }
    renderCurveTable();
    recalculate();
  });

  $("printBtn").addEventListener("click", () => window.print());
  window.addEventListener("beforeprint", recalculate);
  window.addEventListener("afterprint", recalculate);
}

document.addEventListener("DOMContentLoaded", init);
