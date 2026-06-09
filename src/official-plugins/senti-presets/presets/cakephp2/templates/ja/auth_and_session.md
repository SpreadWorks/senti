<!-- {%extends%} -->

<!-- {%block "auth-method"%} -->
### 認証方式

<!-- {{text({prompt: "認証方式の概要を説明してください。認証コンポーネント設定を含めること。", mode: "deep"})}} -->
<!-- {{/text}} -->

<!-- {{data("cakephp2.config.auth", {labels: "項目|設定値"})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "acl"%} -->
### ACL（アクセス制御）

<!-- {{text({prompt: "アクセス制御の定義と、ロールベースのアクセス制御ルールを説明してください。", mode: "deep"})}} -->
<!-- {{/text}} -->

<!-- {{data("cakephp2.config.acl", {labels: "ロール|group_id|権限"})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "login-flow"%} -->
### ログインフロー

```mermaid
sequenceDiagram
  participant User
  participant Browser
  participant AppController
  participant AuthComponent
  participant DB

  User->>Browser: ログインフォーム入力
  Browser->>AppController: POST /users/login
  AppController->>AuthComponent: 認証処理
  AuthComponent->>DB: ユーザー検証
  DB-->>AuthComponent: 認証結果
  AuthComponent-->>AppController: セッション作成
  AppController-->>Browser: リダイレクト
```
<!-- {%/block%} -->
