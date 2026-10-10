// The external scanner for Fluent's line breaks: after the blank lines and
// indentation which follow a line break, the next character decides whether
// the line continues the pattern with text (it's indented and isn't one of
// "[", "*", ".", "{", "}"), starts a block placeable ("{", indented or not),
// starts an attribute ("."), or starts a variant ("[" or "*").  Otherwise we
// produce nothing, and the grammar's line end ends the entry (or the variant
// list).  The tokens cover the line breaks and indentation, but not that next
// character.  See the EBNF's block_text, block_placeable, Attribute, and
// Variant.

#include "tree_sitter/parser.h"

enum TokenType {
  TEXT_LINE,
  PLACEABLE_LINE,
  ATTRIBUTE_LINE,
  VARIANT_LINE,
};

// (The scanner has no state.)
void *tree_sitter_fluent_external_scanner_create(void) { return NULL; }

void tree_sitter_fluent_external_scanner_destroy(void *payload) {
  (void)payload;
}

unsigned tree_sitter_fluent_external_scanner_serialize(void *payload,
                                                        char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_fluent_external_scanner_deserialize(void *payload,
                                                      const char *buffer,
                                                      unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

static bool is_indented_char(int32_t c) {
  switch (c) {
    case 0:
    case '\r':
    case '\n':
    case '[':
    case '*':
    case '.':
    case '{':
    case '}':
      return false;
    default:
      return true;
  }
}

bool tree_sitter_fluent_external_scanner_scan(void *payload, TSLexer *lexer,
                                              const bool *valid_symbols) {
  (void)payload;
  if (!valid_symbols[TEXT_LINE] && !valid_symbols[PLACEABLE_LINE] &&
      !valid_symbols[ATTRIBUTE_LINE] && !valid_symbols[VARIANT_LINE]) {
    return false;
  }
  // (All of them are only valid during error recovery, where continuing
  // patterns would rather merge broken entries with the next ones than
  // leave them as junk.)
  if (valid_symbols[TEXT_LINE] && valid_symbols[PLACEABLE_LINE] &&
      valid_symbols[ATTRIBUTE_LINE] && valid_symbols[VARIANT_LINE]) {
    return false;
  }

  // Line breaks, each maybe after spaces, and the indentation of the last
  // line.
  unsigned line_breaks = 0;
  unsigned indent = 0;
  for (;;) {
    indent = 0;
    while (lexer->lookahead == ' ') {
      lexer->advance(lexer, false);
      indent++;
    }
    if (lexer->lookahead == '\r') {
      lexer->advance(lexer, false);
      if (lexer->lookahead != '\n') {
        return false;
      }
    }
    if (lexer->lookahead == '\n') {
      lexer->advance(lexer, false);
      line_breaks++;
      continue;
    }
    break;
  }
  if (line_breaks == 0 || lexer->eof(lexer)) {
    return false;
  }

  int32_t next = lexer->lookahead;
  lexer->mark_end(lexer);
  if (next == '.' && valid_symbols[ATTRIBUTE_LINE]) {
    lexer->result_symbol = ATTRIBUTE_LINE;
    return true;
  }
  if ((next == '[' || next == '*') && valid_symbols[VARIANT_LINE]) {
    lexer->result_symbol = VARIANT_LINE;
    return true;
  }
  if (next == '{' && valid_symbols[PLACEABLE_LINE]) {
    lexer->result_symbol = PLACEABLE_LINE;
    return true;
  }
  if (indent > 0 && is_indented_char(next) && valid_symbols[TEXT_LINE]) {
    lexer->result_symbol = TEXT_LINE;
    return true;
  }
  return false;
}
