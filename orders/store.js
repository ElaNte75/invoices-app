/* Τοπική αποθήκευση στο κινητό: ιστορικό παραγγελιών και πληροφοριών */
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
    add: function (rec) {
      var list = read();
      rec.t = new Date().toISOString();
      list.push(rec);
      return write(list);
    }
  };
})(window.O = window.O || {});
