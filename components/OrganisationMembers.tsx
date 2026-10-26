import React, { useEffect, useState } from "react";
import { listApprovedMembers, updateApprovedMembers } from "../services/access";
import {
  parseEmailImport,
  type EmailImport,
} from "../functions/src/emailRoster";
export const OrganisationMembers: React.FC<{
  organisationId: string;
  organisationName: string;
  onChange: () => void;
}> = ({ organisationId, organisationName, onChange }) => {
  const [members, setMembers] = useState<string[]>([]),
    [loaded, setLoaded] = useState(false);
  const [text, setText] = useState(""),
    [preview, setPreview] = useState<EmailImport | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const refresh = async () => {
    const result = await listApprovedMembers(organisationId);
    setMembers(result.map((m) => m.email));
    setLoaded(true);
  };
  useEffect(() => {
    let current = true;
    listApprovedMembers(organisationId)
      .then((result) => {
        if (current) {
          setMembers(result.map((m) => m.email));
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (current) setMessage(e.message);
      });
    return () => {
      current = false;
    };
  }, [organisationId]);
  const existing = new Set(members),
    pending = preview?.emails.filter((email) => !existing.has(email)) || [];
  const filtered = members.filter((email) =>
    email.includes(search.trim().toLowerCase()),
  );
  const visible = filtered.slice(page * 50, page * 50 + 50);
  const apply = async () => {
    setBusy(true);
    setMessage("");
    let added = 0;
    try {
      for (let offset = 0; offset < pending.length; offset += 200) {
        const result = await updateApprovedMembers(
          organisationId,
          "add",
          pending.slice(offset, offset + 200),
        );
        added += result.changed;
        setMessage(`Added ${added} addresses. Applying the remaining batches…`);
      }
      await refresh();
      onChange();
      setText("");
      setPreview(null);
      setMessage(
        `${added} approved addresses added. People receive full access when they sign in with that verified address. No emails have been sent.`,
      );
    } catch (e: any) {
      await refresh().catch(() => {});
      onChange();
      setMessage(
        `${added ? added + " addresses were added before the import stopped. " : ""}${e.message} Review the remaining addresses before trying again.`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-label={`Approved members for ${organisationName}`}
      className="border-t pt-5 mt-5 space-y-5 w-full"
    >
      <div>
        <h3 className="font-bold text-lg">Approved email addresses</h3>
        <p className="text-sm text-gray-600 mt-2">
          Only the exact addresses on this list receive full access. They can
          sign in with Google or a verified email account, including accounts
          created after you add the list. A university domain alone never grants
          access.
        </p>
      </div>
      <label className="grid gap-2 text-sm">
        Paste email addresses
        <textarea
          value={text}
          disabled={busy}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
            setMessage("");
          }}
          rows={5}
          placeholder="One per line, or separated by commas or semicolons"
          className="border rounded-lg p-3 w-full"
        />
      </label>
      <label className="grid gap-2 text-sm">
        Or upload a CSV or text file
        <input
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 1000000)
                throw new Error("Use a file smaller than 1 MB.");
              setText(await file.text());
              setPreview(null);
              setMessage(
                "File loaded. Review the addresses before applying them.",
              );
            } catch (err: any) {
              setMessage(err.message);
            }
            e.target.value = "";
          }}
          className="block w-full"
        />
        <span className="text-gray-500 text-xs">
          CSV files may include other columns. Use a column headed Email or
          Email Address. Up to 5,000 addresses per organisation.
        </span>
      </label>
      <button
        disabled={busy || !loaded || !text.trim()}
        onClick={() => {
          try {
            setPreview(parseEmailImport(text));
            setMessage("");
          } catch (e: any) {
            setPreview(null);
            setMessage(e.message);
          }
        }}
        className="border border-indigo-600 text-indigo-700 px-4 py-3 rounded-lg disabled:opacity-50"
      >
        Review addresses
      </button>
      {preview && (
        <div
          role="region"
          aria-label="Email import review"
          className="rounded-xl bg-indigo-50 p-5 space-y-3"
        >
          <h4 className="font-bold">Review before adding</h4>
          <p>
            {pending.length} new valid addresses ·{" "}
            {preview.emails.length - pending.length} already approved ·{" "}
            {preview.duplicates.length} repeated addresses removed ·{" "}
            {preview.invalid.length} invalid entries excluded
          </p>
          {pending.length > 0 && (
            <div className="max-h-52 overflow-y-auto border border-indigo-100 rounded-lg p-3 bg-white">
              <ul className="space-y-1 text-sm">
                {pending.map((email) => (
                  <li key={email} className="break-all">
                    {email}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.invalid.length > 0 && (
            <details className="text-sm text-rose-800">
              <summary className="cursor-pointer">
                Check invalid entries · these will not be added
              </summary>
              <ul className="max-h-40 overflow-y-auto">
                {preview.invalid.map((value) => (
                  <li key={value} className="break-all">
                    {value}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-sm">
            This adds only the valid addresses shown above. It does not remove
            anyone already approved.
          </p>
          <button
            disabled={busy || pending.length === 0}
            onClick={apply}
            className="bg-indigo-600 text-white px-4 py-3 rounded-lg disabled:opacity-50"
          >
            {busy
              ? "Applying addresses…"
              : `Add ${pending.length} approved addresses`}
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm whitespace-pre-wrap">
          {message}
        </p>
      )}
      <div className="space-y-3">
        <h4 className="font-semibold">
          {loaded
            ? `${members.length} approved addresses`
            : "Loading approved addresses…"}
        </h4>
        <label className="grid gap-1 text-sm">
          Find an approved address
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="border rounded-lg p-3"
          />
        </label>
        {loaded && members.length === 0 && (
          <p className="text-sm text-gray-500">
            No addresses approved yet. This organisation currently grants access
            to nobody.
          </p>
        )}
        <ul className="divide-y">
          {visible.map((email) => (
            <li
              key={email}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <span className="text-sm break-all">{email}</span>
              <button
                disabled={busy}
                aria-label={`Remove ${email}`}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await updateApprovedMembers(organisationId, "remove", [
                      email,
                    ]);
                    await refresh();
                    onChange();
                    setMessage(
                      `Removed ${email}. Its organisation access has ended; learning history is retained.`,
                    );
                  } catch (e: any) {
                    setMessage(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="text-sm text-rose-700 underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        {filtered.length > 50 && (
          <div className="flex gap-4 items-center text-sm">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="underline disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page + 1} of {Math.ceil(filtered.length / 50)}
            </span>
            <button
              disabled={(page + 1) * 50 >= filtered.length}
              onClick={() => setPage((p) => p + 1)}
              className="underline disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
