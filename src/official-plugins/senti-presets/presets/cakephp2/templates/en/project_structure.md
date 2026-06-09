<!-- {%extends%} -->

<!-- {%block "directory-tree"%} -->
### Directory Structure

<!-- {{text({prompt: "Output the project directory listing in tree format."})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "directory-roles"%} -->
### Directory Responsibilities

<!-- {{text({prompt: "Describe the responsibilities of main directories (Config/Console/Controller/Model/View/Lib/Plugin) with file counts in table format."})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "libraries"%} -->
<!-- {{data("cakephp2.libs.list", {header: "### Common Libraries (Lib/)\n", labels: "Class|File|Responsibility", ignoreError: true})}} -->
<!-- {{/data}} -->

### View Layer

<!-- {{data("cakephp2.views.helpers", {header: "#### Helpers\n", labels: "Helper|Extends|Responsibility", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.views.layouts", {header: "#### Layouts\n", labels: "File|Purpose", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.views.elements", {header: "#### Elements\n", labels: "File|Purpose", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->
