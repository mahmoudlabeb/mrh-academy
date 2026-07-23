import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
  it('can initialize safely when optional OAuth variables are empty', () => {
    const config = new ConfigService({
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      GOOGLE_CALLBACK_URL: '',
    });

    expect(() => new GoogleStrategy(config)).not.toThrow();
  });
});
