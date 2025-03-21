import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

if (!process.env.ACCESS_KEY || !process.env.SECRET_KEY || !process.env.BUCKET_NAME || !process.env.ENDPOINT_URL) {
  throw new Error("환경 변수가 설정되지 않았습니다.");
}

// CloudFlare R2 클라이언트 설정
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
  },
});

export async function fetchMusic(author: string, title: string, eTag?: string) {
  try {
    const key = `${author}/${title}.webm`;
    const command = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      IfNoneMatch: eTag, // 클라이언트가 제공한 ETag와 일치하면 304 응답
    });

    const response = await s3.send(command);
    return {
      status: response.$metadata.httpStatusCode,
      body: Buffer.from(await response.Body!.transformToByteArray()),
      etag: response.ETag,
    };
  } catch (error: any) {
    return { status: error.$metadata?.httpStatusCode, errorMessage: error.message };
  }
}

export async function fetchThumbnail(author: string, title: string, eTag?: string) {
  try {
    const key = `${author}/${title}.webp`;
    const command = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      IfNoneMatch: eTag, // 클라이언트가 제공한 ETag와 일치하면 304 응답
    });

    const response = await s3.send(command);
    return {
      status: response.$metadata.httpStatusCode,
      body: Buffer.from(await response.Body!.transformToByteArray()),
      etag: response.ETag,
    };
  } catch (error: any) {
    return { status: error.$metadata?.httpStatusCode, errorMessage: error.message };
  }
}

export async function getMusicList() {
  try {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.BUCKET_NAME,
      })
    );

    const musicList = await Promise.all(
      (response.Contents || []).map(async (content) => {
        const key = content.Key;
        if (!key) return null;

        // author/title.webp 형식에서 분리
        const match = key.match(/^([^/]+)\/(.+)\.webp$/);
        if (!match) return null;
        const [, author, title] = match;

        // thumbnail에서 colorcode 조회
        const thumbnailHeadResponse = await s3.send(
          new HeadObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: key,
          })
        );
        const thumbnailColorcode = thumbnailHeadResponse.Metadata?.colorcode || null;

        // 음악 파일에서 emotion과 energy 값 조회
        const musicKey = `${author}/${title}.webm`;
        const musicHeadResponse = await s3.send(
          new HeadObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: musicKey,
          })
        );
        const musicValue = {
          emotion: +(musicHeadResponse.Metadata?.emotion || 0),
          energy: +(musicHeadResponse.Metadata?.energy || 0),
        };

        return { author, title, thumbnailColorcode, musicValue };
      })
    );

    return {
      status: response.$metadata.httpStatusCode,
      musicList: musicList.filter(Boolean),
    };
  } catch (error: any) {
    console.error("음악 파일 목록 가져오기 실패:", error);
    return { status: error.$metadata?.httpStatusCode || 500 };
  }
}
