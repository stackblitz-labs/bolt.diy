Place Tree-sitter WASM grammars here for AST-aware edit matching.

Required (minimum):
- tree-sitter-typescript.wasm
- tree-sitter-tsx.wasm
- tree-sitter-javascript.wasm

Optional (extend coverage):
- tree-sitter-css.wasm
- tree-sitter-html.wasm
- tree-sitter-json.wasm
- tree-sitter-go.wasm
- tree-sitter-rust.wasm
- tree-sitter-python.wasm

Download from official tree-sitter releases or a trusted source and keep filenames as above.
Enable with env `ENABLE_AST_MATCHING=true`. Without these files, AST matching stays disabled.

