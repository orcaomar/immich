import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthDto } from 'src/dtos/auth.dto';
import {
  PersonGroupCreateDto,
  PersonGroupResponseDto,
  PersonGroupUpdateDto,
} from 'src/dtos/person-group.dto';
import { BaseService } from 'src/services/base.service';

@Injectable()
export class PersonGroupService extends BaseService {
  async create(auth: AuthDto, dto: PersonGroupCreateDto): Promise<PersonGroupResponseDto> {
    const group = await this.personGroupRepository.create({
      ownerId: auth.user.id,
      name: dto.name,
      personIds: dto.personIds,
    });
    return group as unknown as PersonGroupResponseDto;
  }

  async update(auth: AuthDto, id: string, dto: PersonGroupUpdateDto): Promise<PersonGroupResponseDto> {
    const group = await this.personGroupRepository.getById(id);
    if (!group || group.ownerId !== auth.user.id) {
      throw new NotFoundException('Person group not found');
    }

    const updated = await this.personGroupRepository.update(id, {
      name: dto.name,
      personIds: dto.personIds,
    });

    return updated as unknown as PersonGroupResponseDto;
  }

  async getAll(auth: AuthDto): Promise<PersonGroupResponseDto[]> {
    const groups = await this.personGroupRepository.getAllForUser(auth.user.id);
    return groups as unknown as PersonGroupResponseDto[];
  }

  async getById(auth: AuthDto, id: string): Promise<PersonGroupResponseDto> {
    const group = await this.personGroupRepository.getById(id);
    if (!group || group.ownerId !== auth.user.id) {
      throw new NotFoundException('Person group not found');
    }
    return group as unknown as PersonGroupResponseDto;
  }

  async delete(auth: AuthDto, id: string): Promise<void> {
    const group = await this.personGroupRepository.getById(id);
    if (!group || group.ownerId !== auth.user.id) {
      throw new NotFoundException('Person group not found');
    }
    await this.personGroupRepository.delete(id);
  }
}
