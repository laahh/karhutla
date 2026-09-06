window.KarhutlaKompetensiStore = (function () {
  const API = "/api/kompetensi";
  const DB_NAME = "karhutla-kompetensi-v1";
  const DB_VER = 1;
  let persistent = false;
  let ready = null;

  function seedData() {
    if (window.KARHUTLA_KOMPETENSI_DATA && Array.isArray(window.KARHUTLA_KOMPETENSI_DATA.records)) {
      return window.KARHUTLA_KOMPETENSI_DATA;
    }
    return {
      source_file: "Form input kompetensi personil KARHUTLA",
      total_records: 0,
      records: []
    };
  }

  function applyData(data) {
    if (!data || !Array.isArray(data.records)) data = seedData();
    data.total_records = data.records.length;
    window.KARHUTLA_KOMPETENSI_DATA = data;
    return data;
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function idbGetData() {
    try {
      const db = await openDb();
      return await new Promise(function (resolve, reject) {
        const req = db.transaction("meta", "readonly").objectStore("meta").get("data");
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    } catch (err) {
      return null;
    }
  }

  async function idbSetData(data) {
    const db = await openDb();
    await new Promise(function (resolve, reject) {
      const tx = db.transaction("meta", "readwrite");
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.objectStore("meta").put(data, "data");
    });
  }

  function useRemoteApi() {
    const host = location.hostname;
    return !!host && host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
  }

  async function fetchApi(url, options) {
    const res = await fetch(url, options);
    const json = await res.json().catch(function () { return null; });
    return { res: res, json: json };
  }

  async function hydrate() {
    let apiData = null;
    if (useRemoteApi()) {
      try {
        const got = await fetchApi(API, { method: "GET", cache: "no-store" });
        if (got.json && got.json.ok && got.json.data) {
          persistent = !!got.json.persistent;
          apiData = got.json.data;
        }
      } catch (err) {
        persistent = false;
      }
    }

    if (persistent && apiData) {
      applyData(apiData);
      return window.KARHUTLA_KOMPETENSI_DATA;
    }

    const local = await idbGetData();
    if (local && Array.isArray(local.records) && local.records.length) {
      applyData(local);
      return window.KARHUTLA_KOMPETENSI_DATA;
    }

    applyData(apiData || seedData());
    return window.KARHUTLA_KOMPETENSI_DATA;
  }

  function readyPromise() {
    if (!ready) ready = hydrate();
    return ready;
  }

  async function save(data) {
    applyData(data);
    await idbSetData(window.KARHUTLA_KOMPETENSI_DATA);
    if (!useRemoteApi()) {
      return { ok: true, persistent: false, data: window.KARHUTLA_KOMPETENSI_DATA };
    }
    try {
      const got = await fetchApi(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "replace",
          data: window.KARHUTLA_KOMPETENSI_DATA
        })
      });
      if (got.json && got.json.ok && got.json.data) {
        persistent = true;
        applyData(got.json.data);
        await idbSetData(got.json.data);
        return { ok: true, persistent: true, data: window.KARHUTLA_KOMPETENSI_DATA };
      }
    } catch (err) {
      /* keep local copy */
    }
    return { ok: true, persistent: false, data: window.KARHUTLA_KOMPETENSI_DATA };
  }

  return {
    hydrate: readyPromise,
    save: save,
    isPersistent: function () { return persistent; }
  };
})();
