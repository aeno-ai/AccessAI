// CSV downloads for the admin panel (HANDOFF.md §52). Every cell is quoted,
// and a cell that starts like a formula (= + - @, or a tab/return) gets a
// leading ' so a spreadsheet shows it as text instead of running it.

const MAX_ROWS = 10000;

function cell(value) {
  if (value === null || value === undefined) return '""';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** [{ header, value(row) }] + rows → CSV text (with a BOM so Excel reads UTF-8). */
function toCsv(columns, rows) {
  const lines = [columns.map((c) => cell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Sends `csv` as a download named `<name>-<YYYY-MM-DD>.csv`. */
function sendCsv(res, name, csv) {
  const day = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${name}-${day}.csv"`);
  res.set('Cache-Control', 'no-store');
  res.send(csv);
}

module.exports = { toCsv, sendCsv, cell, MAX_ROWS };
