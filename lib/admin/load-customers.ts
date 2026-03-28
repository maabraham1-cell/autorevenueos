import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminCustomerDetail, AdminCustomerListRow } from "@/lib/admin/customers-types";

function incMap(m: Map<string, number>, key: string) {
  m.set(key, (m.get(key) ?? 0) + 1);
}

/** Paginate `select('business_id')` and aggregate counts per business_id. */
async function countRowsByBusinessId(
  admin: SupabaseClient,
  table: "contacts" | "conversations" | "recoveries" | "confirmed_bookings",
  businessIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const id of businessIds) {
    counts.set(id, 0);
  }
  if (businessIds.length === 0) {
    return counts;
  }

  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from(table)
      .select("business_id")
      .in("business_id", businessIds)
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }
    const rows = data ?? [];
    if (rows.length === 0) {
      break;
    }
    for (const row of rows) {
      const bid = row.business_id as string | null;
      if (bid) {
        incMap(counts, bid);
      }
    }
    if (rows.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return counts;
}

async function buildEmailByBusinessId(
  admin: SupabaseClient,
  businessIds: string[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  for (const id of businessIds) {
    result.set(id, null);
  }
  if (businessIds.length === 0) {
    return result;
  }

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, business_id, created_at")
    .in("business_id", businessIds);

  if (error) {
    throw error;
  }

  const firstProfileIdByBusiness = new Map<string, string>();
  const sorted = [...(profiles ?? [])].sort(
    (a, b) =>
      new Date(a.created_at as string).getTime() -
      new Date(b.created_at as string).getTime(),
  );
  for (const p of sorted) {
    const bid = p.business_id as string | null;
    if (bid && !firstProfileIdByBusiness.has(bid)) {
      firstProfileIdByBusiness.set(bid, p.id as string);
    }
  }

  const emailByUserId = new Map<string, string>();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (listErr) {
      console.warn("[admin/customers] listUsers page", page, listErr.message);
      break;
    }
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email) {
        emailByUserId.set(u.id, u.email);
      }
    }
    if (users.length < perPage) {
      break;
    }
    page += 1;
  }

  for (const [bid, uid] of firstProfileIdByBusiness) {
    result.set(bid, emailByUserId.get(uid) ?? null);
  }

  return result;
}

async function loadAdminCustomersListFallback(
  admin: SupabaseClient,
): Promise<AdminCustomerListRow[]> {
  const { data: businesses, error: bizErr } = await admin
    .from("businesses")
    .select("id, name, business_mobile, twilio_phone_number, phone_number_mode, created_at")
    .order("created_at", { ascending: false });

  if (bizErr) {
    throw bizErr;
  }

  const list = businesses ?? [];
  const ids = list.map((b) => b.id as string);

  const [contacts, conversations, recoveries, bookings, emails] = await Promise.all([
    countRowsByBusinessId(admin, "contacts", ids),
    countRowsByBusinessId(admin, "conversations", ids),
    countRowsByBusinessId(admin, "recoveries", ids),
    countRowsByBusinessId(admin, "confirmed_bookings", ids),
    buildEmailByBusinessId(admin, ids),
  ]);

  return list.map((b) => {
    const id = b.id as string;
    const phone =
      (b.business_mobile as string | null) ??
      (b.twilio_phone_number as string | null) ??
      null;
    return {
      id,
      name: (b.name as string) ?? "",
      email: emails.get(id) ?? null,
      created_at: b.created_at as string,
      phone,
      phone_number_mode: (b as { phone_number_mode?: string }).phone_number_mode ?? "dedicated",
      contact_count: contacts.get(id) ?? 0,
      conversation_count: conversations.get(id) ?? 0,
      recovery_count: recoveries.get(id) ?? 0,
      confirmed_booking_count: bookings.get(id) ?? 0,
    };
  });
}

async function loadAdminCustomerDetailFallback(
  admin: SupabaseClient,
  businessId: string,
): Promise<AdminCustomerDetail | null> {
  const { data: business, error: bizErr } = await admin
    .from("businesses")
    .select(
      "id, name, business_mobile, twilio_phone_number, industry, activation_status, booking_link, phone_number_mode, twilio_pool_entry_id, created_at",
    )
    .eq("id", businessId)
    .maybeSingle();

  if (bizErr) {
    throw bizErr;
  }
  if (!business) {
    return null;
  }

  const [
    { count: contactCount },
    { count: conversationCount },
    { count: recoveryCount },
    { count: bookingCount },
  ] = await Promise.all([
    admin
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId),
    admin
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId),
    admin
      .from("recoveries")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId),
    admin
      .from("confirmed_bookings")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId),
  ]);

  const { data: profs } = await admin
    .from("profiles")
    .select("id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true })
    .limit(1);

  const uid = profs?.[0]?.id as string | undefined;
  let email: string | null = null;
  if (uid) {
    const { data: u, error: userErr } = await admin.auth.admin.getUserById(uid);
    if (!userErr && u.user?.email) {
      email = u.user.email;
    }
  }

  return {
    id: business.id as string,
    name: (business.name as string) ?? "",
    email,
    created_at: business.created_at as string,
    business_mobile: business.business_mobile as string | null,
    twilio_phone_number: business.twilio_phone_number as string | null,
    industry: business.industry as string | null,
    activation_status: business.activation_status as string | null,
    booking_link: business.booking_link as string | null,
    phone_number_mode: (business as { phone_number_mode?: string }).phone_number_mode ?? "dedicated",
    twilio_pool_entry_id: (business as { twilio_pool_entry_id?: string | null }).twilio_pool_entry_id ?? null,
    contact_count: contactCount ?? 0,
    conversation_count: conversationCount ?? 0,
    recovery_count: recoveryCount ?? 0,
    confirmed_booking_count: bookingCount ?? 0,
  };
}

export async function loadAdminCustomersList(
  admin: SupabaseClient,
): Promise<AdminCustomerListRow[]> {
  const { data, error } = await admin.rpc("admin_list_platform_businesses");

  if (!error && data != null) {
    const rows = data as AdminCustomerListRow[];
    return rows.map((r) => ({
      ...r,
      contact_count: Number(r.contact_count),
      conversation_count: Number(r.conversation_count),
      recovery_count: Number(r.recovery_count),
      confirmed_booking_count: Number(r.confirmed_booking_count),
    }));
  }

  if (error) {
    console.warn(
      "[admin/customers] admin_list_platform_businesses unavailable, using fallback:",
      error.message,
    );
  }

  return loadAdminCustomersListFallback(admin);
}

export async function loadAdminCustomerDetail(
  admin: SupabaseClient,
  businessId: string,
): Promise<AdminCustomerDetail | null> {
  const { data, error } = await admin.rpc("admin_get_platform_business", {
    p_business_id: businessId,
  });

  if (!error && data != null) {
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      return null;
    }
    const r = row as AdminCustomerDetail;
    return {
      ...r,
      contact_count: Number(r.contact_count),
      conversation_count: Number(r.conversation_count),
      recovery_count: Number(r.recovery_count),
      confirmed_booking_count: Number(r.confirmed_booking_count),
    };
  }

  if (error) {
    console.warn(
      "[admin/customers] admin_get_platform_business unavailable, using fallback:",
      error.message,
    );
  }

  return loadAdminCustomerDetailFallback(admin, businessId);
}
