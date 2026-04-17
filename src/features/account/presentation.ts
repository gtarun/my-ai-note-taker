function pickInitials(source: string) {
  const tokens = source
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return '';
  }

  return tokens
    .slice(0, 2)
    .map((token) => token[0] ?? '')
    .join('')
    .toUpperCase();
}

function normalizeValue(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getProfileInitials(name: string | null | undefined, email: string | null | undefined) {
  const normalizedName = normalizeValue(name);
  if (normalizedName) {
    return pickInitials(normalizedName);
  }

  const normalizedEmail = normalizeValue(email);
  if (!normalizedEmail) {
    return '';
  }

  const [localPart] = normalizedEmail.split('@');
  return pickInitials(localPart ?? '') || (localPart?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() ?? '');
}
