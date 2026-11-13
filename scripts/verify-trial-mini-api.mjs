import { Buffer } from "node:buffer";
import { get } from "node:https";
import process from "node:process";
import { pathToFileURL, URL } from "node:url";
import { loadPublicMeals } from "../apps/mini-program-taro/src/public/visitor-meals.ts";

const origin = "https://api.enhe-tongxin.com";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxBytes = 1024 * 1024;

function getAnonymousResponse(url, options) {
  // Node HTTPS sends no ambient cookies and does not follow Location headers.
  return new Promise((done, reject) => {
    get(url, options, done).once("error", reject);
  });
}

async function readResponse(url, expectedStatus, request, withJson = true) {
  const address = new URL(url);
  if (address.origin !== origin || address.username || address.password)
    throw new Error("Wrong origin");
  const response = await request(address.href, {
    method: "GET",
    agent: false,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
    headers: { Accept: "application/json", "Accept-Encoding": "identity" },
    signal: globalThis.AbortSignal.timeout(8000),
  });
  try {
    const { headers, statusCode } = response;
    if (
      statusCode !== expectedStatus ||
      headers["set-cookie"] !== undefined ||
      headers.authorization !== undefined
    ) {
      throw new Error("Unexpected HTTP response");
    }
    if (!withJson) return;
    if (!/^application\/json(?:\s*;|$)/i.test(headers["content-type"] ?? ""))
      throw new Error("JSON required");
    if (Number(headers["content-length"]) > maxBytes) throw new Error("Response too large");
    let bytes = 0;
    const chunks = [];
    for await (const chunk of response) {
      bytes += chunk.length;
      if (bytes > maxBytes) throw new Error("Response too large");
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    response.destroy();
  }
}

function validInputs(reference, date, mealId, items) {
  if (
    typeof reference !== "string" ||
    !/^[A-Za-z0-9._~-]{1,128}$/.test(reference) ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    typeof mealId !== "string" ||
    !uuid.test(mealId) ||
    items.length < 1 ||
    items.length > 12 ||
    items.some((item) => typeof item !== "string" || !item.trim() || item.length > 120)
  )
    return false;
  const parsed = Date.parse(date + "T00:00:00.000Z");
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date;
}

function hasKeys(value, keys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

export async function verifyTrialMiniApi(args, request = getAnonymousResponse) {
  const [publicReference, date, mealId, ...items] = args;
  if (!validInputs(publicReference, date, mealId, items)) return { status: "FAIL", check: "input" };
  let check = "me";
  try {
    const me = await readResponse(origin + "/me", 401, request);
    if (
      !hasKeys(me, ["error", "request_id"]) ||
      typeof me.request_id !== "string" ||
      !uuid.test(me.request_id) ||
      !hasKeys(me.error, ["code", "message"]) ||
      me.error.code !== "UNAUTHENTICATED" ||
      me.error.message !== "Authentication is required."
    )
      throw new Error("Unexpected identity contract");

    check = "meals";
    const meals = await loadPublicMeals({
      baseUrl: origin,
      publicReference,
      date,
      allowLocalHttp: false,
      request: async (url) => ({ statusCode: 200, data: await readResponse(url, 200, request) }),
    });
    const matches = meals.filter((meal) => meal.id === mealId);
    if (
      matches.length !== 1 ||
      matches[0].items.length !== items.length ||
      items.some((item, index) => matches[0].items[index] !== item)
    )
      throw new Error("Expected meal not found");

    check = "health";
    await readResponse(origin + "/health", 404, request, false);
    return { status: "PASS", check: "complete" };
  } catch {
    // The public receipt identifies the failed check without echoing server data or arguments.
    return { status: "FAIL", check };
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await verifyTrialMiniApi(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exitCode = result.status === "PASS" ? 0 : 1;
}
