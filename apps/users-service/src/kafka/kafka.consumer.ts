import { Controller } from "@nestjs/common";
import { EventPattern } from "@nestjs/microservices";
import { Topics } from "./topics";

@Controller()
export class UsersConsumer {

  @EventPattern(Topics.USER_CREATED)
  handleUserCreated(message: any) {
    console.log(
      'new user:',
      message
    );
  }
}