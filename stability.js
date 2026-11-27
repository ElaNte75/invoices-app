// Demand stability (XYZ) for Analysis → Products, measured in calendar units: week (Mon–Sun), half-month (1–15, 16–end) or month.
// The unit is chosen automatically from the selected period: month if it has ≥ 4 whole months, else half-month, else week (auto()).
// XYZ = coefficient of variation of the pieces per unit, empty units included (X < 0,5 steady, Y ≤ 1 fluctuating, Z > 1 occasional).
// Only whole units count: fully inside the period, after recording began, and already closed. At least 4 are needed for a grade.
// Exception for weeks only: the week recording began counts as whole (a few missing days), as the original weekly XYZ did.
// Frequency = in how many of the units touching the period (partial and current ones included) the product was ordered.
(function(){
  const UNITS = {
    W: {label: "Εβδομάδα", many: "εβδομάδες", whole: "ολόκληρες εβδομάδες", the: "τις", by: "ανά εβδομάδα", step: "από εβδομάδα σε εβδομάδα", next: "Η επόμενη εβδομάδα"},
    H: {label: "Δεκαπενθήμερο", many: "δεκαπενθήμερα", whole: "ολόκληρα δεκαπενθήμερα", the: "τα", by: "ανά δεκαπενθήμερο", step: "από δεκαπενθήμερο σε δεκαπενθήμερο", next: "Το επόμενο δεκαπενθήμερο"},
    M: {label: "Μήνας", many: "μήνες", whole: "ολόκληρους μήνες", the: "τους", by: "ανά μήνα", step: "από μήνα σε μήνα", next: "Ο επόμενος μήνας"}
  };
  const MIN = 4;
  const pad = n => String(n).padStart(2, "0");
  const ymd = (y, m, d) => { const t = new Date(y, m, d); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
  const parts = s => [+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)];

  // [start, end] (inclusive, YYYY-MM-DD) of the unit that contains date s.
  function unitOf(s, u){
    const [y, m, d] = parts(s);
    if (u === "W") { const wd = (new Date(y, m, d).getDay() + 6) % 7; return [ymd(y, m, d - wd), ymd(y, m, d - wd + 6)]; }
    if (u === "H") return d <= 15 ? [ymd(y, m, 1), ymd(y, m, 15)] : [ymd(y, m, 16), ymd(y, m + 1, 0)];
    return [ymd(y, m, 1), ymd(y, m + 1, 0)];
  }
  const after = (b, u) => { const [y, m, d] = parts(b[1]); return unitOf(ymd(y, m, d + 1), u); };

  // Units overlapping [from, to]; "whole" when the unit starts at or after lo (normally = from), ends by to and ended before today.
  function units(u, from, to, today, lo){
    const out = [];
    if (!from || !to || to < from) return out;
    for (let b = unitOf(from, u); b[0] <= to; b = after(b, u)) out.push({from: b[0], to: b[1], whole: b[0] >= lo && b[1] <= to && b[1] < today});
    return out;
  }

  // prods: each may carry p.dq = Map(YYYY-MM-DD → pieces) of the period's sales. range: [from, to] of the period.
  // first: date recording began (earliest document). today: YYYY-MM-DD.
  function classify(prods, u, range, first, today){
    const from = [range[0], first || today].sort()[1], to = [range[1], today].sort()[0];
    const lo = u === "W" && first && range[0] <= first ? unitOf(first, u)[0] : from;
    const all = units(u, from, to, today, lo), whole = all.filter(b => b.whole), n = whole.length;
    const map = new Map();
    prods.forEach(p => {
      const sum = b => { let q = 0; if (p.dq) p.dq.forEach((v, d) => { if (d >= b.from && d <= b.to) q += v; }); return q; };
      const vals = whole.map(sum), mean = n ? vals.reduce((a, v) => a + v, 0) / n : 0;
      const cv = n >= MIN && mean > 0 ? Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / n) / mean : null;
      const xyz = cv == null ? "" : cv < 0.5 ? "X" : cv <= 1 ? "Y" : "Z";
      map.set(p.k, {xyz, cv, hit: all.filter(b => sum(b) > 0).length, of: all.length, hitWhole: vals.filter(v => v > 0).length});
    });
    const pending = all.find(b => !b.whole && b.from >= from && b.to >= today);
    return {map, n, total: all.length, whole, next: pending && pending.to <= range[1] ? pending.to : ""};
  }

  // Coarsest unit (month, half-month, week) with at least MIN whole units in the period; week when none reaches it (grade then empty).
  function auto(prods, range, first, today){
    for (const u of ["M", "H", "W"]) { const r = classify(prods, u, range, first, today); r.unit = u; if (r.n >= MIN || u === "W") return r; }
  }

  // Reliability of the grade from the number of whole units.
  function reliability(n){
    if (n < MIN) return {level: "", cls: "none"};
    if (n < 6) return {level: "Χαμηλή", cls: "low"};
    if (n < 12) return {level: "Μέτρια", cls: "mid"};
    return {level: "Υψηλή", cls: "high"};
  }

  // One-line explanation above the table. dt formats YYYY-MM-DD for display.
  function hint(res, dt){
    const U = UNITS[res.unit], r = reliability(res.n), nx = res.next ? ` ${U.next} κλείνει στις ${dt(res.next)}.` : "";
    const span = res.n ? ` (${dt(res.whole[0].from)} – ${dt(res.whole[res.n - 1].to)})` : "";
    if (!r.level) return `<b>Σταθερότητα (XYZ):</b> <span class="rel none">δεν βγαίνει βαθμός</span> · η περίοδος είναι πολύ μικρή: έχει ${res.n} ${U.whole}, χρειάζονται τουλάχιστον ${MIN}. Διάλεξε μεγαλύτερη περίοδο, π.χ. «Όλη η περίοδος».${nx}`;
    return `<b>Σταθερότητα (XYZ):</b> μετρήθηκε ${U.by} σε ${res.n} ${U.whole}${span} · αξιοπιστία <span class="rel ${r.cls}">${r.level}</span> (χαμηλή 4–5, μέτρια 6–11, υψηλή από 12).${res.unit === "M" ? "" : " Η μονάδα μεγαλώνει μόνη της όσο μαζεύονται δεδομένα: δεκαπενθήμερο με 4 ολόκληρα, μήνας με 4 ολόκληρους."}${nx}`;
  }

  window.Stability = {UNITS, classify, auto, reliability, hint};
})();
