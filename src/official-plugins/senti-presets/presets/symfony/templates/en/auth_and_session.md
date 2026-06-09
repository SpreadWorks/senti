<!-- {%extends%} -->

<!-- {%block "auth-method"%} -->
### Authentication Method

<!-- {{text({prompt: "Describe the Symfony authentication method. Include Security Bundle configuration (config/packages/security.yaml), firewalls, providers, and authenticators.", mode: "deep"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "acl"%} -->
### Authorization

<!-- {{text({prompt: "Describe the overview of access control using voters, security attributes (#[IsGranted]), and role hierarchy.", mode: "deep"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "session"%} -->
### Session Management

<!-- {{text({prompt: "Describe the session management approach based on the session configuration in config/packages/framework.yaml."})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "login-flow"%} -->
### Login Flow

<!-- {{text({prompt: "Generate a mermaid sequenceDiagram of the login process flow. Output only the mermaid code block. For line breaks inside participant or note labels, use <br/> inside the label; do not place a literal backslash-n (two characters) outside a label.", mode: "deep"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->
