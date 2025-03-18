import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or missing token');
    }

    // Attach the user to the request
    const request = context.switchToHttp().getRequest();
    request.user = user;

    return user;
  }
}
