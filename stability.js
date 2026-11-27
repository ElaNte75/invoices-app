// Demand stability (XYZ) for Analysis → Products, measured in calendar units: half-month (1–15, 16–end), month or quarter.
// XYZ = coefficient of variation of the pieces per unit, empty units included (X < 0,5 steady, Y ≤ 1 fluctuating, Z > 1 occasional).
// Only whole units count: fully inside the period, after recording began, and already closed. At least 4 are needed for a grade.
// Frequency = in how many of the units touching the period (partial and current ones included) the product was ordered.
(function(){
  const UNITS = {
    H: {label: "Δεκαπενθήμερο", many: "δεκαπενθήμερα", whole: "ολόκληρα δεκαπενθήμερα", the: "τα", step: "από δεκαπενθήμερο σε δεκαπενθήμερο", next: "Το επόμενο δεκαπενθήμερο"},
    M: {label: "Μήνας", many: "μήνες", whole: "ολόκληρους μήνες", the: "τους", step: "από μήνα σε μήνα", next: "Ο επόμενος μήνας"},
    Q: {label: "Τρίμηνο", many: "τρίμηνα", whole: "ολόκληρα τρίμηνα", the: "τα", step: "από τρίμηνο σε τρίμηνο", next: "Το επόμενο τρίμηνο"}
  };
  const MIN = 4;
  const pad = n => String(n).padStart(2, "0");
  const ymd = (y, m, d) => { const t = new Date(y, m, d); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
  const parts = s => [+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)];

  // [start, end] (inclusive, YYYY-MM-DD) of the unit that contains date s.
  function unitOf(s, u){
    const [y, m, d] = parts(s);
    if (u === "H") return d <= 15 ? [ymd(y, m, 1), ymd(y, m, 15)] : [ymd(y, m, 16), ymd(y, m + 1, 0)];
    if (u === "Q") { const q = m - m % 3; return [ymd(y, q, 1), ymd(y, q + 3, 0)]; }
    return [ymd(y, m, 1), ymd(y, m + 1, 0)];
  }
  const after = (b, u) => { const [y, m, d] = parts(b[1]); return unitOf(ymd(y, m, d + 1), u); };

  // Units overlapping [from, to]; "whole" when the unit lies fully inside [from, to] and ended before today.
  function units(u, from, to, today){
    const out = [];
    if (!from || !to || to < from) return out;
    for (let b = unitOf(from, u); b[0] <= to; b = after(b, u)) out.push({from: b[0], to: b[1], whole: b[0] >= from && b[1] <= to && b[1] < today});
    return out;
  }

  // prods: each may carry p.dq = Map(YYYY-MM-DD → pieces) of the period's sales. range: [from, to] of the period.
  // first: date recording began (earliest document). today: YYYY-MM-DD.
  function classify(prods, u, range, first, today){
    const from = [range[0], first || today].sort()[1], to = [range[1], today].sort()[0];
    const all = units(u, from, to, today), whole = all.filter(b => b.whole), n = whole.length;
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

  // Reliability of the grade from the number of whole units.
  function reliability(n){
    if (n < MIN) return {level: "", cls: "none"};
    if (n < 6) return {level: "Χαμηλή", cls: "low"};
    if (n < 12) return {level: "Μέτρια", cls: "mid"};
    return {level: "Υψηλή", cls: "high"};
  }

  // One-line explanation above the table. dt formats YYYY-MM-DD for display.
  function hint(res, u, dt){
    const U = UNITS[u], r = reliability(res.n), nx = res.next ? ` ${U.next} κλείνει στις ${dt(res.next)}.` : "";
    const span = res.n ? ` (${dt(res.whole[0].from)} – ${dt(res.whole[res.n - 1].to)})` : "";
    if (!r.level) return `<b>Αξιοπιστία XYZ:</b> <span class="rel none">δεν βγαίνει ακόμα βαθμός</span> · υπάρχουν ${res.n} από ${U.the} ${MIN} ${U.whole} που χρειάζονται${span}.${nx}`;
    return `<b>Αξιοπιστία XYZ:</b> <span class="rel ${r.cls}">${r.level}</span> · σε ${res.n} ${U.whole}${span} (χαμηλή 4–5, μέτρια 6–11, υψηλή από 12).${nx}`;
  }

  window.Stability = {UNITS, classify, reliability, hint};
})();
