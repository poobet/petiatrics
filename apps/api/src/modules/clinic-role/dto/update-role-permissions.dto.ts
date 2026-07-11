import { IsArray, IsString } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions!: string[]; // Array of action codes e.g. ["PATIENT:VIEW", "INVENTORY:ADD"]
}
