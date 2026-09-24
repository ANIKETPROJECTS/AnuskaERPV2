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
  panel: z.enum(["admin", "subhub", "procurement"]).optional(),
});

const panelSchema = z.object({ panel: z.enum(["admin", "subhub", "procurement"]).optional() });

const bootstrapSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
});

const managedUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  panel: z.enum(["admin", "subhub", "procurement"]),
  subhubName: z.string().trim().max(120).optional(),
  permissions: z.array(z.string()),
});

const updateUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  panel: z.enum(["admin", "subhub", "procurement"]),
  subhubName: z.string().trim().max(120).optional(),
  permissions: z.array(z.string()),
  active: z.boolean(),
  password: z.string().max(200).optional(),
});

export const getAuthStateFn = createServerFn({ method: "GET" })
  .validator(panelSchema)
  .handler(({ data }) => getAuthState(data.panel));

export const loginFn = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(({ data }) => loginUser(data.email, data.password, data.panel));

export const bootstrapMasterAdminFn = createServerFn({ method: "POST" })
  .validator(bootstrapSchema)
  .handler(({ data }) => bootstrapMasterAdmin(data.name, data.email, data.password));

export const logoutFn = createServerFn({ method: "POST" })
  .validator(z.object({ panel: z.enum(["admin", "subhub", "procurement"]) }))
  .handler(({ data }) => logoutUser(data.panel));

export const listUsersFn = createServerFn({ method: "GET" }).handler(() => listUsers());

export const createManagedUserFn = createServerFn({ method: "POST" })
  .validator(managedUserSchema)
  .handler(({ data }) =>
    createManagedUser({
      ...data,
      subhubName: data.subhubName,
      permissions: data.permissions as AccessSection[],
    }),
  );

export const updateManagedUserFn = createServerFn({ method: "POST" })
  .validator(updateUserSchema)
  .handler(({ data }) =>
    updateManagedUser({
      ...data,
      subhubName: data.subhubName,
      permissions: data.permissions as AccessSection[],
    }),
  );

export const deleteManagedUserFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(({ data }) => deleteManagedUser(data.id));