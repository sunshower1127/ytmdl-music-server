import { VercelRequest, VercelResponse } from "@vercel/node";
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

  const { author, title } = request.query;
  if (!(author && typeof author === "string" && title && typeof title === "string")) {
    return response.status(400).json({
      error: "파라미터 오류",
      author,
      title,
    });
  }

  const { status, body, etag, errorMessage } = await fetchMusic(author, title, request.headers["if-none-match"]);
  // 응답 반환
  if (status === 200) {
    response.setHeader("ETag", etag!);
    response.setHeader("Content-Type", "audio/webm");
    response.setHeader("Cache-Control", "public, max-age=3600, immutable");
    response.status(200).send(body);
  } else if (status === 206) {
    response.setHeader("ETag", etag!);
    response.setHeader("Content-Type", "audio/webm");
    // 필요시 Content-Range 헤더 추가 가능
    response.status(206).send(body);
  } else if (status === 304) {
    response.status(304).end();
  } else {
    response.status(status).json({ error: errorMessage });
  }
};
