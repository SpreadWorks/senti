<!-- {%extends "layout"%} -->
<!-- {%block "content"%} -->
# CLI Command Reference

<!-- {%block "description"%} -->
## Description

<!-- {{text({prompt: "Write a 1-2 sentence overview of this chapter. Include the total number of commands, global options, and subcommand structure."})}} -->
<!-- {{/text}} -->

## Content
<!-- {%/block%} -->

<!-- {%block "command-list"%} -->
<!-- {{data("cli.commands.list", {header: "### Command List\n", labels: "Command|Description", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "global-options"%} -->
<!-- {{data("cli.commands.globalOptions", {header: "### Global Options\n", labels: "Option|Type|Default|Description", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "command-details"%} -->
### Command Details

<!-- {{text({prompt: "Describe each command's usage, options, and examples in detail. Create a subsection for each command.", mode: "deep"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "exit-codes"%} -->
<!-- {{data("cli.commands.exitCodes", {header: "### Exit Codes and Output\n", labels: "Code|Meaning", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->
<!-- {%/block%} -->
