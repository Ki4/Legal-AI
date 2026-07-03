/**
 * apply-typography.js
 * n8n Code Node — build Google Docs batchUpdate requests from styleHints.
 *
 * Called after "Get Document" (GET /v1/documents/{id}) to produce styling
 * requests based on the {{!style:}} directives parsed during render-document.
 *
 * Supported keywords (from doc-engine DSL contract):
 *   center          → paragraphStyle.alignment = CENTER
 *   right           → paragraphStyle.alignment = END
 *   bold            → textStyle.bold = true (applied to text range, excl. trailing \n)
 *   keep-with-next  → paragraphStyle.keepWithNext = true
 *   keep-together   → paragraphStyle.keepLinesTogether = true
 *   page-break-before → paragraphStyle.pageBreakBefore = true
 *   indent          → paragraphStyle.indentFirstLine = 720pt EMU (≈ 0.5 inch / ~1.27 cm)
 *
 * styleHints v2 "runs" (S2-B): the optional third argument styleRuns
 *   { [paraIdx]: [{ start, end, styles: ['bold'|'italic'|'underline'] }] }
 * carries inline character ranges (offsets relative to the paragraph, measured
 * after variable substitution). Each run maps to one updateTextStyle request at
 * paragraph.startIndex + offset. Run requests are emitted AFTER the v1 requests
 * and sorted by descending startIndex (index-shift safety, research §1.3).
 *
 * n8n entry point:
 *   const styleHints = $('Build Document').item.json._style_hints || {};
 *   const styleRuns  = $('Build Document').item.json._style_runs || {};
 *   const docBody   = $json.body;          // from Get Document node
 *   const requests  = buildTypographyRequests(styleHints, docBody, styleRuns);
 *   return [{ json: { requests } }];
 */

/** Inline run keyword → Google Docs textStyle field. */
const RUN_FIELDS = { bold: 'bold', italic: 'italic', underline: 'underline' };

/**
 * Build Google Docs batchUpdate requests for the given style hints.
 *
 * @param {Object} styleHints  { [paraIdx: string]: string[] }
 *   Paragraph index (0-based within content) → array of style keywords.
 * @param {Object} docBody  Google Docs API body object ({ content: [...] })
 * @returns {Array} Array of batchUpdate request objects (may be empty).
 */
function buildTypographyRequests(styleHints, docBody, styleRuns) {
  if (!docBody || !docBody.content) return [];
  if (!styleHints) styleHints = {};

  // Filter to paragraph elements only (skip sectionBreak, tableOfContents, etc.)
  const paragraphs = docBody.content.filter((el) => el.paragraph);

  const requests = [];

  for (const [paraIdxStr, styles] of Object.entries(styleHints)) {
    const paraIdx = parseInt(paraIdxStr, 10);
    const para = paragraphs[paraIdx];
    if (!para) continue; // defensive: index out of range

    const startIndex = para.startIndex;
    const endIndex = para.endIndex; // includes the trailing \n

    const paragraphStyle = {};
    const paragraphFields = [];
    const textStyle = {};
    const textFields = [];

    for (const kw of styles) {
      switch (kw) {
        case 'center':
          paragraphStyle.alignment = 'CENTER';
          if (!paragraphFields.includes('alignment')) paragraphFields.push('alignment');
          break;
        case 'right':
          paragraphStyle.alignment = 'END';
          if (!paragraphFields.includes('alignment')) paragraphFields.push('alignment');
          break;
        case 'bold':
          textStyle.bold = true;
          if (!textFields.includes('bold')) textFields.push('bold');
          break;
        case 'keep-with-next':
          paragraphStyle.keepWithNext = true;
          paragraphFields.push('keepWithNext');
          break;
        case 'keep-together':
          paragraphStyle.keepLinesTogether = true;
          paragraphFields.push('keepLinesTogether');
          break;
        case 'page-break-before':
          paragraphStyle.pageBreakBefore = true;
          paragraphFields.push('pageBreakBefore');
          break;
        case 'indent':
          paragraphStyle.indentFirstLine = { magnitude: 720, unit: 'PT' };
          paragraphFields.push('indentFirstLine');
          break;
        default:
          break; // unknown keyword — silently skip (forward-compat)
      }
    }

    if (paragraphFields.length > 0) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex, endIndex },
          paragraphStyle,
          fields: paragraphFields.join(','),
        },
      });
    }

    if (textFields.length > 0) {
      // Text range excludes the trailing \n (endIndex - 1)
      requests.push({
        updateTextStyle: {
          range: { startIndex, endIndex: endIndex - 1 },
          textStyle,
          fields: textFields.join(','),
        },
      });
    }
  }

  // Inline runs (styleHints v2). Style-only requests never shift indices, but
  // descending order is kept as a safety invariant for future request mixes.
  const runRequests = [];
  for (const [paraIdxStr, runs] of Object.entries(styleRuns || {})) {
    const para = paragraphs[parseInt(paraIdxStr, 10)];
    if (!para || !Array.isArray(runs)) continue;

    for (const run of runs) {
      const textStyle = {};
      const fields = [];
      for (const kw of run.styles || []) {
        const field = RUN_FIELDS[kw];
        if (!field) continue; // unknown keyword — silently skip (forward-compat)
        textStyle[field] = true;
        if (!fields.includes(field)) fields.push(field);
      }
      if (!fields.length) continue;

      // Clamp to the paragraph's text range (excl. trailing \n) — defensive
      // against drift between rendered text and the fetched document.
      const startIndex = para.startIndex + run.start;
      const endIndex = Math.min(para.startIndex + run.end, para.endIndex - 1);
      if (endIndex <= startIndex) continue;

      runRequests.push({
        updateTextStyle: {
          range: { startIndex, endIndex },
          textStyle,
          fields: fields.join(','),
        },
      });
    }
  }
  runRequests.sort((a, b) => b.updateTextStyle.range.startIndex - a.updateTextStyle.range.startIndex);

  return requests.concat(runRequests);
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ──────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildTypographyRequests };
}
