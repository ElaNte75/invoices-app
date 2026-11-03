/* Κουμπί εγκατάστασης και ενημερώσεις (service worker) */
(function (O) {
  var btn = document.getElementById("install");
  var deferred = null;
  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    if (!isStandalone()) btn.hidden = false;
  });
  btn.addEventListener("click", function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; btn.hidden = true; });
  });
  window.addEventListener("appinstalled", function () {
    deferred = null;
    btn.hidden = true;
    if (O.toast) O.toast("Η εφαρμογή εγκαταστάθηκε");
  });
  if (isStandalone()) btn.hidden = true;
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
})(window.O = window.O || {});
