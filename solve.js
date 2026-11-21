// Fast drop-in for csv-reader 1.0.0: run(input) returns exactly what
// csv-reader's readCsv returns for {text, header}: {columns, rows, errors}.
// Same broken-row policy, same error codes, same order — only faster.
// It never scans one character at a time through a helper: unquoted fields
// are found by one tight charCodeAt loop and sliced whole, quoted fields
// jump from quote to quote with indexOf, and a quoted segment is sliced
// whole (its CR/LF normalised only when one is present).

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** The reading of one CSV input, {text, header}: {columns, rows, errors}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (len > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // A quoted segment [a, b): CRLF and a lone CR inside it each read as LF.
  // The common case (no CR or LF at all) is one slice, nothing more.
  function segValue(a, b) {
    const s = text.slice(a, b);
    if (!/[\r\n]/.test(s)) return s;
    let nl = 0;
    const v = s.replace(/\r\n|\n|\r/g, () => {
      nl += 1;
      return '\n';
    });
    line += nl;
    return v;
  }

  // Reads unquoted characters onto `value` up to the next comma or line break:
  // a CR not followed by LF is dropped (stray_cr). Returns the field and how
  // it ended; `added` counts the characters kept.
  function readUnquoted(value) {
    let added = 0;
    for (;;) {
      let end = pos;
      while (end < len) {
        const c = text.charCodeAt(end);
        if (c === 44 || c === 10 || c === 13) break;
        end++;
      }
      if (end > pos) {
        value += text.slice(pos, end);
        added += end - pos;
        pos = end;
      }
      if (pos >= len) return { value, ended: END, added };
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        return { value, ended: COMMA, added };
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      // c is CR: CRLF ends the line, a lone CR is dropped with stray_cr.
      if (text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      error('stray_cr');
      pos += 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let value = '';
    let segStart = pos;
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        error('unterminated_quote');
        return readUnquoted('"');
      }
      if (text.charCodeAt(q + 1) === 34) {
        // A doubled quote: one quote in the value, and the field goes on.
        value += segValue(segStart, q);
        value += '"';
        pos = q + 2;
        segStart = pos;
        continue;
      }
      value += segValue(segStart, q);
      pos = q + 1;
      if (pos >= len) return { value, ended: END };
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        return { value, ended: COMMA };
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      // What follows the closing quote is appended as it stands, up to the
      // next comma or line break.
      const junk = readUnquoted(value);
      if (junk.added > 0) error('quote_junk');
      return junk;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
