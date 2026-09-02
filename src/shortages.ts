import { createServerFn } from "@tanstack/react-start";
import { getShortageData } from "./shortages.server";

export type { ShortageAction, ShortageCell, ShortageData, ShortageHub, ShortageRow } from "./shortages.server";

export const getShortageDataFn = createServerFn({ method: "GET" }).handler(() => getShortageData());