/* Σκανάρισμα QR με την κάμερα. Χρησιμοποιεί το ενσωματωμένο BarcodeDetector του Chrome,
   αλλιώς φορτώνει τη βιβλιοθήκη jsQR. Δεν διαβάζει πληροφορίες, επιστρέφει μόνο το κείμενο του QR. */
(function (O) {
  var stream = null, timer = 0, run = 0, detector = null;
  var LIB = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

  function stop() {
    run++;
    clearTimeout(timer);
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  }
  function loadLib() {
    if (window.jsQR) return Promise.resolve();
    return new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = LIB; s.onload = ok; s.onerror = function () { fail(); };
      document.head.appendChild(s);
    });
  }
  function reader() {
    if ("BarcodeDetector" in window) {
      detector = detector || new window.BarcodeDetector({ formats: ["qr_code"] });
      return Promise.resolve(function (video) {
        return detector.detect(video).then(function (c) { return c.length ? c[0].rawValue : ""; });
      });
    }
    return loadLib().then(function () {
      var cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
      return function (video) {
        var k = Math.min(1, 720 / video.videoWidth);
        cv.width = Math.round(video.videoWidth * k); cv.height = Math.round(video.videoHeight * k);
        cx.drawImage(video, 0, 0, cv.width, cv.height);
        var r = window.jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
        return Promise.resolve(r ? r.data : "");
      };
    });
  }

  /* onText(κείμενο) επιστρέφει true όταν η σάρωση τελείωσε. onError("denied" | "nocamera" | "unsupported" | "lib") */
  function start(video, onText, onError) {
    stop();
    var my = run;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { onError("unsupported"); return; }
    reader().then(function (read) {
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then(function (s) {
        if (my !== run) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s;
        video.srcObject = s;
        video.play();
        (function tick() {
          if (my !== run) return;
          var next = function () { if (my === run) timer = setTimeout(tick, 250); };
          if (video.readyState < 2 || !video.videoWidth) return next();
          read(video).then(function (text) {
            if (my !== run) return;
            if (text && onText(text)) return stop();
            if (text) timer = setTimeout(tick, 1500); else next();
          }, next);
        })();
      }, function (e) { if (my === run) onError(e && e.name === "NotAllowedError" ? "denied" : "nocamera"); });
    }, function () { if (my === run) onError("lib"); });
  }
  O.scan = { start: start, stop: stop };
})(window.O = window.O || {});
