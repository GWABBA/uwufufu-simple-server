import { Request } from 'express';

export interface AuthRequest extends Request {
  user: UserFromToken;
}

export interface UserFromToken {
  userId: number;
  email: string;
}
