/* Τοπική αποθήκευση στο κινητό: ιστορικό παραγγελιών και πληροφοριών.
   Κάθε εγγραφή έχει sent:false μέχρι να σταλεί στο GitHub (παλιές εγγραφές χωρίς id δεν στέλνονται). */
(function (O) {
  var KEY = "orders_history_v1";
  var UKEY = "orders_usage_v1";
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  function readUsage() {
    try { var u = JSON.parse(localStorage.getItem(UKEY) || "{}"); return { clients: u.clients || {}, prods: u.prods || {} }; } catch (e) { return { clients: {}, prods: {} }; }
  }
  O.store = {
    /* Πόσες φορές έχουν παραγγελθεί πελάτες και προϊόντα σε παραγγελίες που έχουν ήδη περαστεί (και σβήστηκαν από το ιστορικό) */
    usage: readUsage,
    /* Σβήνει από το ιστορικό ό,τι έχει περαστεί στη βάση. Κρατά μόνο τους μετρητές για τη σειρά των λιστών. Επιστρέφει true αν έσβησε κάτι. */
    purgePassed: function () {
      var list = read(), gone = list.filter(function (r) { return r.passed; });
      if (!gone.length) return false;
      var u = readUsage();
      gone.forEach(function (r) {
        if (r.kind !== "order") return;
        if (r.clientId) u.clients[r.clientId] = (u.clients[r.clientId] || 0) + 1;
        (r.items || []).forEach(function (i) { if (!Array.isArray(i) && i.id) u.prods[i.id] = (u.prods[i.id] || 0) + 1; });
      });
      try { localStorage.setItem(UKEY, JSON.stringify(u)); } catch (e) {}
      return write(list.filter(function (r) { return !r.passed; }));
    },
    all: function () {
      return read().sort(function (a, b) { return a.t < b.t ? 1 : -1; });
    },
    pending: function () {
      return read().filter(function (r) { return r.sent === false && r.id; })
        .sort(function (a, b) { return a.t < b.t ? -1 : 1; });
    },
    add: function (rec) {
      var list = read();
      rec.t = new Date().toISOString();
      rec.id = Math.random().toString(36).slice(2, 6);
      rec.sent = false;
      list.push(rec);
      return write(list);
    },
    /* Προσθέτει καταχώριση που υπάρχει ήδη στο inbox (με το δικό της id και ώρα). Αν υπάρχει ήδη, δεν κάνει τίποτα. */
    insert: function (rec) {
      var list = read();
      if (list.some(function (r) { return r.id === rec.id; })) return false;
      list.push(rec);
      return write(list);
    },
    remove: function (rec) {
      return write(read().filter(function (r) { return !(r.t === rec.t && r.id === rec.id); }));
    },
    update: function (id, patch) {
      var list = read();
      list.forEach(function (r) { if (r.id === id) Object.keys(patch).forEach(function (k) { r[k] = patch[k]; }); });
      return write(list);
    }
  };
})(window.O = window.O || {});
