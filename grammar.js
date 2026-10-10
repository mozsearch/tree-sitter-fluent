/**
 * @file Fluent (https://projectfluent.org/) grammar for tree-sitter, after
 * the Fluent Syntax 1.0 EBNF (spec/fluent.ebnf in projectfluent/fluent).
 *
 * Whitespace is significant: there are no extras, and the external scanner
 * (src/scanner.c) decides what a line break followed by indentation starts:
 * more text of the pattern, a block placeable, an attribute, or a variant.
 * Otherwise the line break ends the entry.
 *
 * Junk (unparseable content) is left to tree-sitter's error recovery.
 */

/* eslint-disable arrow-parens, camelcase */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const BLANK = /([ ]|\r?\n)+/;
const COMMENT_TEXT = /([^\r\n]|\r+[^\r\n])*\r*/;

/**
 * @param {RuleOrLiteral} rule
 * @param {RuleOrLiteral} separator
 */
function sepByWithTrailing(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)), optional(separator));
}

module.exports = grammar({
  name: 'fluent',

  extras: _ => [],

  externals: $ => [
    $._text_line,
    $._placeable_line,
    $._attribute_line,
    $._variant_line,
  ],

  rules: {
    resource: $ => seq(
      repeat(choice(
        seq($._entry, $._line_end),
        $._comment_line,
        $._blank_line,
      )),
      optional(choice($._entry, $._comment, $._blank_inline)),
    ),

    _entry: $ => choice($.message, $.term),

    // Comments: "#" (standalone or attached to the next entry), "##" (group)
    // and "###" (resource).
    _comment_line: $ => seq($._comment, $._line_end),
    _comment: $ => choice($.comment, $.group_comment, $.resource_comment),
    comment: _ => token(seq('#', optional(seq(' ', COMMENT_TEXT)))),
    group_comment: _ => token(seq('##', optional(seq(' ', COMMENT_TEXT)))),
    resource_comment: _ => token(seq('###', optional(seq(' ', COMMENT_TEXT)))),

    message: $ => seq(
      field('id', $.identifier),
      optional($._blank_inline),
      '=',
      optional($._blank_inline),
      choice(
        seq(field('value', $.pattern), repeat($.attribute)),
        repeat1($.attribute),
      ),
    ),

    // (Terms' identifiers include their "-", so that they're distinct from
    // messages' everywhere, ex: as history contexts.)
    term: $ => seq(
      field('id', $.term_identifier),
      optional($._blank_inline),
      '=',
      optional($._blank_inline),
      field('value', $.pattern),
      repeat($.attribute),
    ),

    attribute: $ => seq(
      $._attribute_line,
      '.',
      field('id', $.identifier),
      optional($._blank_inline),
      '=',
      optional($._blank_inline),
      field('value', $.pattern),
    ),

    pattern: $ => repeat1(choice(
      $.text,
      $.placeable,
      seq($._text_line, $.text),
      seq($._placeable_line, $.placeable),
    )),

    // (A carriage return is text unless it's in a line end.)
    text: _ => /([^{}\r\n]|\r+[^{}\r\n])+\r*/,

    placeable: $ => seq(
      '{',
      optional($._blank),
      field('expression', choice($.select_expression, $._inline_expression)),
      optional($._blank),
      '}',
    ),

    _inline_expression: $ => choice(
      $.string_literal,
      $.number_literal,
      $.function_reference,
      $.message_reference,
      $.term_reference,
      $.variable_reference,
      $.placeable,
    ),

    string_literal: _ => token(seq(
      '"',
      repeat(choice(
        /[^"\\\r\n]/,
        /\\[\\"]/,
        /\\u[0-9a-fA-F]{4}/,
        /\\U[0-9a-fA-F]{6}/,
      )),
      '"',
    )),

    number_literal: _ => /-?[0-9]+(\.[0-9]+)?/,

    function_reference: $ => seq(
      field('id', $.identifier),
      field('arguments', $.call_arguments),
    ),

    message_reference: $ => seq(
      field('id', $.identifier),
      optional(seq('.', field('attribute', $.identifier))),
    ),

    term_reference: $ => seq(
      field('id', $.term_identifier),
      optional(seq('.', field('attribute', $.identifier))),
      optional(field('arguments', $.call_arguments)),
    ),

    variable_reference: $ => seq('$', field('id', $.identifier)),

    // (Blanks before "(" and ":" are in their tokens, so that what follows
    // an identifier is known from the next token.)
    call_arguments: $ => seq(
      alias(token(seq(optional(BLANK), '(')), '('),
      optional($._blank),
      optional(sepByWithTrailing(
        $._argument,
        seq(optional($._blank), ',', optional($._blank)),
      )),
      optional($._blank),
      ')',
    ),

    _argument: $ => choice($.named_argument, $._inline_expression),

    named_argument: $ => seq(
      field('name', $.identifier),
      alias(token(seq(optional(BLANK), ':')), ':'),
      optional($._blank),
      field('value', choice($.string_literal, $.number_literal)),
    ),

    select_expression: $ => seq(
      field('selector', $._inline_expression),
      optional($._blank),
      '->',
      optional($._blank_inline),
      repeat1($.variant),
      $._line_end,
    ),

    variant: $ => seq(
      $._variant_line,
      optional(field('default', '*')),
      field('key', $.variant_key),
      optional($._blank_inline),
      field('value', $.pattern),
    ),

    variant_key: $ => seq(
      '[',
      optional($._blank),
      choice($.number_literal, $.identifier),
      optional($._blank),
      ']',
    ),

    identifier: _ => /[a-zA-Z][a-zA-Z0-9_-]*/,
    term_identifier: _ => /-[a-zA-Z][a-zA-Z0-9_-]*/,

    // (Leading spaces of a pattern aren't text.)
    _blank_inline: _ => token(prec(1, /[ ]+/)),
    _blank: _ => BLANK,
    _line_end: _ => /\r?\n/,
    _blank_line: _ => /[ ]*\r?\n/,
  },
});
