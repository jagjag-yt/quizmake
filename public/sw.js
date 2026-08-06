/* eslint-env serviceworker */
/**
 * Service Worker：オフラインでも演習を続けられるようにする。
 *
 * 方針（Workbox などのライブラリは使わず、必要な分だけ自前で実装）:
 * - ページ遷移（navigate）はネットワーク優先。オンラインなら常に最新が表示され、
 *   圏外ならキャッシュしたページを返す。
 * - JS/CSS/画像などはキャッシュ優先。ビルド時にファイル名へハッシュが付くため、
 *   内容が変わればファイル名も変わり、古いものが返り続けることはない。
 * - 自分のサイト（same-origin）の GET のみ扱う。外部リクエストは素通しする。
 *
 * キャッシュを作り直したいときは CACHE_VERSION を上げる。
 */

const CACHE_VERSION = 'v1'
const CACHE_NAME = `quizmake-${CACHE_VERSION}`

/** 最初から入れておくもの（オフラインでの初回表示に必要）。 */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // 1つ失敗しても全体を失敗させない
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

/** キャッシュに入れてよいレスポンスか。 */
function isCacheable(response) {
  return response && response.ok && response.type === 'basic'
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // ページ遷移：ネットワーク優先（更新をすぐ反映）、失敗時はキャッシュ
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy))
          }
          return response
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME)
          return (await cache.match('./index.html')) ?? (await cache.match('./')) ?? Response.error()
        }),
    )
    return
  }

  // それ以外：キャッシュ優先（ハッシュ付きファイルなので内容は変わらない）
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached ?? Response.error())
    }),
  )
})
