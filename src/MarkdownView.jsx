import React, { useState } from "react";

// Copy SVG Icon
const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Code Block with Header and Copy button
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="md-code-block">
      <div className="md-code-header">
        <span className="md-code-lang">{language || "text"}</span>
        <button className="md-code-copy-btn" onClick={handleCopy} title="Copy code">
          {copied ? (
            <>
              <CheckIcon />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <CopyIcon />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="md-code-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Inline formatting (bold, italic, inline code)
function formatInlineText(text) {
  if (!text) return "";
  // Split by inline code first
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code key={i} className="md-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }

    // Process bold (**...**) and italic (*...*)
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bPart, j) => {
      if (bPart.startsWith("**") && bPart.endsWith("**") && bPart.length >= 4) {
        return <strong key={`${i}-${j}`}>{bPart.slice(2, -2)}</strong>;
      }
      const italicParts = bPart.split(/(\*[^*]+\*)/g);
      return italicParts.map((iPart, k) => {
        if (iPart.startsWith("*") && iPart.endsWith("*") && iPart.length >= 2) {
          return <em key={`${i}-${j}-${k}`}>{iPart.slice(1, -1)}</em>;
        }
        return iPart;
      });
    });
  });
}

// Table renderer
function renderTable(tableLines, key) {
  const cleanLines = tableLines.filter((l) => l.trim().length > 0);
  if (cleanLines.length < 2) return null;

  const parseRow = (line) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());

  const headers = parseRow(cleanLines[0]);
  // line 1 is separator (e.g. |---|---|)
  const rows = cleanLines.slice(2).map(parseRow);

  return (
    <div key={key} className="md-table-wrapper">
      <table className="md-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{formatInlineText(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{formatInlineText(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarkdownView({ content, isStreaming }) {
  if (!content) {
    return isStreaming ? <span className="streaming-cursor">▊</span> : null;
  }

  // Split content into blocks: code blocks vs text blocks
  const blocks = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: "text",
        content: content.substring(lastIndex, match.index),
      });
    }
    blocks.push({
      type: "code",
      language: match[1] || "",
      code: match[2],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    blocks.push({
      type: "text",
      content: content.substring(lastIndex),
    });
  }

  // Render each block
  return (
    <div className="markdown-body">
      {blocks.map((block, bIdx) => {
        if (block.type === "code") {
          return (
            <CodeBlock
              key={bIdx}
              language={block.language}
              code={block.code}
            />
          );
        }

        // Process text block line-by-line (headings, lists, tables, paragraphs)
        const lines = block.content.split("\n");
        const elements = [];
        let inTable = false;
        let tableLines = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          // Table detection
          if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
            inTable = true;
            tableLines.push(trimmed);
            continue;
          } else if (inTable) {
            elements.push(renderTable(tableLines, `table-${bIdx}-${i}`));
            inTable = false;
            tableLines = [];
          }

          // Empty line
          if (!trimmed) {
            continue;
          }

          // Headings
          if (trimmed.startsWith("### ")) {
            elements.push(
              <h3 key={`h3-${i}`}>{formatInlineText(trimmed.slice(4))}</h3>
            );
            continue;
          }
          if (trimmed.startsWith("## ")) {
            elements.push(
              <h2 key={`h2-${i}`}>{formatInlineText(trimmed.slice(3))}</h2>
            );
            continue;
          }
          if (trimmed.startsWith("# ")) {
            elements.push(
              <h1 key={`h1-${i}`}>{formatInlineText(trimmed.slice(2))}</h1>
            );
            continue;
          }

          // Blockquotes
          if (trimmed.startsWith("> ")) {
            elements.push(
              <blockquote key={`bq-${i}`}>
                {formatInlineText(trimmed.slice(2))}
              </blockquote>
            );
            continue;
          }

          // Bullet list items
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            elements.push(
              <li key={`li-${i}`} className="md-li">
                {formatInlineText(trimmed.slice(2))}
              </li>
            );
            continue;
          }

          // Numbered list items
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            elements.push(
              <li key={`num-li-${i}`} className="md-li-num" value={numMatch[1]}>
                {formatInlineText(numMatch[2])}
              </li>
            );
            continue;
          }

          // Normal paragraph
          elements.push(
            <p key={`p-${i}`}>{formatInlineText(trimmed)}</p>
          );
        }

        if (inTable && tableLines.length > 0) {
          elements.push(renderTable(tableLines, `table-end-${bIdx}`));
        }

        return <React.Fragment key={bIdx}>{elements}</React.Fragment>;
      })}

      {isStreaming && <span className="streaming-cursor">▊</span>}
    </div>
  );
}
