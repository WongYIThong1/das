const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

export const MAX_UPLOAD_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BATCH_FILES = 100;

function hasAllowedExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  return ALLOWED_UPLOAD_EXTENSIONS.some((ext) => normalized.endsWith(ext));
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
