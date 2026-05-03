import { Role } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Safe subset of profile fields persisted on {@link prisma User}. */
export class SelfUpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  img?: string;

  /** Only admins may deactivate other accounts. */
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** Only {@link Role.ADMIN} callers may persist this field. */
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;
}
