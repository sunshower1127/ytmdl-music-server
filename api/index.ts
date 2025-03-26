import { VercelRequest, VercelResponse } from "@vercel/node";
import { getMusicList } from "../s3-store";

export default async (request: VercelRequest, response: VercelResponse) => {
  // CORS 헤더 추가
  response.setHeader("Access-Control-Allow-Origin", "*"); // 모든 도메인 허용, 필요시 특정 도메인으로 제한
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, If-None-Match");

  // OPTIONS 요청 처리 (프리플라이트 요청)
  if (request.method === "OPTIONS") {
    return response.status(200).end();
  }

  const { status, musicList } = await getMusicList();

  if (status === 200) {
    response.status(200).send(musicList);
  } else if (status === 304) {
    response.status(304).end();
  } else {
    response.status(status).end();
  }
};
