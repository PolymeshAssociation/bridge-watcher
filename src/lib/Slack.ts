import { Logger } from "winston";

import axios from "axios";

export class Slack {
  constructor(private hookURL: string, private logger: Logger) {}

  public post(text: string) {
    axios.post(this.hookURL, { text }).catch((err) => {
      this.logger.error(
        `could not post message to slack. Message: ${text}, Error: ${err}`
      );
    });
  }
}
