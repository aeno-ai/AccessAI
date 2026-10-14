// Small helpers over docx-js for the AccessAI reports.
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} = require('docx');

const PRIMARY = '5B4BD6';
const TINT = 'EFEAFE';
const CODE_BG = 'F4F2FB';
const FONT = 'Calibri';
const MONO = 'Consolas';
// A4 with 2 cm margins.
const PAGE = { width: 11906, height: 16838, margin: 1134 };
const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin; // 9638

/** "Plain **bold** and `code`" → TextRuns. */
function runs(text, base = {}) {
  const out = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(new TextRun({ text: text.slice(last, match.index), ...base }));
    const token = match[0];
    if (token.startsWith('**')) out.push(new TextRun({ text: token.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: token.slice(1, -1), font: MONO, size: (base.size ?? 21) - 2, ...base, bold: base.bold }));
    last = match.index + token.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const P = (text, extra = {}) => new Paragraph({ children: runs(text), spacing: { after: 120, line: 276 }, ...extra });

const H1 = (text, { newPage = true } = {}) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)], pageBreakBefore: newPage });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const H3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });

/** A label in bold followed by text, as one paragraph: "What it does: …". */
const LABEL = (label, text) =>
  new Paragraph({ children: [new TextRun({ text: `${label} `, bold: true, color: PRIMARY }), ...runs(text)], spacing: { after: 100, line: 276 } });

/** Bullets. An item may be [text, [sub-items]]. */
function bullets(items, level = 0) {
  const out = [];
  for (const item of items) {
    const [text, sub] = Array.isArray(item) ? item : [item, null];
    out.push(new Paragraph({ numbering: { reference: 'bullets', level }, children: runs(text), spacing: { after: 60, line: 264 } }));
    if (sub) out.push(...bullets(sub, level + 1));
  }
  return out;
}

let listInstance = 0;
/** A numbered list that starts again at 1. */
function numbered(items) {
  listInstance += 1;
  const instance = listInstance;
  return items.map(
    (text) => new Paragraph({ numbering: { reference: 'numbers', level: 0, instance }, children: runs(text), spacing: { after: 60, line: 264 } }),
  );
}

const border = { style: BorderStyle.SINGLE, size: 4, color: 'C9C4E8' };
const borders = { top: border, bottom: border, left: border, right: border };

// A table: headers, rows of strings (bold and code marks allowed), relative column widths.
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const columnWidths = widths.map((w) => Math.floor((w / total) * CONTENT_WIDTH));
  columnWidths[columnWidths.length - 1] += CONTENT_WIDTH - columnWidths.reduce((a, b) => a + b, 0);
  const cell = (text, index, header) =>
    new TableCell({
      borders,
      width: { size: columnWidths[index], type: WidthType.DXA },
      shading: header ? { fill: TINT, type: ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: String(text)
        .split('\n')
        .map((line) => new Paragraph({ children: runs(line, { size: 19, bold: header || undefined }), spacing: { after: 40 } })),
    });
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true)) }),
      ...rows.map((row) => new TableRow({ children: row.map((c, i) => cell(c, i, false)) })),
    ],
  });
}

/** Monospace lines on a tinted background (code, example documents). */
const code = (lines) =>
  lines.map(
    (line, i) =>
      new Paragraph({
        children: [new TextRun({ text: line || ' ', font: MONO, size: 18 })],
        shading: { fill: CODE_BG, type: ShadingType.CLEAR, color: 'auto' },
        spacing: { after: i === lines.length - 1 ? 160 : 0, line: 240 },
        indent: { left: 120 },
      }),
  );

/** A highlighted note with a coloured bar on the left. */
const note = (text) =>
  new Paragraph({
    children: runs(text),
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: PRIMARY, space: 8 } },
    shading: { fill: TINT, type: ShadingType.CLEAR, color: 'auto' },
    spacing: { before: 80, after: 160, line: 276 },
    indent: { left: 160, right: 120 },
  });

/** A likely panel question and its answer. */
const QA = (question, answer) => [
  new Paragraph({ children: [new TextRun({ text: 'Q: ', bold: true, color: PRIMARY }), new TextRun({ text: question, bold: true })], spacing: { before: 120, after: 40 } }),
  new Paragraph({ children: [new TextRun({ text: 'A: ', bold: true, color: PRIMARY }), ...runs(answer)], spacing: { after: 120, line: 276 } }),
];

const spacer = () => new Paragraph({ children: [] });

const titlePage = (title, subtitle, lines) => [
  new Paragraph({ spacing: { before: 3200 }, children: [] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true, size: 56, color: PRIMARY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 600 }, children: [new TextRun({ text: subtitle, size: 28, color: '4B5563' })] }),
  ...lines.map((line) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: runs(line, { size: 22, color: '4B5563' }) })),
  new Paragraph({ children: [new PageBreak()] }),
];

const toc = () => [
  new Paragraph({ children: [new TextRun({ text: 'Contents', bold: true, size: 32, color: PRIMARY })], spacing: { after: 200 } }),
  new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
];

function makeDocument({ title, children }) {
  return new Document({
    creator: 'AccessAI team',
    title,
    styles: {
      default: { document: { run: { font: FONT, size: 21 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 34, bold: true, color: PRIMARY, font: FONT }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 27, bold: true, color: '1A1A2E', font: FONT }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 23, bold: true, color: PRIMARY, font: FONT }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.BULLET,
            text: ['•', '–', '◦'][level],
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 400 + level * 360, hanging: 260 } } },
          })),
        },
        {
          reference: 'numbers',
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 300 } } } }],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${title} · page `, size: 17, color: '6B7280' }), new TextRun({ children: [PageNumber.CURRENT], size: 17, color: '6B7280' })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

module.exports = { P, H1, H2, H3, LABEL, bullets, numbered, table, code, note, QA, spacer, titlePage, toc, makeDocument, runs };
