/* Φόρμα πελάτη (νέος ή επεξεργασία): μόνο το όνομα είναι υποχρεωτικό στον νέο πελάτη */
(function (O) {
  var FIELDS = [
    { k: "shortName", label: "Όνομα *" },
    { k: "name", label: "Επωνυμία" },
    { k: "afm", label: "ΑΦΜ", mode: "numeric" },
    { k: "city", label: "Πόλη" },
    { k: "address", label: "Διεύθυνση" },
    { k: "phone", label: "Τηλέφωνο", mode: "tel" },
    { k: "doy", label: "ΔΟΥ" },
    { k: "profession", label: "Επάγγελμα" }
  ];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function val(k) { var el = document.getElementById("c-" + k); return el ? el.value.trim() : ""; }
  function clean(f, v) { return f.k === "afm" ? v.replace(/\D/g, "") : v; }

  O.newClient = {
    fields: FIELDS,
    /* vals: προσυμπληρωμένες τιμές (επεξεργασία), note: σχόλιο */
    html: function (vals, note, noRequired) {
      vals = vals || {};
      return FIELDS.map(function (f) {
        return '<div class="label">' + (noRequired ? f.label.replace(" *", "") : f.label) + '</div><input class="field cf" id="c-' + f.k + '" type="text" autocomplete="off"' +
          (f.mode ? ' inputmode="' + f.mode + '"' : "") + ' value="' + esc(vals[f.k] || "") + '">';
      }).join("") + '<div class="label">Σχόλιο</div><textarea class="field cf" id="c-note" placeholder="Ό,τι άλλο ξέρεις…" aria-label="Σχόλιο">' + esc(note || "") + "</textarea>";
    },
    ok: function () { return !!val("shortName"); },
    values: function () {
      var out = {};
      FIELDS.forEach(function (f) {
        var v = clean(f, val(f.k));
        if (v) out[f.k] = v;
      });
      return out;
    },
    /* Μόνο ό,τι άλλαξε σε σχέση με τα στοιχεία της βάσης: { city: {from, to}, ... } */
    changes: function (base) {
      var out = {};
      FIELDS.forEach(function (f) {
        var to = clean(f, val(f.k)), from = base[f.k] || "";
        if (to !== from) out[f.k] = { from: from || null, to: to || null };
      });
      return out;
    },
    note: function () { return val("note"); }
  };
})(window.O = window.O || {});
