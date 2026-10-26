import React from "react";
import { AccessAccount } from "../services/access";
export const AccessPanel: React.FC<{
  access: AccessAccount;
  email: string;
  scenarioTitle?: string;
}> = ({ access, email, scenarioTitle }) => (
  <section className="max-w-7xl mx-auto w-full px-5 pt-6">
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 space-y-2">
      <p className="text-xs text-gray-600 break-all">Signed in as {email}</p>
      <h2 className="font-bold">
        {access.source === "admin"
          ? "Administrator account · full access"
          : access.fullAccess
            ? "Organisation account · full access"
            : "Free account"}
      </h2>
      <p className="text-sm text-gray-700">
        {access.source === "admin"
          ? "You can use every scenario and micro skill. To test the free experience, sign in with another email address that is not approved for organisation access."
          : access.fullAccess
            ? access.organisations
                .map(
                  (o) =>
                    `${o.name}${o.expiresAt ? " · access until " + new Date(o.expiresAt).toLocaleDateString("en-GB") : " · no expiry"}`,
                )
                .join("; ")
            : scenarioTitle
              ? `Your free scenario is ${scenarioTitle}. Its assessment recommends five micro skills for you to practise. Your choice stays with your account.`
              : "Choose one scenario to keep. Your assessment will recommend five relevant micro skills. You can return to your chosen scenario and those skills to build your practice."}
      </p>
    </div>
  </section>
);
