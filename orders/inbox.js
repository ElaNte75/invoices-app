/* Έλεγχος και διαγραφή αρχείων στο inbox (ιδιωτικό repository Invoices) για το ιστορικό της εφαρμογής.
   Ό,τι δεν είναι πια στο inbox το έχει περάσει ο Claude στη βάση, άρα δεν επιτρέπεται επεξεργασία ή διαγραφή. */
(function (O) {
  var API = "https://api.github.com/repos/ElaNte75/Invoices/contents/data/inbox";
  function call(url, opts) {
    opts = opts || {};
    opts.headers = { Authorization: "Bearer " + O.token.get(), "Content-Type": "application/json" };
    opts.cache = "no-store"; /* το GitHub επιτρέπει στον browser να κρατά τις λίστες 60 δευτερόλεπτα: χωρίς αυτό ένα αρχείο που μόλις στάλθηκε φαινόταν «περασμένο» και έσβηνε από το ιστορικό */
    return fetch(url, opts).then(function (res) {
      if (res.status === 401) throw { code: "auth" };
      return res;
    }, function () { throw { code: "net" }; });
  }

  function unb64(s) {
    var bin = atob(s.replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  /* Ό,τι είναι στο inbox αλλά λείπει από το ιστορικό του κινητού (π.χ. σβήστηκε κατά λάθος) ξαναμπαίνει στο ιστορικό */
  function restore(list) {
    var have = {};
    O.store.all().forEach(function (r) { if (r.id) have[O.fileName(r)] = true; });
    var missing = list.filter(function (e) { return /^.+Z-(order|client|clientEdit|edit|info|qr|photo)-[a-z0-9]{4}\.json$/.test(e.name) && !have[e.name]; }).slice(0, 30);
    var any = false;
    return missing.reduce(function (p, e) {
      return p.then(function () {
        return call(API + "/" + e.name).then(function (res) { return res.ok ? res.json() : null; }).then(function (f) {
          if (!f || !f.content) return;
          var j = JSON.parse(unb64(f.content)), m = e.name.match(/-(order|client|clientEdit|edit|info|qr|photo)-([a-z0-9]{4})\.json$/);
          var rec = { id: m[2], t: j.createdAt, kind: m[1], sent: true, sentAt: new Date().toISOString(), sha: f.sha || e.sha, text: j.note || j.text || "" };
          if (j.editedAt) rec.edited = j.editedAt;
          if (rec.kind === "order") { rec.client = j.client.name; rec.clientId = j.client.id; rec.items = j.items; }
          else if (rec.kind === "client") rec.client = j.customer || {};
          else if (rec.kind === "clientEdit") { rec.client = j.client.name; rec.clientId = j.client.id; rec.changes = j.changes; }
          else if (rec.kind === "edit" || rec.kind === "info") { rec.product = j.product.name; rec.productId = j.product.id; rec.changes = j.changes; }
          else if (rec.kind === "qr") { rec.url = j.url; if (j.client) { rec.client = j.client.name; rec.clientId = j.client.id; } else if (j.partner) { rec.client = j.partner.name; rec.clientId = j.partner.isNew ? "newpartner" : "partner:" + j.partner.id; } }
          else if (rec.kind === "photo") { rec.pk = j.photoKind; rec.rel = j.related || ""; }
          if (rec.t && O.fileName(rec) === e.name && O.store.insert(rec)) any = true;
        }).catch(function () {});
      });
    }, Promise.resolve()).then(function () { return any; });
  }

  O.inbox = {
    /* Ενημερώνει ποιες απεσταλμένες εγγραφές είναι ακόμα στο inbox. Επιστρέφει true αν άλλαξε κάτι. */
    refresh: function () {
      var sent = O.store.all().filter(function (r) { return r.id && r.sent === true; });
      if (!O.token.get()) return Promise.resolve(false);
      return call(API).then(function (res) {
        if (res.status === 404) return [];
        if (!res.ok) throw { code: "http" };
        return res.json();
      }).then(function (list) {
        var by = {}, changed = false;
        list.forEach(function (e) { by[e.name] = e.sha; });
        sent.forEach(function (r) {
          var sha = by[O.fileName(r)];
          if (!sha && !r.passed && r.sentAt && Date.now() - new Date(r.sentAt).getTime() < 300000) return; /* μόλις στάλθηκε: δεν θεωρείται περασμένο */
          if (!!r.passed === !!sha || (sha && r.sha !== sha)) {
            O.store.update(r.id, { passed: !sha, sha: sha || r.sha });
            changed = true;
          }
        });
        if (O.store.purgePassed()) changed = true;
        return restore(list).then(function (r) { return changed || r; });
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
