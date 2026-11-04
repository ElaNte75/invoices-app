/* Οθόνες και πλοήγηση της εφαρμογής παραγγελιών */
(function (O) {
  var $ = function (id) { return document.getElementById(id); };
  var app = $("app"), dock = $("dock");
  var VERSION = 14;
  var view = "home", mode = "order", depth = 0, loginMsg = "", syncMsg = "";
  var hset = "orders", confirmKey = "", ncFrom = "", cf = null;
  var S = fresh();
  var pick = { items: [], kind: "" };

  /* editId: καταχώρηση του ιστορικού που επεξεργαζόμαστε· names: ονόματα προϊόντων παραγγελίας που επεξεργαζόμαστε */
  function fresh() { return { client: null, clientName: "", cat: null, qty: {}, names: {}, mat: "", q: "", prod: null, edit: false, editId: "" }; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function norm(s) {
    return String(s).toLowerCase().replace(/ς/g, "σ").normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  /* Πελάτες που καταχωρήθηκαν από το κινητό και δεν υπάρχουν ακόμα στη βάση (φεύγουν όταν μπουν με το ίδιο όνομα ή ΑΦΜ) */
  function newClients() {
    var known = O.data.clients;
    return O.store.all().filter(function (r) { return r.kind === "client"; }).filter(function (r) {
      var n = norm(r.client.shortName), a = r.client.afm;
      return !known.some(function (c) { return norm(c.name) === n || (a && c.afm === a); });
    }).map(function (r) { return { id: "new-" + r.id, name: r.client.shortName, city: r.client.city || "", isNew: true }; });
  }
  function clientById(id) { return newClients().concat(O.data.clients).filter(function (c) { return c.id === id; })[0]; }
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
  O.ui = { esc: esc, back: BACK };
  function histBtn(act) { return '<div class="topbar">' + BACK + '<button class="back" data-act="' + act + '">Ιστορικό</button></div>'; }

  /* ---------- αρχική ---------- */
  function vHome() {
    var d = O.data, n = O.hist.count("orders");
    var when = d.updated ? new Date(d.updated).toLocaleString("el-GR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    var left = O.store.pending().length;
    var pend = left ? '<div class="msg">' + left + (left === 1 ? " καταχώρηση περιμένει" : " καταχωρήσεις περιμένουν") + " αποστολή." + (syncMsg ? " " + esc(syncMsg) : "") +
      '</div><button class="small" data-act="sync">Αποστολή τώρα</button>' : "";
    return '<h1>Παραγγελίες</h1>' + pend + '<div class="stack home">' +
      '<button class="big primary" data-act="new-order">Νέα παραγγελία</button>' +
      '<button class="big" data-act="scan">Σκανάρισμα QR τιμολογίου<small>καταχώρηση τιμολογίου με την κάμερα</small></button>' +
      '<button class="big" data-act="clients">Επεξεργασία πελατών<small>στοιχεία πελάτη, νέος πελάτης</small></button>' +
      '<button class="big" data-act="new-info">Επεξεργασία καταλόγου<small>πάχος, υλικό, διαστάσεις, περιγραφή</small></button>' +
      '<button class="big" data-act="history">Ιστορικό παραγγελιών<small>' + n + " εγγραφές</small></button></div>" +
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
    var top = BACK, add = "";
    if (kind === "client") top = '<div class="topbar">' + BACK + '<button class="back" data-act="new-client">+ Νέος πελάτης</button></div>';
    else if (kind === "cl") { top = histBtn("hist-clients"); add = '<button class="small add" data-act="new-client">+ Νέος πελάτης</button>'; }
    else if (kind === "cat" && mode === "info") top = histBtn("hist-catalog");
    return top + "<h1>" + title + "</h1>" + add + '<input class="search" id="s" type="search" placeholder="' + placeholder + '" aria-label="' + placeholder + '" autocomplete="off"><div class="list" id="list"></div>';
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
  function clientItems() {
    var u = usage().clients;
    var list = O.data.clients.slice().sort(function (a, b) { return (u[b.id] || 0) - (u[a.id] || 0); });
    return newClients().concat(list).map(function (c) {
      return { k: c.id, label: c.name, sub: c.isNew ? "Νέος · περιμένει καταχώρηση" : c.city };
    });
  }
  function vClient() { return vPick("Πελάτης", "Γράψε για αναζήτηση", clientItems(), "client"); }
  function vClients() { return vPick("Επεξεργασία πελατών", "Γράψε για αναζήτηση", clientItems(), "cl"); }

  /* φόρμα πελάτη για επεξεργασία: cf = { kind: "client" | "clientEdit", rec, c, base, vals, note } */
  function baseOf(c) {
    return { shortName: c.short, name: c.full, afm: c.afm, city: c.city, address: c.address, phone: c.phone, doy: c.doy, profession: c.prof };
  }
  function openClientForm(id) {
    var r, c;
    if (id.indexOf("new-") === 0) {
      r = O.store.all().filter(function (x) { return "new-" + x.id === id; })[0];
      if (!r) return;
      cf = { kind: "client", rec: r, vals: r.client, note: r.text || "" };
    } else {
      c = clientById(id);
      if (!c) return;
      cf = { kind: "clientEdit", c: c, base: baseOf(c), vals: baseOf(c), note: "" };
    }
    go("clientform");
  }
  function editClientRec(r) {
    if (r.kind === "client") cf = { kind: "client", rec: r, vals: r.client, note: r.text || "" };
    else {
      var c = clientById(r.clientId);
      if (!c) { O.toast("Ο πελάτης δεν βρέθηκε στη βάση."); return; }
      var vals = baseOf(c);
      Object.keys(r.changes || {}).forEach(function (k) { vals[k] = r.changes[k].to || ""; });
      cf = { kind: "clientEdit", rec: r, c: c, base: baseOf(c), vals: vals, note: r.text || "" };
    }
    go("clientform");
  }
  function vClientForm() {
    return BACK + "<h1>" + (cf.kind === "client" ? "Νέος πελάτης" : "Επεξεργασία πελάτη") + "</h1>" +
      (cf.c ? '<p class="sub">' + esc(cf.c.name) + "</p>" : "") + O.newClient.html(cf.vals, cf.note, cf.kind === "clientEdit");
  }
  function updateCF() {
    var b = $("saveCF"); if (!b) return;
    b.disabled = cf.kind === "client" ? !O.newClient.ok() : !(Object.keys(O.newClient.changes(cf.base)).length || O.newClient.note());
  }
  function saveCF() {
    var note = O.newClient.note(), rec, ok;
    if (cf.kind === "client") rec = { client: O.newClient.values(), text: note };
    else rec = { kind: "clientEdit", clientId: cf.c.id, client: cf.c.name, changes: O.newClient.changes(cf.base), text: note };
    ok = cf.rec ? O.store.update(cf.rec.id, Object.assign(rec, { sent: false, edited: new Date().toISOString() })) : O.store.add(Object.assign({ kind: "client" }, rec));
    if (!ok) { O.toast("Δεν αποθηκεύτηκε. Ο χώρος του κινητού είναι γεμάτος."); return; }
    O.toast(cf.rec ? "Η επεξεργασία αποθηκεύτηκε" : "Η επεξεργασία καταχωρήθηκε");
    if (cf.rec) history.back(); else home();
    sync(false);
  }
  function vNewClient() {
    return BACK + "<h1>Νέος πελάτης</h1><p class=\"sub\">Γράψε όσα ξέρεις. Ό,τι λείπει μένει κενό και συμπληρώνεται αργότερα.</p>" + O.newClient.html();
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
  /* Στην επεξεργασία παραγγελίας ο πελάτης δεν αλλάζει */
  function clientCrumb() {
    var c = clientById(S.client), name = esc(S.clientName || (c ? c.name : ""));
    if (S.editId) return '<div class="crumb ro"><span><small>Πελάτης</small>' + name + "</span></div>";
    return '<button class="crumb" data-act="edit-client"><span><small>Πελάτης</small>' + name + "</span></button>";
  }
  function itemName(id) { var p = prodById(id); return S.names[id] || (p ? p.name : id); }
  function orderItems() { return Object.keys(S.qty).map(function (id) { return { id: id, name: itemName(id), qty: S.qty[id] }; }); }
  function catProducts() { return O.data.products.filter(function (p) { return p.cat === S.cat; }); }
  function vProducts() {
    var all = catProducts(), mats = [];
    all.forEach(function (p) { if (p.mat && mats.indexOf(p.mat) < 0) mats.push(p.mat); });
    var crumbs = "";
    if (mode === "order") crumbs += clientCrumb();
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
    var n = total(), k = Object.keys(S.qty).filter(function (id) { return S.qty[id] > 0; }).length;
    b.disabled = !n;
    if ($("more")) $("more").disabled = !n;
    $("dnote").textContent = n ? k + (k === 1 ? " προϊόν" : " προϊόντα") + " στην παραγγελία · " + n + " τεμ." : "Δεν έχεις βάλει ακόμα ποσότητα";
  }
  function setQty(id, n) {
    n = Math.max(0, Math.min(99999, n || 0));
    if (n) S.qty[id] = n; else delete S.qty[id];
    var r = $("r" + id); if (r) r.classList.toggle("has", n > 0);
    updateSend();
  }

  /* ---------- πληροφορία ---------- */
  function vNote() {
    var p = prodById(S.prod), shown = p, rec = S.editId && O.hist.find(S.editId);
    if (rec) {
      shown = Object.assign({}, p);
      O.edit.fields.forEach(function (f) {
        var c = (rec.changes || {})[f.k];
        if (c) shown[f.s] = c.to == null ? (f.type === "list" ? [] : "") : c.to;
      });
    }
    return BACK + "<h1>Επεξεργασία προϊόντος</h1>" + O.edit.html(shown) +
      '<div class="label">Σχόλιο (προαιρετικά)</div><textarea class="field" id="note" placeholder="Γράψε εδώ…" aria-label="Σχόλιο">' + esc(rec ? rec.text || "" : "") + "</textarea>";
  }
  function editCatRec(r) {
    if (!prodById(r.productId)) { O.toast("Το προϊόν δεν βρέθηκε στον κατάλογο."); return; }
    S = fresh(); S.prod = r.productId; S.editId = r.id; mode = "info";
    go("note");
  }

  /* ---------- επεξεργασία παραγγελίας (πελάτης σταθερός, αλλάζουν τα προϊόντα) ---------- */
  function editOrderRec(r) {
    S = fresh(); mode = "order";
    S.client = r.clientId || ""; S.clientName = r.client; S.editId = r.id;
    r.items.forEach(function (i, n) { var id = i.id || "x" + n; S.qty[id] = i.qty; S.names[id] = i.name; });
    go("orderedit");
  }
  function vOrderEdit() {
    var rows = Object.keys(S.qty).map(function (id) {
      return '<div class="prow has" id="r' + id + '"><div class="pname">' + esc(itemName(id)) + "</div>" +
        '<div class="step"><button data-m="' + id + '" aria-label="Λιγότερο">−</button>' +
        '<input id="q' + id + '" data-i="' + id + '" type="text" inputmode="numeric" pattern="[0-9]*" value="' + S.qty[id] + '" aria-label="Ποσότητα">' +
        '<button class="plus" data-p="' + id + '" aria-label="Περισσότερο">+</button><span class="unit">τεμ.</span></div></div>';
    }).join("");
    return BACK + "<h1>Επεξεργασία παραγγελίας</h1><div class=\"crumbs\">" + clientCrumb() + '</div><p class="sub">Βάλε 0 για να βγει ένα προϊόν.</p><div class="list">' + rows +
      '</div><button class="big add2" data-act="edit-add">+ Προσθήκη προϊόντος</button>';
  }
  function saveOrderEdit() {
    if (!O.store.update(S.editId, { items: orderItems(), sent: false, edited: new Date().toISOString() })) { O.toast("Δεν αποθηκεύτηκε. Ο χώρος του κινητού είναι γεμάτος."); return; }
    O.toast("Η παραγγελία ενημερώθηκε");
    home(); sync(false);
  }
  /* Νέα παραγγελία: αν ο ίδιος πελάτης έχει ήδη παραγγελία που δεν έχει περαστεί στη βάση, τα προϊόντα προστίθενται σε εκείνη */
  function itemsOf(r) { return r.items.map(function (i) { return Array.isArray(i) ? { id: "", name: i[0], qty: i[1] } : { id: i.id || "", name: i.name, qty: i.qty }; }); }
  function pendingOrder(clientId) {
    return O.store.all().filter(function (r) { return r.kind === "order" && r.id && !r.passed && r.clientId === clientId; })[0];
  }
  function saveOrder() {
    var c = clientById(S.client), cid = S.client, items = orderItems(), btn = $("send");
    if (btn) btn.disabled = true;
    O.inbox.refresh().then(function () {
      var r = pendingOrder(cid), ok, merged = false;
      if (r) {
        var all = itemsOf(r);
        items.forEach(function (n) {
          var f = all.filter(function (o) { return n.id ? o.id === n.id : o.name === n.name; })[0];
          if (f) f.qty += n.qty; else all.push(n);
        });
        ok = O.store.update(r.id, { items: all, sent: false, edited: new Date().toISOString() });
        merged = true;
      } else ok = O.store.add({ kind: "order", client: c ? c.name : "", clientId: cid, items: items });
      if (!ok) { O.toast("Δεν αποθηκεύτηκε. Ο χώρος του κινητού είναι γεμάτος."); if (btn) btn.disabled = false; return; }
      O.toast((merged ? "Προστέθηκε στην παραγγελία: " : "Καταχωρήθηκε: ") + (c ? c.name : ""));
      home(); sync(false);
    });
  }

  function updateSave() {
    var b = $("saveNote"), p = prodById(S.prod);
    if (b && p) b.disabled = !(Object.keys(O.edit.changes(p)).length || $("note").value.trim());
  }

  /* ---------- ιστορικό ---------- */
  function openHist(set) {
    hset = set; confirmKey = "";
    go("history");
    O.inbox.refresh().then(function (changed) { if (changed && view === "history") render("history", true); });
  }
  function editRec(k) {
    var r = O.hist.find(k); if (!r || r.passed) return;
    if (r.kind === "order") editOrderRec(r);
    else if (r.kind === "edit") editCatRec(r);
    else if (r.kind === "client" || r.kind === "clientEdit") editClientRec(r);
  }
  function delRec(k) {
    var r = O.hist.find(k); confirmKey = "";
    if (!r) { render("history", true); return; }
    if (!r.id || r.sent !== true || r.passed) { O.store.remove(r); O.toast(r.passed ? "Αφαιρέθηκε από το ιστορικό" : "Διαγράφηκε"); render("history", true); return; }
    O.toast("Διαγραφή…");
    O.inbox.remove(r).then(function (res) {
      if (res === "passed") { O.store.update(r.id, { passed: true }); O.toast("Έχει ήδη περαστεί στη βάση, δεν διαγράφεται."); }
      else { O.store.remove(r); O.toast("Διαγράφηκε"); }
    }, function (err) {
      var code = err && err.code;
      O.toast(code === "net" ? "Χρειάζεται σύνδεση για διαγραφή." : code === "noperm" ? "Το κλειδί δεν έχει δικαίωμα εγγραφής." : "Δεν έγινε η διαγραφή.");
    }).then(function () { if (view === "history") render("history", true); });
  }

  /* ---------- σκανάρισμα QR ---------- */
  function vScan() {
    return BACK + "<h1>Σκανάρισμα QR</h1><p class=\"sub\">Στόχευσε το QR του τιμολογίου. Καταχωρείται μόνο του μόλις διαβαστεί.</p>" +
      '<video class="cam" id="cam" playsinline muted></video><div class="msg" id="camMsg" hidden></div>';
  }
  var SCAN_ERR = {
    denied: "Η κάμερα δεν επιτράπηκε. Στο Chrome πάτα το εικονίδιο δίπλα στη διεύθυνση, άνοιξε τις ρυθμίσεις του site και δώσε άδεια στην κάμερα.",
    nocamera: "Δεν βρέθηκε κάμερα.",
    unsupported: "Η κάμερα δεν υποστηρίζεται σε αυτό το πρόγραμμα. Χρειάζεται Chrome.",
    lib: "Δεν φόρτωσε ο αναγνώστης QR. Έλεγξε τη σύνδεση και δοκίμασε ξανά."
  };
  var lastBad = "";
  function onScan(text) {
    text = String(text).trim();
    if (!/^https?:\/\/[^\s]*aade\.gr\//i.test(text)) {
      if (text !== lastBad) O.toast("Αυτό δεν είναι QR τιμολογίου ΑΑΔΕ.");
      lastBad = text; return false;
    }
    if (O.store.all().some(function (r) { return r.kind === "qr" && r.url === text; })) {
      O.toast("Αυτό το τιμολόγιο το έχεις ήδη σκανάρει."); home(); return true;
    }
    if (!O.store.add({ kind: "qr", url: text })) { O.toast("Δεν αποθηκεύτηκε. Ο χώρος του κινητού είναι γεμάτος."); home(); return true; }
    O.toast("Καταχωρήθηκε το τιμολόγιο");
    home(); sync(false);
    return true;
  }

  /* Φόρμες πελάτη και προϊόντος: δύο ίσα κουμπιά, Ακύρωση και Καταχώρηση */
  function formDock(saveId) {
    return '<div class="dock2 eq"><button class="more" id="cancelForm">Ακύρωση</button><button class="send" id="' + saveId + '" disabled>Καταχώρηση</button></div>';
  }

  /* ---------- εμφάνιση ---------- */
  function render(v, keepScroll) {
    view = v;
    O.scan.stop();
    setDock("");
    var html = {
      home: vHome, login: vLogin, loading: vLoading, client: vClient, clients: vClients, clientform: vClientForm, newclient: vNewClient, cat: vCat,
      products: vProducts, note: vNote, orderedit: vOrderEdit, scan: vScan,
      history: function () { return O.hist.html(hset, confirmKey); }
    }[v]();
    var y = window.scrollY;
    app.innerHTML = html;
    window.scrollTo(0, keepScroll ? y : 0);
    if (v === "client" || v === "clients" || v === "cat") drawPick();
    if (v === "products") {
      drawProducts();
      if (mode === "order") {
        setDock('<div class="docknote" id="dnote"></div><div class="dock2 eq"><button class="more" id="more" disabled>Προσθήκη επόμενου</button>' +
          '<button class="send" id="send" disabled>' + (S.editId ? "Αποθήκευση αλλαγών" : "Καταχώρηση παραγγελίας") + "</button></div>");
        updateSend();
      }
    }
    if (v === "orderedit") {
      setDock('<div class="docknote" id="dnote"></div><div class="dock2"><button class="send" id="send" disabled>Αποθήκευση αλλαγών</button></div>');
      updateSend();
    }
    if (v === "clientform") { setDock(formDock("saveCF")); updateCF(); }
    if (v === "newclient") setDock(formDock("saveClient"));
    if (v === "note") { setDock(formDock("saveNote")); updateSave(); }
    if (v === "scan") {
      lastBad = "";
      O.scan.start($("cam"), onScan, function (code) { var m = $("camMsg"); m.textContent = SCAN_ERR[code] || SCAN_ERR.nocamera; m.hidden = false; });
    }
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
    else if (a === "history") openHist("orders");
    else if (a === "hist-catalog") openHist("catalog");
    else if (a === "hist-clients") openHist("clients");
    else if (a === "clients") { S = fresh(); go("clients"); }
    else if (a === "edit-add") go("cat");
    else if (t.dataset.hedit) editRec(t.dataset.hedit);
    else if (t.dataset.hdel) { confirmKey = t.dataset.hdel; render("history", true); }
    else if (t.dataset.hno) { confirmKey = ""; render("history", true); }
    else if (t.dataset.hyes) delRec(t.dataset.hyes);
    else if (a === "scan") go("scan");
    else if (a === "refresh") { O.toast("Ενημέρωση…"); refresh(false); }
    else if (a === "token") { loginMsg = ""; render("login"); }
    else if (a === "edit-client") { S.edit = true; go("client"); }
    else if (a === "edit-cat") { S.edit = true; go("cat"); }
    else if (t.dataset.pick !== undefined) {
      if (pick.kind === "cl") { openClientForm(t.dataset.pick); return; }
      if (pick.kind === "client") S.client = t.dataset.pick;
      else { S.cat = t.dataset.pick; S.mat = ""; S.q = ""; }
      if (S.edit) { S.edit = false; history.back(); }
      else go(pick.kind === "client" ? "cat" : "products");
    }
    else if (t.dataset.mat !== undefined) { S.mat = t.dataset.mat; render("products"); }
    else if (t.dataset.p) { var p = t.dataset.p; setQty(p, (S.qty[p] || 0) + 1); $("q" + p).value = S.qty[p] || 0; }
    else if (t.dataset.m) { var m = t.dataset.m; setQty(m, (S.qty[m] || 0) - 1); $("q" + m).value = S.qty[m] || 0; }
    else if (t.dataset.prod) { S.prod = t.dataset.prod; go("note"); }
    else if (t.id === "more" || t.id === "cancelForm") history.back();
    else if (t.id === "send" && S.editId) saveOrderEdit();
    else if (t.id === "saveCF") saveCF();
    else if (t.id === "send") {
      saveOrder();
    }
    else if (t.id === "saveNote") {
      var pr2 = prodById(S.prod), rec2 = { product: pr2 ? pr2.name : "", productId: S.prod, changes: O.edit.changes(pr2), text: $("note").value.trim() };
      var saved = S.editId ? O.store.update(S.editId, Object.assign(rec2, { sent: false, edited: new Date().toISOString() })) : O.store.add(Object.assign({ kind: "edit" }, rec2));
      if (!saved) { O.toast("Δεν αποθηκεύτηκε. Ο χώρος του κινητού είναι γεμάτος."); return; }
      O.toast("Η επεξεργασία καταχωρήθηκε");
      if (S.editId) history.back(); else home();
      sync(false);
    }
    else if (a === "sync") { O.toast("Αποστολή…"); sync(true); }
    else if (a === "new-client") { ncFrom = view; go("newclient"); }
    else if (t.id === "saveClient") {
      var cl = O.newClient.values();
      if (!O.store.add({ kind: "client", client: cl, text: O.newClient.note() })) { O.toast("Δεν αποθηκεύτηκε. Ο χώρος του κινητού είναι γεμάτος."); return; }
      var added = O.store.all().filter(function (r) { return r.kind === "client"; })[0];
      S.client = "new-" + added.id;
      O.toast("Ο πελάτης αποθηκεύτηκε: " + cl.shortName);
      if (ncFrom === "clients") history.back();
      else if (S.edit) { S.edit = false; history.go(-2); }
      else { history.replaceState({ v: "cat", d: depth }, ""); render("cat"); }
      sync(false);
    }
  });
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el.id === "s") drawPick();
    else if (el.id === "pq") { S.q = el.value; drawProducts(); }
    else if (el.id === "note" || el.classList.contains("ef")) updateSave();
    else if (el.classList.contains("cf")) { if ($("saveCF")) updateCF(); else if ($("saveClient")) $("saveClient").disabled = !O.newClient.ok(); }
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
