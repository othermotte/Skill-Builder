import React, { useEffect, useState } from "react";
import { AccessAccount, redeemOrganisationCode } from "../services/access";
export const AccessPanel: React.FC<{
  access: AccessAccount;
  onUpdate: (access: AccessAccount) => void;
}> = ({ access, onUpdate }) => {
  const [code, setCode] = useState(
    () => sessionStorage.getItem("organisationCode") || "",
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const url = new URL(location.href);
    const invite = url.searchParams.get("organisationCode");
    if (invite) {
      setCode(invite);
      sessionStorage.setItem("organisationCode", invite);
      url.searchParams.delete("organisationCode");
      history.replaceState(null, "", url);
    }
  }, []);
  return (
    <section className="max-w-7xl mx-auto w-full px-5 pt-6">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 flex flex-wrap items-center justify-between gap-5">
        <div>
          <h2 className="font-bold">
            {access.fullAccess ? "Full access" : "Your free account"}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {access.fullAccess
              ? access.source === "admin"
                ? "Administrator access to all scenarios and micro skills."
                : access.organisations
                    .map(
                      (o) =>
                        `${o.name}${o.expiresAt ? " until " + new Date(o.expiresAt).toLocaleDateString("en-GB") : " · no expiry"}`,
                    )
                    .join("; ")
              : "One scenario of your choice and five micro skills recommended from your assessment. Repeat them to build your practice."}
          </p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              onUpdate(await redeemOrganisationCode(code));
              sessionStorage.removeItem("organisationCode");
              setCode("");
              setMessage("Your organisation access is ready.");
            } catch (e: any) {
              setMessage(e.message);
            } finally {
              setBusy(false);
            }
          }}
          className="flex flex-wrap gap-2"
        >
          <label className="sr-only" htmlFor="organisation-code">
            Organisation access code
          </label>
          <input
            id="organisation-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Organisation code"
            maxLength={24}
            className="border rounded-lg p-3 bg-white"
            required
          />
          <button
            disabled={busy}
            className="rounded-lg bg-indigo-600 text-white px-4 py-3 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Redeem code"}
          </button>
        </form>
        {message && (
          <p role="status" className="w-full text-sm">
            {message}
          </p>
        )}
      </div>
    </section>
  );
};
