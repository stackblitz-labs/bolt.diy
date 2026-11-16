# Documentation site tooling

This directory contains the MkDocs site configuration and its source pages:

- `mkdocs.yml` configures the site build.
- `docs/` contains the Markdown pages and JavaScript used by the site.
- `pyproject.toml` and `poetry.lock` pin the Python documentation toolchain.

From this directory, install the locked dependencies with Poetry and run `poetry run mkdocs serve` for local preview. The GitHub Actions workflow deploys the built site to GitHub Pages.
