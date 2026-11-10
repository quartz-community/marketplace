---
title: Quartz Plugin Marketplace
description: "Discover plugins for Quartz, the static site generator for digital gardens."
---

Discover plugins for [Quartz](https://quartz.jzhao.xyz), the static site generator for digital gardens.

## Browse Plugins

```base
filters:
  and:
    - file.inFolder("plugins")
    - file.ext == "md"
    - file.hasTag("status")
formulas:
  is_official: |
    if(file.hasTag("status/official"), "Official", "Community")
  last_update: file.mtime.relative()
properties:
  title:
    displayName: Plugin
  description:
    displayName: Description
  formula.is_official:
    displayName: Status
  formula.last_update:
    displayName: Updated
views:
  - type: cards
    name: All Plugins
    groupBy:
      property: formula.is_official
      direction: ASC
    order:
      - title
      - description
      - formula.is_official
      - formula.last_update
    sort:
      - property: title
        direction: ASC
    columnSize:
      title: 250
      description: 350
      formula.is_official: 100
      formula.last_update: 120
  - type: cards
    name: Official Plugins
    filters:
      and:
        - file.hasTag("status/official")
    order:
      - title
      - description
      - formula.is_official
      - formula.last_update
    sort:
      - property: title
        direction: ASC
  - type: cards
    name: Community Plugins
    filters:
      and:
        - file.hasTag("status/community")
    order:
      - title
      - description
      - formula.is_official
      - formula.last_update
    sort:
      - property: title
        direction: ASC
  - type: cards
    name: Transformers
    filters:
      and:
        - file.hasTag("plugin/transformer")
    order:
      - title
      - description
      - formula.is_official
      - formula.last_update
  - type: cards
    name: Components
    filters:
      and:
        - file.hasTag("plugin/component")
    order:
      - title
      - description
      - formula.is_official
      - formula.last_update
  - type: cards
    name: Emitters
    filters:
      and:
        - file.hasTag("plugin/emitter")
    order:
      - title
      - description
      - formula.is_official
      - formula.last_update
  - type: cards
    name: Filters
    filters:
      and:
        - file.hasTag("plugin/filter")
    order:
      - title
      - description
      - formula.is_official
      - formula.last_update
  - type: cards
    name: Page Types
    filters:
      and:
        - file.hasTag("plugin/pageType")
    order:
      - title
      - description
      - formula.is_official
      - formula.last_update
```

## Adding Your Plugin

To list your plugin in this marketplace:

1. Give your plugin a `quartz` field in its `package.json`, at least `name` and `category` (see the [plugin manifest reference](https://quartz.jzhao.xyz/advanced/plugin-manifest) and the [plugin template](https://github.com/quartz-community/plugin-template)). Declare `quartzVersion` when it needs a newer Quartz (e.g. `">=5.1.0"`), `capabilities` for what it provides and needs, and `deprecated` when it is no longer maintained. The version shown here is your package's `version`.
2. Add the `quartz-plugin` topic to your GitHub repository.
3. Your plugin will appear here within 6 hours.

## Installing Plugins

Each plugin's page shows its install command: the npm package when it is published there, otherwise its GitHub repository.

```bash
npx quartz plugin add @scope/plugin-name   # from npm
npx quartz plugin add github:<owner>/<repo> # from GitHub
```

See the [Quartz documentation](https://quartz.jzhao.xyz) for more details.
