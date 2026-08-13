/**
 * 虫食いマーカーの表示方法に関する判定。
 *
 * 短い語は inline-block で字形にぴったり合わせ、長い語や句読点を含む語は
 * inline + box-decoration-break にして行またぎで分割できるようにする
 * （inline-block のままだと折り返せず1行を突き破るため）。
 */
export function shouldInline(text) {
  return String(text ?? '').length >= 5 || /[、。／,.]/.test(String(text ?? ''))
}
