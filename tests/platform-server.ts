import { spawn, type ChildProcess } from "node:child_process";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { once } from "node:events";
import { cpSync, mkdirSync } from "node:fs";
import { request } from "node:http";
import { createServer } from "node:https";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout } from "node:timers/promises";

const backendPort = 39111;
const gatewayPort = 39112;
const loopback = "127.0.0.1";
export const backendOrigin = `http://${loopback}:${backendPort}`;
export const adminOrigin = `https://console.localhost:${gatewayPort}`;
export const approvedOrigin = `https://approved.localhost:${gatewayPort}`;
export const otherOrigin = `https://other.localhost:${gatewayPort}`;

type Credentials = { username: string; password: string };

function seedLegacyWidget(database: string) {
  const widgetId = randomUUID();
  const links = [approvedOrigin, otherOrigin].map((origin) => ({ id: randomUUID(), origin }));
  mkdirSync(dirname(database), { recursive: true });
  const db = new DatabaseSync(database);
  try {
    db.exec(`
      CREATE TABLE widget_instances (
        id TEXT PRIMARY KEY,
        template_key TEXT NOT NULL,
        name TEXT NOT NULL,
        config_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE widget_embed_links (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL REFERENCES widget_instances(id),
        origins_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        created_at INTEGER NOT NULL
      ) STRICT;
    `);
    db.prepare("INSERT INTO widget_instances VALUES (?, ?, ?, ?, ?)")
      .run(widgetId, "freedom-fee-check", "Legacy widget", JSON.stringify({ appearance: { background: "#f8f6f2" } }), Date.now());
    for (const { id, origin } of links) {
      db.prepare("INSERT INTO widget_embed_links VALUES (?, ?, ?, 1, ?)")
        .run(id, widgetId, JSON.stringify([origin]), Date.now());
    }
  } finally {
    db.close();
  }
  return { widgetId, links };
}

function der(tag: number, value: Buffer) {
  const size = value.length;
  const length = size < 128 ? [size] : size < 256 ? [0x81, size] : [0x82, size >> 8, size & 0xff];
  return Buffer.concat([Buffer.from([tag, ...length]), value]);
}

// Build a short-lived X.509 certificate in memory. The test browser alone accepts it.
function testCertificate() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sequence = (...items: Buffer[]) => der(0x30, Buffer.concat(items));
  const algorithm = Buffer.from("300d06092a864886f70d01010b0500", "hex"); // sha256WithRSAEncryption
  const commonName = Buffer.from("0603550403", "hex");
  const subject = sequence(der(0x31, sequence(commonName, der(0x0c, Buffer.from("Widget Console Test")))));
  const utcTime = (date: Date) => der(0x17, Buffer.from(date.toISOString().slice(2, 19).replace(/[-T:]/g, "") + "Z"));
  const validity = sequence(utcTime(new Date(Date.now() - 60_000)), utcTime(new Date(Date.now() + 86_400_000)));
  const body = sequence(der(0x02, Buffer.from([1])), algorithm, subject, validity, subject, publicKey.export({ type: "spki", format: "der" }));
  const signature = der(0x03, Buffer.concat([Buffer.from([0]), sign("sha256", body, privateKey)]));
  const certificate = sequence(body, algorithm, signature).toString("base64");
  return {
    key: privateKey.export({ type: "pkcs8", format: "pem" }),
    cert: `-----BEGIN CERTIFICATE-----\n${certificate}\n-----END CERTIFICATE-----`,
  };
}

export async function startPlatform(credentials: Credentials, { trustCloudflare = false } = {}) {
  const database = resolve(".data/e2e", randomUUID(), "platform.sqlite");
  const legacy = seedLegacyWidget(database);
  mkdirSync(".next/standalone/.next", { recursive: true });
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
  cpSync("public", ".next/standalone/public", { recursive: true });

  const hostPages = new Set([new URL(approvedOrigin).host, new URL(otherOrigin).host]);
  const gateway = createServer(testCertificate(), (incoming, outgoing) => {
    const host = incoming.headers.host ?? "";
    if (hostPages.has(host)) {
      const id = /^\/([a-f0-9-]{36})$/i.exec(incoming.url ?? "")?.[1];
      if (!id) {
        outgoing.writeHead(404).end();
        return;
      }
      outgoing.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(
        `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Embed host fixture</title><body style="margin:0"><iframe title="Embedded fixture" style="display:block;width:100%;height:1000px;border:0" src="${adminOrigin}/embed/${id}"></iframe></body></html>`,
      );
      return;
    }

    const upstream = request({
      host: loopback,
      port: backendPort,
      path: incoming.url,
      method: incoming.method,
      headers: { ...incoming.headers, "x-forwarded-host": host, "x-forwarded-proto": "https" },
    }, (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    });
    upstream.on("error", () => {
      if (!outgoing.headersSent) outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(upstream);
  });

  let child: ChildProcess | undefined;
  async function stopBackend() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exit = once(child, "exit");
    child.kill();
    await exit;
  }

  async function startBackend({ username, password }: Credentials) {
    const backend = spawn(process.execPath, [".next/standalone/server.js"], {
      stdio: "inherit",
      env: {
        ...process.env,
        HOSTNAME: loopback,
        PORT: String(backendPort),
        WIDGET_DB_PATH: database,
        WIDGET_PUBLIC_ORIGIN: adminOrigin,
        WIDGET_ADMIN_USERNAME: username,
        WIDGET_ADMIN_PASSWORD: password,
        WIDGET_TRUST_CLOUDFLARE: trustCloudflare ? "1" : "0",
      },
    });
    child = backend;
    await once(backend, "spawn");
    for (let attempt = 0; attempt < 100; attempt++) {
      if (backend.exitCode !== null || backend.signalCode !== null) break;
      try {
        const response = await fetch(`${backendOrigin}/api/health`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) return;
      } catch {
        // The backend may still be starting.
      }
      await setTimeout(100);
    }
    throw new Error("The test backend did not become ready.");
  }

  async function close() {
    const closed = new Promise<void>((resolve, reject) => {
      gateway.close((error) => error ? reject(error) : resolve());
    });
    gateway.closeAllConnections();
    await Promise.all([closed, stopBackend()]);
  }

  gateway.listen(gatewayPort, loopback);
  await once(gateway, "listening");
  try {
    await startBackend(credentials);
  } catch (error) {
    await close();
    throw error;
  }
  return {
    close,
    database,
    legacy,
    async restart(next: Credentials) {
      await stopBackend();
      await startBackend(next);
    },
  };
}
