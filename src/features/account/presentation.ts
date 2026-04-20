export function getProfileInitials({ name, email }: { name: string | null; email: string | null }) {
  const source = pickInitialsSource(name, email);

  if (!source) {
    return '';
  }

  const tokens = source
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return '';
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
}

export function formatBuildVersion({
  appVersion,
  buildNumber,
}: {
  appVersion: string;
  buildNumber?: string | null;
}) {
  const trimmedBuildNumber = typeof buildNumber === 'string' ? buildNumber.trim() : '';

  return trimmedBuildNumber ? `v${appVersion} (${trimmedBuildNumber})` : `v${appVersion}`;
}

export function getBuildFooterParts({
  appVersion,
  buildNumber,
}: {
  appVersion: string;
  buildNumber?: string | null;
}) {
  const trimmedBuildNumber = typeof buildNumber === 'string' ? buildNumber.trim() : '';

  return {
    appVersionLabel: `v${appVersion}`,
    buildNumberLabel: trimmedBuildNumber ? `Build ${trimmedBuildNumber}` : '',
    versionLabel: formatBuildVersion({ appVersion, buildNumber: trimmedBuildNumber }),
  };
}

function pickInitialsSource(name: string | null, email: string | null) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (trimmedName) {
    return trimmedName;
  }

  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  if (!trimmedEmail) {
    return '';
  }

  const atIndex = trimmedEmail.indexOf('@');
  return atIndex >= 0 ? trimmedEmail.slice(0, atIndex) : trimmedEmail;
}
