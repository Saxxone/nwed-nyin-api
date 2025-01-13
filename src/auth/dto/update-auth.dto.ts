import { PartialType } from '@nestjs/mapped-types';
import { SignInDto } from './sign-in.dto';

export class UpdateAuthDto extends PartialType(SignInDto) {}
