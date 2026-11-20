/* Cau noi giua trang ban hang (src/app.js) va may chu: thay cho nen tang cu (window.claude.use). */
(function () {
  "use strict";
  var J = { "Content-Type": "application/json" };
  function fail(status, body) {
    var code = (body && body.code) || (status === 409 ? "conflict" : status === 413 ? "too_large" : status === 429 ? "rate_limited" : status === 401 || status === 403 ? "not_writer" : "upstream_error");
    return { code: code };
  }
  async function call(url, opt) {
    var r = await fetch(url, Object.assign({ credentials: "same-origin" }, opt || {}));
    var b = null; try { b = await r.json(); } catch (e) {}
    if (!r.ok) throw fail(r.status, b);
    return b;
  }
  var api = {
    user: {
      canEdit: async function () { try { return !!(await call("/api/me")).admin; } catch (e) { return false; } }
    },
    assets: {
      upload: function (blob, o) { return call("/api/assets", { method: "POST", headers: { "Content-Type": (o && o.type) || blob.type || "image/jpeg" }, body: blob }); },
      list: function () { return call("/api/assets"); },
      delete: function (id) { return call("/api/assets/" + encodeURIComponent(id), { method: "DELETE" }); }
    },
    artifact: {
      // app.js tao ra ca trang HTML khi bam Luu; o day chi lay phan du lieu va gui len may chu.
      publish: async function (html) {
        var d = new DOMParser().parseFromString(html, "text/html");
        var store = JSON.parse(d.getElementById("store").textContent);
        var media = JSON.parse(d.getElementById("media").textContent);
        await call("/api/publish", { method: "POST", headers: J, body: JSON.stringify({ baseRev: store.rev - 1, store: store, media: media }) });
        setTimeout(function () { location.reload(); }, 150);
      }
    }
  };
  window.claude = { use: function (n) { return api[n] || null; } };
})();
