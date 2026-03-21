import { NextResponse } from 'next/server';
import { validateInvoiceUploadFile } from '../../../../lib/upload-validation';

// Maps MIME types to canonical extensions for normalization.
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg':  '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/heic': '.jpg',   // HEIC — rename to .jpg so backend accepts it
  'image/heif': '.jpg',
  'application/pdf': '.pdf',
};

// Returns the MIME type the backend should see (normalize non-standard types).
const MIME_NORMALIZE: Record<string, string> = {
  'image/jpg':  'image/jpeg',
  'image/heic': 'image/jpeg',
  'image/heif': 'image/jpeg',
};

/**
 * Ensure the file has a proper extension and a canonical MIME type.
 * Camera captures on mobile often produce files named "image" with no extension.
 */
function normalizeUploadFile(file: File): File {
  const mime = file.type.toLowerCase();
  const normalizedMime = MIME_NORMALIZE[mime] ?? mime;
  const expectedExt = MIME_TO_EXT[mime];

  if (!expectedExt) return file;

  // Check if the filename already has a valid extension.
  const nameLower = file.name.toLowerCase();
  const hasExt = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.heic', '.heif'].some((e) =>
    nameLower.endsWith(e),
  );

  // Derive a clean base name (strip any existing extension-like suffix).
  const baseName = hasExt ? file.name.replace(/\.[^.]+$/, '') : file.name || 'photo';
  const finalName = `${baseName}${expectedExt}`;

  if (finalName === file.name && normalizedMime === mime) return file;

  return new File([file], finalName, { type: normalizedMime });
}

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_BASE_URL?.trim();
  if (!baseUrl) return null;
  return baseUrl.replace(/\/+$/, '');
}

export async function POST(request: Request) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization')?.trim();
  if (!authorization) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const upstreamUrl = `${baseUrl}/user/purchase-invoice/create`;

  try {
    const incoming = await request.formData();
    const form = new FormData();
    const fileEntries = incoming.getAll('file');
    if (fileEntries.length !== 1) {
      return NextResponse.json({ error: 'invalid_file_count' }, { status: 400 });
    }
    const fileEntry = fileEntries[0];
    if (!fileEntry) {
      return NextResponse.json({ error: 'missing_file' }, { status: 400 });
    }
    const validationError = validateInvoiceUploadFile(fileEntry);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const normalizedFile = normalizeUploadFile(fileEntry as File);
    form.append('file', normalizedFile, normalizedFile.name);

    const headers: Record<string, string> = { Authorization: authorization };
    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: form,
    });

    const text = await response.text();
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { /* non-JSON */ }

    if (!response.ok) {
      const err = (data as any) ?? {};
      const payload =
        err && typeof err === 'object'
          ? err
          : { error: err?.error ?? err?.message ?? (text.slice(0, 200) || 'upstream_error') };
      return NextResponse.json(
        payload,
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error('[upload] proxy error:', err);
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
