import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor() {
    super({
      clientID: process.env.FACEBOOK_CLIENT_ID || 'your_facebook_client_id',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || 'your_facebook_client_secret',
      callbackURL: 'http://localhost:8000/auth/facebook/callback', // We should dynamically get the host, but hardcoding for demo, adjust as needed in prod
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: any,
  ): Promise<any> {
    const { name, emails, photos, id } = profile;
    const user = {
      email: emails ? emails[0].value : `${id}@facebook.com`,
      firstName: name?.givenName || profile.displayName || 'Facebook',
      lastName: name?.familyName || 'User',
      avatarUrl: photos ? photos[0].value : null,
      providerId: id,
      provider: 'facebook',
    };
    done(null, user);
  }
}
