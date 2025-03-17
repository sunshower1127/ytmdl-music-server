import { VercelRequest, VercelResponse } from "@vercel/node";

export default async (request: VercelRequest, response: VercelResponse) => {
  try {
    request.body = JSON.parse(request.body);

    // 응답 반환
    response.status(200).json({
      success: true,
    });
  } catch (error) {
    response.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
