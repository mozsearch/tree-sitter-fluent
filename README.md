# tree-sitter-fluent

A [tree-sitter](https://tree-sitter.github.io/) grammar for
[Fluent](https://projectfluent.org/), Project Fluent's localization format
(`.ftl` files), after the Fluent Syntax 1.0 EBNF
([spec/fluent.ebnf](https://github.com/projectfluent/fluent/blob/main/spec/fluent.ebnf)).

This is searchfox's fork of
[projectfluent/tree-sitter-fluent](https://github.com/projectfluent/tree-sitter-fluent),
whose 2018 grammar only parsed plain-text messages.  The grammar was rewritten
to cover all of the syntax:

- `message`s and `term`s (`-brand-name = ...`, whose `term_identifier`s
  include the `-`) with `attribute`s
  (`.title = ...`), and attribute-only messages;
- `pattern`s of `text` and `placeable`s, across indented continuation lines;
- `message_reference`s (`{ msg }`, `{ msg.attr }`), `term_reference`s
  (`{ -term }`, `{ -term.attr }`, `{ -term(case: "x") }`),
  `variable_reference`s (`{ $count }`), `function_reference`s
  (`{ NUMBER($n, style: "percent") }`) with `call_arguments` and
  `named_argument`s, `string_literal`s and `number_literal`s;
- `select_expression`s with `variant`s (the default one has a `default`
  field) and `variant_key`s;
- `comment`s (`#`), `group_comment`s (`##`), and `resource_comment`s (`###`).

Whitespace is significant in Fluent, so the grammar has no extras, and an
external scanner (`src/scanner.c`) decides what follows a line break: more
text of the pattern (indented, not starting with `[`, `*`, `.`, `{`, or `}`),
a block placeable, an attribute, a variant, or the end of the entry.  Junk
(unparseable entries) is left to tree-sitter's error recovery, which can
differ from the reference parser's line-based junk.

Testing:

    npx tree-sitter-cli@0.25.4 generate
    npx tree-sitter-cli@0.25.4 test

`scripts/spec-conformance.py . FLUENT/test/fixtures` compares the parses of the
Fluent spec's fixtures with their reference ASTs (messages, terms, attributes,
references, and comments): all 39 agree but leading_dots, where error recovery
after its invalid entries merges some of them.  All of Firefox's 276 en-US
`.ftl` files parse without errors (12390 messages, 77 terms, 5569 attributes,
the same as line-based counts).
