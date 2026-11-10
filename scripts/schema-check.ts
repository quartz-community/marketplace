/**
 * A small JSON Schema checker for plugins.schema.json: the keywords that schema uses (`type`,
 * `enum`, `const`, `oneOf`, `properties`, `required`, `additionalProperties`, `items`, `$ref`
 * into `$defs`). The marketplace's package.json is Quartz's own, so the indexer adds no
 * dependency for this. Formats (`uri`, `date-time`) are not checked.
 */

type Schema = {
  $ref?: string
  type?: string | string[]
  enum?: unknown[]
  const?: unknown
  oneOf?: Schema[]
  properties?: Record<string, Schema>
  required?: string[]
  additionalProperties?: boolean | Schema
  items?: Schema
  minItems?: number
  $defs?: Record<string, Schema>
}

const typeOf = (value: unknown): string =>
  value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : Number.isInteger(value)
        ? "integer"
        : typeof value

const matchesType = (value: unknown, type: string): boolean => {
  const actual = typeOf(value)
  return actual === type || (type === "number" && actual === "integer")
}

/** Problems with `value` against `schema` (an empty list when it is valid). */
export function checkSchema(
  value: unknown,
  schema: Schema,
  root: Schema = schema,
  at = "$",
): string[] {
  if (schema.$ref) {
    const name = schema.$ref.replace(/^#\/\$defs\//, "")
    const target = root.$defs?.[name]
    if (!target) return [`${at}: unknown $ref ${schema.$ref}`]
    return checkSchema(value, target, root, at)
  }
  if (schema.oneOf) {
    const matching = schema.oneOf.filter(
      (option) => checkSchema(value, option, root, at).length === 0,
    )
    return matching.length === 1
      ? []
      : [`${at}: matches ${matching.length} of the ${schema.oneOf.length} allowed shapes`]
  }

  const problems: string[] = []
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!types.some((type) => matchesType(value, type))) {
      return [`${at}: expected ${types.join(" or ")}, got ${typeOf(value)}`]
    }
  }
  if (schema.const !== undefined && value !== schema.const) {
    problems.push(`${at}: must be ${JSON.stringify(schema.const)}`)
  }
  if (schema.enum && !schema.enum.includes(value)) {
    problems.push(`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`)
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      problems.push(`${at}: needs at least ${schema.minItems} items`)
    }
    if (schema.items) {
      value.forEach((item, i) =>
        problems.push(...checkSchema(item, schema.items!, root, `${at}[${i}]`)),
      )
    }
  } else if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (!(key in record)) problems.push(`${at}: missing ${key}`)
    }
    for (const [key, child] of Object.entries(record)) {
      const propSchema = schema.properties?.[key]
      if (propSchema) {
        problems.push(...checkSchema(child, propSchema, root, `${at}.${key}`))
      } else if (schema.additionalProperties === false) {
        problems.push(`${at}: unexpected ${key}`)
      } else if (typeof schema.additionalProperties === "object") {
        problems.push(...checkSchema(child, schema.additionalProperties, root, `${at}.${key}`))
      }
    }
  }
  return problems
}
