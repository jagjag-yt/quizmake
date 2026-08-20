/**
 * Snappy（生ブロック形式）の展開。
 *
 * Firefox の localStorage は SQLite に保存され、値は Snappy で圧縮されていることがある。
 * 消したデータの断片を拾うために、圧縮されたままのバイト列を自力で展開する必要がある。
 * 外部の依存を増やしたくないので、必要な範囲だけ実装している。
 *
 * 形式（https://github.com/google/snappy/blob/main/format_description.txt）:
 *   先頭に展開後の長さ（varint）、続いて要素の並び。
 *   要素は下位2ビットで種類が決まる。
 *     0: そのままの文字列
 *     1: 1バイトの距離での参照
 *     2: 2バイトの距離での参照
 *     3: 4バイトの距離での参照
 */

/**
 * varint を読む。
 * @returns {{value: number, size: number}|null}
 */
function readVarint(buf, start) {
  let value = 0
  let shift = 0
  for (let i = start; i < buf.length && i - start < 5; i += 1) {
    const byte = buf[i]
    value |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) return { value: value >>> 0, size: i - start + 1 }
    shift += 7
  }
  return null
}

/**
 * 生の Snappy ブロックを展開する。
 *
 * @param {Buffer} buf 対象
 * @param {number} start 開始位置
 * @param {number} maxOutput これ以上大きくなるなら諦める（壊れた入力対策）
 * @returns {Buffer|null} 展開できなければ null
 */
export function snappyDecompress(buf, start = 0, maxOutput = 32 * 1024 * 1024) {
  const header = readVarint(buf, start)
  if (!header) return null
  const { value: length, size } = header
  if (length < 16 || length > maxOutput) return null

  const out = Buffer.alloc(length)
  let outPos = 0
  let i = start + size

  while (outPos < length) {
    if (i >= buf.length) return null
    const tag = buf[i]
    const type = tag & 0x03

    if (type === 0) {
      // そのままの文字列
      let litLen = tag >> 2
      i += 1
      if (litLen >= 60) {
        const extra = litLen - 59
        if (i + extra > buf.length) return null
        litLen = 0
        // 4バイト長のときに符号ビットへ食い込むため、符号なしに直しながら足す
        for (let k = 0; k < extra; k += 1) litLen += buf[i + k] * 2 ** (8 * k)
        i += extra
      }
      litLen += 1
      if (!Number.isFinite(litLen) || litLen < 0 || litLen > length) return null
      if (i + litLen > buf.length || outPos + litLen > length) return null
      buf.copy(out, outPos, i, i + litLen)
      outPos += litLen
      i += litLen
      continue
    }

    let copyLen
    let offset
    if (type === 1) {
      copyLen = 4 + ((tag >> 2) & 0x07)
      if (i + 1 >= buf.length) return null
      offset = ((tag >> 5) << 8) | buf[i + 1]
      i += 2
    } else if (type === 2) {
      copyLen = 1 + (tag >> 2)
      if (i + 2 >= buf.length) return null
      offset = buf.readUInt16LE(i + 1)
      i += 3
    } else {
      copyLen = 1 + (tag >> 2)
      if (i + 4 >= buf.length) return null
      offset = buf.readUInt32LE(i + 1)
      i += 5
    }

    if (offset === 0 || offset > outPos) return null
    if (outPos + copyLen > length) return null
    // 重なる参照があるので1バイトずつ写す
    for (let k = 0; k < copyLen; k += 1) {
      out[outPos] = out[outPos - offset]
      outPos += 1
    }
  }

  return out
}
