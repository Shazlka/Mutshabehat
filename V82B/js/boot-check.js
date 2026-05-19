(function phase1BootCheck() {
  if (window.__V82B_PHASE1_BOOTCHECK__) return;
  window.__V82B_PHASE1_BOOTCHECK__ = true;

  var required = [
    "openDatabase",
    "openHome",
    "renderActiveGroups",
    "openAddModal",
    "manualSyncGitHub",
  ];
  var missing = required.filter(function (name) {
    return typeof window[name] !== "function";
  });

  if (missing.length) {
    console.error("V82B boot check failed. Missing globals:", missing.join(", "));
    var badge = document.getElementById("storageBadge");
    if (badge) badge.textContent = "خطأ تحميل الواجهة";
    return;
  }

  var baseOpenDatabase = window.openDatabase;
  var baseOpenHome = window.openHome;

  window.openDatabase = async function (w) {
    if (document.body) {
      document.body.dataset.activeDb = w === "personal" ? "personal" : "auto";
    }
    return await baseOpenDatabase.apply(this, arguments);
  };

  window.openHome = function () {
    if (document.body) {
      document.body.dataset.activeDb = "";
    }
    return baseOpenHome.apply(this, arguments);
  };

  if (
    document.body &&
    !document.body.dataset.activeDb &&
    typeof activeDb !== "undefined" &&
    activeDb
  ) {
    document.body.dataset.activeDb = activeDb === "personal" ? "personal" : "auto";
  }
})();
