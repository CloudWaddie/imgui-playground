// ImGui Playground: Monaco editor on the left, Dear ImGui (WASM) canvas on the right.
// Code in the editor is compiled on every change and swapped into the running loop.
(function () {
  const IMGUI_BASE = "https://flyover.github.io/imgui-js/";
  const MONACO_BASE = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs";
  const STORAGE_CODE = "imgui-playground.code";
  const STORAGE_SPLIT = "imgui-playground.split";
  // new Function() puts the body after two header lines: "function anonymous(ImGui" and ") {".
  const FUNCTION_LINE_OFFSET = 2;

  const EXAMPLES = {
    "Draw lists": `// frame() runs every frame. Edits hot-reload as you type.
// Top-level code runs once per apply, so these variables reset when you edit.

let clicks = 0;

function frame() {
  // Background draw list: behind every window, covers the whole canvas.
  const bg = ImGui.GetBackgroundDrawList();
  const size = ImGui.GetIO().DisplaySize;
  const t = ImGui.GetTime();
  for (let i = 0; i < 12; i++) {
    const x = size.x * (i + 0.5) / 12;
    const y = size.y * 0.5 + Math.sin(t * 2 + i * 0.6) * 120;
    bg.AddCircleFilled(new ImGui.Vec2(x, y), 14, ImGui.IM_COL32(66, 150, 250, 60 + i * 15));
  }

  ImGui.SetNextWindowPos(new ImGui.Vec2(40, 40), ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize(new ImGui.Vec2(380, 260), ImGui.Cond.FirstUseEver);
  ImGui.Begin("Draw lists");
  ImGui.Text("Clicks: " + clicks);
  ImGui.SameLine();
  if (ImGui.Button("Click me")) clicks++;

  // Window draw list: inside this window, clipped to it.
  const dl = ImGui.GetWindowDrawList();
  const p = ImGui.GetCursorScreenPos();
  const avail = ImGui.GetContentRegionAvail();
  const h = Math.max(avail.y, 80);

  dl.AddRectFilled(p, new ImGui.Vec2(p.x + avail.x, p.y + h), ImGui.IM_COL32(24, 26, 34, 255), 6);
  dl.AddLine(new ImGui.Vec2(p.x, p.y + h / 2), new ImGui.Vec2(p.x + avail.x, p.y + h / 2), ImGui.IM_COL32(255, 255, 255, 30), 1);

  // A sine wave built as a path.
  for (let x = 0; x <= avail.x; x += 3) {
    dl.PathLineTo(new ImGui.Vec2(p.x + x, p.y + h / 2 + Math.sin(x * 0.03 + t * 3) * h * 0.3));
  }
  dl.PathStroke(ImGui.IM_COL32(255, 196, 80, 255), 0, 2);

  dl.AddText(new ImGui.Vec2(p.x + 8, p.y + 6), ImGui.IM_COL32(160, 166, 180, 255), "sin(x + t)");

  ImGui.Dummy(new ImGui.Vec2(avail.x, h)); // claim the space so later widgets go below
  ImGui.End();
}
`,
    "Widgets": `let speed = 0.5;
let count = 8;
let color = [0.26, 0.59, 0.98];
let mode = 0;
let enabled = true;
const history = [];

function frame() {
  ImGui.SetNextWindowPos(new ImGui.Vec2(40, 40), ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize(new ImGui.Vec2(360, 300), ImGui.Cond.FirstUseEver);
  ImGui.Begin("Widgets");

  // Widgets that edit a value take an accessor: (v = current) => current = v
  ImGui.Checkbox("Enabled", (v = enabled) => enabled = v);
  ImGui.SliderFloat("Speed", (v = speed) => speed = v, 0, 2);
  ImGui.SliderInt("Count", (v = count) => count = v, 1, 32);
  ImGui.Combo("Mode", (v = mode) => mode = v, ["Linear", "Ease in", "Ease out"]);
  ImGui.ColorEdit3("Color", color);

  ImGui.Separator();

  const t = enabled ? (ImGui.GetTime() * speed) % 1 : 0;
  ImGui.ProgressBar(t, new ImGui.Vec2(-1, 0));

  history.push(Math.sin(ImGui.GetTime() * speed * 4));
  if (history.length > 90) history.shift();
  ImGui.PlotLines("Signal", history, history.length, 0, null, -1, 1, new ImGui.Vec2(0, 60));

  ImGui.End();
}
`,
    "Demo window": `// The Dear ImGui demo (imgui_demo.cpp, ported to JS by imgui-js).
// Browse it to see what's possible; C++ calls map almost 1:1 to JS.
// Where C++ takes &var, JS takes an accessor: (v = show) => show = v
let show = true;

function frame() {
  if (show) {
    ImGui.ShowDemoWindow((v = show) => show = v);
  } else {
    ImGui.Begin("Demo closed", null, ImGui.WindowFlags.AlwaysAutoResize);
    if (ImGui.Button("Reopen demo")) show = true;
    ImGui.End();
  }
}
`,
    "Assets": `// Uses the sample assets that ship with the playground (open Assets to see them).
// Upload your own and change the names below. Fonts load at the top level only:
// Dear ImGui 1.80 bakes each font size up front.
const heading = assets.font("Roboto-Medium.ttf", 30);
const body = assets.font("Roboto-Medium.ttf", 16);
const mono = assets.font("Cousine-Regular.ttf", 14);
const badge = assets.image("badge.svg");

const tint = [1, 1, 1, 1];
let spinning = true;
let angle = 0;

function frame() {
  ImGui.SetNextWindowPos(new ImGui.Vec2(40, 40), ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize(new ImGui.Vec2(440, 470), ImGui.Cond.FirstUseEver);
  ImGui.Begin("Assets");
  ImGui.PushFont(body);

  ImGui.PushFont(heading);
  ImGui.Text("Fonts & images");
  ImGui.PopFont();
  ImGui.TextWrapped("Roboto for UI text, Cousine for code, and one SVG drawn three ways.");
  ImGui.Spacing();

  // 1. As a widget, tinted.
  ImGui.Image(badge.id, new ImGui.Vec2(64, 64), new ImGui.Vec2(0, 0), new ImGui.Vec2(1, 1),
    new ImGui.Vec4(tint[0], tint[1], tint[2], tint[3]));
  ImGui.SameLine();

  // 2. As a button.
  if (ImGui.ImageButton(badge.id, new ImGui.Vec2(56, 56))) spinning = !spinning;
  ImGui.SameLine();
  ImGui.TextDisabled(spinning ? "click to stop" : "click to spin");

  ImGui.ColorEdit4("Tint", tint);

  // 3. In a draw list, as a rotating quad.
  angle += ImGui.GetIO().DeltaTime * (spinning ? 1.5 : 0);
  const dl = ImGui.GetWindowDrawList();
  const p = ImGui.GetCursorScreenPos();
  const w = ImGui.GetContentRegionAvail().x;
  const box = 150;
  const c = new ImGui.Vec2(p.x + w / 2, p.y + box / 2);
  const r = box * 0.32 * Math.SQRT2;
  // Corners in UV order: top-left, top-right, bottom-right, bottom-left.
  const corner = (k) => {
    const a = angle + Math.PI * (k / 2 - 0.75);
    return new ImGui.Vec2(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
  };
  dl.AddRectFilled(p, new ImGui.Vec2(p.x + w, p.y + box), ImGui.IM_COL32(14, 15, 18, 255), 6);
  dl.AddImageQuad(badge.id, corner(0), corner(1), corner(2), corner(3));
  ImGui.Dummy(new ImGui.Vec2(w, box));

  ImGui.PushFont(mono);
  ImGui.TextColored(new ImGui.Vec4(0.64, 0.66, 0.71, 1), 'const badge = assets.image("badge.svg");');
  ImGui.TextColored(new ImGui.Vec4(0.64, 0.66, 0.71, 1), "dl.AddImageQuad(badge.id, a, b, c, d);");
  ImGui.PopFont();

  ImGui.PopFont();
  ImGui.End();
}
`,
    "Blank": `function frame() {
  ImGui.Begin("Hello");
  ImGui.Text("Start here.");
  ImGui.End();
}
`,
  };
  const DEFAULT_EXAMPLE = "Draw lists";

  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");
  const statusText = $("status-text");
  const canvas = document.createElement("canvas");
  canvas.tabIndex = 1;
  $("output").appendChild(canvas);

  let editor = null;
  let currentFrame = null;
  let applyTimer = null;
  let lastRuntimeError = null;

  function setStatus(kind, text) {
    statusEl.dataset.kind = kind;
    statusText.textContent = text;
  }

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* blocked storage: run without persistence */ }
  }

  // User code gets an ImGui that tracks Begin/End pairs, so a throw mid-window
  // can be unwound instead of tripping Dear ImGui's "missing End()" assert.
  const openScopes = [];
  const api = Object.create(ImGui);
  [["Begin", "End"], ["BeginChild", "EndChild"], ["BeginGroup", "EndGroup"]].forEach(function (pair) {
    const begin = pair[0], end = pair[1];
    api[begin] = function () {
      openScopes.push(end);
      return ImGui[begin].apply(ImGui, arguments);
    };
    api[end] = function () {
      openScopes.pop();
      return ImGui[end].apply(ImGui, arguments);
    };
  });

  // The native ShowDemoWindow is compiled out, so route it to flyover's port of imgui_demo.cpp.
  // Accepts an accessor (v = open) => open = v, a [bool] array, or nothing.
  api.ShowDemoWindow = function (p_open) {
    if (Array.isArray(p_open)) {
      const box = p_open;
      p_open = (v = box[0]) => box[0] = v;
    }
    return ImGui_Demo.ShowDemoWindow(p_open || null);
  };

  function unwindScopes() {
    while (openScopes.length) ImGui[openScopes.pop()]();
  }

  const assets = createPlaygroundAssets(function () {
    renderAssetList();
    apply();
  });

  function compile(code) {
    const factory = new Function("ImGui", "assets", code + "\nreturn typeof frame === \"function\" ? frame : null;");
    return factory(api, assets.api);
  }

  function setErrorMarker(error) {
    if (!editor) return;
    const markers = [];
    const match = /<anonymous>:(\d+):(\d+)/.exec(error && error.stack || "");
    if (match) {
      const line = Number(match[1]) - FUNCTION_LINE_OFFSET;
      const model = editor.getModel();
      if (line >= 1 && line <= model.getLineCount()) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: error.message,
          startLineNumber: line,
          startColumn: Number(match[2]),
          endLineNumber: line,
          endColumn: model.getLineMaxColumn(line),
        });
      }
    }
    monaco.editor.setModelMarkers(editor.getModel(), "runtime", markers);
    return match ? Number(match[1]) - FUNCTION_LINE_OFFSET : null;
  }

  function apply() {
    if (!editor) return;
    clearTimeout(applyTimer);
    const code = editor.getValue();
    try {
      openScopes.length = 0;
      const next = compile(code);
      monaco.editor.setModelMarkers(editor.getModel(), "runtime", []);
      storageSet(STORAGE_CODE, code);
      lastRuntimeError = null;
      if (next) {
        currentFrame = next;
        setStatus("ok", "Applied · " + new Date().toLocaleTimeString());
      } else {
        setStatus("warn", "Define a function named frame() to draw something");
      }
    } catch (e) {
      // Keep the last working frame running; just report.
      const line = e instanceof SyntaxError ? null : setErrorMarker(e);
      setStatus("error", (e instanceof SyntaxError ? "Syntax error: " : "Error: ") + e.message + (line ? "  (line " + line + ")" : ""));
    } finally {
      // Top-level assets.font() calls may have grown the atlas, even if compile then failed.
      assets.flush();
    }
  }

  function scheduleApply() {
    if (!$("live").checked) return;
    clearTimeout(applyTimer);
    applyTimer = setTimeout(apply, 250);
  }

  function loop(time) {
    requestAnimationFrame(loop);
    ImGui_Impl.NewFrame(time);
    ImGui.NewFrame();

    if (currentFrame) {
      assets.setInFrame(true);
      try {
        currentFrame();
      } catch (e) {
        unwindScopes();
        // Report each distinct error once, not every frame.
        const key = e.message;
        if (key !== lastRuntimeError) {
          lastRuntimeError = key;
          const line = setErrorMarker(e);
          setStatus("error", "Runtime error: " + e.message + (line ? "  (line " + line + ")" : ""));
        }
      } finally {
        assets.setInFrame(false);
      }
    }

    ImGui.Render();
    const gl = ImGui_Impl.gl;
    if (gl) {
      // Transparent clear so the preview pane's grid shows through.
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
  }

  async function startImGui() {
    await ImGui.default();
    ImGui.CHECKVERSION();
    ImGui.CreateContext();
    ImGui.StyleColorsDark();
    const style = ImGui.GetStyle();
    style.WindowRounding = 6;
    style.FrameRounding = 4;
    style.GrabRounding = 4;
    // Our own context with alpha, so the transparent clear in loop() shows the pane's grid
    // (the impl would create one with alpha: false).
    ImGui_Impl.Init(canvas.getContext("webgl2", { alpha: true }) || canvas.getContext("webgl", { alpha: true }) || canvas);
    requestAnimationFrame(loop);

    setInterval(function () {
      $("fps").textContent = ImGui.GetIO().Framerate.toFixed(0) + " fps";
    }, 500);
  }

  // Monaco gets the real imgui-js typings so ImGui.* autocompletes.
  async function loadTypings() {
    const fetchText = (path) => fetch(IMGUI_BASE + path).then((r) => {
      if (!r.ok) throw new Error(path + " " + r.status);
      return r.text();
    });
    const [emscripten, bind, imgui] = await Promise.all([
      fetchText("build/emscripten.d.ts"),
      fetchText("build/bind-imgui.d.ts"),
      fetchText("build/imgui.d.ts"),
    ]);
    // Wrap each file as an ambient module; "declare" is implied inside one.
    const wrap = (name, text) => "declare module \"" + name + "\" {\n" +
      text.replace(/^(\s*)(export )?declare /gm, "$1$2") + "\n}\n";
    const ts = monaco.languages.typescript;
    ts.javascriptDefaults.addExtraLib(wrap("imgui-emscripten", emscripten), "file:///typings/emscripten.d.ts");
    ts.javascriptDefaults.addExtraLib(wrap("bind-imgui", bind.replace(/"\.\/emscripten"/g, "\"imgui-emscripten\"")), "file:///typings/bind-imgui.d.ts");
    ts.javascriptDefaults.addExtraLib(wrap("imgui-js", imgui), "file:///typings/imgui.d.ts");
    ts.javascriptDefaults.addExtraLib([
      "declare const ImGui: typeof import(\"imgui-js\");",
      "interface PlaygroundImage {",
      "  /** Texture id for ImGui.Image / ImageButton / DrawList.AddImage. */",
      "  id: WebGLTexture;",
      "  width: number;",
      "  height: number;",
      "  /** Natural size, ready to pass as the size argument. */",
      "  size: import(\"imgui-js\").Vec2;",
      "}",
      "/** Fonts and images uploaded from the Assets panel. */",
      "declare const assets: {",
      "  /** An uploaded .ttf/.otf baked at a pixel size (6-128). Call at the top level, not inside frame(). */",
      "  font(name: string, size?: number): import(\"imgui-js\").Font;",
      "  /** An uploaded image. Safe to call anywhere. */",
      "  image(name: string): PlaygroundImage;",
      "  has(name: string): boolean;",
      "  /** Names of uploaded fonts. */",
      "  fonts(): string[];",
      "  /** Names of uploaded images. */",
      "  images(): string[];",
      "};",
    ].join("\n"), "file:///typings/globals.d.ts");
  }

  // index.html#example=Assets opens that example instead of the saved code.
  function linkedExample() {
    const match = /^#example=(.+)$/.exec(location.hash);
    return match ? EXAMPLES[decodeURIComponent(match[1])] || null : null;
  }

  function startEditor() {
    require.config({ paths: { vs: MONACO_BASE } });
    require(["vs/editor/editor.main"], function () {
      monaco.editor.defineTheme("playground", {
        base: "vs-dark",
        inherit: true,
        rules: [{ token: "comment", foreground: "6b7280", fontStyle: "italic" }],
        colors: {
          "editor.background": "#131418",
          "editorGutter.background": "#131418",
          "editor.lineHighlightBackground": "#1a1c21",
          "editor.lineHighlightBorder": "#1a1c21",
          "editorLineNumber.foreground": "#454a56",
          "editorLineNumber.activeForeground": "#a3a8b4",
          "editorCursor.foreground": "#4296fa",
          "editor.selectionBackground": "#4296fa40",
          "editorIndentGuide.background1": "#22252c",
          "editorWidget.background": "#1a1c21",
          "editorWidget.border": "#2c2f37",
          "editorSuggestWidget.background": "#1a1c21",
          "editorSuggestWidget.border": "#2c2f37",
          "editorSuggestWidget.selectedBackground": "#23324a",
          "scrollbarSlider.background": "#ffffff12",
          "scrollbarSlider.hoverBackground": "#ffffff22",
        },
      });

      editor = monaco.editor.create($("editor"), {
        value: linkedExample() || storageGet(STORAGE_CODE) || EXAMPLES[DEFAULT_EXAMPLE],
        language: "javascript",
        theme: "playground",
        automaticLayout: true,
        minimap: { enabled: false },
        fontFamily: "\"JetBrains Mono\", ui-monospace, Consolas, monospace",
        fontSize: 13,
        lineHeight: 20,
        tabSize: 2,
        padding: { top: 12 },
        scrollBeyondLastLine: false,
        renderLineHighlight: "all",
        smoothScrolling: true,
        cursorBlinking: "smooth",
      });
      // The webfont may arrive after Monaco measured the fallback font.
      document.fonts.ready.then(() => monaco.editor.remeasureFonts());

      editor.onDidChangeModelContent(scheduleApply);
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, apply);

      $("apply").onclick = apply;
      $("reset").onclick = () => editor.setValue(EXAMPLES[DEFAULT_EXAMPLE]);
      $("live").onchange = (e) => { if (e.target.checked) apply(); };

      const picker = $("examples");
      Object.keys(EXAMPLES).forEach(function (name) {
        picker.appendChild(new Option(name, name));
      });
      picker.onchange = function () {
        editor.setValue(EXAMPLES[picker.value]);
        apply();
        picker.selectedIndex = 0;
        editor.focus();
      };

      apply();
      loadTypings().catch((e) => console.warn("ImGui typings unavailable:", e));
    });
  }

  function setupSplitter() {
    const workspace = $("workspace");
    const divider = $("divider");
    const saved = storageGet(STORAGE_SPLIT);
    if (saved) workspace.style.setProperty("--split", saved);

    divider.addEventListener("pointerdown", function (e) {
      divider.setPointerCapture(e.pointerId);
      divider.classList.add("dragging");
      document.body.classList.add("resizing");
    });
    divider.addEventListener("pointermove", function (e) {
      if (!divider.hasPointerCapture(e.pointerId)) return;
      const rect = workspace.getBoundingClientRect();
      const pct = Math.min(80, Math.max(20, (e.clientX - rect.left) / rect.width * 100));
      workspace.style.setProperty("--split", pct.toFixed(2) + "%");
    });
    divider.addEventListener("lostpointercapture", function () {
      divider.classList.remove("dragging");
      document.body.classList.remove("resizing");
      storageSet(STORAGE_SPLIT, workspace.style.getPropertyValue("--split"));
    });
  }

  // --- Assets panel ---

  function formatBytes(n) {
    return n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + " KB" : (n / 1024 / 1024).toFixed(1) + " MB";
  }

  // "My Font-Bold.ttf" -> "myFontBold"
  function varName(fileName, fallback) {
    const words = fileName.replace(/\.[^.]+$/, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
    let name = words.map((w, i) => i ? w[0].toUpperCase() + w.slice(1) : w.toLowerCase()).join("");
    if (!name || /^[0-9]/.test(name)) name = fallback;
    return name;
  }

  function snippetFor(entry) {
    const quoted = JSON.stringify(entry.name);
    return entry.kind === "font"
      ? "const " + varName(entry.name, "font") + " = assets.font(" + quoted + ", 18);\n"
      : "const " + varName(entry.name, "image") + " = assets.image(" + quoted + ");\n";
  }

  function insertSnippet(entry) {
    if (!editor) return;
    const text = snippetFor(entry);
    // Fonts must be loaded at the top level, so they go above frame(); images go at the cursor.
    const model = editor.getModel();
    let position = editor.getPosition();
    if (entry.kind === "font") {
      const match = model.findNextMatch("function frame", { lineNumber: 1, column: 1 }, false, true, null, false);
      position = match ? { lineNumber: match.range.startLineNumber, column: 1 } : { lineNumber: 1, column: 1 };
    } else {
      position = { lineNumber: position.lineNumber, column: 1 };
    }
    editor.executeEdits("assets", [{
      range: new monaco.Range(position.lineNumber, 1, position.lineNumber, 1),
      text: text,
    }]);
    editor.focus();
    $("assets-panel").hidePopover();
  }

  function renderAssetList() {
    const items = assets.list();
    const listEl = $("asset-list");
    listEl.replaceChildren();
    $("asset-empty").hidden = items.length > 0;
    $("asset-count").textContent = items.length ? String(items.length) : "";

    items.forEach(function (entry) {
      const li = document.createElement("li");

      const preview = document.createElement("div");
      preview.className = "preview";
      if (entry.kind === "image") {
        const img = document.createElement("img");
        img.src = entry.previewUrl;
        img.alt = "";
        preview.appendChild(img);
      } else {
        preview.textContent = "Aa";
        if (entry.previewFamily) preview.style.fontFamily = "\"" + entry.previewFamily + "\"";
      }

      const info = document.createElement("div");
      info.className = "info";
      const name = document.createElement("b");
      name.textContent = entry.name;
      name.title = entry.name;
      const meta = document.createElement("span");
      meta.textContent = (entry.kind === "font"
        ? "Font · " + formatBytes(entry.bytes.byteLength)
        : "Image · " + entry.width + " × " + entry.height) + (entry.sample ? " · sample" : "");
      info.append(name, meta);

      const insert = document.createElement("button");
      insert.className = "control";
      insert.textContent = "Insert";
      insert.title = "Insert " + snippetFor(entry).trim();
      insert.onclick = () => insertSnippet(entry);

      const remove = document.createElement("button");
      remove.className = "control icon";
      remove.setAttribute("aria-label", "Remove " + entry.name);
      remove.title = "Remove";
      remove.innerHTML = "<svg width=\"12\" height=\"12\" viewBox=\"0 0 12 12\" aria-hidden=\"true\"><path d=\"M2.5 2.5l7 7m0-7l-7 7\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>";
      remove.onclick = () => assets.remove(entry.name);

      if (entry.sample) remove.style.visibility = "hidden";
      li.append(preview, info, insert, remove);
      listEl.appendChild(li);
    });
  }

  async function addFiles(files) {
    for (const file of Array.from(files)) {
      try {
        const entry = await assets.add(file);
        setStatus("ok", "Added " + entry.kind + " " + entry.name);
      } catch (e) {
        setStatus("error", e.message);
      }
    }
  }

  function setupAssets() {
    const input = $("asset-file");
    input.onchange = function () {
      addFiles(input.files);
      input.value = "";
    };

    // Drop files anywhere on the page.
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    window.addEventListener("dragenter", function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      document.body.classList.add("dropping");
    });
    window.addEventListener("dragover", function (e) {
      if (hasFiles(e)) e.preventDefault();
    });
    window.addEventListener("dragleave", function (e) {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) document.body.classList.remove("dropping");
    });
    window.addEventListener("drop", function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      document.body.classList.remove("dropping");
      addFiles(e.dataTransfer.files);
    });
  }

  new ResizeObserver(function () {
    $("size").textContent = canvas.clientWidth + " × " + canvas.clientHeight;
  }).observe(canvas);

  setupSplitter();
  setupAssets();
  startImGui().then(async function () {
    // Textures need the GL context, so stored assets load after ImGui starts.
    await assets.load();
    await assets.loadSamples(["samples/Roboto-Medium.ttf", "samples/Cousine-Regular.ttf", "samples/badge.svg"]);
    renderAssetList();
    setStatus("ok", "ImGui ready");
    startEditor();
  }).catch(function (e) {
    setStatus("error", "Failed to start ImGui: " + e.message);
    console.error(e);
  });
})();
