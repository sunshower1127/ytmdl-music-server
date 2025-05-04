import { VercelRequest, VercelResponse } from "@vercel/node";
import { getSignedMusicUrl } from "../s3-store";

export default async (request: VercelRequest, response: VercelResponse) => {
  // CORS 헤더 추가
  response.setHeader("Access-Control-Allow-Origin", "*"); // 모든 도메인 허용, 필요시 특정 도메인으로 제한
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

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

  // 서명된 URL 생성
  const { status, url, expiresIn, errorMessage } = await getSignedMusicUrl(artist, title);

  if (status === 200 && url) {
    // 서명된 URL로 리다이렉트
    return response.redirect(302, url);
  } else {
    return response.status(status).json({ error: errorMessage });
  }
};
