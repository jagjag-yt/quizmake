/**
 * PWA用アイコン（public/*.png）を生成するスクリプト。
 *
 *   node scripts/generate-icons.mjs
 *
 * 画像ライブラリを増やしたくないため、図形の描画と PNG エンコードを自前で行う。
 * 依存は Node 標準の zlib のみ。
 *
 * 図柄: 青地に「選択肢3つ＋正解のチェック」。
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, '../public')

const BLUE = [37, 99, 235] // #2563eb
const WHITE = [255, 255, 255]

// ---------- 図形のカバレッジ（0..1）----------
// すべて 512x512 の座標系で定義し、出力サイズに合わせて拡大縮小する。

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** 角丸長方形の内側なら true。 */
function inRoundRect(px, py, x, y, w, h, r) {
  if (px < x || py < y || px > x + w || py > y + h) return false
  const cx = Math.min(Math.max(px, x + r), x + w - r)
  const cy = Math.min(Math.max(py, y + r), y + h - r)
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

/** 円の内側なら true。 */
function inCircle(px, py, cx, cy, r) {
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

/** 線分（太さあり・端は丸）の内側なら true。 */
function inSegment(px, py, x1, y1, x2, y2, width) {
  const vx = x2 - x1
  const vy = y2 - y1
  const len2 = vx * vx + vy * vy
  let t = len2 === 0 ? 0 : ((px - x1) * vx + (py - y1) * vy) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const dx = px - (x1 + t * vx)
  const dy = py - (y1 + t * vy)
  return dx * dx + dy * dy <= (width / 2) ** 2
}

/** チェックマーク（2本の線分）。 */
function inCheck(px, py) {
  return (
    inSegment(px, py, 88, 168, 105, 185, 16) ||
    inSegment(px, py, 105, 185, 134, 148, 16)
  )
}

/**
 * 1ピクセル分の色を求める。SSAA(3x3)で輪郭を滑らかにする。
 * @param {number} px,py 512座標系での位置
 * @param {{ fullBleed: boolean, inset: number }} opts
 */
function sampleColor(px, py, step, opts) {
  const N = 3
  let bgA = 0
  const acc = [0, 0, 0, 0] // r,g,b,a を面積で重み付け

  for (let sy = 0; sy < N; sy++) {
    for (let sx = 0; sx < N; sx++) {
      const x = px + ((sx + 0.5) / N - 0.5) * step
      const y = py + ((sy + 0.5) / N - 0.5) * step

      // 背景（角丸 or 全面）
      const bgIn = opts.fullBleed ? true : inRoundRect(x, y, 0, 0, 512, 512, 96)
      if (!bgIn) continue
      bgA += 1

      // 前景は inset の分だけ内側へ縮める
      const k = 1 - opts.inset * 2
      const fx = (x - 512 * opts.inset) / k
      const fy = (y - 512 * opts.inset) / k

      let color = BLUE
      let alpha = 1

      // 選択肢の丸（1つ目は不透明、2・3つ目は半透明）
      if (inCircle(fx, fy, 110, 166, 46)) {
        color = inCheck(fx, fy) ? BLUE : WHITE
        alpha = 1
      } else if (inCircle(fx, fy, 110, 286, 46) || inCircle(fx, fy, 110, 406, 46)) {
        color = WHITE
        alpha = 0.55
      } else if (inRoundRect(fx, fy, 170, 140, 232, 52, 26)) {
        color = WHITE
        alpha = 1
      } else if (
        inRoundRect(fx, fy, 170, 260, 232, 52, 26) ||
        inRoundRect(fx, fy, 170, 380, 180, 52, 26)
      ) {
        color = WHITE
        alpha = 0.55
      }

      // 背景（青）の上に前景を合成
      const r = color[0] * alpha + BLUE[0] * (1 - alpha)
      const g = color[1] * alpha + BLUE[1] * (1 - alpha)
      const b = color[2] * alpha + BLUE[2] * (1 - alpha)
      acc[0] += r
      acc[1] += g
      acc[2] += b
      acc[3] += 1
    }
  }

  const total = N * N
  if (acc[3] === 0) return [0, 0, 0, 0]
  return [
    Math.round(acc[0] / acc[3]),
    Math.round(acc[1] / acc[3]),
    Math.round(acc[2] / acc[3]),
    Math.round(clamp01(bgA / total) * 255),
  ]
}

/** RGBA のピクセル配列を作る。 */
function render(size, opts) {
  const scale = 512 / size
  const step = scale // 1出力ピクセル = step(512座標系)
  const data = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = sampleColor((x + 0.5) * scale, (y + 0.5) * scale, step, opts)
      const i = (y * size + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = a
    }
  }
  return data
}

// ---------- PNG エンコード ----------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // 各行の先頭にフィルタ種別(0)を付ける
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- 出力 ----------

const TARGETS = [
  // 通常アイコン（角丸・背景透過）
  { file: 'icon-192.png', size: 192, opts: { fullBleed: false, inset: 0 } },
  { file: 'icon-512.png', size: 512, opts: { fullBleed: false, inset: 0 } },
  // maskable: OS側で切り抜かれるため全面塗り＋内容を内側へ
  { file: 'icon-maskable-512.png', size: 512, opts: { fullBleed: true, inset: 0.12 } },
  // iOS のホーム画面用（透過なし・角丸はOSが付ける）
  { file: 'apple-touch-icon.png', size: 180, opts: { fullBleed: true, inset: 0.06 } },
]

mkdirSync(OUT_DIR, { recursive: true })
for (const { file, size, opts } of TARGETS) {
  const png = encodePng(size, render(size, opts))
  writeFileSync(resolve(OUT_DIR, file), png)
  console.log(`wrote ${file} (${size}x${size}, ${(png.length / 1024).toFixed(1)}KB)`)
}
