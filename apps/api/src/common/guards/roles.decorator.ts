import { SetMetadata } from '@nestjs/common';
import { Role } from '@petiatrics/types';

export const ROLES_KEY = 'roles';

/** Declares which roles are allowed to access an endpoint or controller. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
