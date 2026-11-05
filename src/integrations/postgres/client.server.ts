import { Pool, type PoolClient, type QueryResult } from "pg";

type Filter = {
  column: string;
  operator: "=" | "<>" | ">" | ">=" | "<" | "<=" | "IN" | "IS" | "@>";
  value: unknown;
  negate?: boolean;
};

type Order = {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
};

type MutationMode = "insert" | "upsert" | "update" | "delete";

type ResultShape<T = unknown> = {
  data: T | null;
  error: null | { message: string; code?: string; details?: string };
  count?: number | null;
};

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ownershipCache = new Map<string, "user_id" | "profile_id" | null>();

function ident(value: string) {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function selectList(value?: string) {
  if (!value || value.trim() === "*") return "*";
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (!SAFE_IDENTIFIER.test(part)) {
        throw new Error(
          `PostgreSQL local adapter currently supports plain column selects only; received "${part}".`,
        );
      }
      return ident(part);
    })
    .join(", ");
}

function normalizeValue(value: unknown) {
  if (value === undefined) return null;
  if (value !== null && typeof value === "object") {
    return JSON.stringify(value);
  }
  return value;
}

function normalizeRows(value: unknown | unknown[]) {
  return Array.isArray(value) ? value : [value];
}

function dbError(error: unknown): ResultShape["error"] {
  if (error && typeof error === "object") {
    const candidate = error as { message?: string; code?: string; detail?: string };
    return {
      message: candidate.message ?? String(error),
      code: candidate.code,
      details: candidate.detail,
    };
  }
  return { message: String(error) };
}

let pool: Pool | undefined;

export function getPostgresPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is required when DATABASE_PROVIDER=postgres. Copy .env.example to .env and run bun run db:setup.",
      );
    }
    pool = new Pool({
      connectionString,
      max: Number.parseInt(process.env.POSTGRES_POOL_MAX || "10", 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

async function detectOwnershipColumn(client: PoolClient, table: string) {
  if (ownershipCache.has(table)) return ownershipCache.get(table) ?? null;

  const result = await client.query<{ column_name: string }>(
    `select column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
        and column_name in ('user_id', 'id')`,
    [table],
  );

  const columns = new Set(result.rows.map((row) => row.column_name));
  const ownership =
    columns.has("user_id") ? "user_id" : table === "profiles" && columns.has("id") ? "profile_id" : null;
  ownershipCache.set(table, ownership);
  return ownership;
}

class PostgresQueryBuilder implements PromiseLike<ResultShape> {
  private action: MutationMode | "select" = "select";
  private selected = "*";
  private mutationPayload: unknown = null;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private rowLimit?: number;
  private singleMode: "none" | "single" | "maybeSingle" = "none";
  private conflictColumns: string[] = [];
  private ignoreDuplicates = false;
  private returning = false;
  private exactCount = false;
  private headOnly = false;

  constructor(
    private readonly table: string,
    private readonly userId?: string,
  ) {
    ident(table);
  }

  select(
    columns = "*",
    options?: { count?: "exact"; head?: boolean },
  ) {
    this.selected = columns;
    this.exactCount = options?.count === "exact";
    this.headOnly = options?.head === true;
    if (this.action !== "select") this.returning = true;
    return this;
  }

  insert(values: unknown | unknown[]) {
    this.action = "insert";
    this.mutationPayload = values;
    return this;
  }

  upsert(
    values: unknown | unknown[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ) {
    this.action = "upsert";
    this.mutationPayload = values;
    this.conflictColumns = (options?.onConflict ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    this.ignoreDuplicates = options?.ignoreDuplicates ?? false;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.action = "update";
    this.mutationPayload = values;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "=", value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, operator: "<>", value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ column, operator: ">", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, operator: ">=", value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ column, operator: "<", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, operator: "<=", value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ column, operator: "IN", value: values });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, operator: "IS", value });
    return this;
  }

  contains(column: string, value: unknown) {
    this.filters.push({ column, operator: "@>", value });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    const mapped = operator === "is" ? "IS" : operator === "eq" ? "=" : "<>";
    this.filters.push({
      column,
      operator: mapped as Filter["operator"],
      value,
      negate: true,
    });
    return this;
  }

  order(
    column: string,
    options: { ascending?: boolean; nullsFirst?: boolean } = {},
  ) {
    this.orders.push({
      column,
      ascending: options.ascending ?? true,
      nullsFirst: options.nullsFirst,
    });
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  range(from: number, to: number) {
    this.rowLimit = Math.max(0, to - from + 1);
    return this;
  }

  single() {
    this.singleMode = "single";
    this.rowLimit = 2;
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    this.rowLimit = 2;
    return this;
  }

  then<TResult1 = ResultShape, TResult2 = never>(
    onfulfilled?: ((value: ResultShape) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async applyOwnership(client: PoolClient) {
    if (!this.userId) return;
    const ownership = await detectOwnershipColumn(client, this.table);
    if (ownership === "user_id" && !this.filters.some((filter) => filter.column === "user_id")) {
      this.filters.push({ column: "user_id", operator: "=", value: this.userId });
    }
    if (ownership === "profile_id" && !this.filters.some((filter) => filter.column === "id")) {
      this.filters.push({ column: "id", operator: "=", value: this.userId });
    }
  }

  private buildWhere(values: unknown[]) {
    if (this.filters.length === 0) return "";

    const clauses = this.filters.map((filter) => {
      const column = ident(filter.column);
      let expression: string;

      if (filter.operator === "IN") {
        const list = Array.isArray(filter.value) ? filter.value : [];
        if (list.length === 0) return "FALSE";
        const placeholders = list.map((value) => {
          values.push(normalizeValue(value));
          return `$${values.length}`;
        });
        expression = `${column} IN (${placeholders.join(", ")})`;
      } else if (filter.operator === "IS") {
        if (filter.value === null) expression = `${column} IS NULL`;
        else if (filter.value === true) expression = `${column} IS TRUE`;
        else if (filter.value === false) expression = `${column} IS FALSE`;
        else {
          values.push(normalizeValue(filter.value));
          expression = `${column} IS NOT DISTINCT FROM $${values.length}`;
        }
      } else if (filter.operator === "@>") {
        values.push(normalizeValue(filter.value));
        expression = `${column} @> $${values.length}::jsonb`;
      } else {
        values.push(normalizeValue(filter.value));
        expression = `${column} ${filter.operator} $${values.length}`;
      }

      return filter.negate ? `NOT (${expression})` : expression;
    });

    return ` WHERE ${clauses.join(" AND ")}`;
  }

  private buildOrder() {
    if (this.orders.length === 0) return "";
    return (
      " ORDER BY " +
      this.orders
        .map((order) => {
          const nulls =
            order.nullsFirst === undefined
              ? ""
              : order.nullsFirst
                ? " NULLS FIRST"
                : " NULLS LAST";
          return `${ident(order.column)} ${order.ascending ? "ASC" : "DESC"}${nulls}`;
        })
        .join(", ")
    );
  }

  private async buildSql(client: PoolClient) {
    await this.applyOwnership(client);

    const values: unknown[] = [];
    const table = `public.${ident(this.table)}`;

    if (this.action === "select") {
      const projection =
        this.exactCount && this.headOnly
          ? "COUNT(*)::int AS __exact_count"
          : selectList(this.selected);
      const sql =
        `SELECT ${projection} FROM ${table}` +
        this.buildWhere(values) +
        (this.headOnly ? "" : this.buildOrder()) +
        (this.headOnly
          ? ""
          : this.rowLimit !== undefined
            ? ` LIMIT ${Math.max(0, Math.floor(this.rowLimit))}`
            : "");
      return { sql, values };
    }

    if (this.action === "delete") {
      const sql =
        `DELETE FROM ${table}` +
        this.buildWhere(values) +
        (this.returning ? ` RETURNING ${selectList(this.selected)}` : "");
      return { sql, values };
    }

    if (this.action === "update") {
      const payload = { ...((this.mutationPayload ?? {}) as Record<string, unknown>) };
      const ownership = await detectOwnershipColumn(client, this.table);
      if (this.userId && ownership === "user_id" && payload.user_id === undefined) {
        payload.user_id = this.userId;
      }
      const keys = Object.keys(payload);
      if (!keys.length) throw new Error(`Cannot update ${this.table} with an empty payload.`);
      const set = keys.map((key) => {
        values.push(normalizeValue(payload[key]));
        return `${ident(key)} = $${values.length}`;
      });
      const sql =
        `UPDATE ${table} SET ${set.join(", ")}` +
        this.buildWhere(values) +
        (this.returning ? ` RETURNING ${selectList(this.selected)}` : "");
      return { sql, values };
    }

    const rows = normalizeRows(this.mutationPayload).map((row) => ({
      ...((row ?? {}) as Record<string, unknown>),
    }));
    if (!rows.length) throw new Error(`Cannot ${this.action} zero rows into ${this.table}.`);

    const ownership = await detectOwnershipColumn(client, this.table);
    for (const row of rows) {
      if (this.userId && ownership === "user_id" && row.user_id === undefined) {
        row.user_id = this.userId;
      }
      if (this.userId && ownership === "profile_id" && row.id === undefined) {
        row.id = this.userId;
      }
    }

    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const tuples = rows.map((row) => {
      const placeholders = keys.map((key) => {
        values.push(normalizeValue(row[key]));
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    let sql =
      `INSERT INTO ${table} (${keys.map(ident).join(", ")}) VALUES ${tuples.join(", ")}`;

    if (this.action === "upsert") {
      if (!this.conflictColumns.length) {
        throw new Error(`PostgreSQL upsert on ${this.table} requires onConflict.`);
      }
      const conflicts = this.conflictColumns.map(ident);
      if (this.ignoreDuplicates) {
        sql += ` ON CONFLICT (${conflicts.join(", ")}) DO NOTHING`;
      } else {
        const conflictSet = new Set(this.conflictColumns);
        const updateKeys = keys.filter((key) => !conflictSet.has(key));
        sql += updateKeys.length
          ? ` ON CONFLICT (${conflicts.join(", ")}) DO UPDATE SET ${updateKeys
              .map((key) => `${ident(key)} = EXCLUDED.${ident(key)}`)
              .join(", ")}`
          : ` ON CONFLICT (${conflicts.join(", ")}) DO NOTHING`;
      }
    }

    if (this.returning) sql += ` RETURNING ${selectList(this.selected)}`;
    return { sql, values };
  }

  private shape(result: QueryResult) {
    const rows = result.rows ?? [];

    if (this.exactCount && this.headOnly) {
      return {
        data: null,
        error: null,
        count: Number((rows[0] as { __exact_count?: number } | undefined)?.__exact_count ?? 0),
      };
    }
    if (this.singleMode === "single") {
      if (rows.length !== 1) {
        return {
          data: null,
          error: {
            message: `Expected exactly one row from ${this.table}, received ${rows.length}.`,
            code: "PGRST116",
          },
        };
      }
      return { data: rows[0], error: null };
    }

    if (this.singleMode === "maybeSingle") {
      if (rows.length > 1) {
        return {
          data: null,
          error: {
            message: `Expected at most one row from ${this.table}, received ${rows.length}.`,
            code: "PGRST116",
          },
        };
      }
      return { data: rows[0] ?? null, error: null };
    }

    if (this.action !== "select" && !this.returning) {
      return { data: null, error: null };
    }

    return { data: rows, error: null };
  }

  private async execute(): Promise<ResultShape> {
    const client = await getPostgresPool().connect();
    try {
      await client.query("BEGIN");
      if (this.userId) {
        await client.query(
          "select set_config('request.jwt.claim.sub', $1, true)",
          [this.userId],
        );
      }

      const { sql, values } = await this.buildSql(client);
      const result = await client.query(sql, values);
      await client.query("COMMIT");
      return this.shape(result);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      return { data: null, error: dbError(error) };
    } finally {
      client.release();
    }
  }
}

export type PostgresDb = {
  from(table: string): PostgresQueryBuilder;
};

export function createPostgresDb(userId?: string): PostgresDb {
  return {
    from(table: string) {
      return new PostgresQueryBuilder(table, userId);
    },
  };
}

export async function checkPostgresConnection() {
  const result = await getPostgresPool().query<{ database: string; version: string }>(
    "select current_database() as database, version() as version",
  );
  return result.rows[0];
}
