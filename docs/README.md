# Documentation Overview

This directory contains the sources used to generate the **bolt.diy** documentation site.
It uses [MkDocs](https://www.mkdocs.org/) with the Material theme to build a static site from the files in [`docs/docs`](docs/docs).
The build configuration lives in [`mkdocs.yml`](mkdocs.yml).

## Building or Serving the Docs

1. Install the documentation dependencies using [Poetry](https://python-poetry.org/):

   ```bash
   cd docs
   poetry install
   ```

2. To preview the documentation locally, run:

   ```bash
   poetry run mkdocs serve -f mkdocs.yml
   ```

   This starts a local server and watches for changes.

3. To generate the static site, run:

   ```bash
   poetry run mkdocs build -f mkdocs.yml
   ```

   The site will be output to the directory specified by `site_dir` in `mkdocs.yml` (currently `../site`).

