import { promises as fs } from "node:fs"
import path from "node:path"

type Blacklist = {
  repos: string[]
  owners: string[]
}

type GitHubOwner = {
  login: string
}

type GitHubLicense = {
  spdx_id: string | null
} | null

type GitHubRepo = {
  name: string
  full_name: string
  owner: GitHubOwner
  default_branch: string
  fork: boolean
  archived: boolean
  disabled: boolean
  stargazers_count: number
  pushed_at: string
  language: string | null
  license: GitHubLicense
  description: string | null
}

type GitHubSearchResponse = {
  total_count: number
  items: GitHubRepo[]
}

type QuartzMetadata = {
  name?: unknown
  version?: unknown
  description?: unknown
  author?: unknown
  category?: unknown
  keywords?: unknown
  quartzVersion?: unknown
  displayName?: unknown
}

type PackageJson = {
  quartz?: QuartzMetadata
}

type IndexedPlugin = {
  slug: string
  owner: string
  repo: string
  repoUrl: string
  name: string
  displayName: string
  description: string
  readmeHeading: string
  readmeExcerpt: string
  pluginAuthor: string
  category: string
  tags: string[]
  version: string
  quartzVersion: string
  stars: number
  official: boolean
  modified: string
  language: string | null
  license: string
  installCommand: string
  source: string
}

type ReportEntry = {
  repo: string
  reason: string
}

type ErrorEntry = {
  repo?: string
  error: string
}

type IndexReport = {
  timestamp: string
  totalFound: number
  totalIndexed: number
  skipped: ReportEntry[]
  errors: ErrorEntry[]
  staleRemoved: number
}

const ROOT = process.cwd()
const BLACKLIST_PATH = path.join(ROOT, "blacklist.json")
const PLUGINS_DIR = path.join(ROOT, "content", "plugins")
const REPORT_PATH = path.join(ROOT, "scripts", "index-report.json")

const GITHUB_API = "https://api.github.com"
const SEARCH_URL = `${GITHUB_API}/search/repositories?q=topic:quartz-plugin+is:public&sort=stars&per_page=100`

const headersForGitHub = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
})

const log = (
  level: "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>,
): void => {
  const payload = { level, message, ...data }
  console.log(JSON.stringify(payload))
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const normalizeString = (value: unknown, fallback: string): string =>
  isNonEmptyString(value) ? value.trim() : fallback

const escapeYamlString = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")

const slugifySegment = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
}

const slugify = (owner: string, repo: string): string => {
  return `${slugifySegment(owner)}/${slugifySegment(repo)}`
}

const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, "")

const stripMarkdown = (value: string): string =>
  value
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\[\[([^\]|]*?)(?:\|([^\]]*))?\]\]/g, (_m, target, display) => display || target)

const truncate = (value: string, max: number): string => {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

const formatDate = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toISOString().slice(0, 10)
}

const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, "utf8")
  return JSON.parse(raw) as T
}

const fetchJson = async <T>(url: string, token: string): Promise<{ status: number; data?: T }> => {
  const response = await fetch(url, { headers: headersForGitHub(token) })
  if (!response.ok) return { status: response.status }
  const data = (await response.json()) as T
  return { status: response.status, data }
}

const fetchText = async (url: string): Promise<{ status: number; text?: string }> => {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github.raw" } })
  if (!response.ok) return { status: response.status }
  const text = await response.text()
  return { status: response.status, text }
}

const extractReadme = (content: string): { heading: string; excerpt: string } => {
  const lines = content.split(/\r?\n/)
  const headingIndex = lines.findIndex((line) => line.startsWith("# ") || line.startsWith("## "))
  if (headingIndex === -1) return { heading: "", excerpt: "" }
  const heading = lines[headingIndex].trim()
  let index = headingIndex + 1
  while (index < lines.length && lines[index].trim() === "") {
    index += 1
  }
  const paragraphLines: string[] = []
  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()
    if (trimmed === "") break
    if (trimmed.startsWith("# ") || trimmed.startsWith("## ")) break
    paragraphLines.push(trimmed)
    index += 1
  }
  const paragraph = paragraphLines.join(" ").trim()
  return { heading, excerpt: paragraph }
}

const buildTags = (categories: string[], keywords: string[], official: boolean): string[] => {
  const tags: string[] = []
  const seen = new Set<string>()
  const statusTag = official ? "status/official" : "status/community"
  seen.add(statusTag)
  tags.push(statusTag)
  for (const category of categories) {
    const tag = `plugin/${category}`
    if (!seen.has(tag)) {
      seen.add(tag)
      tags.push(tag)
    }
  }
  for (const keyword of keywords) {
    if (!seen.has(keyword)) {
      seen.add(keyword)
      tags.push(keyword)
    }
  }
  return tags
}

const parseCategories = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter(isNonEmptyString).map((entry) => entry.trim())
  }
  if (isNonEmptyString(value)) {
    return [value.trim()]
  }
  return []
}

const parseKeywords = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter(isNonEmptyString).map((entry) => entry.trim())
  }
  return []
}

const createMarkdown = (plugin: IndexedPlugin): string => {
  const title = escapeYamlString(plugin.displayName || plugin.name)
  const description = escapeYamlString(plugin.description || "No description provided")
  const author = escapeYamlString(plugin.owner)
  const pluginAuthor = escapeYamlString(plugin.pluginAuthor)
  const version = escapeYamlString(plugin.version)
  const category = escapeYamlString(plugin.category || "uncategorized")
  const license = escapeYamlString(plugin.license)
  const quartzVersion = escapeYamlString(plugin.quartzVersion)
  const repoUrl = plugin.repoUrl
  const installCommand = escapeYamlString(plugin.installCommand)
  const modified = escapeYamlString(plugin.modified)
  const aliases = escapeYamlString(`/plugins/${plugin.name}`)
  const tags = plugin.tags.length > 0 ? plugin.tags : ["plugin/uncategorized"]
  const formattedDate = formatDate(plugin.modified)

  const tagLines = tags.map((tag) => `  - "${escapeYamlString(tag)}"`).join("\n")
  const readmeHeading = plugin.readmeHeading
  const readmeExcerpt = plugin.readmeExcerpt

  return [
    "---",
    `title: "${title}"`,
    `description: "${description}"`,
    `author: "${author}"`,
    `pluginAuthor: "${pluginAuthor}"`,
    `version: "${version}"`,
    `category: "${category}"`,
    "tags:",
    tagLines,
    `stars: ${plugin.stars}`,
    `official: ${plugin.official}`,
    `modified: "${modified}"`,
    `repo: "${repoUrl}"`,
    `source: "${plugin.source}"`,
    `installCommand: "${installCommand}"`,
    `license: "${license}"`,
    `quartzVersion: "${quartzVersion}"`,
    "aliases:",
    `  - "${aliases}"`,
    "---",
    "",
    "> [!info] Install",
    "> ```bash",
    `> ${plugin.installCommand}`,
    "> ```",
    "",
    readmeHeading,
    "",
    readmeExcerpt,
    "",
    `[View full documentation on GitHub](${repoUrl})`,
    "",
    "## Details",
    "",
    "| | |",
    "|---|---|",
    `| **Author** | ${plugin.pluginAuthor} |`,
    `| **Version** | ${plugin.version} |`,
    `| **Category** | ${plugin.category || "uncategorized"} |`,
    `| **License** | ${plugin.license} |`,
    `| **Quartz Version** | ${plugin.quartzVersion} |`,
    `| **Stars** | ⭐ ${plugin.stars} |`,
    `| **Last Updated** | ${formattedDate} |`,
    `| **Source** | [GitHub](${repoUrl}) |`,
    "",
  ].join("\n")
}

const isQuartzFieldValid = (quartz: QuartzMetadata | undefined): quartz is QuartzMetadata => {
  if (!quartz) return false
  if (!isNonEmptyString(quartz.name)) return false
  if (!isNonEmptyString(quartz.version)) return false
  return true
}

const main = async (): Promise<void> => {
  const token = process.env.GITHUB_TOKEN
  if (!token || token.trim() === "") {
    log("error", "GITHUB_TOKEN is required to run the plugin indexer.")
    process.exitCode = 1
    return
  }

  const blacklist = await readJsonFile<Blacklist>(BLACKLIST_PATH)
  const blacklistRepos = new Set(blacklist.repos.map((repo) => repo.toLowerCase()))
  const blacklistOwners = new Set(blacklist.owners.map((owner) => owner.toLowerCase()))

  const skipped: ReportEntry[] = []
  const errors: ErrorEntry[] = []
  const discovered: GitHubRepo[] = []

  log("info", "Searching GitHub for Quartz plugins.")
  for (let page = 1; page <= 10; page += 1) {
    const pageUrl = `${SEARCH_URL}&page=${page}`
    const response = await fetchJson<GitHubSearchResponse>(pageUrl, token)
    if (response.status === 401 || response.status === 403) {
      log("error", "GitHub API authentication failed.", { status: response.status })
      process.exitCode = 1
      return
    }
    if (!response.data) {
      const message = `GitHub search failed with status ${response.status}`
      errors.push({ error: message })
      log("error", message)
      break
    }
    const { items } = response.data
    if (items.length === 0) break
    discovered.push(...items)
    if (items.length < 100) break
  }

  const qualifying = discovered.filter((repo) => {
    if (repo.fork || repo.archived || repo.disabled) {
      const reason = "Repo is forked, archived, or disabled"
      skipped.push({ repo: repo.full_name, reason })
      log("warn", "Skipping repo", { repo: repo.full_name, reason })
      return false
    }
    const repoKey = repo.full_name.toLowerCase()
    const ownerKey = repo.owner.login.toLowerCase()
    if (blacklistRepos.has(repoKey)) {
      const reason = "Repo is blacklisted"
      skipped.push({ repo: repo.full_name, reason })
      log("warn", "Skipping repo", { repo: repo.full_name, reason })
      return false
    }
    if (blacklistOwners.has(ownerKey)) {
      const reason = "Owner is blacklisted"
      skipped.push({ repo: repo.full_name, reason })
      log("warn", "Skipping repo", { repo: repo.full_name, reason })
      return false
    }
    return true
  })

  const plugins: IndexedPlugin[] = []

  for (const repo of qualifying) {
    const owner = repo.owner.login
    const repoName = repo.name
    const repoKey = `${owner}/${repoName}`
    const repoUrl = `https://github.com/${repoKey}`
    try {
      const packageUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${repo.default_branch}/package.json`
      const packageResponse = await fetchText(packageUrl)
      if (!packageResponse.text) {
        skipped.push({ repo: repoKey, reason: "Missing package.json" })
        log("warn", "Skipping repo: missing package.json", { repo: repoKey })
        continue
      }
      let packageJson: PackageJson
      try {
        packageJson = JSON.parse(packageResponse.text) as PackageJson
      } catch (error) {
        skipped.push({ repo: repoKey, reason: "Invalid package.json" })
        log("warn", "Skipping repo: invalid package.json", { repo: repoKey })
        continue
      }

      const quartz = packageJson.quartz
      if (!isQuartzFieldValid(quartz)) {
        skipped.push({ repo: repoKey, reason: "Missing or invalid quartz metadata" })
        log("warn", "Skipping repo: missing or invalid quartz metadata", { repo: repoKey })
        continue
      }

      const readmeUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${repo.default_branch}/README.md`
      const readmeResponse = await fetchText(readmeUrl)
      let readmeHeading = ""
      let readmeExcerpt = ""
      if (readmeResponse.text) {
        const extracted = extractReadme(readmeResponse.text)
        readmeHeading = extracted.heading
        readmeExcerpt = extracted.excerpt
      }

      const fallbackDescription = normalizeString(
        quartz.description,
        normalizeString(repo.description, ""),
      )
      if (!readmeHeading) {
        readmeExcerpt = fallbackDescription
      }

      const cleanExcerpt = truncate(
        stripMarkdown(stripHtml(readmeExcerpt || fallbackDescription)),
        500,
      )
      const categories = parseCategories(quartz.category)
      const primaryCategory = categories[0] ?? "uncategorized"
      const keywords = parseKeywords(quartz.keywords)
      const isOfficial =
        repo.owner.login === "quartz-community" || repo.owner.login === "quartz-themes"
      const tags = buildTags(
        categories.length ? categories : ["uncategorized"],
        keywords,
        isOfficial,
      )
      const pluginAuthor = normalizeString(quartz.author, owner)
      const displayName = normalizeString(
        quartz.displayName,
        normalizeString(quartz.name, repoName),
      )
      const quartzVersion = normalizeString(quartz.quartzVersion, "unspecified")
      const name = normalizeString(quartz.name, repoName)
      const version = normalizeString(quartz.version, "")
      const license = repo.license?.spdx_id ?? "Unknown"
      const slug = slugify(owner, repoName)
      const installCommand = `npx quartz plugin add github:${repoKey}`

      plugins.push({
        slug,
        owner,
        repo: repoName,
        repoUrl,
        name,
        displayName,
        description: cleanExcerpt || "No description provided",
        readmeHeading,
        readmeExcerpt: cleanExcerpt,
        pluginAuthor,
        category: primaryCategory,
        tags,
        version,
        quartzVersion,
        stars: repo.stargazers_count,
        official: repo.owner.login === "quartz-community",
        modified: repo.pushed_at,
        language: repo.language,
        license,
        installCommand,
        source: `github:${repoKey}`,
      })
      log("info", "Indexed repo", { repo: repoKey })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      errors.push({ repo: repoKey, error: message })
      log("error", "Failed to index repo", { repo: repoKey, error: message })
    }
  }

  const pluginMap = new Map<string, IndexedPlugin>()
  for (const plugin of plugins) {
    pluginMap.set(plugin.slug, plugin)
  }

  const existingSlugs = new Set<string>()
  const ownerDirs = await fs.readdir(PLUGINS_DIR, { withFileTypes: true })
  for (const ownerEntry of ownerDirs) {
    if (!ownerEntry.isDirectory()) continue
    const ownerDir = path.join(PLUGINS_DIR, ownerEntry.name)
    const repoEntries = await fs.readdir(ownerDir, { withFileTypes: true })
    for (const repoEntry of repoEntries) {
      if (!repoEntry.isFile() || !repoEntry.name.endsWith(".md")) continue
      const slug = `${ownerEntry.name}/${repoEntry.name.replace(/\.md$/, "")}`
      existingSlugs.add(slug)
    }
  }

  let staleRemoved = 0
  for (const slug of existingSlugs) {
    if (!pluginMap.has(slug)) {
      const filePath = path.join(PLUGINS_DIR, `${slug}.md`)
      await fs.unlink(filePath)
      staleRemoved += 1
      log("info", "Removed stale plugin entry", { slug })
      const ownerDir = path.dirname(filePath)
      const remaining = await fs.readdir(ownerDir)
      if (remaining.length === 0) {
        await fs.rmdir(ownerDir)
      }
    }
  }

  const sortedPlugins = Array.from(pluginMap.values()).sort((a, b) => a.slug.localeCompare(b.slug))
  for (const plugin of sortedPlugins) {
    const content = createMarkdown(plugin)
    const filePath = path.join(PLUGINS_DIR, `${plugin.slug}.md`)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, "utf8")
  }

  const report: IndexReport = {
    timestamp: new Date().toISOString(),
    totalFound: discovered.length,
    totalIndexed: plugins.length,
    skipped,
    errors,
    staleRemoved,
  }

  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8")
  log("info", "Indexing complete", { totalIndexed: plugins.length, staleRemoved })
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error"
  log("error", "Indexer failed", { error: message })
  process.exitCode = 1
})
