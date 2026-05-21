import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";

const s3Endpoint = process.env.S3_ENDPOINT || "";
const s3Region = process.env.S3_REGION || "auto";
const s3AccessKey = process.env.S3_ACCESS_KEY_ID || "";
const s3SecretKey = process.env.S3_SECRET_ACCESS_KEY || "";
const s3Bucket = process.env.S3_OUTPUT_BUCKET || "transmux-files";
const s3PublicUrlBase = process.env.S3_PUBLIC_URL || "";

export function isS3Configured(): boolean {
  return !!(s3Endpoint && s3AccessKey && s3SecretKey);
}

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: s3Endpoint,
      region: s3Region,
      credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
      forcePathStyle: true,
    });
  }
  return client;
}

export async function uploadToS3(
  key: string,
  filePath: string,
  contentType?: string
): Promise<void> {
  const body = fs.createReadStream(filePath);
  await s3().send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    })
  );
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: s3Bucket, Key: key }),
    { expiresIn }
  );
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3().send(
    new DeleteObjectCommand({ Bucket: s3Bucket, Key: key })
  );
}

export function publicUrl(key: string): string {
  if (s3PublicUrlBase) {
    return `${s3PublicUrlBase.replace(/\/+$/, "")}/${key}`;
  }
  return "";
}
