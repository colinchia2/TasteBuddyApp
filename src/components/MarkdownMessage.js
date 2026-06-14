import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { COLORS } from '../constants/colors';

// A link to one of the user's OWN places (Theme 3). Tapped → in-app PlaceCardModal
// (via onSavedPress), NOT a browser. The server emits these as absolute
// https://<host>/my-places/<slug> links so they survive markdown rendering.
const MY_PLACES_RE = /\/my-places\/([^/?#\s]+)/;

function parseInline(text) {
  const parts = [];
  // Order matters: emphasis-WRAPPED links first (**[x](url)** / *[x](url)* / _[x](url)_)
  // so a bolded/italicized place name renders as ONE styled link instead of literal
  // asterisks around raw markdown — the single-pass parser can't recurse. Then a plain
  // link, then bold, then underscore-italic.
  const regex = /(\*\*\[[^\]]+\]\(https?:\/\/[^)\s]+\)\*\*|\*\[[^\]]+\]\(https?:\/\/[^)\s]+\)\*|_\[[^\]]+\]\(https?:\/\/[^)\s]+\)_|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|_[^_\n]+_)/g;
  const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index) });
    }
    const tok = match[0];
    const lm = tok.match(LINK);
    if (lm) {
      const bold = tok.startsWith('**');
      const italic = tok.startsWith('*[') || tok.startsWith('_');
      const mp = lm[2].match(MY_PLACES_RE);
      if (mp) {
        parts.push({ text: lm[1], saved: mp[1], bold, italic });
      } else {
        parts.push({ text: lm[1], link: lm[2], bold, italic });
      }
    } else if (tok.startsWith('**')) {
      parts.push({ text: tok.slice(2, -2), bold: true });
    } else {                       // _italic_
      parts.push({ text: tok.slice(1, -1), italic: true });
    }
    lastIndex = match.index + tok.length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) });
  }
  return parts.length > 0 ? parts : [{ text }];
}

function InlineText({ text, style, onSavedPress }) {
  const parts = parseInline(text);
  if (parts.length === 1 && !parts[0].bold && !parts[0].italic && !parts[0].link && !parts[0].saved) {
    return <Text selectable style={style}>{parts[0].text}</Text>;
  }
  return (
    <Text selectable style={style}>
      {parts.map((p, i) => {
        const emph = [
          p.bold && { fontFamily: 'DMSans_700Bold' },
          p.italic && { fontStyle: 'italic' },
        ];
        // Owned place → open PlaceCardModal in-place (NOT Linking/browser). Styled like
        // surrounding text (medium weight, never the blue/gold external-link look). With
        // no handler it degrades to plain text — never crashes.
        if (p.saved) {
          return onSavedPress ? (
            <Text
              key={i}
              style={[styles.savedLink, ...emph]}
              onPress={() => onSavedPress(p.saved)}
              suppressHighlighting={false}
            >
              {p.text}
            </Text>
          ) : (
            <Text key={i} style={emph}>{p.text}</Text>
          );
        }
        if (p.link) {
          return (
            <Text
              key={i}
              style={[styles.link, ...emph]}
              onPress={() => Linking.openURL(p.link)}
              suppressHighlighting={false}
            >
              {p.text}
            </Text>
          );
        }
        return <Text key={i} style={emph}>{p.text}</Text>;
      })}
    </Text>
  );
}

export default function MarkdownMessage({ text, onSavedPress }) {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const t = lines[i].trim();

    // Markdown table — collect all consecutive pipe-bounded rows
    if (t.startsWith('|') && t.endsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      // Strip separator rows (| --- | --- |)
      const rows = tableLines.filter(r => !/^\|[\s\-:|]+\|$/.test(r));
      if (rows.length) {
        const tableKey = `table-${i}`;
        const headerCells = rows[0].split('|').map(c => c.trim()).filter((_, j, arr) => j > 0 && j < arr.length - 1);
        const bodyRows = rows.slice(1);
        elements.push(
          <View key={tableKey} style={styles.table}>
            <View style={styles.tableHeaderRow}>
              {headerCells.map((c, ci) => (
                <Text key={ci} selectable style={styles.tableHeaderCell}>{c}</Text>
              ))}
            </View>
            {bodyRows.map((row, ri) => {
              const cells = row.split('|').map(c => c.trim()).filter((_, j, arr) => j > 0 && j < arr.length - 1);
              return (
                <View key={ri} style={[styles.tableRow, ri === bodyRows.length - 1 && { borderBottomWidth: 0 }]}>
                  {cells.map((c, ci) => (
                    <InlineText key={ci} text={c} style={styles.tableCell} onSavedPress={onSavedPress} />
                  ))}
                </View>
              );
            })}
          </View>
        );
      }
      continue;
    }

    i++;

    if (t === '---') {
      elements.push(<View key={i} style={styles.divider} />);
      continue;
    }
    if (!t) {
      elements.push(<View key={i} style={styles.spacer} />);
      continue;
    }

    // H1: # heading
    const h1M = t.match(/^#\s+(.+)$/);
    if (h1M) {
      elements.push(<Text key={i} selectable style={styles.h1}>{h1M[1]}</Text>);
      continue;
    }

    // H2: ## heading
    const h2M = t.match(/^##\s+(.+)$/);
    if (h2M) {
      elements.push(<Text key={i} selectable style={styles.h2}>{h2M[1]}</Text>);
      continue;
    }

    // H3: ### heading
    const h3M = t.match(/^###\s+(.+)$/);
    if (h3M) {
      elements.push(<Text key={i} selectable style={styles.h3}>{h3M[1]}</Text>);
      continue;
    }

    // Blockquote: > text
    const bqM = t.match(/^>\s+(.+)$/);
    if (bqM) {
      elements.push(
        <View key={i} style={styles.blockquote}>
          <InlineText text={bqM[1]} style={styles.blockquoteText} onSavedPress={onSavedPress} />
        </View>
      );
      continue;
    }

    // Numbered restaurant header: **1. Name** — optional tagline
    const recM = t.match(/^\*\*(\d+\.\s+[^*]+?)\*\*(?:\s*[—–\-]\s*(.+))?$/);
    if (recM) {
      elements.push(
        <View key={i} style={styles.recHeader}>
          <Text selectable style={styles.recTitle}>{recM[1].trim()}</Text>
          {recM[2] ? <InlineText text={recM[2]} style={styles.recSub} onSavedPress={onSavedPress} /> : null}
        </View>
      );
      continue;
    }

    // Bullet: - item or * item or • item
    const bulletM = t.match(/^[-*•]\s+(.+)$/);
    if (bulletM) {
      elements.push(
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>●</Text>
          <InlineText text={bulletM[1]} style={styles.bulletText} onSavedPress={onSavedPress} />
        </View>
      );
      continue;
    }

    // Normal line
    elements.push(<InlineText key={i} text={t} style={styles.normal} onSavedPress={onSavedPress} />);
  }

  return <View>{elements}</View>;
}

const styles = StyleSheet.create({
  divider: { borderTopWidth: 0.5, borderTopColor: COLORS.border, marginVertical: 14 },
  spacer: { height: 6 },
  h1: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: COLORS.text, marginTop: 16, marginBottom: 4, lineHeight: 26 },
  h2: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: COLORS.text, marginTop: 14, marginBottom: 3, lineHeight: 23 },
  h3: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: COLORS.text, marginTop: 12, marginBottom: 2, lineHeight: 21 },
  blockquote: { borderLeftWidth: 3, borderLeftColor: COLORS.gold, paddingLeft: 12, paddingVertical: 4, marginVertical: 6 },
  blockquoteText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, lineHeight: 20, fontStyle: 'italic' },
  recHeader: { marginTop: 16, marginBottom: 4 },
  recTitle: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: COLORS.text, lineHeight: 24 },
  recSub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, lineHeight: 20, marginTop: 1 },
  bulletRow: { flexDirection: 'row', marginBottom: 4, paddingRight: 4, alignItems: 'flex-start' },
  bulletDot: { fontFamily: 'DMSans_700Bold', fontSize: 8, color: COLORS.gold, marginRight: 8, marginTop: 7 },
  bulletText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.text, lineHeight: 22 },
  normal: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.text, lineHeight: 22 },
  link: { color: COLORS.gold, textDecorationLine: 'underline' },
  // Owned-place tap target (Theme 3): styled as a real link — bold, blue, underlined
  // (C1/B2). Still opens the in-app PlaceCardModal (not a browser); only the look changed.
  savedLink: { fontFamily: 'DMSans_700Bold', color: COLORS.linkBlue, textDecorationLine: 'underline' },
  table: { marginVertical: 10, borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 8, overflow: 'hidden' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: COLORS.offWhite, borderBottomWidth: 1.5, borderBottomColor: COLORS.border },
  tableHeaderCell: { flex: 1, fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted, padding: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  tableCell: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.text, padding: 8, lineHeight: 19 },
});
