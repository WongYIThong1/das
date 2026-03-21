const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',   // non-standard but common on Android
  'image/webp',
  'image/heic',  // iOS default camera format
  'image/heif',
]);

const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'];

export const MAX_UPLOAD_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BATCH_FILES = 100;

function hasAllowedExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  return ALLOWED_UPLOAD_EXTENSIONS.some((ext) => normalized.endsWith(ext));
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg':      '.jpg',
  'image/jpg':       '.jpg',
  'image/png':       '.png',
  'image/webp':      '.webp',
  'image/heic':      '.jpg',
  'image/heif':      '.jpg',
  'application/pdf': '.pdf',
};

const MIME_NORMALIZE: Record<string, string> = {
  'image/jpg':  'image/jpeg',
  'image/heic': 'image/jpeg',
  'image/heif': 'image/jpeg',
};

/**
 * Ensure the file has a proper extension and canonical MIME type.
 * Camera captures on mobile often produce files named "image" or without extension.
 */
export function normalizeUploadFile(file: File): File {
  const mime = file.type.toLowerCase();
  const normalizedMime = MIME_NORMALIZE[mime] ?? mime;
  const expectedExt = MIME_TO_EXT[mime];

  if (!expectedExt) return file;

  const nameLower = file.name.toLowerCase();
  const hasExt = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.heic', '.heif'].some((e) =>
    nameLower.endsWith(e),
  );
  const baseName = hasExt ? file.name.replace(/\.[^.]+$/, '') : file.name || 'photo';
  const finalName = `${baseName}${expectedExt}`;

  if (finalName === file.name && normalizedMime === mime) return file;
  return new File([file], finalName, { type: normalizedMime });
}

export type UploadValidationError =
  | 'invalid_file'
  | 'empty_file'
  | 'file_too_large'
  | 'unsupported_file_type';

export function validateInvoiceUploadFile(file: unknown): UploadValidationError | null {
  if (!(file instanceof File)) {
    return 'invalid_file';
  }
  if (!file.size) {
    return 'empty_file';
  }
  if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    return 'file_too_large';
  }

  const mimeType = file.type.toLowerCase();
  const mimeAllowed = mimeType ? ALLOWED_UPLOAD_MIME_TYPES.has(mimeType) : false;
  const extensionAllowed = hasAllowedExtension(file.name);
  if (!mimeAllowed && !extensionAllowed) {
    return 'unsupported_file_type';
  }

  return null;
}
