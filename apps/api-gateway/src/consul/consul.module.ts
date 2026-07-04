import {Module} from "@nestjs/common";
import {ConsulService} from "./consul.service";
import {AppConfigService} from "./config";
import {RegistrationService} from "./registration.service";

@Module({
    providers: [
        ConsulService,
        AppConfigService,
        RegistrationService,
    ],
    exports: [
        AppConfigService,
    ],
})
export class PlatformConfigModule {}