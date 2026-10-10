//! This crate provides Fluent (Project Fluent's localization format, `.ftl`)
//! language support for the [tree-sitter][] parsing library.
//!
//! ```
//! let code = "hello = Hello, { $name }!\n    .title = { -brand-name }\n";
//! let mut parser = tree_sitter::Parser::new();
//! let language = tree_sitter_fluent::LANGUAGE;
//! parser
//!     .set_language(&language.into())
//!     .expect("Error loading Fluent parser");
//! let tree = parser.parse(code, None).unwrap();
//! assert!(!tree.root_node().has_error());
//! ```
//!
//! [tree-sitter]: https://tree-sitter.github.io/

use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_fluent() -> *const ();
}

/// The tree-sitter [`LanguageFn`][LanguageFn] for this grammar.
///
/// [LanguageFn]: https://docs.rs/tree-sitter-language/*/tree_sitter_language/struct.LanguageFn.html
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_fluent) };

/// The content of the [`node-types.json`][] file for this grammar.
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");

#[cfg(test)]
mod tests {
    #[test]
    fn test_can_load_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Fluent parser");
    }
}
