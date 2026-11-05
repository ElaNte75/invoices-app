/* Αποστολή καταχωρήσεων στο ιδιωτικό repository Invoices, φάκελος data/inbox (ένα αρχείο ανά καταχώρηση).
   Ό,τι δεν σταλεί (χωρίς σύνδεση) μένει στο κινητό και ξαναδοκιμάζεται. Μια επεξεργασμένη καταχώρηση ξαναστέλνεται πάνω στο ίδιο αρχείο. */
(function (O) {
  var running = false;

  function b64(s) {
    var bytes = new TextEncoder().encode(s), bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin);
  }
  O.fileName = function (r) { return r.t.replace(/[:.]/g, "-") + "-" + r.kind + "-" + r.id + ".json"; };
  O.what = function (r) {
    if (r.kind === "order") return "παραγγελία " + r.client;
    if (r.kind === "client") return "νέος πελάτης " + (r.client.shortName || "");
    if (r.kind === "clientEdit") return "επεξεργασία πελάτη " + r.client;
    if (r.kind === "edit") return "επεξεργασία καταλόγου για " + r.product;
    if (r.kind === "qr") return "QR τιμολογίου";
    if (r.kind === "photo") return "φωτογραφία (" + O.photoKindLabel(r.pk) + ")";
    return "πληροφορία για " + r.product;
  };
  function payload(r) {
    var p = { createdAt: r.t, kind: r.kind, source: "orders-app", status: "new" };
    if (r.edited) p.editedAt = r.edited;
    if (r.kind === "order") {
      p.client = { id: r.clientId || "", name: r.client };
      p.items = r.items.map(function (i) { return Array.isArray(i) ? { name: i[0], qty: i[1] } : i; });
    } else if (r.kind === "client") {
      p.localId = "new-" + r.id;
      p.customer = r.client;
      p.note = r.text || "";
    } else if (r.kind === "clientEdit") {
      p.client = { id: r.clientId || "", name: r.client };
      p.changes = r.changes;
      p.note = r.text || "";
    } else if (r.kind === "edit") {
      p.product = { id: r.productId || "", name: r.product };
      p.changes = r.changes;
      p.note = r.text || "";
    } else if (r.kind === "qr") {
      p.url = r.url;
    } else if (r.kind === "photo") {
      p.photoKind = r.pk;
      p.note = r.text || "";
      if (r.rel) p.related = r.rel;
      p.image = { type: "image/jpeg", data: O.photo.base64(r.id) };
    } else {
      p.product = { id: r.productId || "", name: r.product };
      p.text = r.text;
    }
    return p;
  }
  /* Επιστρέφει {sha} (το νέο sha του αρχείου) ή {passed:true} αν το αρχείο έχει φύγει από το inbox */
  function put(r) {
    if (r.kind === "photo" && !O.photo.base64(r.id)) return Promise.resolve({ passed: false, lost: true });
    var body = {
      message: (r.sha ? "Από την εφαρμογή παραγγελιών (επεξεργασία): " : "Από την εφαρμογή παραγγελιών: ") + O.what(r),
      content: b64(JSON.stringify(payload(r), null, 2) + "\n"),
      branch: "main"
    };
    if (r.sha) body.sha = r.sha;
    return fetch("https://api.github.com/repos/ElaNte75/Invoices/contents/data/inbox/" + O.fileName(r), {
      method: "PUT",
      headers: { Authorization: "Bearer " + O.token.get(), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (res.status === 401) throw { code: "auth" };
      if (res.status === 409 || (res.status === 422 && r.sha)) return { passed: true };
      if (res.status === 422) return {}; // υπάρχει ήδη, άρα είχε σταλεί
      if (res.status === 403 || res.status === 404) throw { code: "noperm" };
      if (!res.ok) throw { code: "http" };
      return res.json().then(function (j) { return { sha: j.content && j.content.sha }; }, function () { return {}; });
    }, function () { throw { code: "net" }; });
  }

  /* Στέλνει με τη σειρά ό,τι εκκρεμεί. Επιστρέφει {sent, left} ή απορρίπτεται με {code, sent, left}. */
  O.sync = function () {
    if (running || !O.token.get()) return Promise.resolve({ sent: 0, left: O.store.pending().length });
    running = true;
    var sent = 0;
    return O.store.pending().reduce(function (p, r) {
      return p.then(function () {
        return put(r).then(function (x) {
          if (r.kind === "photo" && x.lost) { O.store.remove(r); return; } /* η φωτογραφία δεν υπάρχει πια στο κινητό */
          O.store.update(r.id, { sent: true, sentAt: new Date().toISOString(), sha: x.sha || r.sha, passed: !!x.passed });
          if (r.kind === "photo") O.photo.del(r.id);
          if (!x.passed) sent++;
        });
      });
    }, Promise.resolve()).then(function () {
      running = false;
      return { sent: sent, left: O.store.pending().length };
    }, function (err) {
      running = false;
      err.sent = sent; err.left = O.store.pending().length;
      throw err;
    });
  };
})(window.O = window.O || {});
