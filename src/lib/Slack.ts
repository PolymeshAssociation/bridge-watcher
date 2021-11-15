import { Logger } from "winston";

import axios from "axios";
export interface ISlack {
  post(text: string): Promise<void>;
}
export class Slack {
  constructor(private hookURL: string, private username: string, private logger: Logger) {}

  public async post(text: string): Promise<void> {
    let message: string = this.username ? `${this.username}: ${text}` : text;
    this.logger.info(`Posting to slack ${message}`);
    await axios.post(this.hookURL, { text: message }).catch((err) => {
      this.logger.error(
        `could not post message to slack. Message: ${text}, Error: ${err}`
      );
    });
  }
}
