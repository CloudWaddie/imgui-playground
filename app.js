// ImGui Playground: Monaco editor on the left, Dear ImGui (via jsimgui) on a canvas on the right.
// Code in the editor is compiled on every change and swapped into the running loop.
(function () {
  const jsimgui = window.JSIMGUI; // the jsimgui module, imported by the loader in index.html
  const { ImGui, ImGuiImplWeb } = jsimgui;
  const IMGUI_TYPES = window.IMGUI_JS.types;
  const MONACO_BASE = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs";
  const STORAGE_CODE = "imgui-playground.code.v2"; // v2: jsimgui syntax; v1 held imgui-js code
  const STORAGE_SPLIT = "imgui-playground.split";
  const STORAGE_INI = "imgui-playground.ini";
  // new Function() puts the body after two header lines: "function anonymous(ImGui,..." and ") {".
  const FUNCTION_LINE_OFFSET = 2;

  // Backend plumbing and extensions that aren't initialized; everything else jsimgui exports
  // starting with "Im" is a global in user code, like in C++ (ImVec2, ImGuiCond, ImGuiWindowFlags...).
  const HIDDEN = new Set(["ImGuiImplWeb", "ImGuiImplOpenGL3", "ImGuiImplWGPU", "ImGuiDockNodeFlags"]);
  const GLOBAL_NAMES = Object.keys(jsimgui).filter((n) => /^Im/.test(n) && !HIDDEN.has(n) && !/^Im(Nodes|Plot)/.test(n));

  // jsimgui is built from Dear ImGui's docking branch; the playground follows master, where these don't exist.
  const DOCKING = ["DockSpace", "DockSpaceOverViewport", "SetNextWindowDockID", "SetNextWindowClass", "GetWindowDockID", "IsWindowDocked"];

  // C++'s IM_COL32 macro: 8-bit RGBA packed as ImU32 (ABGR).
  function IM_COL32(r, g, b, a) {
    return (((a === undefined ? 255 : a) << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }

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
    bg.AddCircleFilled(new ImVec2(x, y), 14, IM_COL32(66, 150, 250, 60 + i * 15));
  }

  ImGui.SetNextWindowPos(new ImVec2(40, 40), ImGuiCond.FirstUseEver);
  ImGui.SetNextWindowSize(new ImVec2(380, 260), ImGuiCond.FirstUseEver);
  ImGui.Begin("Draw lists");
  ImGui.Text("Clicks: " + clicks);
  ImGui.SameLine();
  if (ImGui.Button("Click me")) clicks++;

  // Window draw list: inside this window, clipped to it.
  const dl = ImGui.GetWindowDrawList();
  const p = ImGui.GetCursorScreenPos();
  const avail = ImGui.GetContentRegionAvail();
  const h = Math.max(avail.y, 80);

  dl.AddRectFilled(p, new ImVec2(p.x + avail.x, p.y + h), IM_COL32(24, 26, 34, 255), 6);
  dl.AddLine(new ImVec2(p.x, p.y + h / 2), new ImVec2(p.x + avail.x, p.y + h / 2), IM_COL32(255, 255, 255, 30), 1);

  // A sine wave built as a path.
  for (let x = 0; x <= avail.x; x += 3) {
    dl.PathLineTo(new ImVec2(p.x + x, p.y + h / 2 + Math.sin(x * 0.03 + t * 3) * h * 0.3));
  }
  dl.PathStroke(IM_COL32(255, 196, 80, 255), 2); // (col, thickness, flags) since Dear ImGui 1.92.8

  // Shapes added in recent Dear ImGui versions.
  dl.AddEllipse(new ImVec2(p.x + avail.x - 40, p.y + 30), new ImVec2(26, 14), IM_COL32(120, 220, 160, 255), t, 0, 2);

  dl.AddText(new ImVec2(p.x + 8, p.y + 6), IM_COL32(160, 166, 180, 255), "sin(x + t)");

  ImGui.Dummy(new ImVec2(avail.x, h)); // claim the space so later widgets go below
  ImGui.End();
}
`,
    "Widgets": `// Where C++ takes a pointer (&value), pass a one-element array: [value].
// Widgets edit it in place, so read it back as value[0].
const enabled = [true];
const speed = [0.5];
const count = [8];
const mode = [0];
const color = [0.26, 0.59, 0.98];
const history = [];

function frame() {
  ImGui.SetNextWindowPos(new ImVec2(40, 40), ImGuiCond.FirstUseEver);
  ImGui.SetNextWindowSize(new ImVec2(360, 330), ImGuiCond.FirstUseEver);
  ImGui.Begin("Widgets");

  ImGui.Checkbox("Enabled", enabled);
  ImGui.SliderFloat("Speed", speed, 0, 2);
  ImGui.SliderInt("Count", count, 1, 32);
  ImGui.Combo("Mode", mode, "Linear\\0Ease in\\0Ease out\\0");
  ImGui.ColorEdit3("Color", color);

  ImGui.SeparatorText("Output");

  const t = enabled[0] ? (ImGui.GetTime() * speed[0]) % 1 : 0;
  ImGui.ProgressBar(t, new ImVec2(-1, 0));

  history.push(Math.sin(ImGui.GetTime() * speed[0] * 4));
  if (history.length > 90) history.shift();
  ImGui.PlotLines("Signal", history, history.length, 0, "", -1, 1, new ImVec2(0, 60));

  ImGui.BeginDisabled(!enabled[0]);
  ImGui.Button("Only when enabled");
  ImGui.EndDisabled();

  ImGui.End();
}
`,
    "Demo window": `// The Dear ImGui demo (imgui_demo.cpp). Browse it to see what's possible;
// C++ calls map almost 1:1 to JS. Where C++ takes &value, pass [value].
const show = [true];

function frame() {
  if (show[0]) {
    ImGui.ShowDemoWindow(show);
    // The demo places itself for a full-size app (x = 650). Begin() on the same name appends to
    // its window, so we can pull it back into view when it lands off the right edge.
    ImGui.Begin("Dear ImGui Demo");
    if (ImGui.GetWindowPos().x > ImGui.GetIO().DisplaySize.x - 120) {
      ImGui.SetWindowPos(new ImVec2(20, 20));
    }
    ImGui.End();
  } else {
    ImGui.Begin("Demo closed", null, ImGuiWindowFlags.AlwaysAutoResize);
    if (ImGui.Button("Reopen demo")) show[0] = true;
    ImGui.End();
  }
}
`,
    "Assets": `// Uses the sample assets that ship with the playground (open Assets to see them).
// Upload your own and change the names below.
//
//   assets.font(name)               -> ImFont, for ImGui.PushFont(font, size) ... ImGui.PopFont()
//   assets.image(name)              -> { ref, width, height, size }, e.g. ImGui.Image(img.ref, img.size)
//   assets.has(name)                -> boolean
//   assets.fonts(), assets.images() -> string[] of file names

const roboto = assets.font("Roboto-Medium.ttf");
const cousine = assets.font("Cousine-Regular.ttf");
const badge = assets.image("badge.svg");

const headingSize = [30];
const tint = [1, 1, 1, 1];
let spinning = true;
let angle = 0;

function frame() {
  ImGui.SetNextWindowPos(new ImVec2(40, 40), ImGuiCond.FirstUseEver);
  ImGui.SetNextWindowSize(new ImVec2(440, 520), ImGuiCond.FirstUseEver);
  ImGui.Begin("Assets");
  ImGui.PushFont(roboto, 16);

  // Fonts render at any size, even one that changes every frame.
  ImGui.PushFont(roboto, headingSize[0]);
  ImGui.Text("Fonts & images");
  ImGui.PopFont();
  ImGui.SliderFloat("Heading size", headingSize, 10, 72, "%.0f px");
  ImGui.TextWrapped("Roboto for UI text, Cousine for code, and one SVG drawn three ways.");
  ImGui.Spacing();

  // 1. As a widget, tinted.
  ImGui.ImageWithBg(badge.ref, new ImVec2(64, 64), new ImVec2(0, 0), new ImVec2(1, 1),
    new ImVec4(0, 0, 0, 0), new ImVec4(tint[0], tint[1], tint[2], tint[3]));
  ImGui.SameLine();

  // 2. As a button.
  if (ImGui.ImageButton("badge", badge.ref, new ImVec2(56, 56))) spinning = !spinning;
  ImGui.SameLine();
  ImGui.TextDisabled(spinning ? "click to stop" : "click to spin");

  ImGui.ColorEdit4("Tint", tint);

  // 3. In a draw list, as a rotating quad.
  angle += ImGui.GetIO().DeltaTime * (spinning ? 1.5 : 0);
  const dl = ImGui.GetWindowDrawList();
  const p = ImGui.GetCursorScreenPos();
  const w = ImGui.GetContentRegionAvail().x;
  const box = 150;
  const c = new ImVec2(p.x + w / 2, p.y + box / 2);
  const r = box * 0.32 * Math.SQRT2;
  // Corners in UV order: top-left, top-right, bottom-right, bottom-left.
  const corner = (k) => {
    const a = angle + Math.PI * (k / 2 - 0.75);
    return new ImVec2(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
  };
  dl.AddRectFilled(p, new ImVec2(p.x + w, p.y + box), IM_COL32(14, 15, 18, 255), 6);
  dl.AddImageQuad(badge.ref, corner(0), corner(1), corner(2), corner(3));
  ImGui.Dummy(new ImVec2(w, box));

  ImGui.PushFont(cousine, 14);
  ImGui.TextColored(new ImVec4(0.64, 0.66, 0.71, 1), 'const badge = assets.image("badge.svg");');
  ImGui.TextColored(new ImVec4(0.64, 0.66, 0.71, 1), "dl.AddImageQuad(badge.ref, a, b, c, d);");
  ImGui.PopFont();

  ImGui.PopFont();
  ImGui.End();
}
`,
    "Gradient text": `// Recolor text per vertex: note VtxCount, draw, then rewrite the vertices that were added.
// Each glyph is a quad, so setting a vertex's color blends smoothly across the letter.

// Blend two colors: t = 0 gives a, t = 1 gives b. Colors are [r, g, b], 0-255.
function mix(a, b, t) {
  return IM_COL32(
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  );
}

// The /** @param */ line tells the editor what dl is, so dl. autocompletes.
/** @param {ImDrawList} dl */
function gradientText(dl, pos, text, from, to, shift) {
  const first = dl.VtxCount;             // vertices before
  dl.AddText(pos, IM_COL32(255, 255, 255), text);
  const last = dl.VtxCount;              // vertices after

  const width = ImGui.CalcTextSize(text).x;
  for (let i = first; i < last; i++) {
    const x = dl.GetVtxPos(i).x - pos.x;
    // Sweep the gradient along the text; the fractional part makes it wrap around.
    const t = (x / width + shift) % 1;
    const wave = t < 0.5 ? t * 2 : 2 - t * 2; // 0 -> 1 -> 0, so the ends match
    dl.SetVtxColor(i, mix(from, to, wave));
  }
}

// HSV gives a rainbow. ColorConvertHSVtoRGB writes its results into one-element arrays (0 to 1).
/** @param {ImDrawList} dl */
function rainbowText(dl, pos, text, shift) {
  const first = dl.VtxCount;
  dl.AddText(pos, IM_COL32(255, 255, 255), text);
  const width = ImGui.CalcTextSize(text).x;
  const r = [0], g = [0], b = [0];
  for (let i = first; i < dl.VtxCount; i++) {
    const hue = ((((dl.GetVtxPos(i).x - pos.x) / width + shift) % 1) + 1) % 1;
    ImGui.ColorConvertHSVtoRGB(hue, 0.8, 1, r, g, b);
    dl.SetVtxColor(i, IM_COL32(Math.round(r[0] * 255), Math.round(g[0] * 255), Math.round(b[0] * 255)));
  }
}

function frame() {
  const dl = ImGui.GetForegroundDrawList();
  const t = ImGui.GetTime();
  rainbowText(dl, new ImVec2(40, 100), "Rainbow text", t * 0.2);
  gradientText(dl, new ImVec2(40, 40), "Gradient text", [255, 80, 120], [80, 160, 255], t * 0.3);

  // Vertices can move too: this wobbles each letter.
  const first = dl.VtxCount;
  dl.AddText(new ImVec2(40, 70), IM_COL32(255, 220, 120), "Wobbling text");
  for (let i = first; i < dl.VtxCount; i++) {
    const p = dl.GetVtxPos(i);
    dl.SetVtxPos(i, new ImVec2(p.x, p.y + Math.sin(t * 4 + p.x * 0.08) * 4));
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

  let gl = null;
  let assets = null;
  // The canvas's exact size in device pixels, when the browser reports it (see the ResizeObserver).
  let devicePixelSize = null;
  // Both built-in fonts: the pixel font is only sharp at exactly 1:1, the vector one at any scale.
  let defaultFonts = null;
  let usingBitmapFont = null;
  let editor = null;
  let currentFrame = null;
  let applyTimer = null;
  let lastRuntimeError = null;
  // Set when a failed IM_ASSERT aborted the WebAssembly runtime. It can't be restarted in place,
  // so the next apply saves the code and reloads the page.
  let crashed = null;

  // Emscripten aborts with a RuntimeError("Aborted(Assertion failed: ...)").
  function isAbort(e) {
    return e instanceof WebAssembly.RuntimeError || /^Aborted\(/.test(e && e.message || "");
  }

  function onCrash(e) {
    if (crashed) return;
    crashed = e;
    currentFrame = null;
    const detail = String(e.message || e).replace(/^Aborted\(/, "").replace(/\)$/, "");
    const line = setErrorMarker(e);
    setStatus("error", "Dear ImGui crashed: " + detail + (line ? "  (line " + line + ")" : "") + ". Edit the code (or press Reset) and it restarts.");
  }

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

  const api = Object.create(ImGui);

  // C++ overloads that jsimgui exposes under suffixed names (SetWindowPosStr, PushStyleColorImVec4...).
  // Route by argument type so C++-style calls work as written.
  const isStr = (v) => typeof v === "string";
  const isNum = (v) => typeof v === "number";
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const OVERLOADS = {
    SetWindowPos: [(a) => isStr(a[0]), "SetWindowPosStr"],
    SetWindowSize: [(a) => isStr(a[0]), "SetWindowSizeStr"],
    SetWindowCollapsed: [(a) => isStr(a[0]), "SetWindowCollapsedStr"],
    SetWindowFocus: [(a) => isStr(a[0]), "SetWindowFocusStr"],
    PushStyleColor: [(a) => isObj(a[1]), "PushStyleColorImVec4"],
    PushStyleVar: [(a) => isObj(a[1]), "PushStyleVarImVec2"],
    PushID: [(a) => isNum(a[0]), "PushIDInt"],
    GetID: [(a) => isNum(a[0]), "GetIDInt"],
    GetColorU32: [(a) => isObj(a[0]), "GetColorU32ImVec4"],
    OpenPopup: [(a) => isNum(a[0]), "OpenPopupID"],
    BeginChild: [(a) => isNum(a[0]), "BeginChildID"],
    MenuItem: [(a) => Array.isArray(a[2]), "MenuItemBoolPtr"],
    Selectable: [(a) => Array.isArray(a[1]), "SelectableBoolPtr"],
    CollapsingHeader: [(a) => Array.isArray(a[1]), "CollapsingHeaderBoolPtr"],
    RadioButton: [(a) => Array.isArray(a[1]), "RadioButtonIntPtr"],
    CheckboxFlags: [(a) => Array.isArray(a[1]), "CheckboxFlagsIntPtr"],
  };
  function call(name, args) {
    const overload = OVERLOADS[name];
    const target = overload && ImGui[overload[1]] && overload[0](args) ? overload[1] : name;
    return ImGui[target].apply(ImGui, args);
  }
  Object.keys(OVERLOADS).forEach(function (name) {
    api[name] = function () { return call(name, arguments); };
  });

  // User code gets an ImGui that tracks Begin/End pairs, so a throw mid-window
  // can be unwound instead of tripping Dear ImGui's "missing End()" assert.
  const openScopes = [];
  [["Begin", "End"], ["BeginChild", "EndChild"], ["BeginGroup", "EndGroup"]].forEach(function (pair) {
    const begin = pair[0], end = pair[1];
    api[begin] = function () {
      openScopes.push(end);
      return call(begin, arguments);
    };
    api[end] = function () {
      openScopes.pop();
      return ImGui[end].apply(ImGui, arguments);
    };
  });

  // C++'s ImGui::PushFont(font, size); jsimgui names it PushFontFloat. Size 0 keeps the current size.
  api.PushFont = function (font, size) {
    return ImGui.PushFontFloat(font, size || 0);
  };

  DOCKING.forEach(function (name) {
    api[name] = function () {
      throw new Error("ImGui." + name + "() only exists on Dear ImGui's docking branch; this playground follows master.");
    };
  });

  function unwindScopes() {
    while (openScopes.length) ImGui[openScopes.pop()]();
  }

  function compile(code) {
    const names = ["ImGui"].concat(GLOBAL_NAMES.filter((n) => n !== "ImGui"), ["IM_COL32", "assets"]);
    const values = names.map(function (n) {
      if (n === "ImGui") return api;
      if (n === "IM_COL32") return IM_COL32;
      if (n === "assets") return assets.api;
      return jsimgui[n];
    });
    const factory = new Function(...names, code + "\nreturn typeof frame === \"function\" ? frame : null;");
    return factory(...values);
  }

  function setErrorMarker(error) {
    if (!editor) return;
    const markers = [];
    // Only frames from the user's code: new Function() inside compile() shows up as
    // "(eval at compile (app.js:L:C), <anonymous>:line:col)"; other anonymous frames aren't theirs.
    const match = /eval at compile [^\n]*?<anonymous>:(\d+):(\d+)/.exec(error && error.stack || "");
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
    if (crashed) {
      // Restart with the edited code.
      storageSet(STORAGE_CODE, code);
      const url = new URL(location.href);
      url.hash = ""; // a #example= link would replace the edited code
      location.replace(url.toString());
      return;
    }
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
      if (isAbort(e)) return onCrash(e);
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

  function loop() {
    if (crashed) return; // the runtime is gone; apply() reloads
    requestAnimationFrame(loop);
    try {
      renderFrame();
    } catch (e) {
      if (isAbort(e)) onCrash(e);
      else throw e;
    }
  }

  function renderFrame() {
    // Backing store at device resolution; jsimgui derives the framebuffer scale from it. The exact
    // device-pixel size avoids the browser resampling the canvas (a blur) when CSS size * dpr isn't whole.
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, devicePixelSize ? devicePixelSize.w : Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, devicePixelSize ? devicePixelSize.h : Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    // ProggyClean is a pixel font: crisp at exactly 1:1, blurry when scaled (150% Windows scaling,
    // browser zoom). Anywhere else use the scalable default. Re-checked every frame, so zooming switches it.
    const wantBitmap = dpr === 1;
    if (defaultFonts && wantBitmap !== usingBitmapFont) {
      usingBitmapFont = wantBitmap;
      ImGui.GetIO().FontDefault = (wantBitmap ? defaultFonts.bitmap : defaultFonts.vector).ptr;
    }

    ImGuiImplWeb.BeginRender();

    if (currentFrame) {
      try {
        currentFrame();
      } catch (e) {
        if (isAbort(e)) throw e;
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

    // The renderer draws over whatever is there and never clears; clear to transparent so the
    // preview pane's grid shows through.
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    ImGuiImplWeb.EndRender();
  }

  async function startImGui() {
    // Our own context with alpha, so the transparent clear shows the pane's grid.
    // jsimgui's getContext() call then gets this same context back.
    gl = canvas.getContext("webgl2", { alpha: true }) || canvas.getContext("webgl", { alpha: true });
    if (!gl) throw new Error("WebGL isn't available in this browser.");

    // Window positions and sizes survive reloads.
    ImGuiImplWeb.SetLoadIniSettingsFn(() => storageGet(STORAGE_INI) || "");
    ImGuiImplWeb.SetSaveIniSettingsFn((ini) => storageSet(STORAGE_INI, ini));

    await ImGuiImplWeb.Init({ canvas: canvas, backend: gl instanceof WebGL2RenderingContext ? "webgl2" : "webgl" });
    // Recoverable mistakes (a missing End(), unbalanced Push/Pop...) show as a tooltip in the
    // preview and a log line, instead of asserting and taking the whole runtime down.
    const io = ImGui.GetIO();
    io.ConfigErrorRecovery = true;
    io.ConfigErrorRecoveryEnableAssert = false;
    io.ConfigErrorRecoveryEnableTooltip = true;
    io.ConfigErrorRecoveryEnableDebugLog = true;

    // Both are 13px; renderFrame() picks one as the default font for the current pixel ratio.
    defaultFonts = { bitmap: io.Fonts.AddFontDefaultBitmap(), vector: io.Fonts.AddFontDefaultVector() };

    ImGui.StyleColorsDark();
    const style = ImGui.GetStyle();
    style.WindowRounding = 6;
    style.FrameRounding = 4;
    style.GrabRounding = 4;

    assets = createPlaygroundAssets(jsimgui, gl, function () {
      renderAssetList();
      apply();
    });

    requestAnimationFrame(loop);
    setInterval(function () {
      $("fps").textContent = ImGui.GetIO().Framerate.toFixed(0) + " fps";
    }, 500);
  }

  // Monaco gets the real jsimgui typings so ImGui.* autocompletes.
  async function loadTypings() {
    const response = await fetch(IMGUI_TYPES + "imgui.d.ts");
    if (!response.ok) throw new Error("imgui.d.ts " + response.status);
    let typings = await response.text();
    // Leave docking-only functions out of autocomplete, matching the master branch.
    typings = typings.replace(new RegExp("^\\s*static (" + DOCKING.join("|") + ")\\(.*$", "gm"), "");
    // Wrap as an ambient module; "declare" is implied inside one.
    const module = "declare module \"jsimgui\" {\n" + typings.replace(/^(\s*)(export )?declare /gm, "$1$2") + "\n}\n";
    const ts = monaco.languages.typescript;
    ts.javascriptDefaults.addExtraLib(module, "file:///typings/jsimgui.d.ts");

    const imgui = "import(\"jsimgui\")";
    // Classes and interfaces are also usable as types, e.g. /** @param {ImDrawList} dl */ for a function
    // parameter (the editor can't infer a parameter's type, so it needs this hint to autocomplete).
    const typeNames = new Set();
    for (const m of typings.matchAll(/^export (?:declare )?(?:class|interface|type) (\w+)/gm)) typeNames.add(m[1]);
    const typeAliases = GLOBAL_NAMES.filter((n) => n !== "ImGui" && typeNames.has(n))
      .map((n) => "type " + n + " = " + imgui + "." + n + ";");
    ts.javascriptDefaults.addExtraLib([
      "declare const ImGui: Omit<typeof " + imgui + ".ImGui, " + DOCKING.map((n) => JSON.stringify(n)).join(" | ") + "> & {",
      "  /** Push a font, optionally at a size in pixels (0 or omitted keeps the current size). Pair with ImGui.PopFont(). */",
      "  PushFont(font: " + imgui + ".ImFont | null, size?: number): void;",
      // C++-style overloads routed by the playground (see OVERLOADS in app.js).
      "  /** Set a named window's position (C++ overload; same as SetWindowPosStr). */",
      "  SetWindowPos(name: string, pos: " + imgui + ".ImVec2, cond?: " + imgui + ".ImGuiCond): void;",
      "  /** Set a named window's size (C++ overload; same as SetWindowSizeStr). */",
      "  SetWindowSize(name: string, size: " + imgui + ".ImVec2, cond?: " + imgui + ".ImGuiCond): void;",
      "  /** Set a named window's collapsed state (C++ overload; same as SetWindowCollapsedStr). */",
      "  SetWindowCollapsed(name: string, collapsed: boolean, cond?: " + imgui + ".ImGuiCond): void;",
      "  /** Focus a named window (C++ overload; same as SetWindowFocusStr). */",
      "  SetWindowFocus(name: string): void;",
      "  /** Push a style color as ImVec4 (C++ overload; same as PushStyleColorImVec4). */",
      "  PushStyleColor(idx: " + imgui + ".ImGuiCol, col: " + imgui + ".ImVec4): void;",
      "  /** Push an ImVec2 style var (C++ overload; same as PushStyleVarImVec2). */",
      "  PushStyleVar(idx: " + imgui + ".ImGuiStyleVar, val: " + imgui + ".ImVec2): void;",
      "  /** Push an integer ID (C++ overload; same as PushIDInt). */",
      "  PushID(int_id: number): void;",
      "  /** Hash an integer ID (C++ overload; same as GetIDInt). */",
      "  GetID(int_id: number): " + imgui + ".ImGuiID;",
      "  /** Convert an ImVec4 color to ImU32 (C++ overload; same as GetColorU32ImVec4). */",
      "  GetColorU32(col: " + imgui + ".ImVec4): " + imgui + ".ImU32;",
      "  /** Open a popup by ID (C++ overload; same as OpenPopupID). */",
      "  OpenPopup(id: " + imgui + ".ImGuiID, popup_flags?: " + imgui + ".ImGuiPopupFlags): void;",
      "  /** Begin a child window by ID (C++ overload; same as BeginChildID). */",
      "  BeginChild(id: " + imgui + ".ImGuiID, size?: " + imgui + ".ImVec2, child_flags?: " + imgui + ".ImGuiChildFlags, window_flags?: " + imgui + ".ImGuiWindowFlags): boolean;",
      "  /** Menu item that toggles [selected] (C++ overload; same as MenuItemBoolPtr). */",
      "  MenuItem(label: string, shortcut: string | null, p_selected: [boolean], enabled?: boolean): boolean;",
      "  /** Selectable that toggles [selected] (C++ overload; same as SelectableBoolPtr). */",
      "  Selectable(label: string, p_selected: [boolean], flags?: " + imgui + ".ImGuiSelectableFlags, size?: " + imgui + ".ImVec2): boolean;",
      "  /** Collapsing header with a close button bound to [visible] (C++ overload; same as CollapsingHeaderBoolPtr). */",
      "  CollapsingHeader(label: string, p_visible: [boolean], flags?: " + imgui + ".ImGuiTreeNodeFlags): boolean;",
      "  /** Radio button writing v_button into [v] (C++ overload; same as RadioButtonIntPtr). */",
      "  RadioButton(label: string, v: [number], v_button: number): boolean;",
      "  /** Checkbox toggling bits of [flags] (C++ overload; same as CheckboxFlagsIntPtr). */",
      "  CheckboxFlags(label: string, flags: [number], flags_value: number): boolean;",
      "};",
    ].concat(GLOBAL_NAMES.filter((n) => n !== "ImGui").map((n) => "declare const " + n + ": typeof " + imgui + "." + n + ";"), typeAliases, [
      "/** Packs 8-bit RGBA into an ImU32 color for draw lists, like C++'s IM_COL32 macro. Alpha defaults to 255. */",
      "declare function IM_COL32(r: number, g: number, b: number, a?: number): number;",
      "interface PlaygroundImage {",
      "  /** Texture reference for ImGui.Image / ImageButton / drawList.AddImage. */",
      "  ref: " + imgui + ".ImTextureRef;",
      "  width: number;",
      "  height: number;",
      "  /** Natural size, ready to pass as the size argument. */",
      "  size: " + imgui + ".ImVec2;",
      "}",
      "/** Fonts and images from the Assets panel (uploads and built-in samples). */",
      "declare const assets: {",
      "  /**",
      "   * Returns the ImFont for a .ttf/.otf in Assets. Pick the size when you push it.",
      "   * @example const title = assets.font(\"Roboto-Medium.ttf\");",
      "   * // in frame(): ImGui.PushFont(title, 28); ImGui.Text(\"Hi\"); ImGui.PopFont();",
      "   */",
      "  font(name: string): " + imgui + ".ImFont;",
      "  /**",
      "   * Returns { ref, width, height, size } for an image in Assets.",
      "   * @example const logo = assets.image(\"badge.svg\");",
      "   * // in frame(): ImGui.Image(logo.ref, logo.size);",
      "   */",
      "  image(name: string): PlaygroundImage;",
      "  /** True if a font or image with this file name is in Assets. */",
      "  has(name: string): boolean;",
      "  /** File names of all fonts in Assets, e.g. [\"Cousine-Regular.ttf\", \"Roboto-Medium.ttf\"]. */",
      "  fonts(): string[];",
      "  /** File names of all images in Assets, e.g. [\"badge.svg\"]. */",
      "  images(): string[];",
      "};",
    ]).join("\n"), "file:///typings/globals.d.ts");
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
    const font = varName(entry.name, "font");
    const image = varName(entry.name, "image");
    return entry.kind === "font"
      ? "const " + font + " = assets.font(" + quoted + "); // ImGui.PushFont(" + font + ", 18) ... ImGui.PopFont()\n"
      : "const " + image + " = assets.image(" + quoted + "); // ImGui.Image(" + image + ".ref, " + image + ".size)\n";
  }

  function insertSnippet(entry) {
    if (!editor) return;
    // Declarations go above frame() so they run once per apply, not every frame.
    const model = editor.getModel();
    const match = model.findNextMatch("function frame", { lineNumber: 1, column: 1 }, false, true, null, false);
    const line = match ? match.range.startLineNumber : 1;
    editor.executeEdits("assets", [{
      range: new monaco.Range(line, 1, line, 1),
      text: snippetFor(entry),
    }]);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();
    $("assets-panel").hidePopover();
  }

  function renderAssetList() {
    const items = assets ? assets.list() : [];
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
    if (!assets) {
      setStatus("warn", "Still starting up; try again in a moment.");
      return;
    }
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

  const sizeObserver = new ResizeObserver(function (entries) {
    const box = entries[0].devicePixelContentBoxSize && entries[0].devicePixelContentBoxSize[0];
    devicePixelSize = box ? { w: box.inlineSize, h: box.blockSize } : null;
    $("size").textContent = canvas.clientWidth + " × " + canvas.clientHeight;
  });
  try {
    // Exact device pixels where supported (Chromium, Firefox); otherwise renderFrame() rounds.
    sizeObserver.observe(canvas, { box: "device-pixel-content-box" });
  } catch (e) {
    sizeObserver.observe(canvas);
  }

  setupSplitter();
  setupAssets();
  startImGui().then(async function () {
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
