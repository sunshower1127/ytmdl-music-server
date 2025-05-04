import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export async function fetchMusic(artist: string, title: string, eTag?: string, range?: string) {
  try {
    const key = `${artist}/${title}.mp4`;

    const command = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      IfNoneMatch: eTag, // 클라이언트가 제공한 ETag와 일치하면 304 응답
      Range: range, // Range 요청 처리
    });

    const response = await s3.send(command);
    console.log("response", response);
    return {
      status: response.$metadata.httpStatusCode,
      body: Buffer.from(await response.Body!.transformToByteArray()),
      etag: response.ETag,
      length: response.ContentLength,
      range: response.ContentRange,
    };
  } catch (error: any) {
    return { status: error.$metadata?.httpStatusCode, errorMessage: error.message };
  }
}

export async function fetchThumbnail(artist: string, title: string, eTag?: string) {
  try {
    const key = `${artist}/${title}.webp`;
    const command = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      IfNoneMatch: eTag, // 클라이언트가 제공한 ETag와 일치하면 304 응답
    });

    const response = await s3.send(command);
    return {
      status: response.$metadata.httpStatusCode,
      body: response.Body!.transformToWebStream(),
      etag: response.ETag,
      length: response.ContentLength,
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

        // artist/title.mp4 형식에서 분리
        const match = key.match(/^([^/]+)\/(.+)\.mp4$/);
        if (!match) return null;
        const [, artist, title] = match;

        // mp4 파일에 대한 head 객체를 가져와 metadata 조회
        const headResponse = await s3.send(
          new HeadObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: key,
          })
        );
        let metadata: Record<string, any> = headResponse.Metadata || {};

        metadata = Object.fromEntries(
          Object.entries(metadata).map(([key, value]) => {
            // 스네이크 케이스를 카멜 케이스로 변환
            key = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

            const num = Number(value);
            return [key, isNaN(num) ? value : num];
          })
        );

        return { artist, title, metadata };
      })
    );
    return {
      status: response.$metadata.httpStatusCode,
      musicList: musicList.filter(Boolean),
    };
  } catch (error: any) {
    console.error("mp4 파일 목록 가져오기 실패:", error);
    return { status: error.$metadata?.httpStatusCode || 500 };
  }
}

/**
 * 음악 파일에 대한 서명된 URL을 생성합니다.
 * @param artist 아티스트 이름
 * @param title 곡 제목
 * @returns 서명된 URL 정보
 */
export async function getSignedMusicUrl(artist: string, title: string) {
  try {
    const key = `${artist}/${title}.mp4`;

    const command = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
    });

    // 최대 유효 기간 (7일)
    const expiresIn = 604800;

    const signedUrl = await getSignedUrl(s3, command, { expiresIn });

    return {
      status: 200,
      url: signedUrl,
      expiresIn,
    };
  } catch (error: any) {
    console.error("서명된 URL 생성 실패:", error);
    return {
      status: error.$metadata?.httpStatusCode || 500,
      errorMessage: error.message,
    };
  }
}

/**
 * 썸네일 이미지에 대한 서명된 URL을 생성합니다.
 * @param artist 아티스트 이름
 * @param title 곡 제목
 * @returns 서명된 URL 정보
 */
export async function getSignedThumbnailUrl(artist: string, title: string) {
  try {
    const key = `${artist}/${title}.webp`;

    const command = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
    });

    // 최대 유효 기간 (7일)
    const expiresIn = 604800;

    const signedUrl = await getSignedUrl(s3, command, { expiresIn });

    return {
      status: 200,
      url: signedUrl,
      expiresIn,
    };
  } catch (error: any) {
    console.error("서명된 URL 생성 실패:", error);
    return {
      status: error.$metadata?.httpStatusCode || 500,
      errorMessage: error.message,
    };
  }
}
