// Formateadores de fecha, hora y texto para ChatDos

export function formatMessageTime(input: string | number | Date): string {
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase();
}

export function formatChatListTime(input: string | number | Date): string {
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return formatMessageTime(d);
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Ayer';
  }

  return d.toLocaleDateString('es', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function formatMessageDateSeparator(input: string | number | Date): string {
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return 'Hoy';
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Ayer';
  }

  return d.toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatLastSeen(input: string | null): string {
  if (!input) return '';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - d.getTime()) / 60000);

  if (diffMinutes < 1) {
    return 'hace un momento';
  }

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timeStr = formatMessageTime(d);

  if (isToday) {
    return `últ. vez hoy a las ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `últ. vez ayer a las ${timeStr}`;
  }

  const dateStr = d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  return `últ. vez el ${dateStr} a las ${timeStr}`;
}

export interface TextSegment {
  type: 'text' | 'link';
  content: string;
  url?: string;
  domain?: string;
}

export function parseTextWithLinks(text: string): TextSegment[] {
  if (!text) return [];

  // Expresión regular para detectar URLs con http, https o www.
  const urlRegex = /((?:https?:\/\/|www\.)[^\s<>"'`]+)/gi;
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    const matchedUrl = match[0];
    const matchStart = match.index;

    if (matchStart > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, matchStart),
      });
    }

    let href = matchedUrl;
    if (!href.startsWith('http://') && !href.startsWith('https://')) {
      href = `https://${href}`;
    }

    let domain = '';
    try {
      const parsed = new URL(href);
      domain = parsed.hostname.replace(/^www\./, '');
    } catch {
      domain = matchedUrl;
    }

    segments.push({
      type: 'link',
      content: matchedUrl,
      url: href,
      domain,
    });

    lastIndex = matchStart + matchedUrl.length;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}
