/**
 * Rule for matching and parsing pipe-delimited tables.
 */
export class TableRule {
  /**
   * Check if a token is a table.
   * @param {object} token
   * @returns {boolean}
   */
  match(token) {
    return token.type === 'table';
  }

  /**
   * Parse a table token into an AST node.
   * @param {object} token
   * @returns {object}
   */
  parse(token) {
    const rows = token.rows || [];
    const header = rows[0] || [];
    const separator = rows[1] || [];
    const body = rows.slice(2);

    const alignments = separator.map(cell => {
      const trimmed = cell.trim();
      if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
      if (trimmed.endsWith(':')) return 'right';
      return 'left';
    });

    return {
      type: 'table',
      alignments,
      header: header.map((cell, i) => ({
        type: 'table_cell',
        align: alignments[i] || 'left',
        children: [cell],
      })),
      body: body.map(row => row.map((cell, i) => ({
        type: 'table_cell',
        align: alignments[i] || 'left',
        children: [cell],
      }))),
    };
  }
}
