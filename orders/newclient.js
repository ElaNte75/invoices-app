/* Νέος πελάτης: φόρμα με όσα στοιχεία υπάρχουν (μόνο το όνομα είναι υποχρεωτικό) */
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
  function val(k) { var el = document.getElementById("c-" + k); return el ? el.value.trim() : ""; }

  O.newClient = {
    html: function () {
      return FIELDS.map(function (f) {
        return '<div class="label">' + f.label + '</div><input class="field cf" id="c-' + f.k + '" type="text" autocomplete="off"' +
          (f.mode ? ' inputmode="' + f.mode + '"' : "") + ">";
      }).join("") + '<div class="label">Σχόλιο</div><textarea class="field" id="c-note" placeholder="Ό,τι άλλο ξέρεις…" aria-label="Σχόλιο"></textarea>';
    },
    ok: function () { return !!val("shortName"); },
    values: function () {
      var out = {};
      FIELDS.forEach(function (f) {
        var v = val(f.k);
        if (f.k === "afm") v = v.replace(/\D/g, "");
        if (v) out[f.k] = v;
      });
      return out;
    },
    note: function () { return val("note"); }
  };
})(window.O = window.O || {});
