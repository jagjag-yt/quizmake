import { useEffect, useState } from 'react'

/**
 * useState と同じ使い勝手で、値を localStorage に永続化するフック。
 * ブラウザ再読み込み後も値が復元される。
 *
 * @template T
 * @param {string} key localStorage のキー
 * @param {T} initial 保存値が無い場合の初期値
 * @returns {[T, React.Dispatch<React.SetStateAction<T>>]}
 */
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw != null ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // localStorage が使えない環境（プライベートモード等）では黙って無視
    }
  }, [key, value])

  return [value, setValue]
}
