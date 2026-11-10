# Quartz Plugin Marketplace

A searchable index of [Quartz](https://quartz.jzhao.xyz) plugins, first-party and community: **https://quartz-community.github.io/marketplace/**

The same index is published as JSON at [`static/plugins.json`](https://quartz-community.github.io/marketplace/static/plugins.json) ([schema](https://quartz-community.github.io/marketplace/static/plugins.schema.json)). [Quartz Syncer](https://github.com/saberzero1/quartz-syncer)'s plugin browser reads it.

## Listing your plugin

1. Give your plugin a `quartz` field in its `package.json`, at least `name` and `category`. See the [plugin manifest reference](https://quartz.jzhao.xyz/advanced/plugin-manifest) and the [plugin template](https://github.com/quartz-community/plugin-template). Declare `quartzVersion` when the plugin needs a newer Quartz, and `deprecated` when it is no longer maintained.
2. Add the `quartz-plugin` topic to the GitHub repository.
3. The plugin appears within 6 hours. Its page uses the first heading and paragraph of your `README.md`.

Forks and archived repositories are skipped. A repository or owner can be left out through [`blacklist.json`](blacklist.json).

## How it works

Every 6 hours, and on every push to `v5`, [`index-and-deploy.yaml`](.github/workflows/index-and-deploy.yaml):

1. Runs [`scripts/index-plugins.ts`](scripts/index-plugins.ts). It searches GitHub for the `quartz-plugin` topic, reads each repository's `package.json` and `README.md`, checks npm, and writes `plugins.json` and `content/plugins/<owner>/<repo>.md`. Each `plugins.json` entry is checked against [`plugins.schema.json`](plugins.schema.json); an entry that doesn't fit is left out and reported.
2. Commits the result and builds this site with Quartz, then deploys it to GitHub Pages.

The generated files (`plugins.json`, `content/plugins/`) are not edited by hand.

### `plugins.json`

`schemaVersion` 2. Per plugin:

- **What it is:** name, display name, description, version (from `package.json`), category, keywords, components and frames.
- **Compatibility:** the Quartz version it needs (`quartzVersion`), dependencies, and `capabilities` (what it provides and needs).
- **Status:** deprecated, and `builtin` for the official plugins built into Quartz 5.1 (crawl-links, remove-draft, content-index), with the `configuration` key that replaces them.
- **Configuration:** default order, enabled state, options, `configSchema` and the flat `optionSchema`.
- **Where to get it:** `source` (the npm package when published, else `github:owner/repo`), `npmName`, `repo`, `issues`, stars, licence, last update, and install commands.

## Development

The site is a Quartz site: `quartz/`, `package.json` and `package-lock.json` are Quartz's own, from a [release tag](https://github.com/jackyzha0/quartz/releases). `quartz/styles/custom.scss` holds the marketplace's styles.

```bash
npm ci
GITHUB_TOKEN=<token> npx tsx scripts/index-plugins.ts   # refresh the index
npx quartz build -d content --serve                    # preview the site
```

To update Quartz, copy `quartz/`, `package.json`, `package-lock.json` and the root config files from the new release tag, keep `quartz/styles/custom.scss`, and run `npx quartz plugin doctor --fix`. CI runs `npm run check` and builds the site.

## License

[MIT](LICENSE.txt)
