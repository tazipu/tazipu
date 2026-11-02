/* =====================================================================
 * 好记帐 PWA · IndexedDB 本地持久层
 * 自动保存 dataList / trashList，启动时自动读取；与桌面版 JSON 结构兼容
 * ===================================================================== */
const DB_NAME = 'haojizhang';
const DB_VERSION = 1;
const STORE = 'state';
const STATE_KEY = 'main';

const DB = (function () {
  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  function tx(mode) {
    return _db.transaction(STORE, mode).objectStore(STORE);
  }

  return {
    async init() {
      if (!_db) await open();
      return this.load();
    },

    async load() {
      return new Promise((resolve) => {
        const r = tx('readonly').get(STATE_KEY);
        r.onsuccess = () => {
          const v = r.result || { dataList: [], trashList: [] };
          v.dataList = Array.isArray(v.dataList) ? v.dataList : [];
          v.trashList = Array.isArray(v.trashList) ? v.trashList : [];
          resolve(v);
        };
        r.onerror = () => resolve({ dataList: [], trashList: [] });
      });
    },

    async save(state) {
      return new Promise((resolve, reject) => {
        const payload = {
          dataList: state.dataList,
          trashList: state.trashList,
          savedAt: new Date().toLocaleString()
        };
        const r = tx('readwrite').put(payload, STATE_KEY);
        r.onsuccess = () => resolve(true);
        r.onerror = () => reject(r.error);
      });
    },

    async clear() {
      return new Promise((resolve) => {
        const r = tx('readwrite').clear();
        r.onsuccess = () => resolve(true);
      });
    }
  };
})();
