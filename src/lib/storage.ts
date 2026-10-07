import { getEnv } from "./env";

export const keyFor = (userId: string, jobId: string, name: string) => `u/${userId}/${jobId}/${name}`;

export async function putObject(key: string, bytes: Uint8Array | ArrayBuffer, contentType: string): Promise<void> {
  await getEnv().BUCKET.put(key, bytes, { httpMetadata: { contentType } });
}

export async function getObject(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const o = await getEnv().BUCKET.get(key);
  if (!o) return null;
  return { bytes: new Uint8Array(await o.arrayBuffer()), contentType: o.httpMetadata?.contentType ?? "application/octet-stream" };
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await getEnv().BUCKET.delete(keys);
}
