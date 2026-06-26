import { Body, Controller, Get, Post} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('/')
  async findAll() {
    return await this.tasksService.findAll();
  }


  @Post()
  async create(@Body() dto: CreateTaskDto) {
    return await this.tasksService.create(dto)
  }
}
