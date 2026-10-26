export function normaliseEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("Provide an email address.");
  const email = value.trim().toLowerCase();
  const parts = email.split("@");
  if (email.length > 254 || parts.length !== 2)
    throw new Error("Invalid email address.");
  const [local, domain] = parts;
  if (
    !local ||
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/.test(local)
  )
    throw new Error("Invalid email address.");
  const labels = domain.split(".");
  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    ) ||
    !/^[a-z]{2,}$/.test(labels[labels.length - 1])
  )
    throw new Error("Invalid email address.");
  return email;
}
export interface EmailImport {
  emails: string[];
  duplicates: string[];
  invalid: string[];
  hasHeader: boolean;
}
export function parseEmailImport(input: string): EmailImport {
  if (input.length > 1000000)
    throw new Error("Use a list or CSV smaller than 1 MB.");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && [",", ";", "\t", "\n", "\r"].includes(char)) {
      row.push(cell.trim());
      cell = "";
      if (char === "\n" || char === "\r") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (char === "\r" && input[i + 1] === "\n") i++;
      }
    } else cell += char;
  }
  if (quoted)
    throw new Error("A quoted CSV field is not closed. Please check the file.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const header = (rows[0] || []).findIndex((value) =>
    /^(email|emailaddress|universityemail|workemail)$/.test(
      value.replace(/[\s_\-\uFEFF]/g, "").toLowerCase(),
    ),
  );
  const cells =
    header >= 0
      ? rows
          .slice(1)
          .map(
            (values, i) =>
              values[header] || `Row ${i + 2}: missing email address`,
          )
      : rows.flat();
  const emails = new Set<string>(),
    duplicates = new Set<string>(),
    invalid = new Set<string>();
  for (const raw of cells) {
    if (!raw.trim()) continue;
    const value = raw.replace(/^.*<([^<>]+)>$/, "$1").trim();
    try {
      const email = normaliseEmail(value);
      if (emails.has(email)) duplicates.add(email);
      else emails.add(email);
    } catch {
      invalid.add(raw);
    }
  }
  if (emails.size > 5000)
    throw new Error("Import up to 5,000 addresses at a time.");
  return {
    emails: [...emails],
    duplicates: [...duplicates],
    invalid: [...invalid],
    hasHeader: header >= 0,
  };
}
