// server/src/utils/evidenceSniff.js

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
]);

export function looksLikeAllowedImage(buf) {
  if (!buf || buf.length < 12) return false;

  // JPEG: FF D8 FF
  const isJpeg =
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff;

  // PNG signature
  const isPng =
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(PNG_SIGNATURE);

  // WebP: RIFF....WEBP
  const isWebp =
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP";

  return isJpeg || isPng || isWebp;
}

export function looksLikeAllowedVideo(buf) {
  if (!buf || buf.length < 12) return false;

  // MP4 / MOV use an ISO Base Media File Format "ftyp" box.
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);

    const allowedBrands = new Set([
      "isom",
      "iso2",
      "iso3",
      "iso4",
      "iso5",
      "iso6",
      "mp41",
      "mp42",
      "avc1",
      "M4V ",
      "MSNV",
      "qt  ",
    ]);

    return allowedBrands.has(brand);
  }

  // WebM / Matroska EBML header
  const isEbml =
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3;

  return isEbml;
}

export function looksLikeAllowedEvidence(buf, mimetype) {
  if (!buf || !mimetype) return false;

  if (mimetype.startsWith("image/")) {
    return looksLikeAllowedImage(buf);
  }

  if (mimetype.startsWith("video/")) {
    return looksLikeAllowedVideo(buf);
  }

  return false;
}