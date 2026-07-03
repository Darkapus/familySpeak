import { createWriteStream, promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { env } from "../../config/env.js";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export function isAllowedMimeType(mimeType: string): boolean {
  return mimeType in EXTENSION_BY_MIME;
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function isVideo(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

export function maxSizeForMimeType(mimeType: string): number {
  return isImage(mimeType) ? env.maxImageSizeBytes : env.maxVideoSizeBytes;
}

function datedRelativePath(extension: string): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

export async function saveUploadedFile(
  fileStream: NodeJS.ReadableStream,
  mimeType: string,
): Promise<{ relativePath: string; absolutePath: string }> {
  const extension = EXTENSION_BY_MIME[mimeType] ?? "bin";
  const relativePath = datedRelativePath(extension);
  const absolutePath = join(env.mediaDir, relativePath);
  await fs.mkdir(dirname(absolutePath), { recursive: true });
  await pipeline(fileStream, createWriteStream(absolutePath));
  return { relativePath, absolutePath };
}

export async function generateImageThumbnail(
  absolutePath: string,
  relativePath: string,
): Promise<{ thumbnailRelativePath: string | null; width: number | null; height: number | null }> {
  try {
    const metadata = await sharp(absolutePath).metadata();
    const thumbnailRelativePath = relativePath.replace(/\.[^.]+$/, "") + ".thumb.webp";
    await sharp(absolutePath)
      .resize({ width: 400, withoutEnlargement: true })
      .webp()
      .toFile(join(env.mediaDir, thumbnailRelativePath));
    return { thumbnailRelativePath, width: metadata.width ?? null, height: metadata.height ?? null };
  } catch {
    return { thumbnailRelativePath: null, width: null, height: null };
  }
}

interface FfprobeData {
  streams: Array<{ width?: number; height?: number }>;
  format: { duration?: number };
}

export async function generateVideoThumbnail(
  absolutePath: string,
  relativePath: string,
): Promise<{ thumbnailRelativePath: string | null; width: number | null; height: number | null; durationSeconds: number | null }> {
  const thumbnailRelativePath = relativePath.replace(/\.[^.]+$/, "") + ".thumb.jpg";
  const thumbnailAbsolutePath = join(env.mediaDir, thumbnailRelativePath);
  const thumbnailFilename = thumbnailAbsolutePath.split(/[\\/]/).pop()!;
  const thumbnailDir = dirname(thumbnailAbsolutePath);

  try {
    const metadata = await new Promise<FfprobeData>((resolve, reject) => {
      ffmpeg.ffprobe(absolutePath, (err, data) => (err ? reject(err) : resolve(data as unknown as FfprobeData)));
    });
    const videoStream = metadata.streams.find((s) => s.width && s.height);
    const width = videoStream?.width ?? null;
    const height = videoStream?.height ?? null;
    const durationSeconds = metadata.format.duration ? Number(metadata.format.duration) : null;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(absolutePath)
        .screenshots({ timestamps: ["1"], filename: thumbnailFilename, folder: thumbnailDir, size: "400x?" })
        .on("end", () => resolve())
        .on("error", reject);
    });

    return { thumbnailRelativePath, width, height, durationSeconds };
  } catch {
    return { thumbnailRelativePath: null, width: null, height: null, durationSeconds: null };
  }
}
