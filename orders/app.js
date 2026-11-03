/* Οθόνες και πλοήγηση της εφαρμογής παραγγελιών */
(function (O) {
  var $ = function (id) { return document.getElementById(id); };
  var app = $("app"), dock = $("dock");
  var VERSION = 5;
  var view = "home", mode = "order", depth = 0, loginMsg = "", syncMsg = "";
  var S = fresh();
  var pick = { items: [], kind: "" };

  function fresh() { return { client: null, cat: null, qty: {}, mat: "", q: "", prod: null, edit: false }; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function norm(s) {
    return String(s).toLowerCase().replace(/ς/g, "σ").normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function clientById(id) { return O.data.clients.filter(function (c) { return c.id === id; })[0]; }
  function prodById(id) { return O.data.products.filter(function (p) { return p.id === id; })[0]; }
  function setDock(html) {
    dock.innerHTML = html || "";
    dock.hidden = !html;
    document.body.classList.toggle("has-dock", !!html);
  }
  O.toast = function (t) {
    var el = $("toast"); el.textContent = t; el.hidden = false;
    clearTimeout(O.toast.t);
    O.toast.t = setTimeout(function () { el.hidden = true; }, 2800);
  };

  function tagsOf(p) {
    var t = [];
    if (p.mat) t.push(p.mat);
    if (p.th) t.push("πάχος " + String(p.th).replace(".", ",") + " χιλ.");
    p.feats.forEach(function (f) { if (!(p.th && /^πάχος/.test(f))) t.push(f); });
    return t.map(function (x) { return '<span class="tag">' + esc(x) + "</span>"; }).join("");
  }
  var BACK = '<button class="back" data-act="back">‹ Πίσω</button>';

  /* ---------- αρχική ---------- */
  function vHome() {
    var d = O.data, n = O.store.all().length;
    var when = d.updated ? new Date(d.updated).toLocaleString("el-GR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    var left = O.store.pending().length;
    var pend = left ? '<div class="msg">' + left + (left === 1 ? " καταχώρηση περιμένει" : " καταχωρήσεις περιμένουν") + " αποστολή." + (syncMsg ? " " + esc(syncMsg) : "") +
      '</div><button class="small" data-act="sync">Αποστολή τώρα</button>' : "";
    return '<h1>Παραγγελίες</h1>' + pend + '<div class="stack">' +
      '<button class="big primary" data-act="new-order">Νέα παραγγελία</button>' +
      '<button class="big" data-act="new-info">Διόρθωση καταλόγου<small>πάχος, υλικό, διαστάσεις, περιγραφή</small></button>' +
      '<button class="big" data-act="history">Ιστορικό<small>' + n + " εγγραφές</small></button></div>" +
      '<p class="status">' + d.clients.length + " πελάτες · " + d.products.length + " προϊόντα · ενημερώθηκαν " + when + "</p>" +
      '<div class="row2"><button class="small" data-act="refresh">Ανανέωση δεδομένων</button>' +
      '<button class="small" data-act="token">Αλλαγή κλειδιού</button></div>' +
      '<p class="ver">έκδοση ' + VERSION + "</p>";
  }

  /* ---------- σύνδεση / φόρτωση ---------- */
  function vLogin() {
    return "<h1>Κλειδί πρόσβασης</h1>" +
      "<p>Για να φορτώσουν οι πελάτες και τα προϊόντα χρειάζεται το κλειδί πρόσβασης GitHub (μόνο ανάγνωση). Το βάζεις μία φορά και μένει στο κινητό σου.</p>" +
      (loginMsg ? '<div class="msg">' + esc(loginMsg) + "</div>" : "") +
      '<form id="loginForm" class="stack"><input class="field" id="tk" type="password" autocomplete="off" placeholder="github_pat_…" aria-label="Κλειδί πρόσβασης GitHub" required>' +
      '<button class="big primary" type="submit">Αποθήκευση και φόρτωση</button></form>';
  }
  function vLoading(msg) { return "<h1>Παραγγελίες</h1><p>" + esc(msg || "Φόρτωση δεδομένων…") + "</p>"; }

  /* ---------- λίστες επιλογής (πελάτης, κατηγορία) ---------- */
  function vPick(title, placeholder, items, kind) {
    pick = { items: items, kind: kind };
    return BACK + "<h1>" + title + '</h1><input class="search" id="s" type="search" placeholder="' + placeholder + '" aria-label="' + placeholder + '" autocomplete="off"><div class="list" id="list"></div>';
  }
  function drawPick() {
    var q = norm($("s").value.trim());
    var html = pick.items.filter(function (i) { return norm(i.label + " " + i.sub).indexOf(q) > -1; }).map(function (i) {
      return '<button class="opt" data-pick="' + esc(i.k) + '">' + esc(i.label) + (i.sub ? "<small>" + esc(i.sub) + "</small>" : "") + "</button>";
    }).join("");
    $("list").innerHTML = html || '<p class="empty">Δεν βρέθηκε.</p>';
  }
  /* Πόσες φορές έχει παραγγελθεί κάθε πελάτης και κάθε προϊόν (από το ιστορικό του κινητού) */
  function usage() {
    var u = { clients: {}, prods: {} };
    O.store.all().forEach(function (r) {
      if (r.kind !== "order") return;
      if (r.clientId) u.clients[r.clientId] = (u.clients[r.clientId] || 0) + 1;
      r.items.forEach(function (i) { if (i.id) u.prods[i.id] = (u.prods[i.id] || 0) + 1; });
    });
    return u;
  }
  function vClient() {
    var u = usage().clients;
    var list = O.data.clients.slice().sort(function (a, b) { return (u[b.id] || 0) - (u[a.id] || 0); });
    return vPick("Πελάτης", "Γράψε για αναζήτηση", list.map(function (c) { return { k: c.id, label: c.name, sub: c.city }; }), "client");
  }
  function vCat() {
    var counts = {};
    O.data.products.forEach(function (p) { counts[p.cat] = (counts[p.cat] || 0) + 1; });
    var items = Object.keys(counts).sort(function (a, b) {
      if (a === "Ειδική κατασκευή") return -1;
      if (b === "Ειδική κατασκευή") return 1;
      return a.localeCompare(b, "el");
    }).map(function (c) {
      return { k: c, label: c, sub: counts[c] + " προϊόντα" };
    });
    return vPick("Κατηγορία", "Γράψε για αναζήτηση", items, "cat");
  }

  /* ---------- προϊόντα ---------- */
  function catProducts() { return O.data.products.filter(function (p) { return p.cat === S.cat; }); }
  function vProducts() {
    var all = catProducts(), mats = [];
    all.forEach(function (p) { if (p.mat && mats.indexOf(p.mat) < 0) mats.push(p.mat); });
    var crumbs = "";
    if (mode === "order") {
      var c = clientById(S.client);
      crumbs += '<button class="crumb" data-act="edit-client"><span><small>Πελάτης</small>' + esc(c ? c.name : "") + "</span></button>";
    }
    crumbs += '<button class="crumb" data-act="edit-cat"><span><small>Κατηγορία</small>' + esc(S.cat) + "</span></button>";
    var seg = "";
    if (mats.length > 1) {
      seg = '<div class="seg">' + [""].concat(mats).map(function (m) {
        return '<button data-mat="' + esc(m) + '" aria-pressed="' + (S.mat === m) + '">' + (m || "Όλα") + "</button>";
      }).join("") + "</div>";
    }
    return BACK + '<div class="crumbs">' + crumbs + "</div>" + seg +
      '<input class="search" id="pq" type="search" style="margin-top:12px" placeholder="Περιγραφή (π.χ. Φ36)" value="' + esc(S.q) + '" aria-label="Αναζήτηση στην περιγραφή" autocomplete="off">' +
      '<div class="list" id="plist"></div>';
  }
  function drawProducts() {
    var q = norm(S.q.trim()), u = usage().prods;
    var list = catProducts().filter(function (p) {
      return (!S.mat || p.mat === S.mat) && norm(p.name + " " + p.mat + " " + p.feats.join(" ")).indexOf(q) > -1;
    }).map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) {
      return ((u[b.p.id] || 0) - (u[a.p.id] || 0)) || (a.i - b.i);
    }).map(function (x) { return x.p; });
    $("plist").innerHTML = list.map(function (p) {
      if (mode === "info") {
        return '<button class="prow" data-prod="' + p.id + '"><div class="pname">' + esc(p.name) + '</div><div class="tags">' + tagsOf(p) + "</div></button>";
      }
      var n = S.qty[p.id] || 0;
      return '<div class="prow' + (n ? " has" : "") + '" id="r' + p.id + '"><div class="pname">' + esc(p.name) + '</div><div class="tags">' + tagsOf(p) + "</div>" +
        '<div class="step"><button data-m="' + p.id + '" aria-label="Λιγότερο">−</button>' +
        '<input id="q' + p.id + '" data-i="' + p.id + '" type="text" inputmode="numeric" pattern="[0-9]*" value="' + n + '" aria-label="Ποσότητα">' +
        '<button class="plus" data-p="' + p.id + '" aria-label="Περισσότερο">+</button><span class="unit">τεμ.</span></div></div>';
    }).join("") || '<p class="empty">Δεν βρέθηκε προϊόν.</p>';
  }
  function total() { return Object.keys(S.qty).reduce(function (s, k) { return s + S.qty[k]; }, 0); }
  function updateSend() {
    var b = $("send"); if (!b) return;
    var n = total();
    b.disabled = !n;
    b.textContent = n ? "Καταχώρηση (" + n + " τεμ.)" : "Καταχώρηση παραγγελίας";
  }
  function setQty(id, n) {
    n = Math.max(0, Math.min(99999, n || 0));
    if (n) S.qty[id] = n; else delete S.qty[id];
    var r = $("r" + id); if (r) r.classList.toggle("has", n > 0);
    updateSend();
  }

  /* ---------- πληροφορία ---------- */
  function vNote() {
    var p = prodById(S.prod);
    return BACK + "<h1>Διόρθωση προϊόντος</h1>" + O.edit.html(p) +
      '<div class="label">Σχόλιο (προαιρετικά)</div><textarea class="field" id="note" placeholder="Γράψε εδώ…" aria-label="Σχόλιο"></textarea>';
  }
  function updateSave() {
    var b = $("saveNote"), p = prodById(S.prod);
    if (b && p) b.disabled = !(Object.keys(O.edit.changes(p)).length || $("note").value.trim());
  }

  /* ---------- ιστορικό ---------- */
  function dayLabel(iso) {
    var d = new Date(iso), t = new Date(), y = new Date();
    y.setDate(t.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return "Σήμερα";
    if (d.toDateString() === y.toDateString()) return "Χθες";
    return d.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" });
  }
  function vHistory() {
    var list = O.store.all(), out = "", last = "";
    list.forEach(function (r) {
      var day = dayLabel(r.t);
      if (day !== last) { out += '<div class="day">' + esc(day) + "</div>"; last = day; }
      var time = new Date(r.t).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
      var st = r.sent === false ? '<div class="sub">Περιμένει αποστολή</div>' : r.sent ? '<div class="sub">Στάλθηκε</div>' : "";
      if (r.kind === "order") {
        out += '<div class="entry"><span class="kind">Παραγγελία · ' + time + "</span><b>" + esc(r.client) + "</b><ul>" +
          r.items.map(function (i) { return Array.isArray(i) ? "<li>" + esc(i[0]) + " × " + i[1] + "</li>" : "<li>" + esc(i.name) + " × " + i.qty + "</li>"; }).join("") + "</ul>" + st + "</div>";
      } else if (r.kind === "edit") {
        var lab = {}; O.edit.fields.forEach(function (f) { lab[f.k] = f.label.replace(/ \(.*\)/, ""); });
        out += '<div class="entry"><span class="kind">Διόρθωση · ' + time + "</span><b>" + esc(r.product) + "</b><ul>" +
          Object.keys(r.changes || {}).map(function (k) {
            var c = r.changes[k];
            return "<li>" + esc(lab[k] || k) + ": " + (esc(O.edit.show(c.from)) || "—") + " → " + (esc(O.edit.show(c.to)) || "—") + "</li>";
          }).join("") + "</ul>" + (r.text ? "<div>" + esc(r.text) + "</div>" : "") + st + "</div>";
      } else {
        out += '<div class="entry"><span class="kind">Πληροφορία · ' + time + "</span><b>" + esc(r.product) + "</b><div>" + esc(r.text) + "</div>" + st + "</div>";
      }
    });
    return BACK + "<h1>Ιστορικό</h1>" + (out || '<p class="empty">Δεν υπάρχουν εγγραφές ακόμα.</p>');
  }

  /* ---------- εμφάνιση ---------- */
  function render(v) {
    view = v;
    setDock("");
    var html = { home: vHome, login: vLogin, loading: vLoading, client: vClient, cat: vCat, products: vProducts, note: vNote, history: vHistory }[v]();
    app.innerHTML = html;
    window.scrollTo(0, 0);
    if (v === "client" || v === "cat") drawPick();
    if (v === "products") {
      drawProducts();
      if (mode === "order") { setDock('<button class="send" id="send" disabled>Καταχώρηση παραγγελίας</button>'); updateSend(); }
    }
    if (v === "note") setDock('<button class="send" id="saveNote" disabled>Αποθήκευση διόρθωσης</button>');
  }
  function go(v) {
    depth++;
    history.pushState({ v: v, d: depth }, "");
    render(v);
  }
  function home() {
    S = fresh();
    var d = depth;
    if (d > 0) history.go(-d); else render("home");
  }
  window.addEventListener("popstate", function (e) {
    depth = e.state ? e.state.d : 0;
    render(e.state ? e.state.v : "home");
  });

  /* ---------- δεδομένα ---------- */
  function refresh(silent) {
    if (!silent) { render("loading"); }
    return O.fetchData().then(function () {
      if (view === "home" || view === "loading") render("home");
      if (!silent) O.toast("Τα δεδομένα ενημερώθηκαν");
    }).catch(function (err) {
      var code = err && err.code;
      if (code === "auth") { O.token.clear(); loginMsg = "Το κλειδί δεν έγινε δεκτό. Βάλε νέο κλειδί."; render("login"); }
      else if (code === "access") { O.token.clear(); loginMsg = "Το κλειδί δεν έχει πρόσβαση στο repository Invoices. Φτιάξε νέο με πρόσβαση σε αυτό."; render("login"); }
      else if (silent || O.data.products.length) { O.toast("Χωρίς σύνδεση. Χρησιμοποιούνται τα αποθηκευμένα δεδομένα."); if (view === "loading") render("home"); }
      else { app.innerHTML = vLoading("Δεν υπάρχει σύνδεση. Δοκίμασε ξανά.") + '<button class="big" data-act="refresh">Ξανά</button>'; }
    });
  }

  /* ---------- αποστολή στο GitHub ---------- */
  function sync(manual) {
    return O.sync().then(function (r) {
      syncMsg = "";
      if (r.sent) O.toast(r.sent === 1 ? "Στάλθηκε στο GitHub" : "Στάλθηκαν " + r.sent + " καταχωρήσεις");
    }, function (err) {
      var code = err && err.code;
      if (code === "noperm") syncMsg = "Το κλειδί δεν έχει δικαίωμα εγγραφής. Άλλαξε τα δικαιώματά του στο GitHub (Contents: Read and write).";
      else if (code === "auth") syncMsg = "Το κλειδί δεν έγινε δεκτό. Βάλε νέο από «Αλλαγή κλειδιού».";
      else syncMsg = "";
      if (manual || code === "noperm" || code === "auth") O.toast(syncMsg || "Χωρίς σύνδεση. Θα σταλούν αργότερα.");
    }).then(function () { if (view === "home") render("home"); });
  }
  window.addEventListener("online", function () { sync(false); });

  /* ---------- ενέργειες ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t) return;
    var a = t.dataset.act;
    if (a === "back") history.back();
    else if (a === "new-order") { S = fresh(); mode = "order"; go("client"); }
    else if (a === "new-info") { S = fresh(); mode = "info"; go("cat"); }
    else if (a === "history") go("history");
    else if (a === "refresh") { O.toast("Ενημέρωση…"); refresh(false); }
    else if (a === "token") { loginMsg = ""; render("login"); }
    else if (a === "edit-client") { S.edit = true; go("client"); }
    else if (a === "edit-cat") { S.edit = true; go("cat"); }
    else if (t.dataset.pick !== undefined) {
      if (pick.kind === "client") S.client = t.dataset.pick;
      else { S.cat = t.dataset.pick; S.mat = ""; S.q = ""; }
      if (S.edit) { S.edit = false; history.back(); }
      else go(pick.kind === "client" ? "cat" : "products");
    }
    else if (t.dataset.mat !== undefined) { S.mat = t.dataset.mat; render("products"); }
    else if (t.dataset.p) { var p = t.dataset.p; setQty(p, (S.qty[p] || 0) + 1); $("q" + p).value = S.qty[p] || 0; }
    else if (t.dataset.m) { var m = t.dataset.m; setQty(m, (S.qty[m] || 0) - 1); $("q" + m).value = S.qty[m] || 0; }
    else if (t.dataset.prod) { S.prod = t.dataset.prod; go("note"); }
    else if (t.id === "send") {
      var items = Object.keys(S.qty).map(function (id) { var pr = prodById(id); return { id: id, name: pr ? pr.name : id, qty: S.qty[id] }; });
      var c = clientById(S.client);
      if (!O.store.add({ kind: "order", client: c ? c.name : "", clientId: S.client, items: items })) { O.toast("Δεν αποθηκεύτηκε. Ο χώρος του κινητού είναι γεμάτος."); return; }
      O.toast("Καταχωρήθηκε: " + (c ? c.name : ""));
      home(); sync(false);
    }
    else if (t.id === "saveNote") {
      var pr2 = prodById(S.prod);
      if (!O.store.add({ kind: "edit", product: pr2 ? pr2.name : "", productId: S.prod, changes: O.edit.changes(pr2), text: $("note").value.trim() })) { O.toast("Δεν αποθηκεύτηκε. Ο χώρος του κινητού είναι γεμάτος."); return; }
      O.toast("Η διόρθωση καταχωρήθηκε");
      home(); sync(false);
    }
    else if (a === "sync") { O.toast("Αποστολή…"); sync(true); }
  });
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el.id === "s") drawPick();
    else if (el.id === "pq") { S.q = el.value; drawProducts(); }
    else if (el.id === "note" || el.classList.contains("ef")) updateSave();
    else if (el.dataset && el.dataset.i) {
      var clean = el.value.replace(/\D/g, "").slice(0, 5);
      if (clean !== el.value) el.value = clean;
      setQty(el.dataset.i, parseInt(clean, 10) || 0);
    }
  });
  document.addEventListener("focusin", function (e) { if (e.target.dataset && e.target.dataset.i) e.target.select(); });
  document.addEventListener("focusout", function (e) { if (e.target.dataset && e.target.dataset.i) e.target.value = S.qty[e.target.dataset.i] || 0; });
  document.addEventListener("submit", function (e) {
    if (e.target.id !== "loginForm") return;
    e.preventDefault();
    var t = $("tk").value.trim(); if (!t) return;
    O.token.set(t); loginMsg = "";
    refresh(false);
  });

  /* ---------- εκκίνηση ---------- */
  history.replaceState({ v: "home", d: 0 }, "");
  if (!O.token.get()) render("login");
  else if (O.loadCache()) { render("home"); refresh(true); sync(false); }
  else refresh(false);
})(window.O = window.O || {});
