export function isAllowedRedirectBase(value: string): boolean {
  if (!value || value.length > 2048) {
    return false;
  }

  try {
    const parsed = new URL(value);
    const protocol = parsed.protocol;

    if (protocol === 'mufathom:' || protocol === 'exp:' || protocol.startsWith('exp+')) {
      return true;
    }

    if (protocol === 'http:' || protocol === 'https:') {
      return ['localhost', '127.0.0.1'].includes(parsed.hostname);
    }

    return false;
  } catch {
    return false;
  }
}

export function buildRedirectUrl(
  redirectBase: string,
  params: Record<string, string>
) {
  const url = new URL(redirectBase);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export function buildSupabaseFunctionUrl(supabaseUrl: string, functionName: string) {
  const trimmedSupabaseUrl = supabaseUrl.trim().replace(/\/$/, '');
  const trimmedFunctionName = functionName.trim().replace(/^\/+/, '');

  return `${trimmedSupabaseUrl}/functions/v1/${trimmedFunctionName}`;
}
