/* Φωτογραφίες παραστατικών: συμπίεση, προσωρινή αποθήκευση στο κινητό ώσπου να σταλούν, μετατροπή σε base64 για το inbox.
   Η φωτογραφία κρατιέται χωριστά από το ιστορικό και σβήνεται από το κινητό μόλις σταλεί. */
(function (O) {
  var PREFIX = "orders_photo_", MAX_SIDE = 1800, MAX_B64 = 850000;
  O.photoKinds = [
    { k: "document", label: "Παραστατικό" },
    { k: "other", label: "Άλλο" }
  ];
  /* Παλιότερες φωτογραφίες (πριν την έκδοση 27) είχαν περισσότερες κατηγορίες */
  var OLD = { customer: "Παραστατικό πελάτη", partner: "Δελτίο συνεργάτη", stamp: "Σφραγίδα πρακτορείου" };
  O.photoKindLabel = function (k) { var f = O.photoKinds.filter(function (x) { return x.k === k; })[0]; return f ? f.label : OLD[k] || "Φωτογραφία"; };

  function load(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return viaImg(file); });
    }
    return viaImg(file);
  }
  function viaImg(file) {
    return new Promise(function (ok, fail) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); ok(img); };
      img.onerror = function () { URL.revokeObjectURL(url); fail(); };
      img.src = url;
    });
  }
  /* Μικραίνει την εικόνα μία φορά (εικόνα ή video) και μετά ξανακωδικοποιεί από το μικρό καμβά,
     ώστε να μη φορτώνει τη μνήμη του κινητού. Επιστρέφει data URL JPEG κάτω από 1 MB. */
  function encode(src, w, h) {
    var k = Math.min(1, MAX_SIDE / Math.max(w, h));
    var cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height);
    var q = 0.8, out = "";
    for (var i = 0; i < 10; i++) {
      out = cv.toDataURL("image/jpeg", q);
      if (out.length - 23 <= MAX_B64) { cv.width = cv.height = 1; return out; }
      if (q > 0.56) q -= 0.06;
      else {
        var sm = document.createElement("canvas");
        sm.width = Math.round(cv.width * 0.85); sm.height = Math.round(cv.height * 0.85);
        sm.getContext("2d").drawImage(cv, 0, 0, sm.width, sm.height);
        cv.width = cv.height = 1; cv = sm;
      }
    }
    throw new Error("big");
  }
  var stream = null, run = 0;
  function camStop() { run++; if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }
  O.photo = {
    compress: function (file) {
      return load(file).then(function (img) {
        try { return encode(img, img.width, img.height); } finally { if (img.close) img.close(); }
      });
    },
    /* Κάμερα μέσα στην εφαρμογή (δεν βγαίνει ο χρήστης στην κάμερα του κινητού, που σε πολλά κινητά κλείνει την εφαρμογή) */
    camStart: function (video, onError) {
      camStop();
      var my = run;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { onError("unsupported"); return; }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false }).then(function (s) {
        if (my !== run) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s; video.srcObject = s; video.play();
      }, function (e) { if (my === run) onError(e && e.name === "NotAllowedError" ? "denied" : "nocamera"); });
    },
    camStop: camStop,
    snap: function (video) {
      if (!video.videoWidth) return "";
      try { return encode(video, video.videoWidth, video.videoHeight); } catch (e) { return ""; }
    },
    put: function (id, dataUrl) { try { localStorage.setItem(PREFIX + id, dataUrl); return true; } catch (e) { return false; } },
    get: function (id) { try { return localStorage.getItem(PREFIX + id) || ""; } catch (e) { return ""; } },
    del: function (id) { try { localStorage.removeItem(PREFIX + id); } catch (e) {} },
    /* Μόνο το base64 μέρος, για το αρχείο του inbox */
    base64: function (id) { var d = O.photo.get(id); return d ? d.replace(/^data:image\/jpeg;base64,/, "") : ""; }
  };
})(window.O = window.O || {});
