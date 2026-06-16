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
 * n8n entry point:
 *   const styleHints = $('Build Document').item.json._style_hints || {};
 *   const docBody   = $json.body;          // from Get Document node
 *   const requests  = buildTypographyRequests(styleHints, docBody);
 *   return [{ json: { requests } }];
 */

/**
 * Build Google Docs batchUpdate requests for the given style hints.
 *
 * @param {Object} styleHints  { [paraIdx: string]: string[] }
 *   Paragraph index (0-based within content) → array of style keywords.
 * @param {Object} docBody  Google Docs API body object ({ content: [...] })
 * @returns {Array} Array of batchUpdate request objects (may be empty).
 */
function buildTypographyRequests(styleHints, docBody) {
  if (!styleHints || !docBody || !docBody.content) return [];

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

  return requests;
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ──────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildTypographyRequests };
}
