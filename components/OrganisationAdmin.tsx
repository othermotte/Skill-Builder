import React, { useEffect, useState } from "react";
import {
  Organisation,
  listOrganisations,
  saveOrganisation,
} from "../services/access";
export const OrganisationAdmin: React.FC = () => {
  const [organisations, setOrganisations] = useState<Organisation[]>([]),
    [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState(""),
    [domains, setDomains] = useState(""),
    [limit, setLimit] = useState("");
  const [period, setPeriod] = useState("week"),
    [date, setDate] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [code, setCode] = useState("");
  const refresh = () => listOrganisations().then(setOrganisations);
  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);
  const action = async (data: unknown) => {
    setBusy(true);
    setMessage("");
    setCode("");
    try {
      const result = await saveOrganisation(data);
      if (result.code) setCode(result.code);
      await refresh();
      return true;
    } catch (e: any) {
      setMessage(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const reset = () => {
    setEditing(null);
    setName("");
    setDomains("");
    setLimit("");
    setPeriod("week");
    setDate("");
  };
  return (
    <section className="space-y-6 border border-gray-200 p-6 rounded-3xl">
      <div>
        <h2 className="text-2xl font-bold">Organisation access</h2>
        <p className="mt-2 text-gray-600">
          Give a pilot, partner or organisation full access. Expiry returns
          members to their free allowance and keeps their history.
        </p>
      </div>
      <form
        className="grid md:grid-cols-2 gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const expiresAt =
            period === "never"
              ? null
              : period === "custom"
                ? new Date(date).getTime()
                : Date.now() + (period === "week" ? 7 : 30) * 86400000;
          if (
            await action({
              id: editing,
              name,
              domains: domains
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              memberLimit: limit ? Number(limit) : null,
              expiresAt,
            })
          )
            reset();
        }}
      >
        <label className="grid gap-1 text-sm">
          Organisation name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
            className="border rounded-lg p-3"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Email domains, optional
          <input
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            placeholder="unc.edu, kenan-flagler.unc.edu"
            className="border rounded-lg p-3"
          />
          <span className="text-gray-500 text-xs">
            Comma separated. Only verified addresses at these exact domains can
            redeem.
          </span>
        </label>
        <label className="grid gap-1 text-sm">
          Access expires
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border rounded-lg p-3"
          >
            <option value="week">In one week</option>
            <option value="month">In 30 days</option>
            <option value="custom">On a chosen date</option>
            <option value="never">Never</option>
          </select>
        </label>
        {period === "custom" && (
          <label className="grid gap-1 text-sm">
            Expiry date and time
            <input
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded-lg p-3"
            />
          </label>
        )}
        <label className="grid gap-1 text-sm">
          Maximum members, optional
          <input
            type="number"
            min="1"
            max="100000"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="No limit"
            className="border rounded-lg p-3"
          />
        </label>
        <div className="md:col-span-2 flex gap-3">
          <button
            disabled={busy}
            className="bg-indigo-600 text-white p-3 rounded-lg disabled:opacity-50"
          >
            {busy
              ? "Saving…"
              : editing
                ? "Save organisation access"
                : "Create organisation and code"}
          </button>
          {editing && (
            <button type="button" onClick={reset} className="p-3 underline">
              Cancel edit
            </button>
          )}
        </div>
      </form>
      {message && (
        <p role="alert" className="text-rose-700">
          {message}
        </p>
      )}
      {code && (
        <div role="status" className="bg-amber-50 rounded-xl p-4 space-y-2">
          <p className="font-semibold">
            Copy this invitation now. The code is shown only once.
          </p>
          <code className="break-all select-all">{code}</code>
          <p className="text-sm break-all select-all">
            {location.origin}/?organisationCode={code}
          </p>
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(`${location.origin}/?organisationCode=${code}`)
                .then(() => setMessage("Invitation link copied."))
                .catch(() =>
                  setMessage("Select and copy the invitation link above."),
                )
            }
            className="underline"
          >
            Copy invitation link
          </button>
        </div>
      )}
      <div className="space-y-3">
        {organisations.length === 0 && (
          <p className="text-gray-500">No organisations yet.</p>
        )}
        {organisations.map((o) => (
          <article
            key={o.id}
            className="border rounded-xl p-4 flex flex-wrap justify-between gap-4"
          >
            <div>
              <h3 className="font-bold">{o.name}</h3>
              <p className="text-sm text-gray-600">
                {o.revokedAt
                  ? "Revoked"
                  : o.expiresAt && o.expiresAt <= Date.now()
                    ? "Expired"
                    : "Active"}{" "}
                ·{" "}
                {o.expiresAt
                  ? "Expires " + new Date(o.expiresAt).toLocaleString("en-GB")
                  : "No expiry"}{" "}
                · {o.memberCount}
                {o.memberLimit ? "/" + o.memberLimit : ""} members
              </p>
              <p className="text-xs mt-1 text-gray-500">
                {o.domains.length
                  ? o.domains.join(", ")
                  : "Any verified email address with the code"}
              </p>
            </div>
            <div className="flex gap-4 text-sm">
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(o.id);
                  setName(o.name);
                  setDomains(o.domains.join(", "));
                  setLimit(o.memberLimit === null ? "" : String(o.memberLimit));
                  setPeriod(o.expiresAt === null ? "never" : "custom");
                  if (o.expiresAt)
                    setDate(
                      new Date(
                        o.expiresAt -
                          new Date(o.expiresAt).getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16),
                    );
                  setCode("");
                }}
                className="underline"
              >
                Edit or extend
              </button>
              <button
                disabled={busy}
                onClick={() => action({ id: o.id, action: "rotate" })}
                className="underline"
              >
                Replace invitation code
              </button>
              {!o.revokedAt && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        `Revoke full access for all members of ${o.name}?`,
                      )
                    )
                      action({ id: o.id, action: "revoke" });
                  }}
                  className="underline text-rose-700"
                >
                  Revoke access
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
