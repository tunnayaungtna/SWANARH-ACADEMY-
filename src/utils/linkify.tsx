import React from 'react';

const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<]+|(?:zoom\.us|meet\.google\.com|t\.me|youtu\.be|youtube\.com|drive\.google\.com|docs\.google\.com)\/[^\s<]+)/gi;

/**
 * Converts plain text containing URLs into React nodes with clickable <a> links
 * that open directly in a new tab when clicked.
 */
export function renderTextWithLinks(text: string | undefined | null): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(URL_REGEX.source, 'gi');

  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    let rawUrl = match[0];

    // Strip common trailing punctuation that isn't part of the URL
    let trailingPunctuation = '';
    while (/[.,;:!?)'"\]}]$/.test(rawUrl)) {
      // Keep closing parenthesis if the URL itself contains an opening parenthesis
      if (rawUrl.endsWith(')') && rawUrl.includes('(')) {
        break;
      }
      trailingPunctuation = rawUrl.slice(-1) + trailingPunctuation;
      rawUrl = rawUrl.slice(0, -1);
    }

    if (matchStart > lastIndex) {
      parts.push(text.slice(lastIndex, matchStart));
    }

    const href = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

    parts.push(
      <a
        key={`link-${matchStart}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-indigo-600 dark:text-indigo-400 underline decoration-indigo-400/70 hover:text-indigo-800 dark:hover:text-indigo-300 hover:decoration-indigo-600 break-all font-medium transition-colors cursor-pointer select-text"
        title={`Open link: ${href}`}
      >
        {rawUrl}
      </a>
    );

    if (trailingPunctuation) {
      parts.push(trailingPunctuation);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
