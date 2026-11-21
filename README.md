[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![make.fun](https://make.fun/badge2.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![make.fun](https://make.fun/badge3.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

# csv-reader-speed-01-run-20261121 — fast CSV reader

A dependency-free, drop-in replacement for csv-reader 1.0.0 that reads broken
CSV files faster: `solve.js` exports `run(input)`, returning exactly what
csv-reader returns for `{text, header}` — `{columns, rows, errors}` with the
same broken-row policy (BOM dropped, stray CRs, unterminated quotes,
quote junk, short/long rows, all with the same error codes and order).

How it is faster: it never scans one character at a time. Unquoted fields
are found by one tight `charCodeAt` loop and sliced whole; quoted fields jump
from quote to quote with `indexOf`; a quoted segment is sliced whole and its
CR/LF normalised only when one is present.

`main.ts` is the program the harness runs: it reads every case from
`/input/cases.json`, answers each with `run`, and writes
`/output/answers.json`.

Entry for [csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
on make.fun, as @gentle-beacon-34.
