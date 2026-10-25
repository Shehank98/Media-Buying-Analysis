/* Browser storage for the uploaded sheets. Everything stays in this browser (IndexedDB). */
window.MB = window.MB || {};
MB.db = (() => {
  const mem = new Map(); // fallback when IndexedDB is blocked (private window)
  let broken = false;
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open('media-buying-desk', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('sets');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('sets', mode);
      const rq = fn(t.objectStore('sets'));
      t.oncomplete = () => { db.close(); res(rq && rq.result); };
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  const guard = async (fn, fb) => { if (broken) return fb(); try { return await fn(); } catch (e) { broken = true; return fb(); } };
  return {
    get persistent() { return !broken; },
    put: (k, v) => guard(() => run('readwrite', (s) => s.put(v, k)), () => { mem.set(k, v); }),
    get: (k) => guard(() => run('readonly', (s) => s.get(k)), () => mem.get(k)),
    del: (k) => guard(() => run('readwrite', (s) => s.delete(k)), () => { mem.delete(k); }),
  };
})();
