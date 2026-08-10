import { SetMetadata } from '@nestjs/common';
import { Permission } from '@prisma/client';

export const PERMISSIONS_KEY = 'permissions';

/** Declares which granular permissions are required to access an endpoint or controller. */
export const Permissions = (...permissions: (Permission | string)[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/** Alias for Permissions decorator for explicit RBAC requirements. */
export const RequirePermissions = (...permissions: (Permission | string)[]) => SetMetadata(PERMISSIONS_KEY, permissions);

