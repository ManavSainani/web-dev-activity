"use client";

import { useState } from "react";
import styles from "./admin.module.css";

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createToken(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setToken("");
    setCopied(false);
    try {
      const response = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, expiresInHours: Number(expiresInHours) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create the token.");
      setToken(result.token);
      setMessage(`This key can be used once and expires in ${expiresInHours === "1" ? "1 hour" : `${expiresInHours} hours`}.`);
    } catch (error) {
      setMessage(error.message || "Could not create the token. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setMessage("Clipboard access was unavailable. Select and copy the key manually.");
    }
  }

  return (
    <main className={styles.page}>
      <a className={styles.brand} href="/">fieldnote<span>.</span></a>
      <section className={styles.card}>
        <div className="eyebrow">ADMINISTRATION</div>
        <h1>Create an access key.</h1>
        <p className={styles.intro}>Generate a one-time recording key. The database stores only its hash, so copy it before you leave this page.</p>

        <form onSubmit={createToken}>
          <label htmlFor="adminKey">Admin key</label>
          <input
            id="adminKey"
            type="password"
            autoComplete="current-password"
            required
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="Enter the admin key"
          />

          <label htmlFor="expiry">Key expires if unused after</label>
          <select id="expiry" value={expiresInHours} onChange={(event) => setExpiresInHours(event.target.value)}>
            <option value="1">1 hour</option>
            <option value="24">24 hours</option>
            <option value="168">7 days</option>
            <option value="720">30 days</option>
          </select>

          <button className={styles.createButton} type="submit" disabled={busy}>
            {busy ? "Creating key…" : "Create one-time key"}
          </button>
        </form>

        {message && <p className={token ? styles.success : styles.message} role="status">{message}</p>}
        {token && (
          <div className={styles.result}>
            <label htmlFor="createdToken">One-time key</label>
            <div className={styles.tokenRow}>
              <input id="createdToken" readOnly value={token} onFocus={(event) => event.target.select()} />
              <button type="button" onClick={copyToken}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <small>It cannot be shown again after you leave this page.</small>
          </div>
        )}
        <p className={styles.footnote}>After someone redeems the key, their recording session lasts 30 minutes.</p>
      </section>
    </main>
  );
}
