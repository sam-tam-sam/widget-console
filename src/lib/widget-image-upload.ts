import "server-only";

import sharp from "sharp";
import { WidgetError } from "@/widgets/contracts";

const maxImageBytes = 5 * 1024 * 1024;
const maxRequestBytes = maxImageBytes + 64 * 1024;
const maxImagePixels = 20_000_000;

async function readUpload(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!request.body || !contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    throw new WidgetError("Choose a JPEG, PNG or WebP image to upload.");
  }
  const tooLarge = "Upload an image up to 5 MiB.";
  if (Number(request.headers.get("content-length")) > maxRequestBytes) throw new WidgetError(tooLarge);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxRequestBytes) {
        await reader.cancel();
        throw new WidgetError(tooLarge);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let fields: FormData;
  try {
    fields = await new Response(Buffer.concat(chunks, length), { headers: { "Content-Type": contentType } }).formData();
  } catch {
    throw new WidgetError("The upload could not be read. Choose the image again.");
  }
  const file = fields.get("image");
  if (!(file instanceof File) || !file.size) throw new WidgetError("Choose an image to upload.");
  if (file.size > maxImageBytes) throw new WidgetError(tooLarge);
  return file;
}

function imageFormat(bytes: Buffer) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function validatedWidgetImage(request: Request) {
  const file = await readUpload(request);
  const bytes = Buffer.from(await file.arrayBuffer());
  const format = imageFormat(bytes);
  const claimedType = file.type === "application/octet-stream" ? "" : file.type;
  if (!format || (claimedType && claimedType !== `image/${format}`)) {
    throw new WidgetError("Choose a valid JPEG, PNG or WebP image.");
  }

  try {
    const image = sharp(bytes, { limitInputPixels: maxImagePixels, failOn: "warning" });
    const metadata = await image.metadata();
    if (metadata.format !== format || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image format.");
    // Decode pixels and write a clean raster image with the original aspect ratio.
    const oriented = image.autoOrient();
    const output = format === "jpeg" ? oriented.jpeg({ quality: 95 })
      : format === "webp" ? oriented.webp({ lossless: true }) : oriented.png();
    const { data, info } = await output.toBuffer({ resolveWithObject: true });
    if (data.byteLength > maxImageBytes) throw new WidgetError("The processed image exceeds 5 MiB. Choose a smaller image.");
    return { contentType: `image/${format}`, width: info.width, height: info.height, bytes: data };
  } catch (error) {
    if (error instanceof WidgetError) throw error;
    throw new WidgetError("Choose a readable, static JPEG, PNG or WebP image up to 20 megapixels.");
  }
}
