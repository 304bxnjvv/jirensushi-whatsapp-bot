import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, tokenHash } from "../src/auth.ts";
test("password hashes use random salt and reject changed password", async () => {
  const a = await hashPassword("Correct-horse-123!");
  const b = await hashPassword("Correct-horse-123!");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("Correct-horse-123!", a), true);
  assert.equal(await verifyPassword("wrong", a), false);
  assert.equal(await verifyPassword("wrong", "broken"), false);
});
test("tokens are hashed and not retained as plaintext", async () => {
  assert.equal((await tokenHash("abc")).length, 64);
  assert.notEqual(await tokenHash("abc"), await tokenHash("abcd"));
});
