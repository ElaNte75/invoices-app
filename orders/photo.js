/* Φωτογραφίες παραστατικών: συμπίεση, προσωρινή αποθήκευση στο κινητό ώσπου να σταλούν, μετατροπή σε base64 για το inbox.
   Η φωτογραφία κρατιέται χωριστά από το ιστορικό και σβήνεται από το κινητό μόλις σταλεί. */
(function (O) {
  var PREFIX = "orders_photo_", MAX_SIDE = 1800, MAX_B64 = 850000;
  O.photoKinds = [
    { k: "customer", label: "Παραστατικό πελάτη" },
    { k: "partner", label: "Δελτίο συνεργάτη" },
    { k: "stamp", label: "Σφραγίδα πρακτορείου" },
    { k: "other", label: "Άλλο" }
  ];
  O.photoKindLabel = function (k) { var f = O.photoKinds.filter(function (x) { return x.k === k; })[0]; return f ? f.label : "Φωτογραφία"; };

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
  /* Επιστρέφει data URL JPEG, αρκετά μικρό ώστε το αρχείο στο inbox να μένει κάτω από 1 MB */
  O.photo = {
    compress: function (file) {
      return load(file).then(function (img) {
        var w = img.width, h = img.height, k = Math.min(1, MAX_SIDE / Math.max(w, h)), q = 0.78, out = "";
        for (var i = 0; i < 8; i++) {
          var cv = document.createElement("canvas");
          cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          out = cv.toDataURL("image/jpeg", q);
          if (out.length - 23 <= MAX_B64) return out;
          k *= 0.85; q = Math.max(0.55, q - 0.05);
        }
        throw new Error("big");
      });
    },
    put: function (id, dataUrl) { try { localStorage.setItem(PREFIX + id, dataUrl); return true; } catch (e) { return false; } },
    get: function (id) { try { return localStorage.getItem(PREFIX + id) || ""; } catch (e) { return ""; } },
    del: function (id) { try { localStorage.removeItem(PREFIX + id); } catch (e) {} },
    /* Μόνο το base64 μέρος, για το αρχείο του inbox */
    base64: function (id) { var d = O.photo.get(id); return d ? d.replace(/^data:image\/jpeg;base64,/, "") : ""; }
  };
})(window.O = window.O || {});
