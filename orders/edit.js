/* Διόρθωση καταλόγου: φόρμα προϊόντος και υπολογισμός αλλαγών (πεδία όπως στη βάση) */
(function (O) {
  var MATS = ["Αλουμίνιο", "Ανοξείδωτο", "Αλουμίνιο βαμμένο"];
  /* k = πεδίο στη βάση, s = πεδίο στο κινητό */
  var SHEETS = ["1050", "1200", "430"];
  var FIELDS = [
    { k: "fullName", s: "name", label: "Περιγραφή", type: "text" },
    { k: "material", s: "mat", label: "Υλικό", type: "select", opts: MATS },
    { k: "sheetType", s: "sheet", label: "Τύπος υλικού (κωδικός)", type: "select", opts: SHEETS },
    { k: "thickness", s: "th", label: "Πάχος (χιλ.)", type: "num" },
    { k: "diameter", s: "dia", label: "Διάμετρος", type: "num" },
    { k: "length", s: "len", label: "Μήκος", type: "num" },
    { k: "width", s: "wid", label: "Πλάτος", type: "num" },
    { k: "depth", s: "dep", label: "Ύψος", type: "num" },
    { k: "blank", s: "blank", label: "Ανάπτυγμα (εκ.)", type: "text" },
    { k: "features", s: "feats", label: "Ιδιαιτερότητες (χωρισμένες με κόμμα)", type: "list" }
  ];
  /* Στρογγυλό: διάμετρος και ύψος (όχι μήκος/πλάτος). Κάθε άλλο σχήμα: μήκος, πλάτος και ύψος (όχι διάμετρος).
     Αν το προϊόν έχει ήδη τιμή σε πεδίο που κανονικά κρύβεται, το πεδίο φαίνεται για να μη χαθεί. */
  function isRound(p) { return p.shape === "Στρογγυλό" || (!p.shape && !!p.dia); }
  function visible(p, f) {
    var has = p[f.s] != null && p[f.s] !== "";
    if (f.s === "dia") return isRound(p) || has;
    if (f.s === "len" || f.s === "wid") return !isRound(p) || has;
    return true;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function show(v) {
    if (v == null || v === "") return "";
    return Array.isArray(v) ? v.join(", ") : String(v).replace(".", ",");
  }
  function orig(p, f) {
    var v = p[f.s];
    if (v == null) return f.type === "list" ? [] : "";
    if (f.type === "num" && typeof v === "string") { var n = parseFloat(v.replace(",", ".")); return isNaN(n) ? "" : n; }
    return v;
  }
  function parse(f, text) {
    var v = String(text).trim();
    if (f.type === "num") { if (!v) return ""; var n = parseFloat(v.replace(",", ".")); return isNaN(n) ? "" : n; }
    if (f.type === "list") return v ? v.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [];
    return v;
  }
  function empty(v) { return v === "" || v == null || (Array.isArray(v) && !v.length); }

  O.edit = {
    fields: FIELDS,
    show: show,
    html: function (p) {
      return FIELDS.filter(function (f) { return visible(p, f); }).map(function (f) {
        var id = "e-" + f.s, cur = orig(p, f), input;
        if (f.type === "select") {
          var opts = f.opts.slice();
          if (cur && opts.indexOf(cur) < 0) opts.push(cur);
          input = '<select class="field ef" id="' + id + '">' + [""].concat(opts).map(function (m) {
            return '<option value="' + esc(m) + '"' + (m === cur ? " selected" : "") + ">" + (m || "(κενό)") + "</option>";
          }).join("") + "</select>";
        } else {
          input = '<input class="field ef" id="' + id + '" type="text" autocomplete="off"' + (f.type === "num" ? ' inputmode="decimal"' : "") + ' value="' + esc(show(cur)) + '">';
        }
        var label = f.s === "blank" && isRound(p) ? "Ανάπτυγμα (διάμετρος δίσκου, εκ.)" : f.label;
        return '<div class="label">' + label + "</div>" + input;
      }).join("");
    },
    /* Επιστρέφει μόνο ό,τι άλλαξε: { fullName: {from, to}, ... } */
    changes: function (p) {
      var out = {};
      FIELDS.forEach(function (f) {
        var el = document.getElementById("e-" + f.s); if (!el) return;
        var to = parse(f, el.value), from = orig(p, f);
        if (JSON.stringify(to) !== JSON.stringify(from)) out[f.k] = { from: empty(from) ? null : from, to: empty(to) ? null : to };
      });
      return out;
    }
  };
})(window.O = window.O || {});
