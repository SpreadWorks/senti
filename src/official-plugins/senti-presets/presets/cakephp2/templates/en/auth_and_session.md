<!-- {%extends%} -->

<!-- {%block "auth-method"%} -->
### Authentication Method

<!-- {{text({prompt: "Describe the authentication method overview. Include authentication component configuration.", mode: "deep"})}} -->
<!-- {{/text}} -->

<!-- {{data("cakephp2.config.auth", {labels: "Item|Value"})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "acl"%} -->
### ACL (Access Control)

<!-- {{text({prompt: "Describe the access control definitions and role-based access control rules.", mode: "deep"})}} -->
<!-- {{/text}} -->

<!-- {{data("cakephp2.config.acl", {labels: "Role|group_id|Permissions"})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "login-flow"%} -->
### Login Flow

```mermaid
sequenceDiagram
  participant User
  participant Browser
  participant AppController
  participant AuthComponent
  participant DB

  User->>Browser: Enter login form
  Browser->>AppController: POST /users/login
  AppController->>AuthComponent: Authentication process
  AuthComponent->>DB: User verification
  DB-->>AuthComponent: Auth result
  AuthComponent-->>AppController: Create session
  AppController-->>Browser: Redirect
```
<!-- {%/block%} -->
