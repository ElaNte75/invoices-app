/* Τοπική αποθήκευση στο κινητό: ιστορικό παραγγελιών και πληροφοριών.
   Κάθε εγγραφή έχει sent:false μέχρι να σταλεί στο GitHub (παλιές εγγραφές χωρίς id δεν στέλνονται). */
(function (O) {
  var KEY = "orders_history_v1";
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  O.store = {
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
