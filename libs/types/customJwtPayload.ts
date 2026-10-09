export interface CustomJwtPayload { sub: string; memberType: 'USER' | 'AGENT' | 'ADMIN'; memberNick: string; iat: number; exp: number }
