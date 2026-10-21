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

  function compile(code) {
    const factory = new Function("ImGui", code + "\nreturn typeof frame === \"function\" ? frame : null;");
    return factory(api);
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
    ts.javascriptDefaults.addExtraLib("declare const ImGui: typeof import(\"imgui-js\");\n", "file:///typings/globals.d.ts");
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
        value: storageGet(STORAGE_CODE) || EXAMPLES[DEFAULT_EXAMPLE],
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

  new ResizeObserver(function () {
    $("size").textContent = canvas.clientWidth + " × " + canvas.clientHeight;
  }).observe(canvas);

  setupSplitter();
  startImGui().then(function () {
    setStatus("ok", "ImGui ready");
    startEditor();
  }).catch(function (e) {
    setStatus("error", "Failed to start ImGui: " + e.message);
    console.error(e);
  });
})();
