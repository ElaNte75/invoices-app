/* Ιστορικά: παραγγελίες (και QR τιμολογίων), επεξεργασία καταλόγου, πελάτες.
   Κάθε εγγραφή έχει Επεξεργασία και Διαγραφή όσο δεν έχει περαστεί στη βάση. */
(function (O) {
  var SETS = {
    orders: { title: "Ιστορικό παραγγελιών", kinds: ["order", "qr"] },
    qr: { title: "Ιστορικό QR", kinds: ["qr"] },
    photos: { title: "Ιστορικό φωτογραφιών", kinds: ["photo"] },
    catalog: { title: "Ιστορικό επεξεργασίας καταλόγου", kinds: ["edit", "info"] },
    clients: { title: "Ιστορικό πελατών", kinds: ["client", "clientEdit"] }
  };
  function esc(s) { return O.ui.esc(s); }
  /* Το όνομα όπως είναι τώρα στον κατάλογο (αν δεν βρεθεί, αυτό που αποθηκεύτηκε με την παραγγελία) */
  function curName(it) {
    var p = it.id && O.data.products.filter(function (x) { return x.id === it.id; })[0];
    return p ? p.name : it.name;
  }
  function inSet(set, r) { return SETS[set].kinds.indexOf(r.kind) > -1; }
  function list(set) { return O.store.all().filter(function (r) { return inSet(set, r); }); }
  function key(r) { return r.id || r.t; }
  function dayLabel(iso) {
    var d = new Date(iso), t = new Date(), y = new Date();
    y.setDate(t.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return "Σήμερα";
    if (d.toDateString() === y.toDateString()) return "Χθες";
    return d.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" });
  }
  function status(r) {
    if (r.passed) return "Έχει περαστεί στη βάση" + (r.edited ? " (η τελευταία επεξεργασία δεν στάλθηκε)" : "");
    if (r.sent === false) return "Περιμένει αποστολή";
    if (r.sent) return r.edited ? "Στάλθηκε · επεξεργασμένη" : "Στάλθηκε";
    return "";
  }
  function changeList(r, labels) {
    return "<ul>" + Object.keys(r.changes || {}).map(function (k) {
      var c = r.changes[k];
      return "<li>" + esc(labels[k] || k) + ": " + (esc(O.edit.show(c.from)) || "—") + " → " + (esc(O.edit.show(c.to)) || "—") + "</li>";
    }).join("") + "</ul>";
  }
  function acts(r, confirmKey) {
    var k = esc(key(r));
    if (confirmKey === key(r)) {
      return '<div class="acts"><b class="ask">Σίγουρα;</b><button class="small danger" data-hyes="' + k + '">' + (r.passed ? "Ναι, αφαίρεση" : "Ναι, διαγραφή") + '</button><button class="small" data-hno="1">Άκυρο</button></div>';
    }
    if (r.passed) return '<div class="acts"><button class="small danger" data-hdel="' + k + '">Αφαίρεση από το ιστορικό</button></div>';
    var edit = r.id && r.kind !== "qr" && r.kind !== "info" && r.kind !== "photo" ? '<button class="small" data-hedit="' + k + '">Επεξεργασία</button>' : "";
    return '<div class="acts">' + edit + '<button class="small danger" data-hdel="' + k + '">Διαγραφή</button></div>';
  }
  function entry(r) {
    var time = new Date(r.t).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
    var kind, title, inner = "";
    if (r.kind === "order") {
      kind = "Παραγγελία"; title = r.client;
      inner = "<ul>" + r.items.map(function (i) { var it = Array.isArray(i) ? { name: i[0], qty: i[1] } : i; return "<li>" + esc(curName(it)) + " × " + it.qty + " τμχ</li>"; }).join("") + "</ul>";
    } else if (r.kind === "qr") {
      kind = "Τιμολόγιο QR"; title = r.client || "Σκανάρισμα τιμολογίου";
      inner = '<div class="sub">Περιμένει καταχώριση από τον Claude</div>';
    } else if (r.kind === "photo") {
      var rel = r.rel && O.store.all().filter(function (x) { return O.fileName(x) === r.rel; })[0];
      kind = "Φωτογραφία"; title = O.photoKindLabel(r.pk);
      inner = (O.photo.get(r.id) ? '<img class="thumb" alt="" src="' + O.photo.get(r.id) + '">' : "") +
        (r.text ? "<div>" + esc(r.text) + "</div>" : "") +
        (rel ? '<div class="sub">Σχετίζεται με: ' + esc((rel.kind === "order" ? "παραγγελία " : "QR ") + (rel.client || "")) + "</div>" : "");
    } else if (r.kind === "client") {
      var cf = r.client || {};
      kind = "Νέος πελάτης"; title = cf.shortName || "";
      inner = "<ul>" + O.newClient.fields.filter(function (f) { return f.k !== "shortName" && cf[f.k]; })
        .map(function (f) { return "<li>" + f.label + ": " + esc(cf[f.k]) + "</li>"; }).join("") + "</ul>" + (r.text ? "<div>" + esc(r.text) + "</div>" : "");
    } else if (r.kind === "clientEdit") {
      var cl = {}; O.newClient.fields.forEach(function (f) { cl[f.k] = f.label.replace(" *", ""); });
      kind = "Επεξεργασία πελάτη"; title = r.client;
      inner = changeList(r, cl) + (r.text ? "<div>" + esc(r.text) + "</div>" : "");
    } else if (r.kind === "edit") {
      var lab = {}; O.edit.fields.forEach(function (f) { lab[f.k] = f.label.replace(/ \(.*\)/, ""); });
      kind = "Επεξεργασία"; title = r.product;
      inner = changeList(r, lab) + (r.text ? "<div>" + esc(r.text) + "</div>" : "");
    } else {
      kind = "Πληροφορία"; title = r.product;
      inner = "<div>" + esc(r.text) + "</div>";
    }
    var st = status(r);
    return '<div class="entry"><span class="kind">' + kind + " · " + time + "</span><b>" + esc(title) + "</b>" + inner + (st ? '<div class="sub">' + st + "</div>" : "") + "@ACTS@</div>";
  }

  O.hist = {
    sets: SETS,
    count: function (set) { return list(set).length; },
    find: function (k) { return O.store.all().filter(function (r) { return key(r) === k; })[0]; },
    html: function (set, confirmKey) {
      var out = "", last = "";
      list(set).forEach(function (r) {
        var day = dayLabel(r.t);
        if (day !== last) { out += '<div class="day">' + esc(day) + "</div>"; last = day; }
        out += entry(r).replace("@ACTS@", function () { return acts(r, confirmKey); });
      });
      return O.ui.back + "<h1>" + SETS[set].title + "</h1>" + (out || '<p class="empty">Δεν υπάρχουν εγγραφές ακόμα.</p>');
    }
  };
})(window.O = window.O || {});
