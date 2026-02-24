// src/common/utils/filename.util.ts
import * as path from 'path';

/**
 * multer/busboy가 비-ASCII filename을 latin1 문자열로 주는 케이스가 있어
 * utf8로 복원 시도한다.
 */
export function decodeMulterOriginalName(name: string): string {
  if (!name) return '';

  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');

    // 일부 환경에서는 이미 정상 utf8 문자열이 들어오기도 함.
    // decoded에 치환문자(�)가 많으면 복원 실패로 보고 원본을 사용.
    if (decoded.includes('�')) return name;

    return decoded;
  } catch {
    return name;
  }
}

/**
 * "가능한 한 그대로" 살리되, 위험한 문자만 제거해서 DB 표시용으로 안전하게 만든다.
 */
export function sanitizeDisplayFileBaseName(input: string): string {
  const s = (input ?? '')
    // 1) 제어문자 제거 (null, 줄바꿈, 탭 등)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    // 2) BiDi 방향 제어/격리 문자 제거 (스푸핑 방지)
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
    // 3) 공백 정리
    .replace(/\s+/g, ' ')
    .trim();

  // 4) 너무 길면 컷 (DB 컬럼 길이/UX 방어)
  return s.slice(0, 120);
}

/**
 * multer file.originalname -> (확장자 제거) + (표시 안전화)
 * 결과는 selection.name 같은 DB display name에 바로 넣기 좋다.
 */
export function getSafeDisplayNameFromOriginalName(
  originalname: string,
): string {
  const decoded = decodeMulterOriginalName(originalname);
  const base = path.parse(decoded).name; // 확장자 제거
  const safe = sanitizeDisplayFileBaseName(base);

  // 비어버리면 최후의 기본값
  return safe || 'untitled';
}

/**
 * tmp 파일명 / 로그 용 등에서만 쓰는 "ASCII 안전" 버전이 필요하면 사용.
 * (S3 key는 굳이 이럴 필요 없지만, 원하면 쓸 수 있음)
 */
export function toAsciiSafeFilename(name: string): string {
  const decoded = decodeMulterOriginalName(name);
  return path.basename(decoded).replace(/[^a-zA-Z0-9._-]/g, '');
}
