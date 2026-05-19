import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';

const PersonGroupCreateSchema = z
  .object({
    name: z.string().min(1),
    personIds: z.array(z.string().uuid()).default([]),
  })
  .meta({ id: 'PersonGroupCreateDto' });

export class PersonGroupCreateDto extends createZodDto(PersonGroupCreateSchema) {}

const PersonGroupUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    personIds: z.array(z.string().uuid()).optional(),
  })
  .meta({ id: 'PersonGroupUpdateDto' });

export class PersonGroupUpdateDto extends createZodDto(PersonGroupUpdateSchema) {}

export class PersonGroupResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [String] })
  personIds!: string[];
}
