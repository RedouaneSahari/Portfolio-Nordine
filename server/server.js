import bcrypt from "bcryptjs";
import compression from "compression";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import fs from "fs";
import helmet from "helmet";
import morgan from "morgan";
import nodemailer from "nodemailer";
import path from "path";
import rateLimit from "express-rate-limit";
import { createStream as createRotatingStream } from "rotating-file-stream";
import sqlite3 from "sqlite3";
import SQLiteStoreFactory from "connect-sqlite3";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const ensureDir = (target) => {
  fs.mkdirSync(target, { recursive: true });
};

const logDir = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(__dirname, "logs");
ensureDir(logDir);

const logRetentionDays = Number(process.env.LOG_RETENTION_DAYS) || 365;
const logRetention = `${logRetentionDays}d`;
const accessLogRetention = Number.isFinite(logRetentionDays) && logRetentionDays > 0
  ? logRetentionDays
  : 365;

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(
      (info) => `${info.timestamp} ${info.level.toUpperCase()} ${info.message}`
    )
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, "app-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: logRetention,
    }),
    new DailyRotateFile({
      filename: path.join(logDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: logRetention,
    }),
    new winston.transports.Console(),
  ],
});

const accessLogStream = createRotatingStream("access-%DATE%.log", {
  interval: "1d",
  path: logDir,
  maxFiles: accessLogRetention,
});

const cspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  imgSrc: ["'self'", "data:", "https:"],
  fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
  styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
  scriptSrc: ["'self'"],
  connectSrc: ["'self'"],
};

const splitEnvList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const resolveTrustProxy = () => {
  const raw = String(process.env.TRUST_PROXY || "").trim().toLowerCase();
  if (!raw) {
    return process.env.NODE_ENV === "production" ? 1 : false;
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  const asNumber = Number.parseInt(raw, 10);
  if (!Number.isNaN(asNumber)) return asNumber;
  return raw;
};

const app = express();
app.set("trust proxy", resolveTrustProxy());
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
  })
);
app.use(compression());

const configuredCorsOrigins = splitEnvList(process.env.CORS_ORIGIN);
const configuredPublicOrigins = splitEnvList(process.env.PUBLIC_ORIGIN);
const resolvedCorsOrigins = configuredCorsOrigins.length
  ? configuredCorsOrigins
  : process.env.NODE_ENV === "production"
    ? configuredPublicOrigins
    : [];

if (process.env.NODE_ENV === "production" && !resolvedCorsOrigins.length) {
  logger.error(
    "CORS_ORIGIN/PUBLIC_ORIGIN manquant en production. Definissez au moins une origine autorisee."
  );
  process.exit(1);
}

app.use(
  cors({
    origin: resolvedCorsOrigins.length ? resolvedCorsOrigins : true,
    credentials: true,
  })
);
app.use(
  morgan(
    '[:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"',
    { stream: accessLogStream }
  )
);
app.use(express.json({ limit: "25kb" }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  if (req.path.startsWith("/server")) {
    res.status(403).send("Accès refusé.");
    return;
  }
  next();
});
app.use(
  express.static(projectRoot, {
    index: false,
    maxAge: "1d",
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  })
);

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, "data.sqlite");
ensureDir(path.dirname(dbPath));

const sessionsDbPath = process.env.SESSIONS_DB
  ? path.resolve(process.env.SESSIONS_DB)
  : path.join(path.dirname(dbPath), "sessions.sqlite");
ensureDir(path.dirname(sessionsDbPath));

const sessionSecret = process.env.SESSION_SECRET || "dev-secret-change-me";
if (!process.env.SESSION_SECRET) {
  logger.warn("SESSION_SECRET manquant. Definissez-le pour la production.");
}

const weakSessionSecretTokens = [
  "change-me",
  "dev-secret",
  "secret",
  "password",
  "admin123",
];
const isWeakSessionSecret = (value) => {
  const secret = String(value || "").trim();
  if (secret.length < 32) return true;
  const lowered = secret.toLowerCase();
  return weakSessionSecretTokens.some((token) => lowered.includes(token));
};

if (process.env.NODE_ENV === "production" && isWeakSessionSecret(sessionSecret)) {
  logger.error(
    "SESSION_SECRET trop faible pour la production (minimum 32 caracteres, sans valeur par defaut)."
  );
  process.exit(1);
}

const resolveSessionCookieSecure = () => {
  const raw = String(process.env.SESSION_COOKIE_SECURE || "")
    .trim()
    .toLowerCase();
  if (raw === "true" || raw === "1") {
    return true;
  }
  if (raw === "false" || raw === "0") {
    return false;
  }
  return "auto";
};

const sessionCookieSecure = resolveSessionCookieSecure();

const SQLiteStore = SQLiteStoreFactory(session);
app.use(
  session({
    store: new SQLiteStore({
      db: path.basename(sessionsDbPath),
      dir: path.dirname(sessionsDbPath),
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: "admin_session",
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: sessionCookieSecure,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

const contactLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
});

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const db = new sqlite3.Database(dbPath, (error) => {
  if (error) {
    logger.error(`SQLite connection error: ${error.message}`);
    return;
  }
  logger.info(`SQLite connected at ${dbPath}`);
});

const schemaPath = path.join(__dirname, "sql", "schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf8");

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
};

const dbExec = (sql) => {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

const ensureColumn = async (table, column, definition) => {
  const columns = await dbAll(`PRAGMA table_info(${table})`);
  if (columns.some((col) => col.name === column)) {
    return;
  }
  await dbExec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  logger.info(`SQLite colonne ajoutee: ${table}.${column}`);
};

const ensureAdminUser = async () => {
  const adminUsername = normalizeText(process.env.ADMIN_USERNAME, 120);
  const adminPassword = String(process.env.ADMIN_PASSWORD || "");

  if (!adminUsername || !adminPassword) {
    logger.warn("ADMIN_USERNAME/ADMIN_PASSWORD manquants. Aucun compte admin cree.");
    return;
  }

  const existing = await dbGet(
    "SELECT id FROM admin_users WHERE username = ?",
    [adminUsername]
  );

  if (existing) {
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await dbRun(
    "INSERT INTO admin_users (username, password_hash, created_at) VALUES (?, ?, ?)",
    [adminUsername, passwordHash, new Date().toISOString()]
  );

  logger.info(`Compte admin cree: ${adminUsername}`);
};

const initDatabase = async () => {
  try {
    await dbExec(schemaSql);
    logger.info("SQLite schema ready");
    await ensureColumn("contact_messages", "phone", "TEXT");
    await ensureColumn("page_views", "session_id", "TEXT");
    await ensureColumn("page_views", "referrer", "TEXT");

    const contactColumns = await dbAll("PRAGMA table_info(contact_messages)");
    if (contactColumns.some((column) => column.name === "ip")) {
      await dbRun("UPDATE contact_messages SET ip = NULL WHERE ip IS NOT NULL");
      logger.info("Historique IP nettoye: contact_messages.ip");
    }
    if (contactColumns.some((column) => column.name === "consent")) {
      await dbRun("UPDATE contact_messages SET consent = NULL WHERE consent IS NOT NULL");
      logger.info("Historique consentement nettoye: contact_messages.consent");
    }

    const visitColumns = await dbAll("PRAGMA table_info(page_views)");
    if (visitColumns.some((column) => column.name === "ip")) {
      await dbRun("UPDATE page_views SET ip = NULL WHERE ip IS NOT NULL");
      logger.info("Historique IP nettoye: page_views.ip");
    }

    await ensureAdminUser();
  } catch (error) {
    logger.error(`SQLite init error: ${error.message}`);
  }
};

function normalizeText(value, maxLength) {
  const cleaned = String(value || "").trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isLoopbackHost = (hostname) => {
  const host = String(hostname || "").toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
};

const isSecureOrLoopbackOrigin = (origin) => {
  try {
    const url = new URL(String(origin || ""));
    if (url.protocol === "https:") return true;
    return isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
};

const toBoolean = (value, fallback = false) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const getConfigValue = (name) => {
  const inlineValue = String(process.env[name] || "").trim();
  if (inlineValue) {
    return inlineValue;
  }

  const filePath = String(process.env[`${name}_FILE`] || "").trim();
  if (!filePath) {
    return "";
  }

  try {
    const fileValue = fs.readFileSync(filePath, "utf8").trim();
    return fileValue;
  } catch (error) {
    logger.error(`Impossible de lire ${name}_FILE (${filePath}): ${error.message}`);
    return "";
  }
};

const insertMessage = async ({
  name,
  email,
  phone,
  subject,
  message,
  userAgent,
}) => {
  const sql =
    "INSERT INTO contact_messages (name, email, phone, subject, message, created_at, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)";
  const params = [
    name,
    email,
    phone,
    subject,
    message,
    new Date().toISOString(),
    userAgent,
  ];

  const result = await dbRun(sql, params);
  return result.lastID;
};

const createTransporter = () => {
  const smtpEnabled = toBoolean(getConfigValue("SMTP_ENABLED"), false);
  if (!smtpEnabled) {
    logger.info(
      "SMTP désactivé (SMTP_ENABLED=false). Mode sans mot de passe actif via FormSubmit."
    );
    return null;
  }

  const SMTP_HOST = getConfigValue("SMTP_HOST");
  const SMTP_PORT = getConfigValue("SMTP_PORT");
  const SMTP_USER = getConfigValue("SMTP_USER");
  const SMTP_PASS = getConfigValue("SMTP_PASS");
  const SMTP_SECURE = getConfigValue("SMTP_SECURE");

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    logger.info("SMTP non configuré.");
    return null;
  }

  const placeholders = [
    "votredomaine",
    "motdepasse",
    "change-me",
    "example",
    "app_password",
  ];
  const smtpParts = [SMTP_HOST, SMTP_USER, SMTP_PASS]
    .map((value) => String(value || "").toLowerCase());
  const containsPlaceholder = smtpParts.some((part) =>
    placeholders.some((token) => part.includes(token))
  );

  if (containsPlaceholder) {
    logger.warn(
      "SMTP semble encore en valeurs de demo. Configurez SMTP_HOST/SMTP_USER/SMTP_PASS avec de vraies valeurs."
    );
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  transporter.verify().then(
    () => {
      logger.info("SMTP prêt pour l'envoi des emails.");
    },
    (error) => {
      logger.error(`SMTP invalide: ${error.message}`);
    }
  );

  return transporter;
};

const transporter = createTransporter();
const smtpUser = getConfigValue("SMTP_USER");
const contactTo = getConfigValue("CONTACT_TO") || smtpUser || "";
const contactFrom =
  getConfigValue("CONTACT_FROM") ||
  (smtpUser ? `Portfolio <${smtpUser}>` : "");
const formSubmitEnabled =
  String(getConfigValue("FORMSUBMIT_ENABLED") || "true").toLowerCase() !==
  "false";
const formSubmitRecipient = getConfigValue("FORMSUBMIT_RECIPIENT") || contactTo;
const formSubmitOrigin = (() => {
  const value = splitEnvList(getConfigValue("PUBLIC_ORIGIN"))[0] || "";
  const normalized = value.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return "";
})();
const formSubmitEndpoint =
  getConfigValue("FORMSUBMIT_ENDPOINT") ||
  (formSubmitRecipient
    ? `https://formsubmit.co/ajax/${encodeURIComponent(formSubmitRecipient)}`
    : "");
const adminUiAccessKey = getConfigValue("ADMIN_UI_ACCESS_KEY");
const adminUiLockEnabled = Boolean(adminUiAccessKey);

if (!transporter && formSubmitEnabled && formSubmitEndpoint) {
  logger.info("Fallback email activé: FormSubmit.");
}
if (!transporter && (!formSubmitEnabled || !formSubmitEndpoint)) {
  logger.warn("Aucun provider email configuré. Les emails seront ignorés.");
}
if (!formSubmitRecipient && formSubmitEnabled) {
  logger.warn(
    "FORMSUBMIT_ENABLED=true mais aucun destinataire n'est défini (FORMSUBMIT_RECIPIENT/CONTACT_TO)."
  );
}

const weakAdminUsernames = new Set(["admin", "administrator", "root", "test"]);
const weakAdminPasswordTokens = [
  "admin",
  "password",
  "123456",
  "qwerty",
  "change-me",
  "changeme",
];

const isWeakAdminPassword = (value) => {
  const password = String(value || "").trim();
  if (password.length < 14) return true;

  const lowered = password.toLowerCase();
  if (weakAdminPasswordTokens.some((token) => lowered.includes(token))) {
    return true;
  }

  let complexityScore = 0;
  if (/[a-z]/.test(password)) complexityScore += 1;
  if (/[A-Z]/.test(password)) complexityScore += 1;
  if (/\d/.test(password)) complexityScore += 1;
  if (/[^a-zA-Z0-9]/.test(password)) complexityScore += 1;

  return complexityScore < 3;
};

const timingSafeEqual = (left, right) => {
  const leftValue = String(left || "");
  const rightValue = String(right || "");
  if (!leftValue || !rightValue) return false;
  const leftBuffer = Buffer.from(leftValue, "utf8");
  const rightBuffer = Buffer.from(rightValue, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const hasAdminUiAccess = (req) => {
  if (!adminUiLockEnabled) return true;
  return Boolean(req.session?.adminUiAccess || req.session?.adminId);
};

const validateProductionConfig = () => {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const issues = [];
  const publicOrigins = splitEnvList(getConfigValue("PUBLIC_ORIGIN"));
  const corsOrigins = splitEnvList(getConfigValue("CORS_ORIGIN"));
  const adminUsername = normalizeText(process.env.ADMIN_USERNAME, 120);
  const adminPassword = String(process.env.ADMIN_PASSWORD || "");
  const smtpEnabled = toBoolean(getConfigValue("SMTP_ENABLED"), false);

  if (!publicOrigins.length) {
    issues.push("PUBLIC_ORIGIN manquant.");
  }

  if (!corsOrigins.length && !publicOrigins.length) {
    issues.push("CORS_ORIGIN manquant (ou PUBLIC_ORIGIN invalide).");
  }

  if (sessionCookieSecure === false) {
    issues.push("SESSION_COOKIE_SECURE ne doit pas etre false.");
  }

  if (sessionCookieSecure === "auto") {
    const invalidOrigins = publicOrigins.filter(
      (origin) => !isSecureOrLoopbackOrigin(origin)
    );
    if (invalidOrigins.length) {
      issues.push(
        "SESSION_COOKIE_SECURE=auto exige des PUBLIC_ORIGIN en https (ou loopback local)."
      );
    }
  }

  if (isWeakSessionSecret(sessionSecret)) {
    issues.push("SESSION_SECRET trop faible.");
  }

  if (!adminUsername || !adminPassword) {
    issues.push("ADMIN_USERNAME/ADMIN_PASSWORD manquants.");
  } else {
    if (weakAdminUsernames.has(adminUsername.toLowerCase())) {
      issues.push("ADMIN_USERNAME trop previsible.");
    }
    if (isWeakAdminPassword(adminPassword)) {
      issues.push("ADMIN_PASSWORD trop faible (min 14 caracteres, complexite requise).");
    }
  }

  if (!smtpEnabled && !formSubmitEnabled) {
    issues.push("Aucun provider email actif (SMTP_ENABLED ou FORMSUBMIT_ENABLED).");
  }

  if (formSubmitEnabled && !formSubmitRecipient) {
    issues.push("FORMSUBMIT_RECIPIENT ou CONTACT_TO requis avec FORMSUBMIT_ENABLED=true.");
  }

  if (issues.length) {
    issues.forEach((issue) => {
      logger.error(`Configuration production invalide: ${issue}`);
    });
    throw new Error("Configuration production invalide.");
  }
};

const sendContactViaFormSubmit = async ({
  name,
  email,
  phone,
  subject,
  message,
}) => {
  if (!formSubmitEnabled || !formSubmitEndpoint) {
    return false;
  }

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Portfolio-Contact-Server/1.0",
  };
  if (formSubmitOrigin) {
    headers.Origin = formSubmitOrigin;
    headers.Referer = `${formSubmitOrigin}/`;
  }

  const response = await fetch(formSubmitEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      email,
      phone,
      subject: subject || "Nouveau message du portfolio",
      message,
      _subject: subject ? `Nouveau message: ${subject}` : "Nouveau message du portfolio",
      _replyto: email,
      _autoresponse: `Bonjour ${name},\n\nVotre message a bien été reçu.\n\nNous reviendrons vers vous dès que possible.\n\nPortfolio Nordine`,
      _captcha: "false",
      _template: "table",
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      payload && payload.message ? ` (${payload.message})` : "";
    throw new Error(`FormSubmit HTTP ${response.status}${detail}`);
  }

  if (
    payload &&
    Object.prototype.hasOwnProperty.call(payload, "success") &&
    String(payload.success).toLowerCase() !== "true"
  ) {
    throw new Error(payload.message || "FormSubmit rejected.");
  }

  return true;
};

const logPageView = async (req, res, overridePath = null) => {
  try {
    const sessionId = ensureVisitorId(req, res);
    await dbRun(
      "INSERT INTO page_views (path, session_id, created_at, user_agent, referrer) VALUES (?, ?, ?, ?, ?)",
      [
        overridePath || req.path || "/",
        sessionId,
        new Date().toISOString(),
        req.headers["user-agent"] || "",
        req.get("referer") || "",
      ]
    );
  } catch (error) {
    logger.error(`Erreur log visite: ${error.message}`);
  }
};

const buildVisitSeries = (rows, days) => {
  const counts = new Map(
    rows.map((row) => [row.day, { total: row.total_count, unique: row.unique_count }])
  );
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  const series = [];
  for (let i = 0; i < days; i += 1) {
    const current = new Date(start.getTime() + i * 86400000);
    const key = current.toISOString().slice(0, 10);
    const item = counts.get(key) || { total: 0, unique: 0 };
    series.push({ date: key, total: item.total || 0, unique: item.unique || 0 });
  }
  return series;
};

const escapeCsv = (value) => {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const toCsv = (rows, columns) => {
  const header = columns.map((col) => escapeCsv(col.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((col) => escapeCsv(row[col.key])).join(",")
  );
  return `\uFEFF${[header, ...lines].join("\n")}`;
};

const retentionDays = Number(process.env.DATA_RETENTION_DAYS) || 365;

const purgeOldData = async () => {
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
  await dbRun("DELETE FROM page_views WHERE created_at < ?", [cutoff]);
  await dbRun("DELETE FROM contact_messages WHERE created_at < ?", [cutoff]);
};

const schedulePurge = () => {
  purgeOldData().catch((error) => {
    logger.error(`Erreur purge: ${error.message}`);
  });
  setInterval(() => {
    purgeOldData().catch((error) => {
      logger.error(`Erreur purge: ${error.message}`);
    });
  }, 1000 * 60 * 60 * 24);
};


const LOG_FILE_PREFIXES = {
  app: "app-",
  error: "error-",
  access: "access-",
};

const getExpectedOrigins = (req) => {
  const configured = splitEnvList(process.env.PUBLIC_ORIGIN);
  const rawHost = String(req.get("host") || "").trim();
  const requestHost = rawHost.toLowerCase();
  const requestOrigin = `${req.protocol}://${rawHost}`;
  const portMatch = rawHost.match(/:(\d+)$/);
  const portSuffix = portMatch ? `:${portMatch[1]}` : "";
  const isLoopbackHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(
    requestHost
  );
  const loopbackOrigins = [
    `${req.protocol}://localhost${portSuffix}`,
    `${req.protocol}://127.0.0.1${portSuffix}`,
    `${req.protocol}://[::1]${portSuffix}`,
  ];

  if (!configured.length) {
    return isLoopbackHost
      ? [...new Set([requestOrigin, ...loopbackOrigins])]
      : [requestOrigin];
  }

  if (isLoopbackHost) {
    [requestOrigin, ...loopbackOrigins].forEach((origin) => {
      if (!configured.includes(origin)) {
        configured.push(origin);
      }
    });
  }

  if (process.env.NODE_ENV !== "production") {
    const devOrigin = requestOrigin;
    if (!configured.includes(devOrigin)) {
      configured.push(devOrigin);
    }
  }

  return configured;
};

const getRequestOrigin = (req) => {
  const origin = req.get("origin");
  if (origin) return origin;
  const referer = req.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
};

const requireSameOrigin = (req, res, next) => {
  const origin = getRequestOrigin(req);
  if (!origin) {
    next();
    return;
  }
  if (!getExpectedOrigins(req).includes(origin)) {
    res.status(403).json({ message: "Origine invalide." });
    return;
  }
  next();
};

const parseCookies = (req) => {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(";").reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
};

const ensureVisitorId = (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.visitor_id) {
    return cookies.visitor_id;
  }
  const isSecureRequest =
    req.secure || String(req.get("x-forwarded-proto") || "").includes("https");
  const secureFlag =
    sessionCookieSecure === "auto" ? isSecureRequest : sessionCookieSecure;
  const id = crypto.randomUUID();
  res.cookie("visitor_id", id, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureFlag,
  });
  return id;
};

const requireAdmin = (req, res, next) => {
  if (req.session?.adminId) {
    next();
    return;
  }
  res.status(401).json({ message: "Acces reserve." });
};

const clampNumber = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

const findLatestLogFile = async (prefix) => {
  const entries = await fs.promises.readdir(logDir);
  const matches = entries.filter(
    (name) => name.startsWith(prefix) && name.endsWith(".log")
  );
  if (!matches.length) {
    return null;
  }

  const stats = await Promise.all(
    matches.map(async (name) => ({
      name,
      mtime: (await fs.promises.stat(path.join(logDir, name))).mtimeMs,
    }))
  );
  stats.sort((a, b) => b.mtime - a.mtime);
  return path.join(logDir, stats[0].name);
};

const readLogFile = async (fileKey, maxLines) => {
  const prefix = LOG_FILE_PREFIXES[fileKey];
  if (!prefix) {
    return null;
  }

  const filePath = await findLatestLogFile(prefix);
  if (!filePath) {
    return { content: "", resolvedFile: null };
  }

  try {
    const content = await fs.promises.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    if (lines.length && lines[lines.length - 1] === "") {
      lines.pop();
    }
    return {
      content: lines.slice(-maxLines).join("\n"),
      resolvedFile: path.basename(filePath),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { content: "", resolvedFile: null };
    }
    throw error;
  }
};

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
  });
});

app.post("/api/track", requireSameOrigin, trackLimiter, async (req, res) => {
  const pathValue = normalizeText(req.body?.path, 240);
  if (pathValue) {
    await logPageView(req, res, pathValue);
  }
  res.json({ ok: true });
});

app.get("/api/admin/ui-access", requireSameOrigin, (req, res) => {
  res.json({
    enabled: hasAdminUiAccess(req),
    locked: adminUiLockEnabled,
  });
});

app.post(
  "/api/admin/ui-access",
  requireSameOrigin,
  adminLoginLimiter,
  async (req, res) => {
    if (!adminUiLockEnabled) {
      return res.json({ enabled: true, locked: false });
    }

    const key = normalizeText(req.body?.key, 240);
    if (!key) {
      return res.status(400).json({ message: "Clé admin requise." });
    }

    if (!timingSafeEqual(key, adminUiAccessKey)) {
      return res.status(401).json({ message: "Clé admin invalide." });
    }

    req.session.adminUiAccess = true;
    return res.json({ enabled: true, locked: true });
  }
);

app.get("/api/admin/session", requireSameOrigin, (req, res) => {
  res.json({
    authenticated: Boolean(req.session?.adminId),
    username: req.session?.adminUsername || null,
    uiAccess: hasAdminUiAccess(req),
    adminUiLocked: adminUiLockEnabled,
  });
});

app.post("/api/admin/login", requireSameOrigin, adminLoginLimiter, async (req, res) => {
  const username = normalizeText(req.body?.username, 120);
  const password = String(req.body?.password || "");

  if (!username || !password) {
    return res.status(400).json({ message: "Identifiants requis." });
  }

  try {
    const admin = await dbGet(
      "SELECT id, username, password_hash FROM admin_users WHERE username = ?",
      [username]
    );

    if (!admin) {
      return res.status(401).json({ message: "Identifiants invalides." });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Identifiants invalides." });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;
    req.session.adminUiAccess = true;

    await dbRun("UPDATE admin_users SET last_login_at = ? WHERE id = ?", [
      new Date().toISOString(),
      admin.id,
    ]);

    return res.json({ authenticated: true, username: admin.username });
  } catch (error) {
    logger.error(`Erreur /api/admin/login: ${error.message}`);
    return res.status(500).json({ message: "Erreur lors de la connexion." });
  }
});

app.post("/api/admin/logout", requireSameOrigin, (req, res) => {
  if (!req.session) {
    return res.json({ ok: true });
  }

  req.session.destroy((error) => {
    if (error) {
      logger.error(`Erreur /api/admin/logout: ${error.message}`);
      res.status(500).json({ message: "Erreur lors de la deconnexion." });
      return;
    }
    res.clearCookie("admin_session");
    res.json({ ok: true });
  });
});

app.get("/api/admin/messages", requireSameOrigin, requireAdmin, async (req, res) => {
  const limit = clampNumber(req.query?.limit, 30, 1, 100);
  const offset = clampNumber(req.query?.offset, 0, 0, 100000);
  const query = normalizeText(req.query?.q, 120);

  const where = query
    ? "WHERE name LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?"
    : "";
  const params = query ? Array(4).fill(`%${query}%`) : [];

  try {
    const totalRow = await dbGet(
      `SELECT COUNT(*) AS total FROM contact_messages ${where}`.trim(),
      params
    );
    const rows = await dbAll(
      `SELECT id, name, email, phone, subject, message, created_at, user_agent FROM contact_messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`.trim(),
      [...params, limit, offset]
    );

    res.json({
      items: rows,
      limit,
      offset,
      total: totalRow?.total || 0,
      q: query || "",
    });
  } catch (error) {
    logger.error(`Erreur /api/admin/messages: ${error.message}`);
    res.status(500).json({ message: "Erreur lors du chargement des messages." });
  }
});

app.get("/api/admin/messages/export", requireSameOrigin, requireAdmin, async (req, res) => {
  const query = normalizeText(req.query?.q, 120);
  const where = query
    ? "WHERE name LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?"
    : "";
  const params = query ? Array(4).fill(`%${query}%`) : [];

  try {
    const rows = await dbAll(
      `SELECT name, email, phone, subject, message, created_at, user_agent FROM contact_messages ${where} ORDER BY created_at DESC`.trim(),
      params
    );

    const csv = toCsv(rows, [
      { key: "created_at", label: "Date" },
      { key: "name", label: "Nom" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Telephone" },
      { key: "subject", label: "Sujet" },
      { key: "message", label: "Message" },
      { key: "user_agent", label: "User-Agent" },
    ]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"messages.csv\"");
    res.send(csv);
  } catch (error) {
    logger.error(`Erreur /api/admin/messages/export: ${error.message}`);
    res.status(500).json({ message: "Erreur lors de l'export des messages." });
  }
});

app.get("/api/admin/logs", requireSameOrigin, requireAdmin, async (req, res) => {
  const fileKey = String(req.query?.file || "app");
  const maxLines = clampNumber(req.query?.lines, 200, 20, 500);

  try {
    const result = await readLogFile(fileKey, maxLines);
    if (result === null) {
      return res.status(400).json({ message: "Fichier de log inconnu." });
    }

    return res.json({
      file: fileKey,
      lines: maxLines,
      content: result.content,
      resolvedFile: result.resolvedFile,
    });
  } catch (error) {
    logger.error(`Erreur /api/admin/logs: ${error.message}`);
    return res.status(500).json({ message: "Erreur lors du chargement des logs." });
  }
});

app.get("/api/admin/visits", requireSameOrigin, requireAdmin, async (req, res) => {
  const days = clampNumber(req.query?.days, 14, 1, 90);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  try {
    const totalRow = await dbGet(
      "SELECT COUNT(*) AS total, COUNT(DISTINCT session_id) AS unique_total FROM page_views"
    );
    const rows = await dbAll(
      "SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS total_count, COUNT(DISTINCT session_id) AS unique_count FROM page_views WHERE created_at >= ? GROUP BY day ORDER BY day ASC",
      [start.toISOString()]
    );

    res.json({
      total: totalRow?.total || 0,
      uniqueTotal: totalRow?.unique_total || 0,
      days,
      series: buildVisitSeries(rows, days),
    });
  } catch (error) {
    logger.error(`Erreur /api/admin/visits: ${error.message}`);
    res.status(500).json({ message: "Erreur lors du chargement des visites." });
  }
});

app.get("/api/admin/visits/export", requireSameOrigin, requireAdmin, async (req, res) => {
  const days = clampNumber(req.query?.days, 14, 1, 365);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  try {
    const rows = await dbAll(
      "SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS total_count, COUNT(DISTINCT session_id) AS unique_count FROM page_views WHERE created_at >= ? GROUP BY day ORDER BY day ASC",
      [start.toISOString()]
    );

    const series = buildVisitSeries(rows, days);
    const csv = toCsv(series, [
      { key: "date", label: "Date" },
      { key: "total", label: "Visites" },
      { key: "unique", label: "Visiteurs uniques" },
    ]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"visites.csv\"");
    res.send(csv);
  } catch (error) {
    logger.error(`Erreur /api/admin/visits/export: ${error.message}`);
    res.status(500).json({ message: "Erreur lors de l'export des visites." });
  }
});

app.post("/api/contact", contactLimiter, async (req, res) => {
  const name = normalizeText(req.body?.name, 120);
  const email = normalizeText(req.body?.email, 160);
  const phone = normalizeText(req.body?.phone, 40);
  const subject = normalizeText(req.body?.subject, 180);
  const message = normalizeText(req.body?.message, 3000);

  if (!name || !email || !message) {
    return res.status(400).json({
      message: "Merci de remplir le nom, l'email et le message.",
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      message: "L'adresse email semble invalide.",
    });
  }

  try {
    const entryId = await insertMessage({
      name,
      email,
      phone,
      subject,
      message,
      userAgent: req.headers["user-agent"] || "",
    });

    let emailSent = false;
    let emailSentToOwner = false;
    let emailSentToSender = false;
    let ownerProvider = "none";
    let providerErrorMessage = "";

    if (transporter && contactTo) {
      try {
        await transporter.sendMail({
          from: contactFrom || contactTo,
          to: contactTo,
          replyTo: email,
          subject: subject
            ? `Nouveau message: ${subject}`
            : "Nouveau message du portfolio",
          text: `Nom: ${name}
Email: ${email}
Telephone: ${phone || "Non fourni"}
Sujet: ${subject || ""}

${message}`,
        });
        emailSent = true;
        emailSentToOwner = true;
        ownerProvider = "smtp";
      } catch (error) {
        providerErrorMessage = String(error?.message || "");
        logger.error(`Erreur SMTP: ${error.message}`);
      }
    } else if (formSubmitEnabled && formSubmitEndpoint) {
      try {
        const sent = await sendContactViaFormSubmit({
          name,
          email,
          phone,
          subject,
          message,
        });
        if (sent) {
          emailSent = true;
          emailSentToOwner = true;
          emailSentToSender = true;
          ownerProvider = "formsubmit";
        }
      } catch (error) {
        providerErrorMessage = String(error?.message || "");
        logger.error(`Erreur FormSubmit: ${error.message}`);
      }
    }

    if (transporter) {
      try {
        await transporter.sendMail({
          from: contactFrom || contactTo || process.env.SMTP_USER || "",
          to: email,
          subject: "Confirmation de votre message",
          text: `Bonjour ${name},

Votre message a bien été reçu.

Récapitulatif:
- Sujet: ${subject || "(Sans sujet)"}
- Date: ${new Date().toLocaleString("fr-FR")}

Nous reviendrons vers vous dès que possible.

Portfolio Nordine`,
        });
        emailSent = true;
        emailSentToSender = true;
      } catch (error) {
        providerErrorMessage = String(error?.message || "");
        logger.error(`Erreur SMTP confirmation: ${error.message}`);
      }
    }

    logger.info(
      `Message contact #${entryId} enregistré. Email owner: ${emailSentToOwner} (${ownerProvider}), email sender: ${emailSentToSender}`
    );

    let responseMessage =
      "Message enregistré, mais il ne peut pas être envoyé pour le moment.";

    if (emailSentToOwner && emailSentToSender) {
      responseMessage =
        "Message envoyé. Une confirmation a été transmise à votre email.";
    } else if (emailSentToOwner) {
      responseMessage = "Message envoyé. Merci pour votre prise de contact.";
    } else if (emailSentToSender) {
      responseMessage = "Message enregistré. Une confirmation a été envoyée à votre email.";
    } else if (/needs activation/i.test(providerErrorMessage)) {
      responseMessage =
        "Message enregistré. L'envoi email est en attente d'activation FormSubmit (vérifiez l'email d'administration).";
    }

    return res.status(200).json({
      message: responseMessage,
      emailSent,
      emailSentToOwner,
      emailSentToSender,
      id: entryId,
    });
  } catch (error) {
    logger.error(`Erreur /api/contact: ${error.message}`);
    return res.status(500).json({
      message: "Une erreur est survenue lors de l'envoi.",
    });
  }
});

app.get("/admin", (req, res) => {
  logPageView(req, res, "/admin");
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(projectRoot, "admin.html"));
});

app.get("/", (req, res) => {
  logPageView(req, res);
  res.sendFile(path.join(projectRoot, "index.html"));
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ message: "Route API inconnue." });
    return;
  }
  if (req.method === "GET") {
    logPageView(req, res);
  }
  res.sendFile(path.join(projectRoot, "index.html"));
});

app.use((error, req, res, next) => {
  logger.error(`Erreur serveur: ${error.message}`);
  res.status(500).json({ message: "Erreur serveur inattendue." });
});

const port = Number(process.env.PORT) || 3000;

const startServer = async () => {
  validateProductionConfig();
  await initDatabase();
  schedulePurge();
  app.listen(port, () => {
    logger.info(`Serveur demarre sur http://localhost:${port}`);
  });
};

startServer();

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});

process.on("uncaughtException", (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
});

