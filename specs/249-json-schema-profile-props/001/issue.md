1. Migrate jsonSchemaFlag from a method on the Provider class to a property in builtinProfiles(). Default values should be held in builtinProfiles and overridable via profile definitions in config.json. UserProvider is already compliant; align the builtin side of ClaudeProvider and CodexProvider accordingly.
2. Remove the schema file write branching in agent.js that relies on `provider.constructor.key === 'codex'`, and control it via a profile property such as `jsonSchemaMode: 'file' | 'inline'`. Eliminate the hard-coded dependency on the provider key.

<details>
<summary>ja</summary>

jsonSchemaFlag・jsonSchemaModeをプロファイルプロパティに移行

1. jsonSchemaFlagをProviderクラスのメソッドからbuiltinProfiles()のプロパティに移行する。デフォルト値はbuiltinProfilesに持たせ、config.jsonのprofile定義で上書き可能にする。UserProviderは既に対応済み。ClaudeProvider・CodexProviderのbuiltin側を合わせる。
2. agent.jsのprovider.constructor.key === 'codex'によるスキーマファイル書き出し分岐を除去し、jsonSchemaMode: 'file' | 'inline'のようなプロファイルプロパティで制御する。providerキーへのハードコード依存をなくす。

</details>