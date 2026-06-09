<!-- {%extends "layout"%} -->
<!-- {%block "content"%} -->
# システム概要

<!-- {{data("monorepo.monorepo.apps", {labels: "overview", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{text({prompt: "このプロジェクトの概要を1〜2文で説明してください。"})}} -->
<!-- {{/text}} -->

<!-- {%block "description"%} -->
## 説明

<!-- {{text({prompt: "この章の概要を1〜2文で記述してください。対象プロジェクトの構成・外部連携の有無を踏まえること。"})}} -->
<!-- {{/text}} -->

## 内容
<!-- {%/block%} -->

<!-- {%block "architecture"%} -->
### 構成図

<!-- {{text({prompt: "プロジェクトのアーキテクチャ構成図を mermaid flowchart で生成してください。主要コンポーネント間のデータフローを含めること。出力は mermaid コードブロックのみ。ノードラベル内で改行する場合は <br/> を [...] 内に含めること。ラベル外にリテラルのバックスラッシュ n（2 文字）を置かない。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "components"%} -->
### コンポーネント責務

<!-- {{text({prompt: "主要コンポーネントの配置・責務・入出力を表形式で記述してください。", mode: "deep"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "external"%} -->
### 外部連携

<!-- {{text({prompt: "外部システムとの連携がある場合、用途・接続方式を表形式で記述してください。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "environments"%} -->
### 環境差分

<!-- {{text({prompt: "環境ごと（local/staging/production）の構成差分を説明してください。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->
<!-- {%/block%} -->
