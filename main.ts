// news-image-20261124 — "The World in One Day"
// A deterministic program that draws a one-page newspaper front page summing
// up Tuesday 24 November 2026 in world news, and writes it as a 1024x1024 PNG
// to /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png).
// Node 22 standard library only. No network, no randomness, no timestamps:
// the same input always produces the same bytes.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

// ---------------------------------------------------------------- canvas ---
const W = 1024;
const H = 1024;
const PAPER = [246, 241, 229];
const INK = [20, 18, 16];
const RED = [179, 38, 30];
const NAVY = [29, 53, 87];
const GRAY = [107, 100, 85];
const PANEL = [255, 253, 246];
const AMBER = [232, 163, 61];

const px = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function setPixel(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = c[0];
  px[o + 1] = c[1];
  px[o + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) setPixel(i, j, c);
  }
}

function frameRect(x, y, w, h, t, c) {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function drawLine(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawCircle(cx, cy, r, c) {
  let x = r;
  let y = 0;
  let err = 0;
  while (x >= y) {
    setPixel(cx + x, cy + y, c);
    setPixel(cx + y, cy + x, c);
    setPixel(cx - y, cy + x, c);
    setPixel(cx - x, cy + y, c);
    setPixel(cx - x, cy - y, c);
    setPixel(cx - y, cy - x, c);
    setPixel(cx + y, cy - x, c);
    setPixel(cx + x, cy - y, c);
    y += 1;
    err += 1 + 2 * y;
    if (2 * (err - x) + 1 > 0) {
      x -= 1;
      err += 1 - 2 * x;
    }
  }
}

// ------------------------------------------------------------ 5x7 font -----
// Hand-drawn 5-wide, 7-tall bitmap glyphs. '#' is ink, '.' is blank.
const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "\u2022": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
};

function textWidth(s, scale) {
  return s.length * 6 * scale - scale;
}

function drawChar(ch, x, y, scale, c) {
  const g = FONT[ch] || FONT[" "];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (g[row][col] === "1") {
        fillRect(x + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
}

function drawText(s, x, y, scale, c) {
  for (let i = 0; i < s.length; i++) {
    drawChar(s[i], x + i * 6 * scale, y, scale, c);
  }
}

// Draw twice, one pixel to the right, for a heavier headline weight.
function drawTextBold(s, x, y, scale, c) {
  drawText(s, x, y, scale, c);
  drawText(s, x + 1, y, scale, c);
}

function drawTextCentered(s, cx, y, scale, c) {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

// Greedy word wrap. Returns lines that fit maxW pixels at the given scale.
function wrapText(s, maxW, scale) {
  const words = s.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- layout ---
const M = 28; // outer margin
const CW = W - 2 * M; // content width

// Page frame.
frameRect(8, 8, W - 16, H - 16, 2, INK);
fillRect(0, 14, W, 3, RED);

// Masthead.
drawTextCentered("THE WORLD IN ONE DAY", 512, 30, 5, INK);
drawTextCentered("TUESDAY 24 NOVEMBER 2026", 512, 78, 2, RED);
fillRect(M, 102, CW, 3, INK);
fillRect(M, 108, CW, 1, INK);

// Hero story: COP31 collapses.
const HY = 122;
const HH = 208;
fillRect(M, HY, CW, HH, PANEL);
frameRect(M, HY, CW, HH, 2, INK);
fillRect(M + 16, HY + 18, 10, 10, RED);
drawText("CLIMATE - ANTALYA", M + 32, HY + 18, 1, RED);
drawTextBold("COP31 COLLAPSES", M + 16, HY + 40, 4, INK);
const heroBody = wrapText(
  "THE LONGEST CLIMATE SUMMIT IN HISTORY ENDS WITH NO DEAL - THE FIRST COLLAPSE SINCE 2009. THE FINAL 'ANTALYA PACT' NEVER MENTIONED FOSSIL FUELS. THE EU AND BRITAIN WALKED AWAY. THE UN CHIEF: 'DEEPLY DISAPPOINTED.'",
  756,
  2,
);
heroBody.forEach((line, i) => {
  drawText(line, M + 16, HY + 96 + i * 18, 2, INK);
});
drawText("NEXT: ALL EYES TURN TO COP32 IN ADDIS ABABA.", M + 16, HY + 182, 1, NAVY);
// Cracked globe motif at the right of the hero panel.
const GX = 892;
const GY = 226;
drawCircle(GX, GY, 58, INK);
drawCircle(GX, GY, 57, INK);
drawLine(GX - 58, GY, GX + 58, GY, INK);
drawLine(GX - 40, GY - 42, GX + 40, GY - 42, INK);
drawLine(GX - 40, GY + 42, GX + 40, GY + 42, INK);
drawLine(GX + 6, GY - 58, GX - 8, GY - 20, RED);
drawLine(GX - 8, GY - 20, GX + 10, GY + 6, RED);
drawLine(GX + 10, GY + 6, GX - 4, GY + 30, RED);
drawLine(GX - 4, GY + 30, GX + 8, GY + 58, RED);

// News grid: 2 columns x 3 rows.
function drawPanel(x, y, w, h, label, headline, body, tag) {
  fillRect(x, y, w, h, PANEL);
  frameRect(x, y, w, h, 2, INK);
  fillRect(x + 14, y + 14, 9, 9, RED);
  drawText(label, x + 30, y + 14, 1, RED);
  drawTextBold(headline, x + 14, y + 36, 2, INK);
  const lines = wrapText(body, w - 28, 1);
  lines.forEach((line, i) => {
    drawText(line, x + 14, y + 66 + i * 11, 1, INK);
  });
  drawText(tag, x + w - 14 - textWidth(tag, 1), y + h - 24, 1, RED);
}

const GX0 = M;
const GX1 = M + 496;
const PW = 472;
const PH = 172;
const GY0 = 346;
const GY1 = 530;
const GY2 = 714;

drawPanel(
  GX0, GY0, PW, PH,
  "UKRAINE - WAR AT SEA",
  "RUSSIAN WARSHIP SUNK OFF LIBYA",
  "UKRAINE SANK A RUSSIAN CORVETTE IN BENGHAZI PORT WITH NAVAL DRONES, ZELENSKY SAID - THE WAR SPREADS FAR BEYOND EUROPE. THE SHIP IS REPORTED TO BE THE CORVETTE MERKURY. DAYS EARLIER, A DRONE HIT A RUSSIAN-LINKED CARGO SHIP OFF FINLAND.",
  "22 NOV",
);
drawPanel(
  GX1, GY0, PW, PH,
  "POLAND - NATO",
  "NATO JETS RUSH TO POLAND",
  "NATO WILL SEND AWACS EARLY-WARNING AIRCRAFT AFTER THREE RUSSIAN MISSILES LANDED IN POLAND ON FRIDAY, RAISING FEARS THE WAR COULD SPILL OVER INTO NATO LAND. WARSAW SAYS THE MISSILES WERE RUSSIAN KH-101 CRUISE MISSILES.",
  "23 NOV",
);
drawPanel(
  GX0, GY1, PW, PH,
  "IRAN - STANDOFF",
  "IRAN VOWS TO FIGHT BLOCKADE",
  "TEHRAN SAYS IT WILL USE 'ALL ITS TOOLS' AGAINST THE US NAVAL BLOCKADE. THE VOW CAME AT A MONDAY BRIEFING BY IRAN'S FOREIGN MINISTRY. WASHINGTON SANCTIONS DOZENS LINKED TO IRAN'S SHADOW BANKING NETWORKS.",
  "23 NOV",
);
drawPanel(
  GX1, GY1, PW, PH,
  "INDONESIA - BANTEN",
  "FACTORY FIRE: 24 DEAD",
  "24 KILLED AND ABOUT 30 STILL MISSING AFTER A BLAZE TORE THROUGH A CANDY FACTORY IN CIKANDE, BANTEN. THE FIRE BROKE OUT ON SATURDAY EVENING; THE CAUSE IS STILL UNDER INVESTIGATION. RESCUERS PICK THROUGH THE UNSTABLE WRECKAGE.",
  "23 NOV",
);
drawPanel(
  GX0, GY2, PW, PH,
  "INDIA - NEPAL",
  "A NEW TRAIN, NEW TIES",
  "MODI AND NEPAL PM BALENDRA SHAH FLAG OFF THE AYODHYA-JANAKPUR EXPRESS. EIGHT PACTS SIGNED; INDIA PLEDGES RS 15,000 CRORE IN AID. THE WEEKLY SERVICE RUNS 604 KM BETWEEN THE TWO PILGRIM CITIES.",
  "23 NOV",
);
drawPanel(
  GX1, GY2, PW, PH,
  "SPORT",
  "ALCARAZ TAKES ATP FINALS",
  "ALCARAZ BEATS ZVEREV 6-2, 7-6(7) FOR A MAIDEN TITLE IN TURIN. VERSTAPPEN WINS THE LAS VEGAS GRAND PRIX; PANT HITS 128 IN THE DRAWN WELLINGTON TEST. THE DRAW DENTS INDIA'S WORLD TEST CHAMPIONSHIP HOPES.",
  "22 NOV",
);

// "Also today" ticker band.
const TY = 902;
fillRect(M, TY, CW, 56, INK);
const ticker =
  "TRUMP'S 28-POINT UKRAINE PLAN STILL DIVIDES ALLIES \u2022 SOUTH KOREA WARNS AFTER A RUSSIAN JET ENTERS ITS AIRSPACE \u2022 MEXICO CAPTURES DRUG LORD 'CHAPO ISIDRO' \u2022 JENSEN HUANG RETURNS AS NVIDIA CEO \u2022 ISRAELI STRIKES KILL THREE IN GAZA \u2022 THAI-CAMBODIA CEASEFIRE HOLDS";
const prefix = "ALSO TODAY: ";
const prefixW = textWidth(prefix, 1);
const firstMax = CW - 28 - prefixW;
// Wrap with the first line shortened by the prefix width, so no line
// runs past the band's right edge.
const tickerLines = [];
{
  let cur = "";
  let first = true;
  for (const w of ticker.split(" ")) {
    const maxW = first ? firstMax : CW - 28;
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, 1) <= maxW || cur === "") {
      cur = trial;
    } else {
      tickerLines.push(cur);
      cur = w;
      first = false;
    }
  }
  if (cur !== "") tickerLines.push(cur);
}
drawText(prefix, M + 14, TY + 10, 1, AMBER);
tickerLines.forEach((line, i) => {
  const x = i === 0 ? M + 14 + prefixW : M + 14;
  drawText(line, x, TY + 10 + i * 13, 1, [246, 241, 229]);
});

// Footer.
drawTextCentered(
  "SOURCES: REUTERS, CNN, AP - ALL STORIES DATED 22-24 NOV 2026",
  512,
  974,
  1,
  GRAY,
);

// ------------------------------------------------------------- PNG encode ---
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colour type RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

// ------------------------------------------------------------------- main ---
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "entry.png");
writeFileSync(outPath, png);
console.log("wrote " + outPath + " " + W + "x" + H + " " + png.length + " bytes");
