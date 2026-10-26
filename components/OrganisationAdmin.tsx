import React, { useEffect, useState } from "react";
import {
  Organisation,
  listOrganisations,
  saveOrganisation,
} from "../services/access";
import { OrganisationMembers } from "./OrganisationMembers";
export const OrganisationAdmin: React.FC = () => {
  const [organisations, setOrganisations] = useState<Organisation[]>([]),
    [editing, setEditing] = useState<string | null>(null),
    [managing, setManaging] = useState<string | null>(null);
  const [name, setName] = useState(""),
    [limit, setLimit] = useState("");
  const [period, setPeriod] = useState("week"),
    [date, setDate] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const refresh = () => listOrganisations().then(setOrganisations);
  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);
  const reset = () => {
    setEditing(null);
    setName("");
    setLimit("");
    setPeriod("week");
    setDate("");
  };
  const edit = (o: Organisation) => {
    setEditing(o.id);
    setName(o.name);
    setLimit(o.memberLimit === null ? "" : String(o.memberLimit));
    setPeriod(o.expiresAt === null ? "never" : "custom");
    setDate(
      o.expiresAt
        ? new Date(
            o.expiresAt - new Date(o.expiresAt).getTimezoneOffset() * 60000,
          )
            .toISOString()
            .slice(0, 16)
        : "",
    );
    setMessage("");
  };
  return (
    <section className="space-y-6 border border-gray-200 p-6 rounded-3xl">
      <div>
        <h2 className="text-2xl font-bold">Organisation access</h2>
        <p className="mt-2 text-gray-600">
          Give a class, pilot or partner full access through an approved list of
          email addresses. Expiry or removal returns people to their free
          allowance and keeps their learning history.
        </p>
      </div>
      <form
        className="grid md:grid-cols-2 gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            const expiresAt =
              period === "never"
                ? null
                : period === "custom"
                  ? new Date(date).getTime()
                  : Date.now() + (period === "week" ? 7 : 30) * 86400000;
            const result = await saveOrganisation({
              id: editing,
              name,
              memberLimit: limit ? Number(limit) : null,
              expiresAt,
            });
            const wasNew = !editing;
            reset();
            await refresh();
            setManaging(result.id);
            setMessage(
              wasNew
                ? "Organisation created. Add approved email addresses below to grant access."
                : "Organisation access updated.",
            );
          } catch (e: any) {
            setMessage(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="grid gap-1 text-sm">
          Organisation name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="border rounded-lg p-3"
          />
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
              required
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded-lg p-3"
            />
          </label>
        )}
        <label className="grid gap-1 text-sm">
          Maximum approved addresses, optional
          <input
            type="number"
            min="1"
            max="5000"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Up to 5,000"
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
                : "Create organisation"}
          </button>
          {editing && (
            <button type="button" onClick={reset} className="p-3 underline">
              Cancel edit
            </button>
          )}
        </div>
      </form>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <div className="space-y-4">
        {organisations.length === 0 && (
          <p className="text-gray-500">No organisations yet.</p>
        )}
        {organisations.map((o) => (
          <article key={o.id} className="border rounded-xl p-5">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h3 className="font-bold">{o.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {o.revokedAt
                    ? "Revoked"
                    : o.expiresAt && o.expiresAt <= Date.now()
                      ? "Expired"
                      : "Active"}{" "}
                  ·{" "}
                  {o.expiresAt
                    ? "Expires " + new Date(o.expiresAt).toLocaleString("en-GB")
                    : "No expiry"}{" "}
                  · {o.approvedCount || 0}
                  {o.memberLimit ? "/" + o.memberLimit : ""} approved addresses
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <button
                  disabled={busy}
                  onClick={() => setManaging(managing === o.id ? null : o.id)}
                  className="underline"
                >
                  {managing === o.id
                    ? "Close address list"
                    : "Manage email addresses"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => edit(o)}
                  className="underline"
                >
                  Edit or extend
                </button>
                {!o.revokedAt && (
                  <button
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !confirm(
                          `Revoke full access for all approved members of ${o.name}?`,
                        )
                      )
                        return;
                      setBusy(true);
                      try {
                        await saveOrganisation({ id: o.id, action: "revoke" });
                        await refresh();
                        setMessage(
                          "Organisation access revoked. Approved addresses remain available if you renew the grant.",
                        );
                      } catch (e: any) {
                        setMessage(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="underline text-rose-700"
                  >
                    Revoke access
                  </button>
                )}
              </div>
            </div>
            {managing === o.id && (
              <OrganisationMembers
                key={o.id}
                organisationId={o.id}
                organisationName={o.name}
                onChange={() => {
                  refresh().catch((e) => setMessage(e.message));
                }}
              />
            )}
          </article>
        ))}
      </div>
    </section>
  );
};
