# The reports' source

`docs/AccessAI-How-It-Works.docx` and `docs/AccessAI-Defense-Notes.docx` are made by these scripts (with the `docx` library), so they can be updated when the app changes.

| File | What it writes |
|---|---|
| `part1.js` | How It Works, Part 1: architecture |
| `part2.js` | Part 2: every feature |
| `part3.js` | Part 3: MongoDB and every collection |
| `part45.js` | Parts 4 and 5 (offline first, project map) and Appendix A (known gaps) |
| `part6.js` | Part 6: embeddings, ChromaDB and RAG (with the real `app.explain` run of 12 October 2026) |
| `files.js` | Appendix B: one line for every source file (add a row when you add a file) |
| `defense.js` | Defense Notes |
| `lib.js` | Headings, paragraphs (`**bold**`, `` `code` ``), lists, tables, notes |
| `build.js` | Puts it together; the test results quoted in the reports are near the top |
| `data/explain-*.json` | The query measurements from `backend/scripts/explainQueries.js --out …`, before and after the §19 indexes |

To rebuild (from this folder):

```
npm install
npm run build        # writes both .docx files into docs/
```

Then open each file in Word, click the table of contents → **Update Field** → **Update entire table**, and save. (A fresh build has an empty contents list until Word fills it in.)

Check every new statement against the code before adding it, and keep secrets out: the repository is public.
