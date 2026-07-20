import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

@Injectable()
export class TurnCredentialsService {
  constructor(private configService: ConfigService) {}

  async getIceServers(): Promise<IceServer[]> {
    const apiKey = this.configService.get<string>('METERED_API_KEY');
    const appName = this.configService.get<string>('METERED_APP_NAME');
    const response = await fetch(
      `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch TURN credentials: ${response.status}`);
    }
    return response.json();
  }
}
