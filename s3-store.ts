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

// 추가: RFC 2047 형식의 문자열을 디코딩하는 함수
function decodeMimeWord(word: string): string {
  // 단순한 RFC 2047 디코더 (utf-8, Q-인코딩만 지원)
  return word.replace(/=\?utf-8\?Q\?(.*?)\?=/gi, (_, encoded) => {
    return encoded
      .replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
      })
      .replace(/_/g, " ");
  });
}

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

export async function getMusicList() {
  try {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.BUCKET_NAME,
      })
    );

    const musicList = response.Contents?.map((content) => {
      const key = content.Key;
      if (!key) return;

      // author/title.webm 형식에서 분리
      const match = key.match(/^([^/]+)\/(.+)\.webm$/);
      if (match) {
        const [, author, title] = match;
        return { author, title };
      }
    });

    return {
      status: response.$metadata.httpStatusCode,
      musicList, // 계층화된 구조
    };
  } catch (error: any) {
    console.error("음악 파일 목록 가져오기 실패:", error);
    return { status: error.$metadata?.httpStatusCode || 500 };
  }
}

export async function getThumbnailData(author: string, title: string) {
  try {
    const key = `${author}/${title}.webm`;
    const command = new HeadObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
    });
    const response = await s3.send(command);

    const thumbnailMetadata = response.Metadata?.thumbnail;
    if (!thumbnailMetadata) {
      return { status: response.$metadata.httpStatusCode, thumbnail: null };
    }

    // RFC 2047 패턴이면 디코딩
    const decoded = thumbnailMetadata.startsWith("=?utf-8?Q?") ? decodeMimeWord(thumbnailMetadata) : thumbnailMetadata;

    const thumbnail = JSON.parse(decoded);
    thumbnail.url = thumbnail.url.replaceAll(" ", "");
    return {
      status: response.$metadata.httpStatusCode,
      thumbnail,
    };
  } catch (error: any) {
    console.error("썸네일 가져오기 실패:", error);
    return { status: error.$metadata?.httpStatusCode, errorMessage: error.message };
  }
}
