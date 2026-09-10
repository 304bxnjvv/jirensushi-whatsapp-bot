// Outputs SQL with a salted password hash, never plaintext. Pass the password through stdin.
import { hashPassword } from "../src/auth.ts";
const [username, role, operation] = process.argv.slice(2);
if (
  !username ||
  !/^[a-zA-Z0-9._-]{3,60}$/.test(username) ||
  !["local", "ceo"].includes(role) ||
  (operation !== undefined && operation !== "--reset")
) {
  console.error(
    "Usage: node scripts/create-user.ts USERNAME local|ceo [--reset] < password-input",
  );
  process.exit(1);
}
let password = "";
for await (const chunk of process.stdin) password += chunk;
password = password.replace(/\r?\n$/, "");
if (password.length < 12 || password.length > 256)
  throw new Error("Password must be 12–256 characters.");
const hash = await hashPassword(password);
password = "";
if (operation === "--reset") {
  console.log(
    "UPDATE users SET password_hash='" +
      hash +
      "' WHERE username='" +
      username +
      "';\nDELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username='" +
      username +
      "');",
  );
} else
  console.log(
    "INSERT INTO users(id,username,password_hash,role) VALUES ('" +
      crypto.randomUUID() +
      "','" +
      username +
      "','" +
      hash +
      "','" +
      role +
      "');",
  );
