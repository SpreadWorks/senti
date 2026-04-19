/**
 * src/docs/data/text.js
 *
 * TextDataSource — AI テキスト生成を DataSource メカニズムに統合する。
 *
 * {{text({prompt: "...", mode: "deep"})}} は {{data("base.text", ...)}} の
 * シンタックスシュガーとして機能する。
 *
 * data パイプライン（resolveDataDirectives）から呼び出された場合、
 * テキスト生成は非同期処理が必要なため null を返し、
 * text.js コマンドが後続で実際の LLM 呼び出しを行う。
 */

export default function register(container) {
  const DataSource = container.get("base.DataSource");

  class TextSource extends DataSource {
    generate(_analysis, _labels) {
      return null;
    }
  }

  return TextSource;
}
