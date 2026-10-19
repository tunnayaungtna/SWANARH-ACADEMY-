/**
 * File helpers for determining file types, icons, and formatted sizes
 */

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileTypeCategory(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'sheet';
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return 'slide';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
  if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'zip';
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'cs', 'html', 'css', 'json', 'sql'].includes(ext)) return 'code';
  if (['txt', 'md'].includes(ext)) return 'text';

  return 'file';
}
