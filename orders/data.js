/* Πελάτες και προϊόντα: λήψη από το ιδιωτικό repository Invoices (GitHub) και αποθήκευση στο κινητό.
   Κατεβαίνουν μόνο τα αρχεία που άλλαξαν από την τελευταία φορά. */
(function (O) {
  var TOKEN_KEY = "orders_token";
  var CACHE_KEY = "orders_data_v7";
  var REPO = 'repository(owner:"ElaNte75", name:"Invoices")';
  var TREES = "query { " + REPO + " {" +
    ' c: object(expression:"main:data/customers") { ... on Tree { entries { name oid } } }' +
    ' p: object(expression:"main:data/products") { ... on Tree { entries { name oid } } }' +
    ' s: object(expression:"main:data/partners") { ... on Tree { entries { name oid } } } } }';
  var BATCH = 150;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  O.data = { clients: [], products: [], partners: [], updated: "" };
  O.token = {
    get: function () { return get(TOKEN_KEY) || ""; },
    set: function (t) { set(TOKEN_KEY, t); },
    clear: function () { del(TOKEN_KEY); }
  };

  O.loadCache = function () {
    var raw = get(CACHE_KEY);
    if (!raw) return false;
    try { O.data = JSON.parse(raw); O.data.partners = O.data.partners || []; return O.data.products.length > 0; } catch (e) { return false; }
  };

  function gql(query) {
    return fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: "Bearer " + O.token.get(), "Content-Type": "application/json" },
      body: JSON.stringify({ query: query })
    }).then(function (r) {
      if (r.status === 401) throw { code: "auth" };
      if (!r.ok) throw { code: "http" };
      return r.json();
    }, function () { throw { code: "net" }; }).then(function (j) {
      if (!j.data || !j.data.repository) throw { code: j.errors ? "http" : "access" };
      return j.data.repository;
    });
  }

  function byName(a, b) { return a.name.localeCompare(b.name, "el"); }
  function slimClient(j, f) {
    return {
      id: f.id, o: f.oid, name: j.shortName || j.name || f.id, city: j.city || "", afm: j.afm || "",
      short: j.shortName || "", full: j.name || "", address: j.address || "", phone: j.phone || "", doy: j.doy || "", prof: j.profession || "", web: j.website || "", ins: j.instructions || ""
    };
  }
  function slimPartner(j, f) {
    return { id: f.id, o: f.oid, name: j.shortName || j.name || f.id, role: j.role || "", full: j.name || "" };
  }
  function slimProduct(j, f) {
    return {
      id: f.id, o: f.oid,
      cat: j.category || "Χωρίς κατηγορία",
      name: j.fullName || j.description || f.id,
      mat: j.material || "",
      th: j.thickness || "",
      len: j.length || "", wid: j.width || "", dep: j.depth || "", dia: j.diameter || "",
      shape: j.shape || "", blank: j.blank == null ? "" : String(j.blank), sheet: j.sheetType || "",
      feats: j.features || []
    };
  }

  O.fetchData = function () {
    var old = {};
    O.data.clients.forEach(function (r) { old["c:" + r.id] = r; });
    O.data.products.forEach(function (r) { old["p:" + r.id] = r; });
    (O.data.partners || []).forEach(function (r) { old["s:" + r.id] = r; });
    return gql(TREES).then(function (repo) {
      if (!repo.c || !repo.p) throw { code: "access" };
      var files = [];
      [["c", repo.c], ["p", repo.p], ["s", repo.s]].forEach(function (g) {
        if (g[1]) g[1].entries.forEach(function (e) {
          if (/\.json$/.test(e.name)) files.push({ t: g[0], id: e.name.replace(/\.json$/, ""), oid: e.oid });
        });
      });
      var todo = files.filter(function (f) { var o = old[f.t + ":" + f.id]; return !(o && o.o === f.oid); });
      var batches = [];
      for (var i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
      return Promise.all(batches.map(function (b) {
        var q = "query { " + REPO + " {" + b.map(function (f, n) {
          return " f" + n + ':object(oid:"' + f.oid + '") { ... on Blob { text } }';
        }).join("") + " } }";
        return gql(q).then(function (r) {
          b.forEach(function (f, n) { f.text = r["f" + n] && r["f" + n].text; });
        });
      })).then(function () { return files; });
    }).then(function (files) {
      var clients = [], products = [], partners = [];
      files.forEach(function (f) {
        var rec = null;
        if (f.text) {
          try { var j = JSON.parse(f.text); rec = f.t === "c" ? slimClient(j, f) : f.t === "s" ? slimPartner(j, f) : slimProduct(j, f); } catch (e) {}
        } else rec = old[f.t + ":" + f.id] || null;
        if (rec) (f.t === "c" ? clients : f.t === "s" ? partners : products).push(rec);
      });
      O.data = { clients: clients.sort(byName), products: products.sort(byName), partners: partners.sort(byName), updated: new Date().toISOString() };
      set(CACHE_KEY, JSON.stringify(O.data));
      return O.data;
    });
  };
})(window.O = window.O || {});
