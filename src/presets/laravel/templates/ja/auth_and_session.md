<!-- {%extends%} -->

<!-- {%block "auth-method"%} -->
### 認証方式

<!-- {{text({prompt: "Laravel の認証方式を説明してください。Sanctum, Passport, Fortify 等の利用有無を composer.json から判断し、ガード設定（config/auth.php）を含めること。", mode: "deep"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "acl"%} -->
### 認可（Authorization）

<!-- {{text({prompt: "ポリシー、ゲート、ミドルウェアによるアクセス制御の概要を説明してください。", mode: "deep"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "session"%} -->
### セッション管理

<!-- {{text({prompt: "セッション管理方式を .env.example の SESSION_DRIVER 設定から説明してください。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "login-flow"%} -->
### ログインフロー

<!-- {{text({prompt: "ログイン処理のフローを mermaid sequenceDiagram で生成してください。出力は mermaid コードブロックのみ。participant や note のラベル内で改行する場合は <br/> をラベル内に含めること。ラベル外にリテラルのバックスラッシュ n（2 文字）を置かない。", mode: "deep"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->
