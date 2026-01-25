import * as jose from "jose";
import { getConfig } from "../config.js";

export interface JwtPayload extends jose.JWTPayload {
  sub: string; // User ID
  username: string;
  avatar?: string | undefined;
}

function getSecret(): Uint8Array {
  const config = getConfig();
  return new TextEncoder().encode(config.JWT_SECRET);
}

function parseExpiry(expiresIn: string): string {
  // jose uses different format, convert common formats
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (match) {
    const value = match[1];
    const unit = match[2];
    switch (unit) {
      case "s":
        return `${value} seconds`;
      case "m":
        return `${value} minutes`;
      case "h":
        return `${value} hours`;
      case "d":
        return `${value} days`;
    }
  }
  return expiresIn;
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  const config = getConfig();
  const secret = getSecret();

  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(parseExpiry(config.JWT_EXPIRES_IN))
    .sign(secret);

  return jwt;
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  const secret = getSecret();

  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return {
      sub: payload.sub as string,
      username: payload.username as string,
      avatar: payload.avatar as string | undefined,
    };
  } catch {
    return null;
  }
}
