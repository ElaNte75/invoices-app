/* Έλεγχος και διαγραφή αρχείων στο inbox (ιδιωτικό repository Invoices) για το ιστορικό της εφαρμογής.
   Ό,τι δεν είναι πια στο inbox το έχει περάσει ο Claude στη βάση, άρα δεν επιτρέπεται επεξεργασία ή διαγραφή. */
(function (O) {
  var API = "https://api.github.com/repos/ElaNte75/Invoices/contents/data/inbox";
  function call(url, opts) {
    opts = opts || {};
    opts.headers = { Authorization: "Bearer " + O.token.get(), "Content-Type": "application/json" };
    return fetch(url, opts).then(function (res) {
      if (res.status === 401) throw { code: "auth" };
      return res;
    }, function () { throw { code: "net" }; });
  }

  O.inbox = {
    /* Ενημερώνει ποιες απεσταλμένες εγγραφές είναι ακόμα στο inbox. Επιστρέφει true αν άλλαξε κάτι. */
    refresh: function () {
      var sent = O.store.all().filter(function (r) { return r.id && r.sent === true; });
      if (!sent.length || !O.token.get()) return Promise.resolve(false);
      return call(API).then(function (res) {
        if (res.status === 404) return [];
        if (!res.ok) throw { code: "http" };
        return res.json();
      }).then(function (list) {
        var by = {}, changed = false;
        list.forEach(function (e) { by[e.name] = e.sha; });
        sent.forEach(function (r) {
          var sha = by[O.fileName(r)];
          if (!!r.passed === !!sha || (sha && r.sha !== sha)) {
            O.store.update(r.id, { passed: !sha, sha: sha || r.sha });
            changed = true;
          }
        });
        if (O.store.purgePassed()) changed = true;
        return changed;
      }).catch(function () { return false; });
    },
    /* Σβήνει το αρχείο από το GitHub. Επιστρέφει "deleted" ή "passed" (έχει ήδη φύγει από το inbox). */
    remove: function (r) {
      var url = API + "/" + O.fileName(r);
      var sha = r.sha ? Promise.resolve(r.sha) : call(url).then(function (res) {
        if (res.status === 404) return null;
        if (!res.ok) throw { code: res.status === 403 ? "noperm" : "http" };
        return res.json().then(function (j) { return j.sha; });
      });
      return sha.then(function (s) {
        if (!s) return "passed";
        return call(url, { method: "DELETE", body: JSON.stringify({ message: "Από την εφαρμογή παραγγελιών: διαγραφή " + O.what(r), sha: s, branch: "main" }) }).then(function (res) {
          if (res.status === 404 || res.status === 409) return "passed";
          if (res.status === 403) throw { code: "noperm" };
          if (!res.ok) throw { code: "http" };
          return "deleted";
        });
      });
    }
  };
})(window.O = window.O || {});
