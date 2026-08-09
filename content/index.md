---
title: Quartz Plugin Marketplace
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
      - description
      - formula.is_official
      - formula.last_update
  - type: cards
    name: Components
    filters:
      and:
        - file.hasTag("plugin/component")
    order:
      - description
      - formula.is_official
      - formula.last_update
  - type: cards
    name: Emitters
    filters:
      and:
        - file.hasTag("plugin/emitter")
    order:
      - description
      - formula.is_official
      - formula.last_update
  - type: cards
    name: Filters
    filters:
      and:
        - file.hasTag("plugin/filter")
    order:
      - description
      - formula.is_official
      - formula.last_update
  - type: cards
    name: Page Types
    filters:
      and:
        - file.hasTag("plugin/pageType")
    order:
      - description
      - formula.is_official
      - formula.last_update
```

## Adding Your Plugin

To list your plugin in this marketplace:

1. Ensure your plugin has a valid `quartz` field in its `package.json` (see the [plugin template](https://github.com/quartz-community/plugin-template))
2. Add the `quartz-plugin` topic to your GitHub repository
3. Your plugin will appear here within 6 hours

## Installing Plugins

```bash
npx quartz plugin add github:<owner>/<repo>
```

See the [Quartz documentation](https://quartz.jzhao.xyz) for more details.
