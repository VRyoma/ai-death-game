/**
 * 画像パスを生成するヘルパー関数
 * GitHub Pages の basePath (/ai-death-game) を考慮する
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

/**
 * 汎用画像パスを生成する
 * @param path 画像パス（先頭の/を除く）
 * @returns basePathを考慮した画像パス
 */
export function getImagePath(path: string): string {
  // 先頭の/を削除して、basePathを追加
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE_PATH}/${normalizedPath}`;
}

/**
 * キャラクター画像のパスを生成する
 * @param characterId キャラクターID
 * @param expression 表情 (default, painful, happy, fainted)
 * @param mouth 口の状態 (0: 閉じた, 1: 開いた)
 * @returns 画像パス
 */
export function getCharacterImagePath(
  characterId: string,
  expression: string,
  mouth: number
): string {
  return `${BASE_PATH}/agents/${characterId}_${expression}_${mouth}.jpg`;
}

/**
 * マスター画像のパスを生成する
 * @param expression 表情 (default, painful, happy, fainted)
 * @param mouth 口の状態 (0: 閉じた, 1: 開いた)
 * @returns 画像パス
 */
export function getMasterImagePath(expression: string, mouth: number): string {
  return `${BASE_PATH}/agents/master_${expression}_${mouth}.jpg`;
}
