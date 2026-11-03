/* Αποστολή καταχωρήσεων στο ιδιωτικό repository Invoices, φάκελος data/inbox (ένα αρχείο ανά καταχώρηση).
   Ό,τι δεν σταλεί (χωρίς σύνδεση) μένει στο κινητό και ξαναδοκιμάζεται. */
(function (O) {
  var running = false;

  function b64(s) {
    var bytes = new TextEncoder().encode(s), bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin);
  }
  function fileName(r) { return r.t.replace(/[:.]/g, "-") + "-" + r.kind + "-" + r.id + ".json"; }
  function payload(r) {
    var p = { createdAt: r.t, kind: r.kind, source: "orders-app", status: "new" };
    if (r.kind === "order") {
      p.client = { id: r.clientId || "", name: r.client };
      p.items = r.items.map(function (i) { return Array.isArray(i) ? { name: i[0], qty: i[1] } : i; });
    } else if (r.kind === "edit") {
      p.product = { id: r.productId || "", name: r.product };
      p.changes = r.changes;
      p.note = r.text || "";
    } else {
      p.product = { id: r.productId || "", name: r.product };
      p.text = r.text;
    }
    return p;
  }
  function put(r) {
    var what = r.kind === "order" ? "παραγγελία " + r.client : r.kind === "edit" ? "διόρθωση καταλόγου για " + r.product : "πληροφορία για " + r.product;
    var body = {
      message: "Από την εφαρμογή παραγγελιών: " + what,
      content: b64(JSON.stringify(payload(r), null, 2) + "\n"),
      branch: "main"
    };
    return fetch("https://api.github.com/repos/ElaNte75/Invoices/contents/data/inbox/" + fileName(r), {
      method: "PUT",
      headers: { Authorization: "Bearer " + O.token.get(), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (res.status === 401) throw { code: "auth" };
      if (res.status === 403 || res.status === 404) throw { code: "noperm" };
      if (res.status === 422) return; // υπάρχει ήδη, άρα είχε σταλεί
      if (!res.ok) throw { code: "http" };
    }, function () { throw { code: "net" }; });
  }

  /* Στέλνει με τη σειρά ό,τι εκκρεμεί. Επιστρέφει {sent, left} ή απορρίπτεται με {code, sent, left}. */
  O.sync = function () {
    if (running || !O.token.get()) return Promise.resolve({ sent: 0, left: O.store.pending().length });
    running = true;
    var sent = 0;
    return O.store.pending().reduce(function (p, r) {
      return p.then(function () {
        return put(r).then(function () { O.store.update(r.id, { sent: true, sentAt: new Date().toISOString() }); sent++; });
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
