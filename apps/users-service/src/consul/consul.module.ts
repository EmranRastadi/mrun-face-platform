import { Global, Module } from '@nestjs/common';
import { ConsulService } from './consul.service';

@Global()
@Module({
    providers: [ConsulService],
    exports: [ConsulService],
})
export class ConsulModule {}