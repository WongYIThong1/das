import { NextResponse } from 'next/server';
import { validateInvoiceUploadFile } from '../../../../lib/upload-validation';

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
    form.append('file', fileEntry);

    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { Authorization: authorization },
      body: form,
    });

    const text = await response.text();
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { /* non-JSON */ }

    if (!response.ok) {
      const err = (data as any) ?? {};
      return NextResponse.json(
        { error: err.error ?? err.message ?? (text.slice(0, 200) || 'upstream_error') },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error('[upload] proxy error:', err);
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
