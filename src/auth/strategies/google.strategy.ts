import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'your_google_client_id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your_google_client_secret',
      callbackURL: 'http://localhost:8000/auth/google/callback', // We should dynamically get the host, but hardcoding for demo, adjust as needed in prod
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos, id } = profile;
    const user = {
      email: emails && emails.length > 0 ? emails[0].value : `${id}@google.com`,
      firstName: name?.givenName || profile.displayName || 'Google',
      lastName: name?.familyName || 'User',
      avatarUrl: photos && photos.length > 0 ? photos[0].value : null,
      providerId: id,
      provider: 'google',
    };
    done(null, user);
  }
}
