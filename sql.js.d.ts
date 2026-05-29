declare module "sql.js" {
  interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  interface SqlJsDatabase {
    exec: (sql: string) => Array<{
      columns: string[];
      values: unknown[][];
    }>;
    close: () => void;
  }

  interface SqlJsStatic {
    Database: new (data?: Uint8Array) => SqlJsDatabase;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
