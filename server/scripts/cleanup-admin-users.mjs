import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath =
  process.env.DB_PATH && String(process.env.DB_PATH).trim()
    ? path.resolve(process.env.DB_PATH)
    : path.resolve(__dirname, "..", "storage", "data.sqlite");

const keepUsername = String(process.env.ADMIN_USERNAME || "").trim();
const weakUsernames = new Set(["admin", "administrator", "root", "test"]);

const db = new sqlite3.Database(dbPath);

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ changes: this.changes });
    });
  });

const closeDb = () =>
  new Promise((resolve) => {
    db.close(() => resolve());
  });

const main = async () => {
  const before = await dbAll(
    "SELECT id, username, created_at, last_login_at FROM admin_users ORDER BY id"
  );
  console.log("Comptes admin avant nettoyage:");
  console.log(JSON.stringify(before, null, 2));

  const removableWeak = before
    .map((row) => row.username)
    .filter((username) => weakUsernames.has(String(username || "").toLowerCase()))
    .filter((username) => !keepUsername || username !== keepUsername);

  if (removableWeak.length) {
    const placeholders = removableWeak.map(() => "?").join(", ");
    const result = await dbRun(
      `DELETE FROM admin_users WHERE username IN (${placeholders})`,
      removableWeak
    );
    console.log(
      `Suppression effectuée: ${result.changes} compte(s) faible(s) supprimé(s).`
    );
  } else {
    console.log("Aucun compte admin faible à supprimer.");
  }

  const after = await dbAll(
    "SELECT id, username, created_at, last_login_at FROM admin_users ORDER BY id"
  );
  console.log("Comptes admin après nettoyage:");
  console.log(JSON.stringify(after, null, 2));
};

main()
  .catch((error) => {
    console.error(`Erreur nettoyage admins: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
