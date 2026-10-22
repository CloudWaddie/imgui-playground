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
    "Minecraft ClickGUI": `// Cloud Client: a Vape V4 style ClickGUI for Minecraft, drawn with draw lists.
//   Click a module to toggle it         Right click (or the dots) opens its settings
//   Drag a header to move its panel     Click a header to collapse the panel
//   Insert shows and hides the GUI

// ---- Theme -------------------------------------------------------------------------------------

const ACC = [20, 230, 255];
const BG = [20, 20, 23];
const HEADER = [14, 14, 16];
const SETBG = [13, 13, 15];
const LINE = [44, 44, 50];
const TEXT = [244, 244, 246];
const DIM = [150, 150, 158];
const MUTE = [100, 100, 108];
const WHITE_ = [255, 255, 255];

let GA = 1; // global alpha, multiplied into every color

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, speed, dt) => a + (b - a) * (1 - Math.exp(-speed * dt));
const outCubic = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const C = (c, a = 255) => IM_COL32(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), Math.round(clamp(a * GA, 0, 255)));
const V = (x, y) => new ImVec2(x, y);
const hot = (x0, y0, x1, y1) => inp.x >= x0 && inp.x <= x1 && inp.y >= y0 && inp.y <= y1;

// Roboto ships with the playground (see Assets); fall back to the default font without it.
const FONT = assets.has("Roboto-Medium.ttf") ? assets.font("Roboto-Medium.ttf") : null;

// dl.AddText and ImGui.CalcTextSize don't work in this build (an empty text_end gets passed through),
// so text goes through ImGui.Text on the overlay window, and widths are measured by laying text out off-screen.
/** @param {ImDrawList} dl */
function text(dl, x, y, size, c, s) {
  ImGui.PushFont(FONT || ImGui.GetFont(), size);
  ImGui.SetCursorScreenPos(V(x, y));
  ImGui.PushStyleColor(ImGuiCol.Text, c);
  ImGui.Text(s);
  ImGui.PopStyleColor();
  ImGui.PopFont();
}
const WIDTHS = new Map();
function textW(size, s) {
  const key = size + "|" + s;
  let w = WIDTHS.get(key);
  if (w === undefined) {
    ImGui.PushFont(FONT || ImGui.GetFont(), size);
    ImGui.SetCursorScreenPos(V(-4000, -4000));
    ImGui.Text(s);
    w = ImGui.GetItemRectSize().x;
    ImGui.PopFont();
    if (WIDTHS.size > 3000) WIDTHS.clear();
    WIDTHS.set(key, w);
  }
  return w;
}
// A full-screen window with no background that ignores the mouse: everything below draws on it.
function overlay(draw) {
  ImGui.SetNextWindowPos(V(0, 0));
  ImGui.SetNextWindowSize(ImGui.GetIO().DisplaySize);
  ImGui.PushStyleVarImVec2(ImGuiStyleVar.WindowPadding, V(0, 0));
  const F = ImGuiWindowFlags;
  ImGui.Begin("##clickgui", null, F.NoTitleBar | F.NoResize | F.NoMove | F.NoScrollbar | F.NoScrollWithMouse | F.NoBackground | F.NoSavedSettings | F.NoInputs | F.NoNav);
  ImGui.PopStyleVar();
  draw(ImGui.GetWindowDrawList());
  ImGui.End();
}
// The one gradient: white sliding into the accent, applied per vertex after the text is drawn.
/** @param {ImDrawList} dl */
function gradText(dl, x, y, size, s) {
  const w = Math.max(1, textW(size, s)), first = dl.VtxCount, t = ImGui.GetTime();
  text(dl, x, y, size, C(WHITE_), s);
  for (let i = first; i < dl.VtxCount; i++) {
    const u = (dl.GetVtxPos(i).x - x) / w;
    dl.SetVtxColor(i, C(mixc(WHITE_, ACC, 0.5 + 0.5 * Math.sin(t * 1.6 - u * 3))));
  }
}

// ---- Model -------------------------------------------------------------------------------------

const slider = (name, min, max, val, dec = 1) => ({ t: "slider", name, min, max, val, dec, d: (val - min) / (max - min), hov: 0 });
const check = (name, val = false) => ({ t: "check", name, val, a: val ? 1 : 0, hov: 0 });
const mode = (name, opts) => ({ t: "mode", name, opts, i: 0, an: opts.map((_, k) => (k === 0 ? 1 : 0)) });
const mod = (name, desc, key, settings = [], on = false) => ({
  name, desc, key, settings, on, onA: on ? 1 : 0, hov: 0, open: false, openA: 0,
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

const HEAD_H = 32, MOD_H = 26;
const gui = {
  placed: false, open: true, wasOpen: false, o: 0, openT: 0,
  order: [0, 1, 2, 3, 4, 5], drag: null, active: null, top: null, hintHov: 0,
};
const inp = { x: 0, y: 0, click: false, rclick: false, down: false, wheel: 0 };
let toasts = [];

const modeText = (m) => { const s = m.settings.find((q) => q.t === "mode"); return s ? s.opts[s.i] : ""; };

function toast(m) {
  toasts.push({ text: m.name, on: m.on, age: 0 });
  if (toasts.length > 4) toasts.shift();
}

// ---- Overlay that is always on screen: watermark, module list, toasts ----------------------------

/** @param {ImDrawList} dl */
function drawHud(dl, dt, sw, sh) {
  GA = 1;
  gradText(dl, 14, 11, 17, "Cloud Client");

  // Enabled modules, longest first. Each fades and slides in with its switch.
  const act = ALL.filter((m) => m.onA > 0.01).sort((a, b) => textW(14, b.name + modeText(b)) - textW(14, a.name + modeText(a)));
  act.forEach((m, i) => {
    m.hudY = m.hudY === undefined ? i * 20 : damp(m.hudY, i * 20, 14, dt);
    const sfx = modeText(m);
    const bw = textW(14, m.name) + (sfx ? textW(12, sfx) + 6 : 0) + 16;
    const e = outCubic(m.onA);
    const x = sw - bw * e, y = 12 + m.hudY;
    GA = m.onA;
    dl.AddRectFilled(V(x, y), V(sw, y + 20), C([0, 0, 0], 170));
    dl.AddRectFilled(V(sw - 2, y), V(sw, y + 20), C(WHITE_));
    text(dl, x + 6, y + 3, 14, C(TEXT), m.name);
    if (sfx) text(dl, x + 6 + textW(14, m.name) + 6, y + 4, 12, C(MUTE), sfx);
  });

  // Toasts, bottom right.
  toasts.forEach((n, i) => {
    n.age += dt;
    const life = 2.4;
    const inT = outCubic(n.age / 0.3), outT = clamp((life - n.age) / 0.3, 0, 1);
    const idx = toasts.length - 1 - i;
    n.sy = n.sy === undefined ? idx : damp(n.sy, idx, 12, dt);
    const tw = 200, th = 44;
    const x = sw - 16 - tw + (1 - inT) * 30, y = sh - 16 - th - n.sy * (th + 6);
    GA = inT * outT;
    dl.AddRectFilled(V(x, y), V(x + tw, y + th), C([0, 0, 0], 173), 3);
    dl.AddRect(V(x, y), V(x + tw, y + th), C([48, 48, 48]), 3, 1);
    const ic = C(n.on ? WHITE_ : MUTE), ix = x + 21, iy = y + th / 2 - 1;
    dl.AddCircle(V(ix, iy), 7.5, ic, 24, 1.3);
    if (n.on) {
      dl.AddLine(V(ix - 3, iy), V(ix - 1, iy + 2.5), ic, 1.4);
      dl.AddLine(V(ix - 1, iy + 2.5), V(ix + 3.5, iy - 2.5), ic, 1.4);
    } else {
      dl.AddLine(V(ix - 2.5, iy - 2.5), V(ix + 2.5, iy + 2.5), ic, 1.4);
      dl.AddLine(V(ix + 2.5, iy - 2.5), V(ix - 2.5, iy + 2.5), ic, 1.4);
    }
    text(dl, x + 38, y + 7, 14, C(TEXT), n.text);
    text(dl, x + 38, y + 24, 12, C(DIM), n.on ? "Enabled" : "Disabled");
    dl.AddRectFilled(V(x + 1, y + th - 2.5), V(x + 1 + (tw - 2) * clamp(1 - n.age / life, 0, 1), y + th - 1.5), C(n.on ? ACC : MUTE));
  });
  toasts = toasts.filter((n) => n.age < 2.4);
  GA = 1;
}

// ---- Sidebar icons (24px box centered on cx, cy) -------------------------------------------------

/** @param {ImDrawList} dl */
function icon(dl, i, cx, cy, c) {
  switch (i) {
    case 0: // crossed swords
      dl.AddLine(V(cx - 7, cy + 7), V(cx + 7, cy - 7), c, 1.6);
      dl.AddLine(V(cx + 7, cy + 7), V(cx - 7, cy - 7), c, 1.6);
      break;
    case 1: // chevrons
      for (let k = 0; k < 2; k++) {
        const x = cx - 6 + k * 6;
        dl.AddLine(V(x, cy - 6), V(x + 6, cy), c, 1.6);
        dl.AddLine(V(x + 6, cy), V(x, cy + 6), c, 1.6);
      }
      break;
    case 2: // person
      dl.AddCircle(V(cx, cy - 4), 4, c, 16, 1.6);
      dl.PathClear();
      dl.PathArcTo(V(cx, cy + 10), 8, Math.PI, Math.PI * 2, 16);
      dl.PathStroke(c, 1.6);
      break;
    case 3: // eye
      dl.AddBezierQuadratic(V(cx - 9, cy), V(cx, cy - 10), V(cx + 9, cy), c, 1.6);
      dl.AddBezierQuadratic(V(cx - 9, cy), V(cx, cy + 10), V(cx + 9, cy), c, 1.6);
      dl.AddCircleFilled(V(cx, cy), 2.6, c, 12);
      break;
    case 4: // globe
      dl.AddCircle(V(cx, cy), 8, c, 20, 1.6);
      dl.AddEllipse(V(cx, cy), V(3.5, 8), c, 0, 16, 1.3);
      dl.AddLine(V(cx - 8, cy), V(cx + 8, cy), c, 1.3);
      break;
    default: // grid
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        dl.AddRect(V(cx - 7 + a * 8, cy - 7 + b * 8), V(cx - 1 + a * 8, cy - 1 + b * 8), c, 1.5, 1.4);
      }
  }
}

// ---- Settings rows -----------------------------------------------------------------------------

const rowH = (s) => (s.t === "slider" ? 36 : 24);
const settingsH = (m) => (m.settings.length ? m.settings.reduce((a, s) => a + rowH(s), 0) + 8 : 0);

/** @param {ImDrawList} dl */
function drawSetting(dl, s, x0, y, x1, canHit, dt) {
  const px = x0 + 12, qx = x1 - 12;
  const h = rowH(s);

  if (s.t === "slider") {
    const ty = y + 26;
    const over = canHit && hot(x0 + 6, ty - 9, x1 - 6, ty + 9);
    if (over && inp.click) gui.active = s;
    if (gui.active === s && inp.down) {
      const q = Math.pow(10, s.dec);
      s.val = Math.round((s.min + clamp((inp.x - px) / (qx - px), 0, 1) * (s.max - s.min)) * q) / q;
    }
    s.hov = damp(s.hov, over || gui.active === s ? 1 : 0, 16, dt);
    s.d = damp(s.d, (s.val - s.min) / (s.max - s.min), 24, dt);
    const fx = px + (qx - px) * s.d;
    text(dl, px, y + 4, 12, C(DIM), s.name);
    const v = s.val.toFixed(s.dec);
    text(dl, qx - textW(12, v), y + 4, 12, C(TEXT), v);
    dl.AddRectFilled(V(px, ty - 1), V(qx, ty + 1), C(LINE), 1);
    dl.AddRectFilled(V(px, ty - 1), V(fx, ty + 1), C(ACC), 1);
    dl.AddCircleFilled(V(fx, ty), 3.5 + 0.5 * s.hov, C(TEXT), 20);
  } else if (s.t === "check") {
    const over = canHit && hot(x0, y, x1, y + h);
    if (over && inp.click) s.val = !s.val;
    s.hov = damp(s.hov, over ? 1 : 0, 16, dt);
    s.a = damp(s.a, s.val ? 1 : 0, 18, dt);
    text(dl, px, y + 5, 12.5, C(mixc(DIM, TEXT, Math.max(s.a, s.hov))), s.name);
    dl.AddRectFilled(V(qx - 24, y + 6), V(qx, y + 18), C(mixc([58, 58, 64], ACC, s.a)), 6);
    dl.AddCircleFilled(V(qx - 18 + s.a * 12, y + 12), 4, C(mixc(DIM, WHITE_, s.a)), 16);
  } else {
    // Mode: click to go to the next option, right click for the previous one.
    const over = canHit && hot(x0, y, x1, y + h);
    if (over && (inp.click || inp.rclick)) {
      s.dir = inp.rclick ? -1 : 1;
      s.i = (s.i + s.dir + s.opts.length) % s.opts.length;
      s.flash = 1;
    }
    s.flash = damp(s.flash || 0, 0, 10, dt);
    s.hov = damp(s.hov || 0, over ? 1 : 0, 16, dt);
    text(dl, px, y + 5, 12.5, C(mixc(DIM, TEXT, s.hov)), s.name);
    const o = s.opts[s.i], ow = textW(12.5, o);
    const g = GA;
    GA *= 1 - s.flash * 0.8;
    text(dl, qx - 12 - ow + (s.dir || 1) * s.flash * 8, y + 5, 12.5, C(ACC), o);
    GA = g;
    const ac = C(mixc(MUTE, TEXT, s.hov));
    dl.AddLine(V(qx - ow - 22, y + 8), V(qx - ow - 25, y + 12), ac, 1.4);
    dl.AddLine(V(qx - ow - 25, y + 12), V(qx - ow - 22, y + 16), ac, 1.4);
    dl.AddLine(V(qx - 4, y + 8), V(qx - 1, y + 12), ac, 1.4);
    dl.AddLine(V(qx - 1, y + 12), V(qx - 4, y + 16), ac, 1.4);
  }
  return h;
}

// ---- One module button -------------------------------------------------------------------------

/** @param {ImDrawList} dl */
function drawModule(dl, m, mi, x0, y0, x1, canHit, dt) {
  const sh = settingsH(m);
  m.openA = damp(m.openA, m.open ? 1 : 0, 12, dt);
  const hov = canHit && hot(x0, y0, x1, y0 + MOD_H);
  m.hov = damp(m.hov, hov ? 1 : 0, 16, dt);
  m.onA = damp(m.onA, m.on ? 1 : 0, 14, dt);

  const dx = x1 - 15;
  if (hov) {
    if (inp.click) {
      if (m.settings.length && Math.abs(inp.x - dx) < 12) m.open = !m.open;
      else { m.on = !m.on; toast(m); }
    }
    if (inp.rclick && m.settings.length) m.open = !m.open;
  }

  // Enabled modules invert to white; the rest stay black.
  if (m.onA > 0.01) dl.AddRectFilled(V(x0, y0), V(x1, y0 + MOD_H), C(WHITE_, 255 * m.onA));
  if (m.hov > 0.01) dl.AddRectFilled(V(x0, y0), V(x1, y0 + MOD_H), C(WHITE_, 9 * m.hov * (1 - m.onA)));
  const tc = mixc(mixc(DIM, TEXT, m.hov), [10, 10, 12], m.onA);
  text(dl, x0 + 12, y0 + 5, 13, C(tc), m.name);
  if (m.key && m.hov > 0.02) text(dl, x1 - 32 - textW(11, m.key), y0 + 7, 11, C(tc, 170 * m.hov), m.key);
  if (m.settings.length) {
    const dc = C(mixc(mixc(MUTE, TEXT, m.hov), [10, 10, 12], m.onA));
    for (let k = -1; k <= 1; k++) dl.AddCircleFilled(V(dx, y0 + MOD_H / 2 + k * 4), 1.2, dc, 8);
  }

  let h = MOD_H;
  if (m.openA > 0.02) {
    const eh = sh * m.openA;
    dl.PushClipRect(V(x0, y0 + MOD_H), V(x1, y0 + MOD_H + eh), true);
    dl.AddRectFilled(V(x0, y0 + MOD_H), V(x1, y0 + MOD_H + eh), C(SETBG));
    let y = y0 + MOD_H + 4;
    const g = GA;
    m.settings.forEach((s, k) => {
      GA = g * clamp(m.openA * 1.6 - k * 0.15, 0, 1);
      y += drawSetting(dl, s, x0, y, x1, canHit && m.openA > 0.9, dt);
    });
    GA = g;
    dl.PopClipRect();
    h += eh;
  }
  return h;
}

// ---- Category panels ---------------------------------------------------------------------------

/** @param {ImDrawList} dl */
function drawPanel(dl, c, ci, rank, pw, live, dt) {
  // Panels drop in one after another when the GUI opens.
  const p = outCubic((gui.openT - rank * 0.05) / 0.4);
  const save = GA;
  GA *= p;
  const x0 = c.x, y0 = c.y - (1 - p) * 24, x1 = x0 + pw;

  c.collA = damp(c.collA, c.collapsed ? 0 : 1, 14, dt);
  let content = 0;
  c.mods.forEach((m) => { content += MOD_H + settingsH(m) * m.openA; });
  c.h = HEAD_H + content * c.collA + 4 * c.collA;
  const y1 = y0 + c.h;

  for (let k = 1; k < 5; k++) dl.AddRectFilled(V(x0 - k, y0 - k + 4), V(x1 + k, y1 + k + 4), C([0, 0, 0], 14), 3 + k);
  dl.AddRectFilled(V(x0, y0), V(x1, y1), C(BG), 3);
  dl.AddRectFilled(V(x0, y0), V(x1, y0 + HEAD_H), C(HEADER), 3, c.collA > 0.02 ? ImDrawFlags.RoundCornersTop : ImDrawFlags.RoundCornersAll);
  dl.AddLine(V(x0, y0 + HEAD_H - 0.5), V(x1, y0 + HEAD_H - 0.5), C(LINE), 1);
  icon(dl, ci, x0 + 20, y0 + HEAD_H / 2, C(TEXT));
  text(dl, x0 + 40, y0 + 7, 14.5, C(TEXT), c.name);
  const sc = 1 - 2 * c.collA; // chevron points down when collapsed, up when open
  const cc = C(DIM);
  dl.AddLine(V(x1 - 22, y0 + HEAD_H / 2 + sc * 2.5), V(x1 - 17, y0 + HEAD_H / 2 - sc * 2.5), cc, 1.5);
  dl.AddLine(V(x1 - 17, y0 + HEAD_H / 2 - sc * 2.5), V(x1 - 12, y0 + HEAD_H / 2 + sc * 2.5), cc, 1.5);

  if (c.collA > 0.02) {
    dl.PushClipRect(V(x0, y0 + HEAD_H), V(x1, y1), true);
    const canHit = live && gui.top === c && c.collA > 0.95;
    let y = y0 + HEAD_H;
    c.mods.forEach((m, mi) => {
      const g = GA;
      GA *= outCubic((gui.openT - rank * 0.05 - 0.1 - mi * 0.03) / 0.3);
      y += drawModule(dl, m, mi, x0, y, x1, canHit, dt);
      GA = g;
    });
    dl.PopClipRect();
  }
  dl.AddRect(V(x0, y0), V(x1, y1), C(LINE, 120), 3, 1);
  GA = save;
}

// ---- The GUI -----------------------------------------------------------------------------------

/** @param {ImDrawList} dl */
function drawGui(dl, dt, sw, sh) {
  const gap = 12;
  const pw = clamp(Math.floor((sw - 60 - 5 * gap) / 6), 136, 168);
  if (!gui.placed) {
    const total = 6 * pw + 5 * gap;
    CATS.forEach((c, i) => { c.x = (sw - total) / 2 + i * (pw + gap); c.y = 70; c.collapsed = false; c.collA = 1; c.h = 300; });
    gui.placed = true;
  }
  if (gui.open && !gui.wasOpen) gui.openT = 0;
  gui.wasOpen = gui.open;
  gui.openT += dt;
  gui.o = damp(gui.o, gui.open ? 1 : 0, 12, dt);

  if (!inp.down) {
    // A header press that never turned into a drag collapses the panel.
    if (gui.drag && !gui.drag.moved) gui.drag.p.collapsed = !gui.drag.p.collapsed;
    gui.drag = null;
    gui.active = null;
  }
  if (gui.o < 0.01) return;

  GA = gui.o;
  const live = gui.open && gui.o > 0.9;

  // The panel under the mouse (topmost first), so overlapping panels don't both react.
  gui.top = null;
  if (live) {
    for (let k = gui.order.length - 1; k >= 0; k--) {
      const c = CATS[gui.order[k]];
      if (hot(c.x, c.y, c.x + pw, c.y + c.h)) { gui.top = c; break; }
    }
  }
  if (live && inp.click && gui.top && hot(gui.top.x, gui.top.y, gui.top.x + pw, gui.top.y + HEAD_H)) {
    const c = gui.top;
    gui.drag = { p: c, dx: inp.x - c.x, dy: inp.y - c.y, sx: inp.x, sy: inp.y, moved: false };
    gui.order = gui.order.filter((i) => CATS[i] !== c).concat(CATS.indexOf(c));
  }
  if (gui.drag && inp.down) {
    const d = gui.drag;
    if (Math.hypot(inp.x - d.sx, inp.y - d.sy) > 4) d.moved = true;
    if (d.moved) {
      d.p.x = clamp(inp.x - d.dx, -pw + 40, sw - 40);
      d.p.y = clamp(inp.y - d.dy, 0, sh - HEAD_H);
    }
  }

  dl.AddRectFilled(V(0, 0), V(sw, sh), C([0, 0, 0], 120));

  gui.order.forEach((ci, rank) => drawPanel(dl, CATS[ci], ci, rank, pw, live, dt));

  GA = 1;
}

// When the GUI is hidden, a small hint in the corner brings it back.
/** @param {ImDrawList} dl */
function drawHint(dl, dt, sh) {
  GA = 1 - clamp(gui.o * 1.5, 0, 1);
  if (GA < 0.01) { GA = 1; return; }
  const label = "Insert  to open";
  const w = textW(12.5, label) + 28, x = 12, y = sh - 38;
  const over = !gui.open && hot(x, y, x + w, y + 26);
  gui.hintHov = damp(gui.hintHov, over ? 1 : 0, 16, dt);
  if (over && inp.click) gui.open = true;
  dl.AddRectFilled(V(x, y), V(x + w, y + 26), C(BG, 225), 3);
  dl.AddRect(V(x, y), V(x + w, y + 26), C(mixc(LINE, ACC, gui.hintHov)), 3, 1);
  text(dl, x + 14, y + 5, 12.5, C(mixc(DIM, ACC, gui.hintHov)), label);
  GA = 1;
}

function frame() {
  const io = ImGui.GetIO();
  const dt = Math.min(io.DeltaTime, 1 / 30);
  const mp = ImGui.GetMousePos();
  inp.x = mp.x; inp.y = mp.y;
  inp.click = ImGui.IsMouseClicked(0);
  inp.rclick = ImGui.IsMouseClicked(1);
  inp.down = ImGui.IsMouseDown(0);
  inp.wheel = io.MouseWheel;
  if (ImGui.IsKeyPressed(ImGuiKey._Insert, false)) gui.open = !gui.open;

  overlay((dl) => {
    drawHud(dl, dt, io.DisplaySize.x, io.DisplaySize.y);
    drawGui(dl, dt, io.DisplaySize.x, io.DisplaySize.y);
    drawHint(dl, dt, io.DisplaySize.y);
  });
}
`,
    "Dynamic island": `// Dynamic island: a glass pill at the top of the screen that morphs between states.
// Use the "Dynamic island" window to trigger them. Each state has its own size, which is
// animated on a spring, and its own content, which cross-fades. Everything is a draw list call.

const FONT = assets.has("Roboto-Medium.ttf") ? assets.font("Roboto-Medium.ttf") : null;

let GA = 1; // global alpha, multiplied into every color

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, speed, dt) => a + (b - a) * (1 - Math.exp(-speed * dt));
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const C = (c, a = 255) => IM_COL32(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), Math.round(clamp(a * GA, 0, 255)));
const V = (x, y) => new ImVec2(x, y);
const WHITE = [255, 255, 255], BLACK = [0, 0, 0];

// An underdamped spring: x chases target and overshoots a little, which gives the island its bounce.
function spring(s, target, dt) {
  const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += ((target - s.x) * 190 - s.v * 15) * h;
    s.x += s.v * h;
  }
}

// ---- Looks -------------------------------------------------------------------------------------

const STYLES = {
  Sky: {
    top: [142, 186, 252], bot: [58, 112, 224], edge: [255, 255, 255], edgeA: 170,
    text: [255, 255, 255], sub: [226, 240, 255], subA: 210, track: [14, 40, 110], shadow: [10, 30, 100],
    shadowText: true, sky: [[112, 164, 246], [196, 220, 252]], cloudA: 46,
  },
  Dark: {
    top: [58, 62, 78], bot: [22, 24, 33], edge: [255, 255, 255], edgeA: 46,
    text: [246, 248, 252], sub: [176, 184, 202], subA: 255, track: [0, 0, 0], shadow: [0, 0, 0],
    shadowText: false, sky: [[16, 18, 26], [36, 42, 58]], cloudA: 8,
  },
};
let S = STYLES.Sky;

const BLOCKS = [
  { name: "Grass", c: [96, 172, 52] },
  { name: "Stone", c: [138, 140, 148] },
  { name: "Planks", c: [190, 146, 80] },
  { name: "Obsidian", c: [92, 48, 150] },
  { name: "Wool", c: [214, 62, 62] },
  { name: "Lapis", c: [48, 92, 214] },
  { name: "Gold", c: [250, 200, 48] },
];

// An 8x8 face, like a Minecraft skin: H hair, S skin, W eye white, B iris, N nose, M mouth.
const FACE = ["HHHHHHHH", "HHHHHHHH", "HSSSSSSH", "SSSSSSSS", "SBWSSWBS", "SSSNNSSS", "SSMMMMSS", "SSSSSSSS"];
const SKINS = [
  { name: "Steve", H: [68, 44, 26], S: [196, 138, 102], W: [255, 255, 255], B: [70, 64, 160], N: [166, 104, 76], M: [116, 66, 50] },
  { name: "Dream", H: [210, 150, 60], S: [226, 178, 140], W: [255, 255, 255], B: [40, 120, 70], N: [196, 144, 108], M: [150, 90, 76] },
  { name: "Alex", H: [28, 22, 20], S: [128, 86, 60], W: [255, 255, 255], B: [30, 30, 30], N: [104, 66, 46], M: [78, 46, 36] },
  { name: "Notch", H: [150, 150, 154], S: [210, 160, 124], W: [255, 255, 255], B: [60, 90, 170], N: [180, 128, 96], M: [130, 80, 66] },
];

const NOTIFY = {
  info: { c: [70, 150, 255], title: "Config loaded", msg: "default.json, 42 modules" },
  success: { c: [58, 198, 118], title: "Config saved", msg: "Written to default.json" },
  warn: { c: [255, 184, 56], title: "Low durability", msg: "Diamond sword is at 12%", glow: [255, 184, 56] },
  error: { c: [255, 80, 92], title: "Disconnected", msg: "Connection timed out", glow: [255, 80, 92] },
};
const MODULES = ["KillAura", "Scaffold", "Sprint", "Fly", "ESP", "Velocity", "Speed"];

// Every state: its size and what it needs. Content lives in DRAW below, keyed by id.
const STATES = [
  { id: "idle", label: "Idle", w: 312, h: 46 },
  { id: "scaffold", label: "Scaffold", w: 352, h: 48 },
  { id: "fight", label: "Fight", w: 258, h: 46 },
  { id: "toggle", label: "Module toggle", w: 252, h: 46 },
  { id: "notify", label: "Notification", w: 322, h: 54 },
  { id: "music", label: "Music", w: 344, h: 62 },
  { id: "timer", label: "Timer", w: 214, h: 46 },
  { id: "loading", label: "Loading", w: 304, h: 52 },
  { id: "health", label: "Low health", w: 212, h: 46, glow: [255, 70, 84] },
  { id: "ping", label: "High ping", w: 224, h: 46, glow: [255, 180, 50] },
  { id: "chat", label: "Chat", w: 344, h: 54 },
  { id: "rec", label: "Recording", w: 184, h: 40, glow: [255, 70, 84] },
  { id: "speed", label: "Speed", w: 224, h: 46 },
  { id: "mini", label: "Minimized", w: 66, h: 36 },
];
const BY_ID = Object.fromEntries(STATES.map((s) => [s.id, s]));

const sim = {
  block: 0, blocks: 64, trail: 1, run: [true],
  fight: { hp: 1, trail: 1, time: 15, flash: 0, skin: 0, next: 0.8 },
  tg: 1, toggleOn: true, module: "KillAura", kind: "info",
  load: 0, rec: 0,
  auto: [false], interval: [3], cycleT: 0,
  style: "Sky", backdrop: [true],
};
const isl = {
  id: "idle", w: { x: 312, v: 0 }, h: { x: 46, v: 0 },
  alpha: Object.fromEntries(STATES.map((s) => [s.id, s.id === "idle" ? 1 : 0])),
  gc: [255, 70, 84], ga: 0,
};

function newTarget() {
  const f = sim.fight;
  f.hp = 1; f.trail = 1; f.time = 15; f.skin = (f.skin + 1) % SKINS.length; f.next = 0.8;
}
function hit() {
  const f = sim.fight;
  f.hp -= 0.07 + Math.random() * 0.08;
  f.flash = 1;
  f.next = 0.5 + Math.random() * 0.7;
  if (f.hp <= 0.03) newTarget();
}
function go(id, payload) {
  if (id === "fight" && isl.id !== "fight") newTarget();
  if (id === "rec" && isl.id !== "rec") sim.rec = 0;
  if (id === "loading" && isl.id !== "loading") sim.load = 0;
  if (id === "toggle") {
    if (payload !== undefined) sim.toggleOn = payload;
    sim.module = MODULES[Math.floor(Math.random() * MODULES.length)];
  }
  if (id === "notify" && payload) sim.kind = payload;
  isl.id = id;
  sim.cycleT = 0;
}

function updateSim(dt, t) {
  S = STYLES[sim.style];
  const f = sim.fight;
  if (isl.id === "scaffold" && sim.run[0]) {
    sim.blocks -= (3.8 + 0.8 * Math.sin(t * 1.7)) * dt;
    if (sim.blocks <= 0) sim.blocks = 64;
  }
  const frac = sim.blocks / 64;
  sim.trail = sim.trail < frac ? frac : damp(sim.trail, frac, 2.4, dt);

  if (isl.id === "fight" && sim.run[0]) {
    f.time -= dt;
    f.next -= dt;
    if (f.next <= 0) hit();
    if (f.time <= 0) newTarget();
  }
  f.flash = damp(f.flash, 0, 8, dt);
  f.trail = f.trail < f.hp ? f.hp : damp(f.trail, f.hp, 2.6, dt);

  sim.tg = damp(sim.tg, sim.toggleOn ? 1 : 0, 14, dt);
  if (isl.id === "loading") { sim.load += dt / 6; if (sim.load > 1) sim.load = 0; }
  if (isl.id === "rec") sim.rec += dt;
  if (sim.auto[0]) {
    sim.cycleT += dt;
    if (sim.cycleT >= sim.interval[0]) {
      const i = STATES.findIndex((s) => s.id === isl.id);
      go(STATES[(i + 1) % STATES.length].id);
    }
  }
}

// ---- Drawing helpers ---------------------------------------------------------------------------

const ink = (a = 255) => C(S.text, a);
const dim = (a = 1) => C(S.sub, S.subA * a);

// dl.AddText and ImGui.CalcTextSize don't work in this build (an empty text_end gets passed through),
// so text goes through ImGui.Text on the overlay window, and widths are measured by laying text out off-screen.
function txt(dl, x, y, size, col, s) {
  ImGui.PushFont(FONT || ImGui.GetFont(), size);
  if (S.shadowText) {
    ImGui.SetCursorScreenPos(V(x, y + 1));
    ImGui.PushStyleColor(ImGuiCol.Text, C(S.shadow, 120));
    ImGui.Text(s);
    ImGui.PopStyleColor();
  }
  ImGui.SetCursorScreenPos(V(x, y));
  ImGui.PushStyleColor(ImGuiCol.Text, col);
  ImGui.Text(s);
  ImGui.PopStyleColor();
  ImGui.PopFont();
}
const WIDTHS = new Map();
function textW(size, s) {
  const key = size + "|" + s;
  let w = WIDTHS.get(key);
  if (w === undefined) {
    ImGui.PushFont(FONT || ImGui.GetFont(), size);
    ImGui.SetCursorScreenPos(V(-4000, -4000));
    ImGui.Text(s);
    w = ImGui.GetItemRectSize().x;
    ImGui.PopFont();
    if (WIDTHS.size > 3000) WIDTHS.clear();
    WIDTHS.set(key, w);
  }
  return w;
}
// Two stacked lines, centered on cy.
/** @param {ImDrawList} dl */
function two(dl, x, cy, top, bottom, size = 14) {
  txt(dl, x, cy - size - 1, size, ink(), top);
  txt(dl, x, cy + 1, size - 2, dim(), bottom);
}

// A rounded shape with a vertical gradient: draw it once, then recolor each vertex by its height.
// The antialiasing fringe vertices keep their own alpha, so the edge stays smooth.
/** @param {ImDrawList} dl */
function glass(dl, x0, y0, x1, y1, r, top, bot) {
  const first = dl.VtxCount, h = y1 - y0;
  dl.AddRectFilled(V(x0, y0), V(x1, y1), C(WHITE), r);
  for (let i = first; i < dl.VtxCount; i++) {
    const a = dl.GetVtxColor(i) >>> 24;
    const c = mixc(top, bot, clamp((dl.GetVtxPos(i).y - y0) / h, 0, 1));
    dl.SetVtxColor(i, IM_COL32(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), a));
  }
}
// A soft white sheen that fades out over the top half.
/** @param {ImDrawList} dl */
function sheen(dl, x0, y0, x1, y1, r, strength) {
  const first = dl.VtxCount, h = (y1 - y0) * 0.55;
  dl.AddRectFilled(V(x0 + 1.5, y0 + 1.5), V(x1 - 1.5, y1 - 1.5), C(WHITE), r);
  for (let i = first; i < dl.VtxCount; i++) {
    const a = dl.GetVtxColor(i) >>> 24;
    const k = Math.max(0, 1 - (dl.GetVtxPos(i).y - y0) / h);
    dl.SetVtxColor(i, IM_COL32(255, 255, 255, Math.round(a / 255 * strength * k)));
  }
}

/** @param {ImDrawList} dl */
function cloud(dl, cx, cy, s, c) {
  dl.AddCircleFilled(V(cx - 5.5 * s, cy + 1.5 * s), 4.5 * s, c, 20);
  dl.AddCircleFilled(V(cx - 0.5 * s, cy - 2.5 * s), 6.5 * s, c, 24);
  dl.AddCircleFilled(V(cx + 5.5 * s, cy + 0.5 * s), 5 * s, c, 20);
  dl.AddRectFilled(V(cx - 5.5 * s, cy + 1 * s), V(cx + 5.5 * s, cy + 6 * s), c, 2 * s);
}
/** @param {ImDrawList} dl */
function logo(dl, cx, cy, r) {
  dl.AddCircleFilled(V(cx, cy), r + 1.5, C(WHITE, 100), 32);
  dl.AddCircleFilled(V(cx, cy), r, C([44, 108, 226]), 32);
  dl.AddCircleFilled(V(cx, cy - r * 0.4), r * 0.6, C(WHITE, 28), 24);
  cloud(dl, cx, cy - 0.5, r / 16 * 0.95, C(WHITE));
}
// An isometric block: top, left and right faces in three shades.
/** @param {ImDrawList} dl */
function cube(dl, cx, cy, s, c) {
  const k = 0.87;
  const top = C(mixc(c, WHITE, 0.3)), left = C(c), right = C(mixc(c, BLACK, 0.32));
  dl.AddQuadFilled(V(cx, cy - s), V(cx + s * k, cy - s * 0.5), V(cx, cy), V(cx - s * k, cy - s * 0.5), top);
  dl.AddQuadFilled(V(cx - s * k, cy - s * 0.5), V(cx, cy), V(cx, cy + s), V(cx - s * k, cy + s * 0.5), left);
  dl.AddQuadFilled(V(cx, cy), V(cx + s * k, cy - s * 0.5), V(cx + s * k, cy + s * 0.5), V(cx, cy + s), right);
  dl.AddLine(V(cx, cy), V(cx, cy + s), C(BLACK, 40), 1);
}
/** @param {ImDrawList} dl */
function head(dl, x, y, px, skin, flash) {
  for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) {
    dl.AddRectFilled(V(x + q * px, y + r * px), V(x + (q + 1) * px + 0.4, y + (r + 1) * px + 0.4), C(skin[FACE[r][q]]));
  }
  if (flash > 0.01) dl.AddRectFilled(V(x, y), V(x + 8 * px, y + 8 * px), C([255, 40, 40], 150 * flash));
  dl.AddRect(V(x - 1, y - 1), V(x + 8 * px + 1, y + 8 * px + 1), C(WHITE, 150), 3, 1.2);
}
// A progress bar: the bright part is the value, the dark tail behind it is where it just was.
/** @param {ImDrawList} dl */
function bar(dl, x0, x1, cy, h, frac, trail, col) {
  const w = x1 - x0;
  const fx = x0 + w * clamp(frac, 0, 1), tx = x0 + w * clamp(Math.max(trail, frac), 0, 1);
  dl.AddRectFilled(V(x0, cy - h / 2), V(x1, cy + h / 2), C(S.track, 70), h / 2);
  if (tx - fx > 1) dl.AddRectFilled(V(fx - h / 2, cy - h / 2), V(tx, cy + h / 2), C(mixc(col, BLACK, 0.55)), h / 2);
  if (fx - x0 > 1) {
    dl.AddRectFilled(V(x0, cy - h / 2), V(fx, cy + h / 2), C(col), h / 2);
    dl.AddRectFilled(V(x0 + h / 2, cy - h / 2 + 0.8), V(Math.max(x0 + h / 2, fx - h / 2), cy - h / 2 + 1.8), C(WHITE, 80));
  }
}
const hpColor = (hp) => (hp > 0.5 ? mixc([250, 210, 60], [70, 212, 92], (hp - 0.5) * 2) : mixc([240, 70, 70], [250, 210, 60], hp * 2));
const clock = (sec) => String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(Math.floor(sec % 60)).padStart(2, "0");

// ---- State content -----------------------------------------------------------------------------
// Each function draws one state. Left-anchored items hang off x0, right-anchored ones off x1, so the
// content stays put while the island is still springing to its new size.

const DRAW = {
  idle({ dl, x0, cy, t }) {
    logo(dl, x0 + 27, cy, 16);
    txt(dl, x0 + 52, cy - 10, 19, ink(), "cloud");
    dl.AddLine(V(x0 + 116, cy - 12), V(x0 + 116, cy + 12), C(S.text, 55), 1);
    two(dl, x0 + 130, cy, "stable", "v2.1.1");
    dl.AddLine(V(x0 + 200, cy - 12), V(x0 + 200, cy + 12), C(S.text, 55), 1);
    two(dl, x0 + 214, cy, "hypixel", Math.round(24 + 6 * Math.sin(t * 1.3)) + " ms");
  },

  scaffold({ dl, x0, x1, cy }) {
    const b = BLOCKS[sim.block], col = mixc(b.c, WHITE, 0.12);
    dl.AddCircleFilled(V(x0 + 28, cy), 18, C(b.c, 80), 32);
    dl.AddCircle(V(x0 + 28, cy), 18, C(WHITE, 130), 32, 1.2);
    cube(dl, x0 + 28, cy - 0.5, 10.5, b.c);
    bar(dl, x0 + 58, x1 - 106, cy, 6, sim.blocks / 64, sim.trail, col);
    txt(dl, x1 - 94, cy - 15, 15, ink(), Math.ceil(sim.blocks) + " blocks");
    txt(dl, x1 - 94, cy + 1, 12, dim(), (3.8 + 0.8 * Math.sin(ImGui.GetTime() * 1.7)).toFixed(1) + " b/s");
  },

  fight({ dl, x0, x1, cy }) {
    const f = sim.fight, skin = SKINS[f.skin];
    head(dl, x0 + 15 + f.flash * Math.sin(ImGui.GetTime() * 70) * 1.6, cy - 13, 3.25, skin, f.flash);
    txt(dl, x0 + 56, cy - 18, 15, ink(), f.time.toFixed(2) + "s");
    txt(dl, x1 - 16 - textW(11.5, skin.name), cy - 16, 11.5, dim(), skin.name);
    bar(dl, x0 + 56, x1 - 16, cy + 9, 6, f.hp, f.trail, hpColor(f.hp));
  },

  toggle({ dl, x0, cy }) {
    const k = sim.tg;
    dl.AddRectFilled(V(x0 + 16, cy - 10), V(x0 + 50, cy + 10), C(mixc([96, 110, 140], [58, 198, 118], k), 255), 10);
    dl.AddCircleFilled(V(x0 + 27 + k * 14, cy), 7.5, C(WHITE), 20);
    two(dl, x0 + 64, cy, sim.module, sim.toggleOn ? "Enabled" : "Disabled", 15);
  },

  notify({ dl, x0, cy }) {
    const n = NOTIFY[sim.kind], ix = x0 + 30;
    dl.AddCircleFilled(V(ix, cy), 17, C(n.c, 70), 32);
    dl.AddCircleFilled(V(ix, cy), 13, C(n.c), 32);
    const w = C(WHITE);
    if (sim.kind === "info") {
      dl.AddCircleFilled(V(ix, cy - 5), 1.7, w, 10);
      dl.AddRectFilled(V(ix - 1.5, cy - 1), V(ix + 1.5, cy + 6), w, 1);
    } else if (sim.kind === "success") {
      dl.AddLine(V(ix - 5, cy), V(ix - 1.5, cy + 4), w, 2.2);
      dl.AddLine(V(ix - 1.5, cy + 4), V(ix + 5.5, cy - 4), w, 2.2);
    } else if (sim.kind === "warn") {
      dl.AddRectFilled(V(ix - 1.5, cy - 6), V(ix + 1.5, cy + 1.5), w, 1);
      dl.AddCircleFilled(V(ix, cy + 5), 1.7, w, 10);
    } else {
      dl.AddLine(V(ix - 4.5, cy - 4.5), V(ix + 4.5, cy + 4.5), w, 2.2);
      dl.AddLine(V(ix + 4.5, cy - 4.5), V(ix - 4.5, cy + 4.5), w, 2.2);
    }
    two(dl, x0 + 58, cy, n.title, n.msg, 15);
  },

  music({ dl, x0, x1, cy, t }) {
    const ax = x0 + 15, ay = cy - 23;
    dl.AddRectFilled(V(ax, ay), V(ax + 46, ay + 46), C([226, 96, 150]), 9);
    dl.AddCircleFilled(V(ax + 30, ay + 16), 12, C([120, 90, 230], 170), 28);
    dl.AddCircleFilled(V(ax + 15, ay + 31), 10, C([255, 190, 110], 170), 24);
    dl.AddRect(V(ax, ay), V(ax + 46, ay + 46), C(WHITE, 120), 9, 1.2);
    txt(dl, x0 + 72, cy - 24, 15, ink(), "Midnight City");
    txt(dl, x0 + 72, cy - 7, 12, dim(), "M83");
    const frac = (t * 0.03) % 1;
    bar(dl, x0 + 72, x1 - 82, cy + 17, 4, frac, frac, WHITE);
    txt(dl, x1 - 72, cy + 10, 11, dim(), clock(frac * 243));
    for (let i = 0; i < 4; i++) {
      const bh = 5 + 15 * Math.abs(Math.sin(t * 3.2 + i * 1.4));
      dl.AddRectFilled(V(x1 - 34 + i * 6, cy - bh / 2 - 4), V(x1 - 30 + i * 6, cy + bh / 2 - 4), ink(230), 2);
    }
  },

  timer({ dl, x0, cy, t }) {
    const frac = 1 - (t % 30) / 30, c = V(x0 + 29, cy);
    dl.AddCircle(c, 14, C(S.track, 80), 40, 3);
    dl.PathClear();
    dl.PathArcTo(c, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, frac), 40);
    dl.PathStroke(ink(), 3);
    txt(dl, x0 + 56, cy - 17, 18, ink(), clock(frac * 30));
    txt(dl, x0 + 56, cy + 2, 12, dim(), "Bed protection");
  },

  loading({ dl, x0, x1, cy, t }) {
    const c = V(x0 + 28, cy - 2), a = t * 5;
    dl.AddCircle(c, 11, C(S.track, 70), 32, 2.5);
    dl.PathClear();
    dl.PathArcTo(c, 11, a, a + Math.PI * 1.25, 24);
    dl.PathStroke(ink(), 2.5);
    txt(dl, x0 + 54, cy - 21, 15, ink(), "Updating modules");
    txt(dl, x0 + 54, cy - 4, 12, dim(), (sim.load * 20).toFixed(1) + " of 20.0 MB");
    txt(dl, x1 - 18 - textW(17, Math.round(sim.load * 100) + "%"), cy - 20, 17, ink(), Math.round(sim.load * 100) + "%");
    bar(dl, x0 + 54, x1 - 18, cy + 15, 4, sim.load, sim.load, WHITE);
  },

  health({ dl, x0, cy, t }) {
    const s = 1.25 + 0.2 * Math.max(0, Math.sin(t * 6)), cx = x0 + 28, y = cy - 1, c = C([255, 84, 100]);
    dl.AddCircleFilled(V(cx - 4 * s, y - 3 * s), 5 * s, c, 20);
    dl.AddCircleFilled(V(cx + 4 * s, y - 3 * s), 5 * s, c, 20);
    dl.AddTriangleFilled(V(cx - 8.8 * s, y - 1.2 * s), V(cx + 8.8 * s, y - 1.2 * s), V(cx, y + 9 * s), c);
    two(dl, x0 + 56, cy, "4.5 HP", "Critical", 17);
  },

  ping({ dl, x0, cy, t }) {
    const cx = x0 + 28, by = cy + 9, c = C([255, 196, 70]);
    for (let r = 1; r <= 3; r++) {
      dl.PathClear();
      dl.PathArcTo(V(cx, by), 5.5 * r, -Math.PI * 0.78, -Math.PI * 0.22, 14);
      dl.PathStroke(c, 2.4);
    }
    dl.AddCircleFilled(V(cx, by), 2, c, 10);
    two(dl, x0 + 56, cy, Math.round(312 + 40 * Math.sin(t * 3)) + " ms", "High ping", 17);
  },

  chat({ dl, x0, x1, cy }) {
    head(dl, x0 + 15, cy - 13, 3.25, SKINS[3], 0);
    two(dl, x0 + 56, cy, "Notch", "gg, nice scaffold", 15);
    txt(dl, x1 - 18 - textW(11.5, "now"), cy - 16, 11.5, dim(), "now");
    dl.AddCircleFilled(V(x1 - 24, cy + 9), 4, C([70, 150, 255]), 12);
  },

  rec({ dl, x0, cy, t }) {
    const p = 0.55 + 0.45 * Math.sin(t * 5);
    dl.AddCircleFilled(V(x0 + 24, cy), 11, C([255, 70, 84], 50 * p), 24);
    dl.AddCircleFilled(V(x0 + 24, cy), 6, C([255, 70, 84], 255 * (0.6 + 0.4 * p)), 20);
    txt(dl, x0 + 42, cy - 8, 14, ink(), "REC");
    txt(dl, x0 + 80, cy - 8, 14, dim(), clock(sim.rec));
  },

  speed({ dl, x0, cy, t }) {
    for (let k = 0; k < 3; k++) {
      const a = 70 + 185 * Math.max(0, Math.sin(t * 7 - k * 0.9)), x = x0 + 16 + k * 8;
      dl.AddLine(V(x, cy - 8), V(x + 8, cy), ink(a), 2.4);
      dl.AddLine(V(x + 8, cy), V(x, cy + 8), ink(a), 2.4);
    }
    two(dl, x0 + 56, cy, (17.8 + 2.2 * Math.sin(t * 1.4)).toFixed(1) + " b/s", "Speed", 17);
  },

  mini({ dl, x0, w, cy }) {
    logo(dl, x0 + w / 2, cy, 13);
  },
};

// ---- Scene -------------------------------------------------------------------------------------

function drawBackdrop(sw, sh, t) {
  if (!sim.backdrop[0]) return;
  const bg = ImGui.GetBackgroundDrawList();
  GA = 1;
  bg.AddRectFilledMultiColor(V(0, 0), V(sw, sh), C(S.sky[0]), C(S.sky[0]), C(S.sky[1]), C(S.sky[1]));
  // Soft drifting clouds, so the glass has something to refract.
  for (let i = 0; i < 7; i++) {
    const x = ((i * 211 + t * (7 + i * 2.4)) % (sw + 360)) - 180, y = 70 + (i * 131) % Math.max(200, sh * 0.62), r = 36 + (i % 3) * 20;
    for (let k = 0; k < 4; k++) {
      bg.AddCircleFilled(V(x, y), r + k * 12, C(WHITE, S.cloudA * 0.35), 32);
      bg.AddCircleFilled(V(x + r * 0.9, y + 6), r * 0.8 + k * 10, C(WHITE, S.cloudA * 0.3), 32);
      bg.AddCircleFilled(V(x - r * 0.9, y + 8), r * 0.7 + k * 10, C(WHITE, S.cloudA * 0.3), 32);
    }
  }
}

function drawIsland(dt, t, sw) {
  const dl = ImGui.GetWindowDrawList(), st = BY_ID[isl.id];
  spring(isl.w, st.w, dt);
  spring(isl.h, st.h, dt);
  const w = Math.max(44, isl.w.x), h = Math.max(26, isl.h.x);
  const x0 = sw / 2 - w / 2, y0 = 18, x1 = x0 + w, y1 = y0 + h, r = Math.min(h, w) / 2, cy = y0 + h / 2;
  GA = 1;

  // Soft shadow under the pill.
  for (let k = 1; k <= 7; k++) dl.AddRectFilled(V(x0 - k * 2, y0 - k + 7), V(x1 + k * 2, y1 + k * 2 + 7), C(S.shadow, 9), r + k * 2);

  // Colored glow for urgent states (low health, warnings, errors, recording).
  const glow = st.glow || (isl.id === "notify" && NOTIFY[sim.kind].glow) || null;
  if (glow) isl.gc = glow;
  isl.ga = damp(isl.ga, glow ? 1 : 0, 9, dt);
  if (isl.ga > 0.01) {
    const p = 0.55 + 0.45 * Math.sin(t * 5);
    for (let k = 1; k <= 5; k++) dl.AddRect(V(x0 - k * 1.6, y0 - k * 1.6), V(x1 + k * 1.6, y1 + k * 1.6), C(isl.gc, (80 - k * 13) * p * isl.ga), r + k * 1.6, 2);
  }

  glass(dl, x0, y0, x1, y1, r, S.top, S.bot);
  sheen(dl, x0, y0, x1, y1, r, S.shadowText ? 46 : 26);
  dl.AddRect(V(x0, y0), V(x1, y1), C(S.edge, S.edgeA), r, 1.2);
  dl.AddLine(V(x0 + r, y0 + 1.6), V(x1 - r, y0 + 1.6), C(WHITE, S.shadowText ? 130 : 40), 1);

  // Content cross-fades: the old state fades out quickly while the new one fades in.
  dl.PushClipRect(V(x0 + 2, y0), V(x1 - 2, y1), true);
  for (const s of STATES) {
    const on = isl.id === s.id;
    isl.alpha[s.id] = damp(isl.alpha[s.id], on ? 1 : 0, on ? 12 : 26, dt);
    if (isl.alpha[s.id] < 0.01) continue;
    GA = isl.alpha[s.id];
    DRAW[s.id]({ dl, x0, y0, x1, y1, cy, w, h, t });
  }
  GA = 1;
  dl.PopClipRect();
}

// ---- Controls ----------------------------------------------------------------------------------

// A grid of equal-width buttons. The width comes from the window, so labels always fit.
function grid(items, cols, active, onPick, color) {
  const gap = 10, bw = (ImGui.GetContentRegionAvail().x - gap * (cols - 1)) / cols;
  items.forEach((it, i) => {
    if (i % cols) ImGui.SameLine();
    const on = active(it), col = color ? color(it) : null;
    if (on) ImGui.PushStyleColor(ImGuiCol.Button, new ImVec4(0.2, 0.46, 0.92, 1));
    else if (col) ImGui.PushStyleColor(ImGuiCol.Button, new ImVec4(col[0] / 255 * 0.8, col[1] / 255 * 0.8, col[2] / 255 * 0.8, 1));
    if (ImGui.Button(it.label, V(bw, 40))) onPick(it);
    if (on || col) ImGui.PopStyleColor();
  });
}

function controls() {
  ImGui.SetNextWindowPos(V(20, 90), ImGuiCond.FirstUseEver);
  ImGui.SetNextWindowSize(V(560, 760), ImGuiCond.FirstUseEver);
  ImGui.Begin("Dynamic island");
  ImGui.PushFont(FONT || ImGui.GetFont(), 18);
  ImGui.PushStyleVarImVec2(ImGuiStyleVar.FramePadding, V(14, 9));
  ImGui.PushStyleVarImVec2(ImGuiStyleVar.ItemSpacing, V(10, 10));

  ImGui.SeparatorText("State");
  grid(STATES, 3, (s) => isl.id === s.id, (s) => go(s.id));

  ImGui.SeparatorText("Scaffold");
  grid(BLOCKS.map((b, i) => ({ label: b.name, i, c: b.c })), 4, (b) => sim.block === b.i, (b) => { sim.block = b.i; go("scaffold"); }, (b) => b.c);
  ImGui.Checkbox("Place blocks", sim.run);
  ImGui.SameLine();
  if (ImGui.Button("Restock", V(140, 0))) { sim.blocks = 64; sim.trail = 1; }

  ImGui.SeparatorText("Fight");
  if (ImGui.Button("Hit target", V(180, 40))) { go("fight"); hit(); }
  ImGui.SameLine();
  if (ImGui.Button("New target", V(180, 40))) { go("fight"); newTarget(); }

  ImGui.SeparatorText("Notification");
  grid(Object.keys(NOTIFY).map((k) => ({ label: k })), 4, (k) => isl.id === "notify" && sim.kind === k.label, (k) => go("notify", k.label));

  ImGui.SeparatorText("Module toggle");
  if (ImGui.Button("Enable a module", V(230, 40))) go("toggle", true);
  ImGui.SameLine();
  if (ImGui.Button("Disable a module", V(230, 40))) go("toggle", false);

  ImGui.SeparatorText("Look");
  Object.keys(STYLES).forEach((k, i) => {
    if (i) ImGui.SameLine();
    if (ImGui.RadioButton(k, sim.style === k)) sim.style = k;
  });
  ImGui.SameLine();
  ImGui.Checkbox("Backdrop", sim.backdrop);
  ImGui.Checkbox("Cycle through every state", sim.auto);
  if (sim.auto[0]) ImGui.SliderFloat("Seconds each", sim.interval, 1, 8, "%.1f");

  ImGui.PopStyleVar(2);
  ImGui.PopFont();
  ImGui.End();
}

// A full-screen window with no background that ignores the mouse: the island's canvas.
function overlay(draw) {
  ImGui.SetNextWindowPos(V(0, 0));
  ImGui.SetNextWindowSize(ImGui.GetIO().DisplaySize);
  ImGui.PushStyleVarImVec2(ImGuiStyleVar.WindowPadding, V(0, 0));
  const F = ImGuiWindowFlags;
  ImGui.Begin("##island", null, F.NoTitleBar | F.NoResize | F.NoMove | F.NoScrollbar | F.NoScrollWithMouse | F.NoBackground | F.NoSavedSettings | F.NoInputs | F.NoNav | F.NoBringToFrontOnFocus);
  ImGui.PopStyleVar();
  draw();
  ImGui.End();
}

function frame() {
  const io = ImGui.GetIO(), dt = Math.min(io.DeltaTime, 1 / 30), t = ImGui.GetTime();
  updateSim(dt, t);
  drawBackdrop(io.DisplaySize.x, io.DisplaySize.y, t);
  overlay(() => drawIsland(dt, t, io.DisplaySize.x));
  controls();
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
