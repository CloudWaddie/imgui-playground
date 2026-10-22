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
    "Minecraft ClickGUI": `// Minecraft client ClickGUI, drawn entirely with draw lists. All input comes from the mouse.
//   Left click a module: toggle it         Right click (or the arrow): open its settings
//   Drag sliders, click checkboxes, click a mode to cycle it
//   Drag the header to move the window     Mouse wheel scrolls     Insert / X / the orb: show and hide

const ACC = [20, 230, 255];   // accent
const DEEP = [20, 110, 255];  // second gradient stop
const GRAY = [150, 160, 176];
const WHITE = [255, 255, 255];

let GA = 1; // global alpha, multiplied into every color

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, speed, dt) => a + (b - a) * (1 - Math.exp(-speed * dt));
const outCubic = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
const outBack = (p) => { p = clamp(p, 0, 1); return 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2); };
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const C = (c, a = 255) => IM_COL32(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), Math.round(clamp(a * GA, 0, 255)));
const V = (x, y) => new ImVec2(x, y);

// An underdamped spring: x chases target and overshoots a little, which is what makes things feel alive.
function spring(s, target, dt) {
  const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += ((target - s.x) * 170 - s.v * 13) * h;
    s.x += s.v * h;
  }
}

/** @param {ImDrawList} dl */
function text(dl, x, y, size, c, s) {
  ImGui.PushFont(ImGui.GetFont(), size);
  dl.AddText(V(x, y), c, s);
  ImGui.PopFont();
}
function textW(size, s) {
  return ImGui.CalcTextSize(s).x * size / ImGui.GetFontSize();
}
// Text whose vertices are recolored with a moving accent-to-white sweep.
/** @param {ImDrawList} dl */
function gradText(dl, x, y, size, s, shift) {
  const w = Math.max(1, textW(size, s)), first = dl.VtxCount;
  text(dl, x, y, size, C(WHITE), s);
  for (let i = first; i < dl.VtxCount; i++) {
    const u = ((((dl.GetVtxPos(i).x - x) / w + shift) % 1) + 1) % 1;
    const k = u < 0.5 ? u * 2 : 2 - u * 2;
    dl.SetVtxColor(i, C(mixc(ACC, WHITE, k * k)));
  }
}
/** @param {ImDrawList} dl */
function hex(dl, cx, cy, r, rot, c, th) {
  dl.PathClear();
  for (let k = 0; k < 6; k++) {
    const a = rot + k * Math.PI / 3;
    dl.PathLineTo(V(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  dl.PathStroke(c, th, ImDrawFlags.Closed);
}

// ---- Model -----------------------------------------------------------------------------------

const slider = (name, min, max, val, dec = 1) => ({ t: "slider", name, min, max, val, dec, d: (val - min) / (max - min), hov: 0 });
const check = (name, val = false) => ({ t: "check", name, val, a: val ? 1 : 0, hov: 0 });
const mode = (name, opts) => ({ t: "mode", name, opts, i: 0, flash: 0, dir: 1, hov: 0 });
const mod = (name, desc, key, settings = [], on = false) => ({
  name, desc, key, settings, on, onA: on ? 1 : 0, knob: { x: on ? 1 : 0, v: 0 },
  hov: 0, open: false, openA: 0,
});

const CATS = [
  { name: "Combat", mods: [
    mod("KillAura", "Attacks entities around you", "R", [slider("Range", 3, 6, 4.2), slider("CPS", 1, 20, 12, 0), mode("Target", ["Closest", "Health", "Angle", "Switch"]), check("Through walls"), check("Auto block", true)], true),
    mod("Velocity", "Reduces the knockback you take", "", [slider("Horizontal %", 0, 100, 0, 0), slider("Vertical %", 0, 100, 100, 0), mode("Mode", ["Cancel", "Reverse", "Jump"])]),
    mod("Criticals", "Every hit lands as a critical", "", [mode("Mode", ["Packet", "Jump", "MiniJump"]), slider("Delay ms", 0, 500, 120, 0)]),
    mod("TriggerBot", "Hits whatever your crosshair is on", "", [slider("CPS", 1, 20, 9, 0), check("Only weapons", true)]),
    mod("Reach", "Extends your hit distance", "", [slider("Distance", 3, 6, 3.6)]),
    mod("AutoCrystal", "Places and breaks end crystals", "", [slider("Range", 2, 8, 5.5), slider("Min damage", 0, 20, 6, 0), check("Anti suicide", true)]),
  ] },
  { name: "Movement", mods: [
    mod("Sprint", "Always sprinting", "", [check("Omni directional")], true),
    mod("Speed", "Move faster on the ground", "G", [mode("Mode", ["Strafe", "BHop", "Ground", "Vulcan"]), slider("Speed", 0.5, 3, 1.4)]),
    mod("Fly", "Take to the sky", "F", [mode("Mode", ["Creative", "Vanilla", "Glide"]), slider("Speed", 0.2, 5, 1.8), check("Anti kick", true)]),
    mod("Step", "Walk up full blocks", "", [slider("Height", 1, 4, 1.5)]),
    mod("NoFall", "Cancels fall damage", "", [mode("Mode", ["Packet", "Spoof"])], true),
    mod("Jesus", "Walk on liquids", "", [mode("Mode", ["Solid", "Dolphin"])]),
  ] },
  { name: "Player", mods: [
    mod("Scaffold", "Places blocks under your feet", "X", [check("Tower", true), check("Safe walk", true), slider("Delay ms", 0, 300, 40, 0)]),
    mod("AutoTool", "Picks the fastest tool for the block", "", []),
    mod("ChestStealer", "Loots chests for you", "", [slider("Delay ms", 0, 400, 80, 0), check("Auto close", true)]),
    mod("FastPlace", "Removes the block place delay", "", [slider("Ticks", 0, 4, 0, 0)]),
    mod("AutoArmor", "Equips the best armor", "", [slider("Delay ms", 0, 400, 150, 0)]),
    mod("Nuker", "Breaks blocks around you", "", [slider("Radius", 1, 6, 3, 0), check("Flatten")]),
  ] },
  { name: "Render", mods: [
    mod("ESP", "Outlines entities through walls", "J", [mode("Style", ["Box", "Outline", "Glow", "2D"]), check("Players", true), check("Mobs"), check("Items"), slider("Line width", 1, 5, 2)], true),
    mod("Tracers", "Lines pointing to players", "", [slider("Width", 1, 5, 1.5), check("Distance fade", true)]),
    mod("Fullbright", "Everything is bright", "", [mode("Mode", ["Gamma", "Potion"])], true),
    mod("Nametags", "Bigger readable nametags", "", [slider("Scale", 0.5, 3, 1.2), check("Show health", true)]),
    mod("Freecam", "Fly the camera around", "", [slider("Speed", 0.2, 4, 1)]),
    mod("Zoom", "Hold to zoom in", "C", [slider("FOV", 5, 60, 25, 0), check("Smooth", true)]),
  ] },
  { name: "World", mods: [
    mod("Timer", "Changes the game speed", "", [slider("Speed", 0.1, 5, 1.6)]),
    mod("XRay", "See ores through stone", "", [slider("Opacity", 0, 100, 0, 0), check("Ores only", true)]),
    mod("TimeChanger", "Locks the time of day", "", [slider("Time", 0, 24000, 6000, 0)]),
    mod("Weather", "Overrides the weather", "", [mode("Weather", ["Clear", "Rain", "Thunder"])]),
    mod("FastBreak", "Break blocks faster", "", [slider("Speed", 1, 3, 1.4)]),
    mod("AutoFarm", "Harvests and replants crops", "", [slider("Range", 1, 6, 4, 0)]),
  ] },
  { name: "Misc", mods: [
    mod("AutoRespawn", "Respawns instantly", "", [], true),
    mod("Spammer", "Repeats a chat message", "", [slider("Delay s", 1, 30, 8, 0)]),
    mod("AntiBot", "Ignores server bots", "", [mode("Mode", ["Hypixel", "Matrix", "Custom"])]),
    mod("FakeLag", "Delays your outgoing packets", "", [slider("Delay ms", 50, 1000, 250, 0)]),
    mod("NameProtect", "Hides your username", "", []),
    mod("Panic", "Disables everything at once", "", []),
  ] },
];
const ALL = CATS.flatMap((c) => c.mods);
CATS.forEach((c) => { c.hov = 0; c.sel = 0; });

const HEAD = 58, SIDE = 176, FOOT = 30, SIDE_ITEM = 52;
const gui = {
  x: 0, y: 0, w: 800, h: 520, placed: false,
  open: true, openS: { x: 0, v: 0 }, alpha: 0, flashT: 1,
  dragging: false, dx: 0, dy: 0,
  cat: 0, catT: 1, catDir: 1, sel: { x: 0, v: 0 }, closeHov: 0,
  scroll: 0, scrollT: 0, total: 0, active: null,
  orbHov: 0,
};
const inp = { x: 0, y: 0, click: false, rclick: false, down: false, wheel: 0 };
let toasts = [];
let ripples = [];
let trail = [];
const parts = Array.from({ length: 46 }, () => ({
  x: Math.random() * 800, y: Math.random() * 520,
  vx: (Math.random() - 0.5) * 12, vy: -(6 + Math.random() * 16),
  r: 1 + Math.random() * 1.8, ph: Math.random() * 6.28,
}));
// Steve's face: H hair, S skin, W eye white, B eye blue, N nose, M mouth.
const STEVE = ["HHHHHHHH", "HHHHHHHH", "HSSSSSSH", "SSSSSSSS", "SBWSSWBS", "SSSNNSSS", "SSMMMMSS", "SSSSSSSS"];
const STEVE_COL = { H: [66, 43, 24], S: [190, 132, 98], W: [255, 255, 255], B: [66, 60, 150], N: [160, 100, 72], M: [110, 60, 45] };

const hot = (x0, y0, x1, y1) => inp.x >= x0 && inp.x <= x1 && inp.y >= y0 && inp.y <= y1;
const modeSuffix = (m) => { const s = m.settings.find((q) => q.t === "mode"); return s ? s.opts[s.i] : ""; };

function toggleGui(v) {
  gui.open = v;
  if (v) gui.flashT = 0;
}
function toast(m) {
  toasts.push({ text: m.name, on: m.on, age: 0 });
  if (toasts.length > 5) toasts.shift();
}

// ---- Always-on overlay: watermark, module list and toasts ---------------------------------------

/** @param {ImDrawList} dl */
function drawHud(dl, dt, t, sw, sh) {
  GA = 1;
  const fps = Math.round(ImGui.GetIO().Framerate);
  const tail = "  |  " + fps + " fps";
  const w = textW(20, "Waddie") + textW(13, tail) + 22;
  dl.AddRectFilled(V(10, 10), V(10 + w, 40), C([8, 12, 18], 170), 8);
  dl.AddRectFilled(V(10, 14), V(13, 36), C(ACC), 2);
  gradText(dl, 20, 14, 20, "Waddie", t * 0.4);
  text(dl, 20 + textW(20, "Waddie"), 19, 13, C(GRAY), tail);

  // Enabled modules, longest first. Each one slides in from the right as its switch animates.
  const label = (m) => m.name + (modeSuffix(m) ? " " + modeSuffix(m) : "");
  const act = ALL.filter((m) => m.onA > 0.01).sort((a, b) => textW(15, label(b)) - textW(15, label(a)));
  act.forEach((m, i) => {
    m.hudY = m.hudY === undefined ? i * 20 : damp(m.hudY, i * 20, 12, dt);
    const sfx = modeSuffix(m);
    const bw = textW(15, m.name) + (sfx ? textW(12, sfx) + 6 : 0) + 18;
    const e = outCubic(m.onA);
    const x = sw - bw * e, y = 12 + m.hudY;
    const c = mixc(ACC, DEEP, 0.5 + 0.5 * Math.sin(t * 1.5 + i * 0.5));
    GA = m.onA;
    dl.AddRectFilled(V(x - 4, y), V(sw, y + 20), C([6, 9, 14], 150));
    dl.AddRectFilled(V(sw - 3, y), V(sw, y + 20), C(c));
    text(dl, x + 2, y + 2, 15, C(c), m.name);
    if (sfx) text(dl, x + 2 + textW(15, m.name) + 6, y + 4, 12, C(GRAY), sfx);
  });

  // Toasts stack up in the bottom right corner.
  toasts.forEach((n, i) => {
    n.age += dt;
    const life = 2.6, out = 0.35;
    let s = outBack(n.age / 0.45);
    if (n.age > life - out) s = 1 - Math.pow((n.age - (life - out)) / out, 2);
    const idx = toasts.length - 1 - i;
    n.sy = n.sy === undefined ? idx : damp(n.sy, idx, 10, dt);
    const tw = 236, th = 48;
    const x = sw - 16 - tw * s, y = sh - 16 - th - n.sy * 58;
    const c = n.on ? ACC : [255, 90, 110];
    GA = clamp(s, 0, 1);
    dl.AddRectFilled(V(x - 2, y - 2), V(x + tw + 2, y + th + 2), C(c, 22), 12);
    dl.AddRectFilled(V(x, y), V(x + tw, y + th), C([10, 14, 22], 235), 10);
    dl.AddRect(V(x, y), V(x + tw, y + th), C(c, 120), 10, 1);
    dl.AddCircleFilled(V(x + 26, y + 24), 12, C(c, 40), 24);
    if (n.on) {
      dl.AddLine(V(x + 20, y + 24), V(x + 25, y + 29), C(c), 2.5);
      dl.AddLine(V(x + 25, y + 29), V(x + 33, y + 19), C(c), 2.5);
    } else {
      dl.AddLine(V(x + 21, y + 19), V(x + 31, y + 29), C(c), 2.5);
      dl.AddLine(V(x + 31, y + 19), V(x + 21, y + 29), C(c), 2.5);
    }
    text(dl, x + 50, y + 7, 16, C(WHITE), n.text);
    text(dl, x + 50, y + 27, 12.5, C(GRAY), n.on ? "Enabled" : "Disabled");
    const left = clamp(1 - n.age / life, 0, 1);
    dl.AddRectFilled(V(x + 10, y + th - 4), V(x + 10 + (tw - 20) * left, y + th - 2), C(c, 200), 1);
  });
  toasts = toasts.filter((n) => n.age < 2.6);
  GA = 1;
}

// ---- Sidebar icons -----------------------------------------------------------------------------

/** @param {ImDrawList} dl */
function icon(dl, i, cx, cy, c) {
  const P = Math.PI;
  switch (i) {
    case 0: // crossed swords
      dl.AddLine(V(cx - 8, cy + 8), V(cx + 8, cy - 8), c, 2);
      dl.AddLine(V(cx + 8, cy + 8), V(cx - 8, cy - 8), c, 2);
      dl.AddCircleFilled(V(cx - 8, cy + 8), 2.2, c, 12);
      dl.AddCircleFilled(V(cx + 8, cy + 8), 2.2, c, 12);
      break;
    case 1: // chevrons
      for (let k = 0; k < 3; k++) {
        const x = cx - 9 + k * 6;
        dl.AddLine(V(x, cy - 7), V(x + 6, cy), c, 2);
        dl.AddLine(V(x + 6, cy), V(x, cy + 7), c, 2);
      }
      break;
    case 2: // person
      dl.AddCircle(V(cx, cy - 5), 4.5, c, 16, 2);
      dl.PathClear();
      dl.PathArcTo(V(cx, cy + 11), 9, P, P * 2, 16);
      dl.PathStroke(c, 2);
      break;
    case 3: // eye
      dl.AddBezierQuadratic(V(cx - 10, cy), V(cx, cy - 11), V(cx + 10, cy), c, 2);
      dl.AddBezierQuadratic(V(cx - 10, cy), V(cx, cy + 11), V(cx + 10, cy), c, 2);
      dl.AddCircleFilled(V(cx, cy), 3.2, c, 14);
      break;
    case 4: // globe
      dl.AddCircle(V(cx, cy), 9, c, 20, 2);
      dl.AddEllipse(V(cx, cy), V(4, 9), c, 0, 16, 1.5);
      dl.AddLine(V(cx - 9, cy), V(cx + 9, cy), c, 1.5);
      break;
    default: // 2x2 grid
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        dl.AddRectFilled(V(cx - 9 + a * 10, cy - 9 + b * 10), V(cx - 1 + a * 10, cy - 1 + b * 10), c, 2);
      }
  }
}

// ---- Settings rows ---------------------------------------------------------------------------

/** @param {ImDrawList} dl */
function drawSetting(dl, s, x0, y, x1, canHit, dt) {
  const cy = y + 17;
  const tx0 = x0 + 190;
  text(dl, x0 + 24, cy - 8, 14, C([190, 200, 214]), s.name);

  if (s.t === "slider") {
    const tx1 = x1 - 100;
    const over = canHit && hot(tx0 - 8, cy - 12, tx1 + 8, cy + 12);
    if (over && inp.click) gui.active = s;
    if (gui.active === s && inp.down) {
      const q = Math.pow(10, s.dec);
      s.val = Math.round((s.min + clamp((inp.x - tx0) / (tx1 - tx0), 0, 1) * (s.max - s.min)) * q) / q;
    }
    s.hov = damp(s.hov, over || gui.active === s ? 1 : 0, 14, dt);
    s.d = damp(s.d, (s.val - s.min) / (s.max - s.min), 22, dt);
    const fx = tx0 + (tx1 - tx0) * s.d;
    dl.AddRectFilled(V(tx0, cy - 2), V(tx1, cy + 2), C([40, 48, 62]), 2);
    dl.AddRectFilledMultiColor(V(tx0, cy - 2), V(fx, cy + 2), C(DEEP), C(ACC), C(ACC), C(DEEP));
    dl.AddCircleFilled(V(fx, cy), 13 + 2 * s.hov, C(ACC, 34 * s.hov), 24);
    dl.AddCircleFilled(V(fx, cy), 6 + 2 * s.hov, C(WHITE), 20);
    dl.AddCircle(V(fx, cy), 6 + 2 * s.hov, C(ACC), 20, 2);
    text(dl, x1 - 88, cy - 8, 14, C(ACC), s.val.toFixed(s.dec));
  } else if (s.t === "check") {
    const over = canHit && hot(tx0 - 4, cy - 13, tx0 + 80, cy + 13);
    if (over && inp.click) s.val = !s.val;
    s.hov = damp(s.hov, over ? 1 : 0, 14, dt);
    s.a = damp(s.a, s.val ? 1 : 0, 16, dt);
    const bc = mixc([30, 38, 52], ACC, s.a);
    dl.AddRectFilled(V(tx0, cy - 9), V(tx0 + 18, cy + 9), C(bc), 5);
    dl.AddRect(V(tx0, cy - 9), V(tx0 + 18, cy + 9), C(mixc([60, 72, 92], ACC, Math.max(s.a, s.hov * 0.6))), 5, 1.2);
    if (s.a > 0.15) {
      const k = s.a;
      dl.AddLine(V(tx0 + 4.5, cy), V(tx0 + 8, cy + 4), C([6, 14, 22], 255 * k), 2.2);
      dl.AddLine(V(tx0 + 8, cy + 4), V(tx0 + 14, cy - 4), C([6, 14, 22], 255 * k), 2.2);
    }
    text(dl, tx0 + 28, cy - 7, 13, C(mixc(GRAY, ACC, s.a)), s.val ? "On" : "Off");
  } else {
    const pw = 160;
    const over = canHit && hot(tx0, cy - 13, tx0 + pw, cy + 13);
    const left = inp.x < tx0 + pw / 2;
    if (over && inp.click) {
      s.dir = left ? -1 : 1;
      s.i = (s.i + s.dir + s.opts.length) % s.opts.length;
      s.flash = 1;
    }
    s.hov = damp(s.hov, over ? 1 : 0, 14, dt);
    s.flash = damp(s.flash, 0, 9, dt);
    dl.AddRectFilled(V(tx0, cy - 13), V(tx0 + pw, cy + 13), C([24, 32, 44]), 8);
    dl.AddRect(V(tx0, cy - 13), V(tx0 + pw, cy + 13), C(mixc([46, 58, 76], ACC, s.hov * 0.7)), 8, 1);
    const lc = C(mixc(GRAY, ACC, over && left ? 1 : 0.3)), rc = C(mixc(GRAY, ACC, over && !left ? 1 : 0.3));
    dl.AddLine(V(tx0 + 16, cy - 5), V(tx0 + 11, cy), lc, 2);
    dl.AddLine(V(tx0 + 11, cy), V(tx0 + 16, cy + 5), lc, 2);
    dl.AddLine(V(tx0 + pw - 16, cy - 5), V(tx0 + pw - 11, cy), rc, 2);
    dl.AddLine(V(tx0 + pw - 11, cy), V(tx0 + pw - 16, cy + 5), rc, 2);
    const o = s.opts[s.i], ow = textW(14, o);
    const save = GA;
    GA *= 1 - s.flash * 0.7;
    text(dl, tx0 + pw / 2 - ow / 2 + s.dir * s.flash * 14, cy - 8, 14, C(ACC), o);
    GA = save;
  }
}

// ---- One module card -------------------------------------------------------------------------

/** @param {ImDrawList} dl */
function drawCard(dl, m, idx, x0, y0, x1, view, live, dt) {
  const hs = m.settings.length ? m.settings.length * 34 + 8 : 0;
  const h = 54 + hs * m.openA;

  // Cards fly in one after another when a category opens.
  const p = clamp((gui.catT - idx * 0.05) / 0.5, 0, 1);
  const ox = (1 - outBack(p)) * 46 * gui.catDir;
  const saveGA = GA;
  GA *= outCubic(p);
  x0 += ox; x1 += ox;

  const inView = hot(view.x0, view.y0, view.x1, view.y1);
  const hov = live && p > 0.85 && inView && hot(x0, y0, x1, y0 + 54);
  m.hov = damp(m.hov, hov ? 1 : 0, 14, dt);
  m.onA = damp(m.onA, m.on ? 1 : 0, 9, dt);
  spring(m.knob, m.on ? 1 : 0, dt);
  m.openA = damp(m.openA, m.open ? 1 : 0, 11, dt);

  const sx1 = x1 - 18, sx0 = sx1 - 46;
  const ax = sx0 - 22;
  if (hov) {
    if (inp.click) {
      if (m.settings.length && Math.abs(inp.x - ax) < 14) m.open = !m.open;
      else { m.on = !m.on; toast(m); }
      ripples.push({ m, x: inp.x, y: inp.y, t: 0 });
    }
    if (inp.rclick && m.settings.length) m.open = !m.open;
  }

  if (y0 + h > view.y0 && y0 < view.y1 && GA > 0.01) {
    const a = m.onA;
    dl.AddRectFilled(V(x0, y0), V(x1, y0 + h), C([16, 21, 30], 235), 10);
    if (a > 0.01) {
      dl.AddRectFilled(V(x0, y0), V(x1, y0 + h), C(ACC, 20 * a), 10);
      for (let k = 1; k < 4; k++) dl.AddRect(V(x0 - k, y0 - k), V(x1 + k, y0 + h + k), C(ACC, (30 - k * 8) * a), 10 + k, 1.5);
      dl.AddRectFilled(V(x0, y0 + 11), V(x0 + 3, y0 + 43), C(ACC, 255 * a), 2);
    }
    if (m.hov > 0.01) dl.AddRectFilled(V(x0, y0), V(x1, y0 + h), C(WHITE, 9 * m.hov), 10);
    dl.AddRect(V(x0, y0), V(x1, y0 + h), C(mixc([34, 44, 60], ACC, a * 0.75)), 10, 1);

    // Click ripples, clipped to the card.
    dl.PushClipRect(V(x0, y0), V(x1, y0 + h), true);
    for (const r of ripples) {
      if (r.m !== m) continue;
      const k = r.t / 0.8;
      dl.AddCircleFilled(V(r.x, r.y), 380 * outCubic(k), C(ACC, 60 * (1 - k)), 48);
    }
    dl.PopClipRect();

    text(dl, x0 + 20 + 3 * m.hov, y0 + 10, 17, C(mixc([226, 233, 244], ACC, a)), m.name);
    text(dl, x0 + 20 + 3 * m.hov, y0 + 32, 12.5, C(GRAY), m.desc);

    // Switch: the knob is on a spring, so it overshoots at both ends.
    const kx = m.knob.x;
    dl.AddRectFilled(V(sx0, y0 + 16), V(sx1, y0 + 38), C(mixc([46, 54, 68], ACC, clamp(kx, 0, 1))), 11);
    const kcx = sx0 + 11 + kx * 24, kcy = y0 + 27;
    if (a > 0.01) for (let k = 1; k < 4; k++) dl.AddCircleFilled(V(kcx, kcy), 8 + k * 3, C(ACC, 34 * a / k), 24);
    dl.AddCircleFilled(V(kcx, kcy), 8 + 1.5 * m.hov, C(mixc([205, 212, 224], WHITE, a)), 24);

    let kr = sx0 - 12;
    if (m.settings.length) {
      const s = lerp(1, -1, m.openA);
      const ac = C(mixc(GRAY, ACC, m.openA));
      dl.AddLine(V(ax - 5, y0 + 27 - s * 3), V(ax, y0 + 27 + s * 3), ac, 2);
      dl.AddLine(V(ax, y0 + 27 + s * 3), V(ax + 5, y0 + 27 - s * 3), ac, 2);
      kr = ax - 16;
    }
    if (m.key) {
      const kw = textW(12, m.key) + 14;
      dl.AddRectFilled(V(kr - kw, y0 + 17), V(kr, y0 + 37), C([30, 40, 56]), 5);
      text(dl, kr - kw + 7, y0 + 20, 12, C(GRAY), m.key);
    }

    if (m.openA > 0.02) {
      dl.PushClipRect(V(x0, y0 + 54), V(x1, y0 + h), true);
      dl.AddLine(V(x0 + 16, y0 + 54), V(x1 - 16, y0 + 54), C(WHITE, 16 * m.openA), 1);
      const g = GA;
      m.settings.forEach((s, k) => {
        const fa = clamp(m.openA * 1.7 - k * 0.2, 0, 1);
        GA = g * fa;
        drawSetting(dl, s, x0 + (1 - outCubic(fa)) * 24, y0 + 58 + k * 34, x1, live && inView && m.openA > 0.9, dt);
      });
      GA = g;
      dl.PopClipRect();
    }
  }
  GA = saveGA;
  return h;
}

// ---- The window --------------------------------------------------------------------------------

/** @param {ImDrawList} dl */
function drawGui(dl, dt, t, sw, sh) {
  gui.w = clamp(sw - 40, 660, 820);
  gui.h = clamp(sh - 40, 420, 540);
  if (!gui.placed) {
    gui.x = (sw - gui.w) / 2;
    gui.y = (sh - gui.h) / 2;
    gui.placed = true;
  }
  spring(gui.openS, gui.open ? 1 : 0, dt);
  gui.alpha = damp(gui.alpha, gui.open ? 1 : 0, 12, dt);
  gui.flashT += dt;
  if (!inp.down) { gui.active = null; gui.dragging = false; }
  if (gui.alpha < 0.01) return;

  GA = clamp(gui.alpha, 0, 1);
  const live = gui.open && gui.alpha > 0.85;
  const W = gui.w, H = gui.h;
  const wx = gui.x, wy = gui.y + (1 - gui.openS.x) * 70;
  const t0 = V(wx, wy), t1 = V(wx + W, wy + H);

  // Drag by the header.
  if (live && inp.click && hot(wx, wy, wx + W - 56, wy + HEAD)) {
    gui.dragging = true;
    gui.dx = inp.x - gui.x;
    gui.dy = inp.y - gui.y;
  }
  if (gui.dragging) {
    gui.x = clamp(inp.x - gui.dx, -W + 120, sw - 120);
    gui.y = clamp(inp.y - gui.dy, 0, sh - 60);
  }

  // Shadow, body, sidebar.
  for (let k = 1; k < 7; k++) dl.AddRectFilled(V(wx - k * 3, wy - k * 3 + 12), V(wx + W + k * 3, wy + H + k * 3 + 12), C([0, 0, 0], 13), 16 + k * 3);
  dl.AddRectFilled(t0, t1, C([9, 12, 19], 246), 14);
  dl.AddRectFilled(t0, V(wx + SIDE, wy + H), C([5, 8, 13], 255), 14, ImDrawFlags.RoundCornersLeft);

  // Drifting glow blobs and a particle field that reacts to the mouse.
  dl.PushClipRect(V(wx + 1, wy + 1), V(wx + W - 1, wy + H - 1), true);
  for (let b = 0; b < 3; b++) {
    const bx = wx + W * (0.5 + 0.38 * Math.sin(t * 0.3 + b * 2.1));
    const by = wy + H * (0.5 + 0.3 * Math.cos(t * 0.23 + b * 1.7));
    for (let r = 0; r < 10; r++) dl.AddCircleFilled(V(bx, by), 50 + r * 20, C(b === 1 ? DEEP : ACC, 2.4), 36);
  }
  for (const q of parts) {
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.y < -6) { q.y = H + 6; q.x = Math.random() * W; }
    if (q.x < -6) q.x = W + 6;
    if (q.x > W + 6) q.x = -6;
    const dx = wx + q.x - inp.x, dy = wy + q.y - inp.y, d = Math.hypot(dx, dy);
    if (d < 110 && d > 0.1) { q.x += dx / d * (110 - d) * dt * 3; q.y += dy / d * (110 - d) * dt * 3; }
  }
  for (let i = 0; i < parts.length; i++) {
    const q = parts[i];
    const px = wx + q.x, py = wy + q.y;
    for (let j = i + 1; j < parts.length; j++) {
      const d = Math.hypot(q.x - parts[j].x, q.y - parts[j].y);
      if (d < 85) dl.AddLine(V(px, py), V(wx + parts[j].x, wy + parts[j].y), C(ACC, (1 - d / 85) * 55), 1);
    }
    const dm = Math.hypot(px - inp.x, py - inp.y);
    if (live && dm < 140) dl.AddLine(V(px, py), V(inp.x, inp.y), C(ACC, (1 - dm / 140) * 130), 1);
    dl.AddCircleFilled(V(px, py), q.r, C(ACC, 90 + 80 * Math.sin(t * 2 + q.ph)), 10);
  }
  dl.PopClipRect();

  // Header: spinning hex logo, gradient title, comet along the bottom edge.
  const lx = wx + 34, ly = wy + 29;
  hex(dl, lx, ly, 17, t * 0.8, C(ACC, 220), 2);
  hex(dl, lx, ly, 11, -t * 1.3, C(DEEP, 255), 2);
  dl.AddCircleFilled(V(lx, ly), 4 + Math.sin(t * 3), C(WHITE), 16);
  dl.AddCircleFilled(V(lx, ly), 22, C(ACC, 18), 28);
  gradText(dl, wx + 62, wy + 8, 26, "WADDIE", t * 0.5);
  text(dl, wx + 64, wy + 38, 11.5, C(GRAY), "CLIENT   1.21.4");
  const phase = ((t * 0.35) % 1.5 - 0.25) * W;
  for (let x = 0; x < W; x += 8) {
    const hl = Math.exp(-Math.pow((x - phase) / 90, 2));
    dl.AddRectFilled(V(wx + x, wy + HEAD), V(wx + Math.min(x + 8, W), wy + HEAD + 2), C(mixc(ACC, WHITE, hl * hl), 40 + 215 * hl));
  }

  // FPS chip and the close button.
  const fps = "FPS " + Math.round(ImGui.GetIO().Framerate);
  const cw = textW(12.5, fps) + 20, fx0 = wx + W - 56 - cw - 8;
  dl.AddRectFilled(V(fx0, wy + 18), V(fx0 + cw, wy + 40), C([20, 28, 40]), 11);
  text(dl, fx0 + 10, wy + 22, 12.5, C(ACC), fps);
  const overX = live && hot(wx + W - 46, wy + 14, wx + W - 14, wy + 44);
  gui.closeHov = damp(gui.closeHov, overX ? 1 : 0, 14, dt);
  if (overX && inp.click) toggleGui(false);
  const xc = mixc(GRAY, [255, 90, 110], gui.closeHov);
  dl.AddCircleFilled(V(wx + W - 30, wy + 29), 15, C([255, 90, 110], 30 * gui.closeHov), 24);
  dl.AddLine(V(wx + W - 36, wy + 23), V(wx + W - 24, wy + 35), C(xc), 2);
  dl.AddLine(V(wx + W - 24, wy + 23), V(wx + W - 36, wy + 35), C(xc), 2);

  // Sidebar: a pill on a spring slides to the selected category and stretches while it moves.
  spring(gui.sel, HEAD + 18 + gui.cat * SIDE_ITEM, dt);
  const stretch = clamp(Math.abs(gui.sel.v) * 0.035, 0, 16);
  const py0 = wy + gui.sel.x - stretch / 2, py1 = wy + gui.sel.x + 44 + stretch / 2;
  dl.AddRectFilled(V(wx + 10, py0), V(wx + SIDE - 10, py1), C(ACC, 24), 10);
  dl.AddRect(V(wx + 10, py0), V(wx + SIDE - 10, py1), C(ACC, 80), 10, 1);
  dl.AddRectFilled(V(wx + 10, py0 + 10), V(wx + 13.5, py1 - 10), C(ACC), 2);
  for (let k = 1; k < 4; k++) dl.AddRect(V(wx + 10 - k, py0 - k), V(wx + SIDE - 10 + k, py1 + k), C(ACC, 20 - k * 5), 10 + k, 1.5);

  CATS.forEach((c, i) => {
    const iy = wy + HEAD + 18 + i * SIDE_ITEM;
    const over = live && hot(wx + 10, iy, wx + SIDE - 10, iy + 44);
    if (over && inp.click && gui.cat !== i) {
      gui.catDir = i > gui.cat ? 1 : -1;
      gui.cat = i; gui.catT = 0; gui.scroll = 0; gui.scrollT = 0;
    }
    c.hov = damp(c.hov, over ? 1 : 0, 14, dt);
    c.sel = damp(c.sel, gui.cat === i ? 1 : 0, 12, dt);
    const tc = mixc(mixc(GRAY, WHITE, c.hov * 0.8), ACC, c.sel);
    icon(dl, i, wx + 34 + 2 * c.hov, iy + 22, C(tc));
    text(dl, wx + 58 + 2 * c.hov, iy + 13, 16, C(tc), c.name);
    const n = c.mods.filter((m) => m.on).length;
    const label = String(n);
    const bw = textW(12, label) + 12;
    dl.AddRectFilled(V(wx + SIDE - 20 - bw, iy + 14), V(wx + SIDE - 20, iy + 31), C(n ? ACC : [30, 40, 56], n ? 40 : 255), 8);
    text(dl, wx + SIDE - 20 - bw + 6, iy + 15, 12, C(n ? ACC : GRAY), label);
  });

  // Profile card with a pixel-art Steve head.
  const pyy = wy + H - FOOT - 62;
  dl.AddRectFilled(V(wx + 10, pyy), V(wx + SIDE - 10, pyy + 52), C([14, 20, 30]), 10);
  for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) {
    dl.AddRectFilled(V(wx + 20 + q * 4.5, pyy + 8 + r * 4.5), V(wx + 20 + (q + 1) * 4.5, pyy + 8 + (r + 1) * 4.5), C(STEVE_COL[STEVE[r][q]]));
  }
  dl.AddRect(V(wx + 20, pyy + 8), V(wx + 56, pyy + 44), C(ACC, 150), 0, 1);
  text(dl, wx + 66, pyy + 10, 14, C(WHITE), "CloudWaddie");
  text(dl, wx + 66, pyy + 29, 11.5, C(ACC), "Premium");

  // Footer.
  dl.AddLine(V(wx + 14, wy + H - FOOT), V(wx + W - 14, wy + H - FOOT), C(WHITE, 12), 1);
  const nOn = ALL.filter((m) => m.on).length;
  text(dl, wx + SIDE + 16, wy + H - FOOT + 8, 12.5, C(GRAY), nOn + " of " + ALL.length + " modules enabled");
  const hint = "Right click: settings   Insert: toggle GUI";
  text(dl, wx + W - 16 - textW(12.5, hint), wy + H - FOOT + 8, 12.5, C([100, 112, 130]), hint);

  // Content area: title row, then the scrolling module list.
  const cat = CATS[gui.cat];
  gui.catT += dt;
  ripples.forEach((r) => { r.t += dt; });
  ripples = ripples.filter((r) => r.t < 0.8);
  const cx0 = wx + SIDE + 16, cx1 = wx + W - 22;
  const ty = wy + HEAD + 14;
  const ta = outCubic(gui.catT / 0.4);
  const sg = GA;
  GA *= ta;
  text(dl, cx0 + (1 - ta) * 20 * gui.catDir, ty, 22, C(WHITE), cat.name);
  const on = cat.mods.filter((m) => m.on).length;
  text(dl, cx0 + textW(22, cat.name) + 12 + (1 - ta) * 20 * gui.catDir, ty + 6, 12.5, C(ACC), on + " / " + cat.mods.length + " active");
  GA = sg;

  const view = { x0: cx0 - 6, y0: wy + HEAD + 48, x1: wx + W - 8, y1: wy + H - FOOT - 6 };
  const viewH = view.y1 - view.y0;
  const maxS = Math.max(0, gui.total - viewH);
  if (live && hot(view.x0, view.y0, view.x1, view.y1)) gui.scrollT -= inp.wheel * 70;
  gui.scrollT = clamp(gui.scrollT, 0, maxS);
  gui.scroll = damp(gui.scroll, gui.scrollT, 14, dt);

  dl.PushClipRect(V(view.x0, view.y0), V(view.x1, view.y1), true);
  let y = view.y0 + 4 - gui.scroll;
  cat.mods.forEach((m, i) => { y += drawCard(dl, m, i, cx0, y, cx1, view, live, dt) + 9; });
  gui.total = y + gui.scroll - view.y0;
  dl.PopClipRect();

  if (maxS > 1) {
    const th = Math.max(30, viewH * viewH / gui.total);
    const ty0 = view.y0 + (viewH - th) * (gui.scroll / maxS);
    dl.AddRectFilled(V(wx + W - 12, view.y0), V(wx + W - 9, view.y1), C(WHITE, 10), 2);
    dl.AddRectFilled(V(wx + W - 12, ty0), V(wx + W - 9, ty0 + th), C(ACC, 170), 2);
  }

  // Border glow and the ring that bursts out when the GUI opens.
  const pulse = 0.65 + 0.35 * Math.sin(t * 2);
  for (let k = 0; k < 6; k++) dl.AddRect(V(wx - k, wy - k), V(wx + W + k, wy + H + k), C(ACC, (70 - k * 12) * pulse), 14 + k, 1.5);
  dl.AddRect(t0, t1, C(ACC, 150), 14, 1.2);
  if (gui.flashT < 0.7) {
    const k = gui.flashT / 0.7, e = outCubic(k) * 60;
    dl.AddRect(V(wx - e, wy - e), V(wx + W + e, wy + H + e), C(ACC, 160 * (1 - k)), 14 + e, 2);
  }
  GA = 1;
}

// A pulsing orb in the corner that brings the GUI back.
/** @param {ImDrawList} dl */
function drawOrb(dl, dt, t, sh) {
  const a = 1 - clamp(gui.alpha * 1.5, 0, 1);
  if (a < 0.01) return;
  GA = a;
  const cx = 44, cy = sh - 44;
  const over = !gui.open && Math.hypot(inp.x - cx, inp.y - cy) < 26;
  gui.orbHov = damp(gui.orbHov, over ? 1 : 0, 14, dt);
  if (over && inp.click) toggleGui(true);
  for (let k = 0; k < 3; k++) {
    const p = (t * 0.5 + k / 3) % 1;
    dl.AddCircle(V(cx, cy), 20 + p * 26, C(ACC, 150 * (1 - p)), 40, 2);
  }
  dl.AddCircleFilled(V(cx, cy), 28 + 3 * gui.orbHov, C(ACC, 30), 32);
  dl.AddCircleFilled(V(cx, cy), 20 + 2 * gui.orbHov, C([10, 16, 26]), 32);
  hex(dl, cx, cy, 11, t, C(ACC), 2);
  hex(dl, cx, cy, 6, -t * 1.4, C(DEEP), 2);
  text(dl, cx + 36, cy - 8, 13, C(GRAY, 200 * gui.orbHov + 55), "Insert");
  GA = 1;
}

function frame() {
  const io = ImGui.GetIO();
  const dt = Math.min(io.DeltaTime, 1 / 30);
  const t = ImGui.GetTime();
  const dl = ImGui.GetForegroundDrawList();
  const mp = ImGui.GetMousePos();
  inp.x = mp.x; inp.y = mp.y;
  inp.click = ImGui.IsMouseClicked(0);
  inp.rclick = ImGui.IsMouseClicked(1);
  inp.down = ImGui.IsMouseDown(0);
  inp.wheel = io.MouseWheel;
  if (ImGui.IsKeyPressed(ImGuiKey._Insert, false)) toggleGui(!gui.open);

  drawHud(dl, dt, t, io.DisplaySize.x, io.DisplaySize.y);
  drawGui(dl, dt, t, io.DisplaySize.x, io.DisplaySize.y);
  drawOrb(dl, dt, t, io.DisplaySize.y);

  // A glowing cursor with a fading trail while the GUI is up.
  trail.push({ x: inp.x, y: inp.y });
  if (trail.length > 16) trail.shift();
  const ca = clamp(gui.alpha, 0, 1);
  if (ca > 0.05) {
    GA = ca;
    trail.forEach((p, i) => {
      const k = (i + 1) / trail.length;
      dl.AddCircleFilled(V(p.x, p.y), 1 + 4 * k, C(ACC, 60 * k * k), 12);
    });
    dl.AddCircle(V(inp.x, inp.y), 9 + (inp.down ? -3 : 0), C(ACC, 230), 20, 1.8);
    dl.AddCircleFilled(V(inp.x, inp.y), 2.2, C(WHITE), 10);
    GA = 1;
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
