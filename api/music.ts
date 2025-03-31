import { VercelRequest, VercelResponse } from "@vercel/node";
import { Readable } from "stream";
import { fetchMusic } from "../s3-store";

export default async (request: VercelRequest, response: VercelResponse) => {
  // CORS 헤더 추가
  response.setHeader("Access-Control-Allow-Origin", "*"); // 모든 도메인 허용, 필요시 특정 도메인으로 제한
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, If-None-Match");

  // OPTIONS 요청 처리 (프리플라이트 요청)
  if (request.method === "OPTIONS") {
    return response.status(200).end();
  }

  const { artist, title } = request.query;
  if (!(artist && typeof artist === "string" && title && typeof title === "string")) {
    return response.status(400).json({
      error: "파라미터 오류",
      artist,
      title,
    });
  }

  const { status, body, etag, errorMessage, length } = await fetchMusic(artist, title, request.headers["if-none-match"]);
  // 응답 반환
  if (status === 200 && body) {
    response.setHeader("ETag", etag!);
    response.setHeader("Content-Type", "audio/mp4");
    response.setHeader("Cache-Control", "public, max-age=2592000, immutable"); // 1달 캐싱
    response.setHeader("Content-Length", length!);

    const stream = Readable.fromWeb(body as any);
    stream.pipe(response);
  } else if (status === 304) {
    response.status(304).end();
  } else {
    response.status(status).json({ error: errorMessage });
  }
};
