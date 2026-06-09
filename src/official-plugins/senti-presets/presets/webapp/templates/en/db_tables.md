<!-- {%extends "layout"%} -->
<!-- {%block "content"%} -->
# DB Table Definitions

<!-- {%block "description"%} -->
## Description

<!-- {{text({prompt: "Write a 1-2 sentence overview of this chapter. Include the total number of tables and FK relationships."})}} -->
<!-- {{/text}} -->

## Content
<!-- {%/block%} -->

<!-- {%block "table-list"%} -->
<!-- {{data("webapp.tables.list", {header: "### Table List\n", labels: "Table|DB|Primary Purpose", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "fk"%} -->
<!-- {{data("webapp.tables.fk", {header: "### Foreign Key Relationships (FK)\n", labels: "Parent Table|Child Table|FK Column|Notes", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "indexes"%} -->
### Indexes

Index definitions should be verified directly from the DB schema.
<!-- {%/block%} -->
<!-- {%/block%} -->
