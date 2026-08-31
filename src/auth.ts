import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  bootstrapMasterAdmin,
  createManagedUser,
  deleteManagedUser,
  getAuthState,
  listUsers,
  loginUser,
  logoutUser,
  updateManagedUser,
} from "./auth.server";
import type { AccessSection } from "./auth.server";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const bootstrapSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
});

const managedUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  panel: z.enum(["admin", "subhub"]),
  permissions: z.array(z.string()),
});

const updateUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  panel: z.enum(["admin", "subhub"]),
  permissions: z.array(z.string()),
  active: z.boolean(),
  password: z.string().max(200).optional(),
});

export const getAuthStateFn = createServerFn({ method: "GET" }).handler(() => getAuthState());

export const loginFn = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(({ data }) => loginUser(data.email, data.password));

export const bootstrapMasterAdminFn = createServerFn({ method: "POST" })
  .validator(bootstrapSchema)
  .handler(({ data }) => bootstrapMasterAdmin(data.name, data.email, data.password));

export const logoutFn = createServerFn({ method: "POST" }).handler(() => logoutUser());

export const listUsersFn = createServerFn({ method: "GET" }).handler(() => listUsers());

export const createManagedUserFn = createServerFn({ method: "POST" })
  .validator(managedUserSchema)
  .handler(({ data }) =>
    createManagedUser({
      ...data,
      permissions: data.permissions as AccessSection[],
    }),
  );

export const updateManagedUserFn = createServerFn({ method: "POST" })
  .validator(updateUserSchema)
  .handler(({ data }) =>
    updateManagedUser({
      ...data,
      permissions: data.permissions as AccessSection[],
    }),
  );

export const deleteManagedUserFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(({ data }) => deleteManagedUser(data.id));