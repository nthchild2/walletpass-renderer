/**
 * Apple: messageEncoding is "The IANA character set name of the text encoding to use to convert
 * `message` from a string representation to a data representation that the system renders as a
 * barcode, such as “iso-8859-1”." So the barcode carries these bytes, not the raw string.
 */

export interface EncodedMessage {
  bytes: Uint8Array;
  /** Characters the encoding can't represent (replaced with "?"). */
  unmappable: string[];
  /** False when the encoding name isn't one we know; UTF-8 is used instead. */
  known: boolean;
}

const LATIN1 = new Set(['iso-8859-1', 'iso8859-1', 'latin1', 'latin-1', 'l1', 'iso-latin-1', 'cp819', 'ibm819']);
const ASCII = new Set(['us-ascii', 'ascii', 'iso646-us']);
const UTF8 = new Set(['utf-8', 'utf8']);

export function encodeMessage(message: string, encoding = 'iso-8859-1'): EncodedMessage {
  const name = encoding.trim().toLowerCase();
  if (UTF8.has(name) || !(LATIN1.has(name) || ASCII.has(name))) {
    return { bytes: new TextEncoder().encode(message), unmappable: [], known: UTF8.has(name) };
  }
  const max = ASCII.has(name) ? 0x7f : 0xff;
  const bytes: number[] = [];
  const unmappable: string[] = [];
  for (const ch of message) {
    const code = ch.codePointAt(0)!;
    if (code <= max) bytes.push(code);
    else {
      bytes.push(0x3f); // "?"
      unmappable.push(ch);
    }
  }
  return { bytes: Uint8Array.from(bytes), unmappable, known: true };
}

/** A string whose char codes are the bytes, which is how bwip-js takes binary data. */
export function bytesToBinaryString(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}
