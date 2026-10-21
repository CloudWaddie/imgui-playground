// Uploaded fonts and images. Kept in IndexedDB so they survive reloads,
// and exposed to user code as the `assets` object.
window.createPlaygroundAssets = function (jsimgui, gl, onChange) {
  const { ImGui, ImGuiImplWeb, ImVec2, ImFont } = jsimgui;
  const DB_NAME = "imgui-playground";
  const STORE = "assets";
  const FONT_EXT = /\.(ttf|otf|ttc)$/i;

  const entries = new Map(); // name -> { name, kind, type, bytes, sample?, font? | texture, ref, width, height, size, previewUrl }

  // --- persistence (best effort: blocked storage just means no persistence) ---

  // Some browsers (headless, locked-down profiles) never answer indexedDB.open; don't hang startup on it.
  const DB_TIMEOUT_MS = 3000;

  let dbPromise = null;
  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        const timer = setTimeout(() => reject(new Error("IndexedDB didn't respond")), DB_TIMEOUT_MS);
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "name" });
        req.onsuccess = () => { clearTimeout(timer); resolve(req.result); };
        req.onerror = () => { clearTimeout(timer); reject(req.error); };
        req.onblocked = () => { clearTimeout(timer); reject(new Error("IndexedDB is blocked by another tab")); };
      });
    }
    return dbPromise;
  }

  async function dbRun(mode, fn) {
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  function persist(fn) {
    dbRun("readwrite", fn).catch((e) => console.warn("Asset storage unavailable:", e));
  }

  // --- decoding ---

  function checkFont(bytes, name) {
    const tag = new TextDecoder("latin1").decode(new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength)));
    if (tag === "wOFF" || tag === "wOF2") {
      throw new Error(name + " is a web font (WOFF). Dear ImGui needs the .ttf or .otf version.");
    }
    if (!["\x00\x01\x00\x00", "OTTO", "true", "ttcf"].includes(tag)) {
      throw new Error(name + " doesn't look like a TrueType/OpenType font.");
    }
  }

  async function decodeImage(bytes, type) {
    const url = URL.createObjectURL(new Blob([bytes], { type: type }));
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
    return { img: img, url: url };
  }

  function uploadTexture(img) {
    // SVGs without a width/height attribute report 0; give them a usable size.
    const width = img.naturalWidth || 256;
    const height = img.naturalHeight || 256;
    let source = img;
    if (!img.naturalWidth || !img.naturalHeight) {
      source = document.createElement("canvas");
      source.width = width;
      source.height = height;
      source.getContext("2d").drawImage(img, 0, 0, width, height);
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Clamp + linear so non-power-of-two images work on WebGL1 too.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { texture: texture, ref: ImGuiImplWeb.RegisterTexture(texture), width: width, height: height };
  }

  let fontSerial = 0;

  // Runs outside the render loop (uploads, startup), so adding to the font atlas is safe.
  async function materialize(record) {
    const entry = Object.assign({}, record);
    if (entry.kind === "font") {
      checkFont(entry.bytes, entry.name);
      // A unique virtual file per load, so re-uploading a name never clobbers a font still in use.
      const file = "font-" + (++fontSerial) + "-" + entry.name.replace(/[^A-Za-z0-9._-]/g, "_");
      ImGuiImplWeb.LoadFont(file, new Uint8Array(entry.bytes.slice(0)));
      const font = ImGui.GetIO().Fonts.AddFontFromFileTTF(file);
      // jsimgui 0.14 returns the raw native object here instead of an ImFont, and PushFont
      // then silently ignores it; wrap it so it behaves like every other ImFont.
      entry.font = font instanceof ImFont ? font : ImFont.From(font);
      try {
        // Lets the panel preview the face; ImGui itself uses the raw bytes.
        const face = new FontFace("asset-" + fontSerial, entry.bytes.slice(0));
        await face.load();
        document.fonts.add(face);
        entry.previewFamily = face.family;
      } catch (e) {
        entry.previewFamily = null;
      }
    } else {
      const decoded = await decodeImage(entry.bytes, entry.type);
      Object.assign(entry, uploadTexture(decoded.img));
      entry.previewUrl = decoded.url;
      entry.size = new ImVec2(entry.width, entry.height);
    }
    return entry;
  }

  function release(entry) {
    if (!entry) return;
    // Fonts stay in the atlas and textures stay alive: the last working frame() may still be
    // drawing with them until the edited code compiles. Only the preview URL is ours to free.
    if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
  }

  function kindOf(file) {
    if (FONT_EXT.test(file.name)) return "font";
    if (file.type.startsWith("image/")) return "image";
    return null;
  }

  // --- the object user code sees ---

  function need(name, kind) {
    const entry = entries.get(name);
    if (!entry || entry.kind !== kind) {
      throw new Error("No " + kind + " named \"" + name + "\". Upload it from Assets.");
    }
    return entry;
  }

  const api = {
    font(name) {
      return need(name, "font").font;
    },
    image(name) {
      const entry = need(name, "image");
      return { ref: entry.ref, width: entry.width, height: entry.height, size: entry.size };
    },
    has(name) {
      return entries.has(name);
    },
    fonts() {
      return list().filter((e) => e.kind === "font").map((e) => e.name);
    },
    images() {
      return list().filter((e) => e.kind === "image").map((e) => e.name);
    },
  };

  function list() {
    return Array.from(entries.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async function add(file) {
    const kind = kindOf(file);
    if (!kind) throw new Error(file.name + " isn't a .ttf/.otf font or an image.");
    const record = { name: file.name, kind: kind, type: file.type, bytes: await file.arrayBuffer() };
    const entry = await materialize(record);
    release(entries.get(file.name));
    entries.set(file.name, entry);
    persist((store) => store.put(record));
    onChange();
    return entry;
  }

  function remove(name) {
    release(entries.get(name));
    entries.delete(name);
    persist((store) => store.delete(name));
    onChange();
  }

  // Samples ship with the site. They're fetched every load, never persisted, and can't be removed.
  async function loadSamples(urls) {
    await Promise.all(urls.map(async function (url) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(response.status + " " + response.statusText);
        const name = url.split("/").pop();
        const record = { name: name, kind: FONT_EXT.test(name) ? "font" : "image", type: response.headers.get("content-type") || "", bytes: await response.arrayBuffer() };
        // A user upload with the same name wins.
        if (!entries.has(name)) entries.set(name, Object.assign(await materialize(record), { sample: true }));
      } catch (e) {
        // Expected when the page is opened from file://, where fetch is blocked.
        console.warn("Sample asset unavailable: " + url, e);
      }
    }));
  }

  async function load() {
    let records = [];
    try {
      records = await dbRun("readonly", (store) => store.getAll());
    } catch (e) {
      console.warn("Asset storage unavailable:", e);
    }
    for (const record of records) {
      try {
        release(entries.get(record.name)); // replaces a sample of the same name
        entries.set(record.name, await materialize(record));
      } catch (e) {
        console.warn("Skipping stored asset " + record.name + ":", e);
      }
    }
  }

  return {
    api: api,
    add: add,
    remove: remove,
    list: list,
    load: load,
    loadSamples: loadSamples,
  };
};
