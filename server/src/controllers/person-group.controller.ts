import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthDto } from 'src/dtos/auth.dto';
import {
  PersonGroupCreateDto,
  PersonGroupResponseDto,
  PersonGroupUpdateDto,
} from 'src/dtos/person-group.dto';
import { Auth, Authenticated } from 'src/middleware/auth.guard';
import { PersonGroupService } from 'src/services/person-group.service';
import { Permission } from 'src/enum';
import { UUIDParamDto } from 'src/validation';

@ApiTags('PersonGroup')
@Controller('person-groups')
export class PersonGroupController {
  constructor(private service: PersonGroupService) {}

  @Post()
  @Authenticated({ permission: Permission.PersonCreate })
  create(@Auth() auth: AuthDto, @Body() dto: PersonGroupCreateDto): Promise<PersonGroupResponseDto> {
    return this.service.create(auth, dto);
  }

  @Get()
  @Authenticated({ permission: Permission.PersonRead })
  getAll(@Auth() auth: AuthDto): Promise<PersonGroupResponseDto[]> {
    return this.service.getAll(auth);
  }

  @Get(':id')
  @Authenticated({ permission: Permission.PersonRead })
  getById(@Auth() auth: AuthDto, @Param() { id }: UUIDParamDto): Promise<PersonGroupResponseDto> {
    return this.service.getById(auth, id);
  }

  @Put(':id')
  @Authenticated({ permission: Permission.PersonUpdate })
  update(
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Body() dto: PersonGroupUpdateDto,
  ): Promise<PersonGroupResponseDto> {
    return this.service.update(auth, id, dto);
  }

  @Delete(':id')
  @Authenticated({ permission: Permission.PersonDelete })
  delete(@Auth() auth: AuthDto, @Param() { id }: UUIDParamDto): Promise<void> {
    return this.service.delete(auth, id);
  }
}
