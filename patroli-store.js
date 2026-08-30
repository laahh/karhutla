window.KarhutlaPatroliStore = (function () {
  const API = "/api/patroli";
  const PHOTO_API = "/api/laporan-photo";
  const DB_NAME = "karhutla-patroli-v1";
  const DB_VER = 1;
  const displayCache = {};
  let persistent = false;
  let ready = null;

  function seedData() {
    if (window.KARHUTLA_PATROLI_DATA && Array.isArray(window.KARHUTLA_PATROLI_DATA.records)) {
      return window.KARHUTLA_PATROLI_DATA;
    }
    return {
      source_file: "Form input patroli KARHUTLA",
      total_records: 0,
      records: []
    };
  }

  function applyData(data) {
    if (!data || !Array.isArray(data.records)) data = seedData();
    data.total_records = data.records.length;
    window.KARHUTLA_PATROLI_DATA = data;
    return data;
  }

  function isPhotoRef(src) {
    if (typeof src !== "string" || !src) return false;
    return src.indexOf("laporan-foto/") === 0 ||
      src.indexOf("idb:") === 0 ||
      /^https?:\/\//.test(src);
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" });
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

  async function idbPutPhoto(id, file) {
    const db = await openDb();
    await new Promise(function (resolve, reject) {
      const tx = db.transaction("photos", "readwrite");
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.objectStore("photos").put({
        id: id,
        name: file.name || id,
        type: file.type || "image/jpeg",
        blob: file
      });
    });
  }

  async function idbGetPhoto(id) {
    try {
      const db = await openDb();
      return await new Promise(function (resolve, reject) {
        const req = db.transaction("photos", "readonly").objectStore("photos").get(id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    } catch (err) {
      return null;
    }
  }

  async function cacheIdbPhotos(data) {
    const records = (data && data.records) || [];
    for (let r = 0; r < records.length; r += 1) {
      const files = records[r] && records[r].dokumentasi && records[r].dokumentasi.files
        ? records[r].dokumentasi.files : [];
      for (let i = 0; i < files.length; i += 1) {
        const src = files[i];
        if (typeof src !== "string" || src.indexOf("idb:") !== 0) continue;
        if (displayCache[src]) continue;
        const row = await idbGetPhoto(src.slice(4));
        if (row && row.blob) displayCache[src] = URL.createObjectURL(row.blob);
      }
    }
  }

  function displayUrl(src) {
    if (typeof src !== "string" || !src) return "";
    if (src.indexOf("idb:") === 0) return displayCache[src] || "";
    return src;
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(blob);
    });
  }

  function compressPhoto(file) {
    if (!file || !window.createImageBitmap || !document.createElement("canvas").getContext) {
      return Promise.resolve(file);
    }
    return createImageBitmap(file).then(function (bitmap) {
      const max = 1400;
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (bitmap.close) bitmap.close();
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          resolve(blob || file);
        }, "image/jpeg", 0.82);
      });
    }).catch(function () {
      return file;
    });
  }

  async function fetchApi(url, options) {
    const res = await fetch(url, options);
    const json = await res.json().catch(function () { return null; });
    return { res: res, json: json };
  }

  async function hydrate() {
    let apiData = null;
    try {
      const got = await fetchApi(API, { method: "GET", cache: "no-store" });
      if (got.json && got.json.ok && got.json.data) {
        persistent = !!got.json.persistent;
        apiData = got.json.data;
      }
    } catch (err) {
      persistent = false;
    }

    if (persistent && apiData) {
      applyData(apiData);
      await cacheIdbPhotos(apiData);
      return window.KARHUTLA_PATROLI_DATA;
    }

    const local = await idbGetData();
    if (local && Array.isArray(local.records) && local.records.length) {
      applyData(local);
      await cacheIdbPhotos(local);
      return window.KARHUTLA_PATROLI_DATA;
    }

    applyData(apiData || seedData());
    await cacheIdbPhotos(window.KARHUTLA_PATROLI_DATA);
    return window.KARHUTLA_PATROLI_DATA;
  }

  function readyPromise() {
    if (!ready) ready = hydrate();
    return ready;
  }

  async function save(data) {
    applyData(data);
    await idbSetData(window.KARHUTLA_PATROLI_DATA);
    try {
      const got = await fetchApi(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "replace",
          data: window.KARHUTLA_PATROLI_DATA
        })
      });
      if (got.json && got.json.ok && got.json.data) {
        persistent = true;
        applyData(got.json.data);
        await idbSetData(got.json.data);
        return { ok: true, persistent: true, data: window.KARHUTLA_PATROLI_DATA };
      }
    } catch (err) {
      /* keep local copy */
    }
    return { ok: true, persistent: false, data: window.KARHUTLA_PATROLI_DATA };
  }

  async function uploadPhoto(file, name) {
    const packed = await compressPhoto(file);
    const photoFile = packed && packed.size ? packed : file;

    try {
      const data = await blobToBase64(photoFile);
      const got = await fetchApi(PHOTO_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || (file && file.name) || "patroli.jpg",
          type: photoFile.type || "image/jpeg",
          data: data
        })
      });
      if (got.json && got.json.ok && got.json.url) {
        persistent = true;
        return got.json.url;
      }
    } catch (err) {
      /* fall through to IndexedDB */
    }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await idbPutPhoto(id, photoFile);
    const ref = "idb:" + id;
    displayCache[ref] = URL.createObjectURL(photoFile);
    return ref;
  }

  return {
    hydrate: readyPromise,
    save: save,
    uploadPhoto: uploadPhoto,
    displayUrl: displayUrl,
    isPhotoRef: isPhotoRef,
    isPersistent: function () { return persistent; }
  };
})();
