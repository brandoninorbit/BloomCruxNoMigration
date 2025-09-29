// Utility helpers for extracting a display first name and avatar URL from a Supabase user object.
// Includes multiple metadata key fallbacks and a Gravatar fallback (MD5 implementation included).

export interface MinimalUserLike {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: Array<{ identity_data?: Record<string, unknown> | null } | null> | null;
}

// Lightweight MD5 (public domain style implementation) - adequate for Gravatar hashing.
function md5(str: string): string {
  function toWords(input: string) {
    const msg = unescape(encodeURIComponent(input));
    const words: number[] = [];
    for (let i = 0; i < msg.length; i++) {
      words[i >> 2] = words[i >> 2] | (msg.charCodeAt(i) << ((i % 4) * 8));
    }
    // append padding
    words[(msg.length >> 2)] = words[(msg.length >> 2)] | (0x80 << ((msg.length % 4) * 8));
    words[(((msg.length + 8) >> 6) << 4) + 14] = msg.length * 8;
    return words;
  }
  function toHex(num: number) {
    let s = ''; for (let i = 0; i < 4; i++) { s += ('0' + ((num >> (i * 8)) & 0xff).toString(16)).slice(-2); } return s;
  }
  function FF(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    const n = a + ((b & c) | (~b & d)) + x + t; return (((n << s) | (n >>> (32 - s))) + b) >>> 0;
  }
  function GG(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    const n = a + ((b & d) | (c & ~d)) + x + t; return (((n << s) | (n >>> (32 - s))) + b) >>> 0;
  }
  function HH(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    const n = a + (b ^ c ^ d) + x + t; return (((n << s) | (n >>> (32 - s))) + b) >>> 0;
  }
  function II(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    const n = a + (c ^ (b | ~d)) + x + t; return (((n << s) | (n >>> (32 - s))) + b) >>> 0;
  }
  const x = toWords(str);
  let a = 0x67452301; let b = 0xefcdab89; let c = 0x98badcfe; let d = 0x10325476;
  for (let i = 0; i < x.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d;
    // Round 1
    a = FF(a, b, c, d, x[i + 0] | 0, 7, 0xd76aa478); d = FF(d, a, b, c, x[i + 1] | 0, 12, 0xe8c7b756); c = FF(c, d, a, b, x[i + 2] | 0, 17, 0x242070db); b = FF(b, c, d, a, x[i + 3] | 0, 22, 0xc1bdceee);
    a = FF(a, b, c, d, x[i + 4] | 0, 7, 0xf57c0faf); d = FF(d, a, b, c, x[i + 5] | 0, 12, 0x4787c62a); c = FF(c, d, a, b, x[i + 6] | 0, 17, 0xa8304613); b = FF(b, c, d, a, x[i + 7] | 0, 22, 0xfd469501);
    a = FF(a, b, c, d, x[i + 8] | 0, 7, 0x698098d8); d = FF(d, a, b, c, x[i + 9] | 0, 12, 0x8b44f7af); c = FF(c, d, a, b, x[i +10] | 0, 17, 0xffff5bb1); b = FF(b, c, d, a, x[i +11] | 0, 22, 0x895cd7be);
    a = FF(a, b, c, d, x[i +12] | 0, 7, 0x6b901122); d = FF(d, a, b, c, x[i +13] | 0, 12, 0xfd987193); c = FF(c, d, a, b, x[i +14] | 0, 17, 0xa679438e); b = FF(b, c, d, a, x[i +15] | 0, 22, 0x49b40821);
    // Round 2
    a = GG(a, b, c, d, x[i + 1] | 0, 5, 0xf61e2562); d = GG(d, a, b, c, x[i + 6] | 0, 9, 0xc040b340); c = GG(c, d, a, b, x[i +11] | 0, 14, 0x265e5a51); b = GG(b, c, d, a, x[i + 0] | 0, 20, 0xe9b6c7aa);
    a = GG(a, b, c, d, x[i + 5] | 0, 5, 0xd62f105d); d = GG(d, a, b, c, x[i +10] | 0, 9, 0x02441453); c = GG(c, d, a, b, x[i +15] | 0, 14, 0xd8a1e681); b = GG(b, c, d, a, x[i + 4] | 0, 20, 0xe7d3fbc8);
    a = GG(a, b, c, d, x[i + 9] | 0, 5, 0x21e1cde6); d = GG(d, a, b, c, x[i +14] | 0, 9, 0xc33707d6); c = GG(c, d, a, b, x[i + 3] | 0, 14, 0xf4d50d87); b = GG(b, c, d, a, x[i + 8] | 0, 20, 0x455a14ed);
    a = GG(a, b, c, d, x[i +13] | 0, 5, 0xa9e3e905); d = GG(d, a, b, c, x[i + 2] | 0, 9, 0xfcefa3f8); c = GG(c, d, a, b, x[i + 7] | 0, 14, 0x676f02d9); b = GG(b, c, d, a, x[i +12] | 0, 20, 0x8d2a4c8a);
    // Round 3
    a = HH(a, b, c, d, x[i + 5] | 0, 4, 0xfffa3942); d = HH(d, a, b, c, x[i + 8] | 0, 11, 0x8771f681); c = HH(c, d, a, b, x[i +11] | 0, 16, 0x6d9d6122); b = HH(b, c, d, a, x[i +14] | 0, 23, 0xfde5380c);
    a = HH(a, b, c, d, x[i + 1] | 0, 4, 0xa4beea44); d = HH(d, a, b, c, x[i + 4] | 0, 11, 0x4bdecfa9); c = HH(c, d, a, b, x[i + 7] | 0, 16, 0xf6bb4b60); b = HH(b, c, d, a, x[i +10] | 0, 23, 0xbebfbc70);
    a = HH(a, b, c, d, x[i +13] | 0, 4, 0x289b7ec6); d = HH(d, a, b, c, x[i + 0] | 0, 11, 0xeaa127fa); c = HH(c, d, a, b, x[i + 3] | 0, 16, 0xd4ef3085); b = HH(b, c, d, a, x[i + 6] | 0, 23, 0x04881d05);
    a = HH(a, b, c, d, x[i + 9] | 0, 4, 0xd9d4d039); d = HH(d, a, b, c, x[i +12] | 0, 11, 0xe6db99e5); c = HH(c, d, a, b, x[i +15] | 0, 16, 0x1fa27cf8); b = HH(b, c, d, a, x[i + 2] | 0, 23, 0xc4ac5665);
    // Round 4
    a = II(a, b, c, d, x[i + 0] | 0, 6, 0xf4292244); d = II(d, a, b, c, x[i + 7] | 0, 10, 0x432aff97); c = II(c, d, a, b, x[i +14] | 0, 15, 0xab9423a7); b = II(b, c, d, a, x[i + 5] | 0, 21, 0xfc93a039);
    a = II(a, b, c, d, x[i +12] | 0, 6, 0x655b59c3); d = II(d, a, b, c, x[i + 3] | 0, 10, 0x8f0ccc92); c = II(c, d, a, b, x[i +10] | 0, 15, 0xffeff47d); b = II(b, c, d, a, x[i + 1] | 0, 21, 0x85845dd1);
    a = II(a, b, c, d, x[i + 8] | 0, 6, 0x6fa87e4f); d = II(d, a, b, c, x[i +15] | 0, 10, 0xfe2ce6e0); c = II(c, d, a, b, x[i + 6] | 0, 15, 0xa3014314); b = II(b, c, d, a, x[i +13] | 0, 21, 0x4e0811a1);
    a = II(a, b, c, d, x[i + 4] | 0, 6, 0xf7537e82); d = II(d, a, b, c, x[i +11] | 0, 10, 0xbd3af235); c = II(c, d, a, b, x[i + 2] | 0, 15, 0x2ad7d2bb); b = II(b, c, d, a, x[i + 9] | 0, 21, 0xeb86d391);
    a = (a + oa) >>> 0; b = (b + ob) >>> 0; c = (c + oc) >>> 0; d = (d + od) >>> 0;
  }
  return [a, b, c, d].map(toHex).join('');
}

export function resolveUserDisplay(user: MinimalUserLike | null | undefined) {
  if (!user) return { firstName: 'Agent', avatarUrl: null };
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const rawFull = String(meta['full_name'] ?? meta['fullName'] ?? meta['name'] ?? '');
  const email = String(user.email ?? '').trim();
  const local = email.split('@')[0] || '';
  // Derive first name from full name else from email local segment before delimiters.
  let firstName = (rawFull || '').trim().split(/[\s_]+/)[0] || local.split(/[._+\-]/)[0] || 'Agent';
  if (firstName.length > 32) firstName = firstName.slice(0, 32);

  // Avatar fallbacks in order of common metadata keys.
  const identityData = Array.isArray(user.identities) ? user.identities.find(id => id?.identity_data && (
    Boolean((id.identity_data as Record<string, unknown>)['avatar_url']) || Boolean((id.identity_data as Record<string, unknown>)['avatarUrl']) || Boolean((id.identity_data as Record<string, unknown>)['picture']) || Boolean((id.identity_data as Record<string, unknown>)['image'])
  ))?.identity_data as Record<string, unknown> | null : null;
  const avatarUrl = (meta['avatar_url'] as string | undefined) || (meta['avatarUrl'] as string | undefined) || (meta['picture'] as string | undefined) || (meta['image'] as string | undefined) || (identityData && ((identityData['avatar_url'] as string | undefined) || (identityData['avatarUrl'] as string | undefined) || (identityData['picture'] as string | undefined) || (identityData['image'] as string | undefined))) || (email ? `https://www.gravatar.com/avatar/${md5(email.trim().toLowerCase())}?d=identicon&s=128` : null);

  return { firstName, avatarUrl };
}
